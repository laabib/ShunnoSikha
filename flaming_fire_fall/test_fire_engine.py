#!/usr/bin/env python3
"""Unit tests for the Module 9 fire emergency simulation engine (deterministic, synthetic)."""

import unittest
import json

from shunnoshikha.fire_emergency import (
    FireSimulationEngine, FIRE_TYPES, COMPARTMENTS, ADJACENCY,
    build_ai_assessment, DEFAULT_THRESHOLDS,
)

CFG = {"ignition": "USLAB", "fire_type": "electrical", "initial_intensity": 0.5,
       "o2_pct": 21.0, "ventilation_cms": 10.0}


def run_sim(cfg=None, ticks=240):
    e = FireSimulationEngine()
    e.configure(cfg or CFG)
    e.start()
    for _ in range(ticks):
        e.advance(0.5)
    return e


class TestFireEngine(unittest.TestCase):
    def test_01_reset_nominal(self):
        e = FireSimulationEngine()
        s = e.state()
        self.assertEqual(s["status"], "idle")
        self.assertEqual(s["severity"], "Normal")
        self.assertEqual(s["crew"]["status"], "SAFE")
        self.assertEqual(s["data_source"], "SIMULATION")
        self.assertTrue(all(not c["on_fire"] for c in s["compartments"].values()))

    def test_02_determinism(self):
        a, b = run_sim(), run_sim()
        self.assertEqual(json.dumps(a.state()["history"]), json.dumps(b.state()["history"]))
        self.assertEqual(a.state()["fire"]["burning"], b.state()["fire"]["burning"])

    def test_03_ignition_and_detection(self):
        e = run_sim(ticks=40)
        s = e.state()
        self.assertIn("USLAB", s["fire"]["burning"])
        self.assertEqual(s["ignition_time"], 0.0)
        self.assertIsNotNone(s["detection_time"])
        self.assertTrue(any(ev["type"] == "fire_detected" for ev in s["events"]))

    def test_04_spread_to_adjacent(self):
        e = run_sim(ticks=240)
        burning = set(e.state()["fire"]["burning"])
        self.assertGreater(len(burning), 1)
        self.assertTrue(any(ev["type"] == "fire_spread" for ev in e.state()["events"]))
        for cid in burning:
            self.assertIn(cid, ADJACENCY)

    def test_05_pause_resume(self):
        e = FireSimulationEngine(); e.configure(CFG); e.start()
        e.advance(2.0)
        e.pause()
        t = e.state()["sim_time"]
        e.advance(5.0)
        self.assertEqual(e.state()["sim_time"], t)
        self.assertEqual(e.state()["status"], "paused")
        e.start()
        e.advance(2.0)
        self.assertGreater(e.state()["sim_time"], t)

    def test_06_speed_multiplier(self):
        e1 = FireSimulationEngine(); e1.configure({**CFG, "speed": 1}); e1.start(); e1.advance(2.0)
        e5 = FireSimulationEngine(); e5.configure({**CFG, "speed": 5}); e5.start(); e5.advance(2.0)
        self.assertAlmostEqual(e5.state()["sim_time"], e1.state()["sim_time"] * 5, delta=0.3)

    def test_07_water_gating(self):
        for ft in ["electrical", "lithium_battery", "flammable_liquid"]:
            e = FireSimulationEngine()
            e.configure({**CFG, "fire_type": ft, "water_approved": True, "equipment_deenergized": True})
            e.start()
            with self.assertRaises(ValueError):
                e.activate_suppression("activate_water", confirmed=True)
        # Compatible fire type still requires explicit procedure approval and de-energization.
        e = FireSimulationEngine(); e.configure({**CFG, "fire_type": "equipment_material"}); e.start()
        with self.assertRaises(ValueError):
            e.activate_suppression("activate_water", confirmed=True)
        e = FireSimulationEngine()
        e.configure({**CFG, "fire_type": "equipment_material", "water_approved": True, "equipment_deenergized": True})
        e.start()
        e.activate_suppression("activate_water", confirmed=True)
        self.assertTrue(e.state()["suppression"]["active"])
        # Oxygen-enriched fire also requires oxygen isolation before water.
        e_ox = FireSimulationEngine()
        e_ox.configure({**CFG, "fire_type": "oxygen_enriched", "water_approved": True, "equipment_deenergized": True})
        e_ox.start()
        with self.assertRaises(ValueError):
            e_ox.activate_suppression("activate_water", confirmed=True)
        e_ox.activate_suppression("isolate_oxygen", confirmed=True)
        e_ox.activate_suppression("activate_water", confirmed=True)
        self.assertTrue(e_ox.state()["suppression"]["active"])

    def test_08_confirmation_required(self):
        e = FireSimulationEngine(); e.configure(CFG); e.start()
        with self.assertRaises(ValueError):
            e.activate_suppression("activate_suppressant", confirmed=False)
        e.activate_suppression("activate_suppressant", confirmed=True)
        self.assertTrue(any(ev["type"] == "suppression_activation" for ev in e.state()["events"]))

    def test_09_suppression_extinguishes(self):
        e = run_sim(ticks=60)
        e.activate_suppression("activate_suppressant", confirmed=True)
        for _ in range(800):
            e.advance(0.5)
        s = e.state()
        self.assertEqual(s["status"], "extinguished")
        self.assertEqual(s["fire"]["burning"], [])
        self.assertIsNotNone(s["extinguish_time"])

    def test_10_threshold_violations_and_crew(self):
        e = run_sim(ticks=240)
        s = e.state()
        self.assertTrue(any(ev["type"] == "threshold_violation" for ev in s["events"]))
        self.assertIn(s["crew"]["status"], ["CAUTION", "DANGER", "CRITICAL"])
        self.assertTrue(any(ev["type"] == "crew_status_change" for ev in s["events"]))

    def test_11_config_validation(self):
        e = FireSimulationEngine()
        s = e.configure({"ignition": "NOPE", "fire_type": "NOPE", "initial_intensity": 99, "o2_pct": 99})
        self.assertIn(s["config"]["ignition"], ADJACENCY)
        self.assertIn(s["config"]["fire_type"], FIRE_TYPES)
        self.assertLessEqual(s["config"]["initial_intensity"], 1.0)
        self.assertLessEqual(s["config"]["o2_pct"], 40.0)
        e.start()
        with self.assertRaises(ValueError):
            e.configure({"fire_type": "electrical"})

    def test_12_thresholds_configurable(self):
        e = FireSimulationEngine()
        e.thresholds["co_ppm"]["crit"][1] = 5.0
        e.configure(CFG); e.start()
        for _ in range(60):
            e.advance(0.5)
        self.assertEqual(e.state()["crew"]["species_status"]["co_ppm"], "CRITICAL")

    def test_13_report_sections(self):
        e = run_sim(ticks=60)
        e.activate_suppression("emergency_isolation", confirmed=True)
        rep = e.build_report()
        for section in ["Incident Overview", "Fire Classification", "Fire Spread Timeline",
                        "Environmental Changes", "Suppression Actions", "Crew Survival Assessment",
                        "AI Recommendations", "Full Event Log"]:
            self.assertIn(section, rep["markdown"])
        self.assertIn("json", rep)

    def test_14_ai_assessment_structure(self):
        e = run_sim(ticks=40)
        a = build_ai_assessment(e.state(), brain=None)
        for key in ["situation_summary", "fire_severity", "environmental_risk",
                    "recommended_response", "crew_recommendations", "spread_scenario", "rationale"]:
            self.assertIn(key, a)
        self.assertEqual(a["data_source"], "SIMULATION")

    def test_15_layout_connected(self):
        ids = {c["id"] for c in COMPARTMENTS}
        for cid, nbrs in ADJACENCY.items():
            self.assertIn(cid, ids)
            for n in nbrs:
                self.assertIn(n, ids)
                self.assertIn(cid, ADJACENCY[n])


if __name__ == "__main__":
    unittest.main()