#!/usr/bin/env python3
"""Integration and synchronization tests for SensorDataService, sensor_api, and serial_gateway."""

import os
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from shunnoshikha import serial_gateway as sg
from shunnoshikha.backend_api import app
from shunnoshikha.fire_emergency import FireSimulationEngine
from shunnoshikha.sensor_api import make_sensor_router
from shunnoshikha.sensor_service import SensorDataService


class FakeClock:
    def __init__(self, start=100.0):
        self.t = start

    def __call__(self):
        return self.t

    def advance(self, dt):
        self.t += dt


class TestSensorServiceSync(unittest.TestCase):
    def test_01_centralized_simulation_sync_across_views(self):
        clock = FakeClock()
        svc = SensorDataService(FireSimulationEngine(), clock=clock)
        snap = svc.patch_environment({"o2_pct": 16.5, "co_ppm": 65.0, "temp_C": 47.0})

        self.assertEqual(snap["mode"], "simulation")
        self.assertEqual(snap["data_source"], "SIMULATION")
        self.assertEqual(snap["sensors"]["o2_pct"]["value"], 16.5)
        self.assertEqual(snap["fire_state"]["atmosphere"]["o2_pct"], 16.5)
        self.assertEqual(snap["telemetry_frame"] if "telemetry_frame" in snap else svc.telemetry_frame()["telemetry"]["o2_concentration_pct"], 16.5)
        self.assertEqual(snap["crew"]["status"], "CRITICAL")
        self.assertEqual(snap["fire_state"]["crew"]["status"], "CRITICAL")
        self.assertEqual(snap["sensors"]["co_ppm"]["status"], "critical")
        self.assertEqual(snap["sensors"]["temp_C"]["status"], "critical")
        self.assertIn("co2", snap["crew"]["risks"])
        self.assertIn("humidity", snap["crew"]["risks"])
        self.assertIn("pressure", snap["crew"]["risks"])

    def test_02_live_mode_never_fabricates_readings_and_marks_stale(self):
        clock = FakeClock(10.0)
        svc = SensorDataService(FireSimulationEngine(), clock=clock)
        snap = svc.set_mode("live")
        self.assertEqual(snap["mode"], "live")
        self.assertEqual(snap["data_source"], "LIVE_HARDWARE")
        self.assertFalse(snap["hardware"]["connected"])
        self.assertEqual(snap["hardware"]["status"], "disconnected")
        self.assertTrue(all(r["value"] is None for r in snap["sensors"].values()))
        self.assertEqual(snap["crew"]["status"], "UNKNOWN")

        # Ingest normalized output directly from serial_gateway (including °C & mg/m³)
        raw_line = (
            b'{"sensors":{"o2_pct":{"value":20.8,"unit":"%"},'
            b'"temp_C":{"value":24.2,"unit":"C"},'
            b'"smoke_mgm3":{"value":0.05,"unit":"mg/m3"},'
            b'"co_ppm":{"value":null,"unit":"ppm","status":"uncalibrated"}}}'
        )
        normalized = sg.decode_line(raw_line)
        res = svc.ingest({
            "board": "Arduino Uno",
            "device_id": "uno-lab-1",
            "source": "serial",
            "sequence": 1,
            "sensors": normalized,
        })
        self.assertTrue(res["accepted"])
        snap2 = svc.snapshot()
        self.assertTrue(snap2["hardware"]["connected"])
        self.assertEqual(snap2["sensors"]["o2_pct"]["value"], 20.8)
        self.assertEqual(snap2["sensors"]["temp_C"]["value"], 24.2)
        self.assertEqual(snap2["sensors"]["smoke_mgm3"]["value"], 0.05)
        self.assertIsNone(snap2["sensors"]["co_ppm"]["value"])
        self.assertEqual(snap2["sensors"]["co_ppm"]["status"], "uncalibrated")
        self.assertIsNone(snap2["sensors"]["co2_ppm"]["value"])
        self.assertEqual(snap2["sensors"]["co2_ppm"]["status"], "missing")

        # Advancing past STALE_AFTER_SECONDS withholds readings cleanly
        clock.advance(6.5)
        svc.advance(0.5)
        stale_snap = svc.snapshot()
        self.assertFalse(stale_snap["hardware"]["connected"])
        self.assertEqual(stale_snap["hardware"]["status"], "stale")
        self.assertTrue(all(r["value"] is None for r in stale_snap["sensors"].values()))

    def test_03_live_mode_locks_simulation_and_suppression_actuation(self):
        svc = SensorDataService(FireSimulationEngine())
        svc.set_mode("live")
        with self.assertRaises(ValueError):
            svc.patch_environment({"o2_pct": 18.0})
        with self.assertRaises(ValueError):
            svc.fire_action("start")
        with self.assertRaises(ValueError):
            svc.suppress("activate_suppressant", True)
        snap = svc.snapshot()
        self.assertTrue(any(e["type"] == "command_blocked" for e in snap["fire_state"]["events"]))

    def test_04_presentation_presets_and_scripted_suppression(self):
        svc = SensorDataService(FireSimulationEngine())
        with self.assertRaises(ValueError):
            svc.select_preset("suppression", confirmed=False)
        snap = svc.select_preset("suppression", confirmed=True)
        self.assertEqual(snap["presentation"]["scenario"], "suppression")
        svc.presentation_action("start")
        for _ in range(40):
            svc.advance(0.5)
        mid = svc.snapshot()
        self.assertTrue(mid["fire_state"]["suppression"]["active"])
        crit_snap = svc.select_preset("critical")
        self.assertEqual(crit_snap["crew"]["status"], "CRITICAL")

    def test_05_ai_assessment_and_report_respect_mode_and_source(self):
        svc = SensorDataService(FireSimulationEngine())
        svc.select_preset("electrical")
        svc.presentation_action("start")
        for _ in range(10):
            svc.advance(0.5)
        sim_ai = svc.assess(brain=None)
        self.assertEqual(sim_ai["data_source"], "SIMULATION")
        sim_rep = svc.report()
        self.assertIn("Crew Survival Assessment", sim_rep["markdown"])

        svc.set_mode("live")
        live_ai = svc.assess(brain=None)
        self.assertEqual(live_ai["data_source"], "LIVE_HARDWARE")
        self.assertIn("Missing/uncalibrated", live_ai["situation_summary"])
        live_rep = svc.report()
        self.assertIn("LIVE_HARDWARE", live_rep["markdown"])


class TestSensorAPIGatewayCompat(unittest.TestCase):
    def test_01_gateway_token_and_unit_roundtrip_and_limits_compat(self):
        from fastapi import FastAPI
        test_app = FastAPI()
        svc = SensorDataService(FireSimulationEngine())
        test_app.include_router(make_sensor_router(svc))

        with patch.dict(os.environ, {"SHUNNO_GATEWAY_TOKEN": "gw-secret-123"}), TestClient(test_app, client=("192.168.1.5", 50000)) as non_local:
            r_remote = non_local.post("/api/sensors/ingest", json={"board": "Arduino Uno", "device_id": "u1", "source": "serial", "sequence": 1, "sensors": {"o2_pct": {"value": 21, "unit": "%"}}})
            self.assertEqual(r_remote.status_code, 403)

        with patch.dict(os.environ, {"SHUNNO_GATEWAY_TOKEN": "gw-secret-123"}), TestClient(test_app, client=("127.0.0.1", 50000)) as client:
            # Switch to live mode
            r = client.post("/api/sensors/mode", json={"mode": "live"})
            self.assertEqual(r.status_code, 200)

            # Gateway token header accepted (both X-Gateway-Token and Bearer)
            bad = client.post("/api/sensors/ingest", json={"board": "Arduino Uno", "device_id": "u1", "source": "serial", "sequence": 1, "sensors": {"o2_pct": {"value": 21, "unit": "%"}}})
            self.assertEqual(bad.status_code, 401)

            good_pkt = {
                "board": "Arduino Uno",
                "device_id": "u1",
                "source": "serial",
                "sequence": 1,
                "sensors": sg.decode_line(b'{"sensors":{"o2_pct":20.9,"temp_C":{"value":23.4,"unit":"C"},"smoke_mgm3":{"value":0.04,"unit":"mg/m3"}}}'),
            }
            ok = client.post("/api/sensors/ingest", json=good_pkt, headers={"X-Gateway-Token": "gw-secret-123"})
            self.assertEqual(ok.status_code, 200, ok.text)
            st = client.get("/api/sensors/state").json()
            self.assertEqual(st["sensors"]["temp_C"]["value"], 23.4)
            self.assertEqual(st["sensors"]["smoke_mgm3"]["value"], 0.04)

            # Early-warning compatibility endpoints
            lim = client.get("/api/early-warning/limits").json()
            self.assertIn("co_caution_ppm", lim["limits"])
            self.assertIn("o2_pct", lim["thresholds"])

            # Switch back to simulation for HVAC confirmation test
            client.post("/api/sensors/mode", json={"mode": "simulation"})
            hvac_unconf = client.post("/api/early-warning/hvac-suppress", json={"action_code": "ACTION_ISOLATE_VENTILATION"})
            self.assertEqual(hvac_unconf.status_code, 400)
            hvac_conf = client.post("/api/early-warning/hvac-suppress", json={"action_code": "ACTION_ISOLATE_VENTILATION", "confirmed": True})
            self.assertEqual(hvac_conf.status_code, 200)
            self.assertEqual(hvac_conf.json()["action_executed"], "ACTION_ISOLATE_VENTILATION")
            self.assertIn("confirmation", hvac_conf.json())


if __name__ == "__main__":
    unittest.main()
