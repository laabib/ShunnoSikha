#!/usr/bin/env python3
"""USB gateway tests: all serial devices and HTTP requests are mocked."""

import contextlib
import io
import json
import sys
import unittest
import urllib.error
import urllib.request
from types import SimpleNamespace
from unittest.mock import Mock, patch

from shunnoshikha import serial_gateway as sg


PORT = "/dev/cu.mock-uno"
OTHER_PORT = "/dev/cu.mock-other"


def port_info(device=PORT):
    return SimpleNamespace(device=device, description="Mock USB board")


def frame(sensors, **metadata):
    return json.dumps({"sensors": sensors, **metadata}).encode("utf-8") + b"\n"


class SerialFailure(OSError):
    pass


class TestNormalization(unittest.TestCase):
    def test_all_canonical_scalars_and_units(self):
        values = dict(zip(sg.UNITS, (20.9, 0.5, 420, 22, 45, 0.03, 101.3, 7.5)))
        for packet in (values, {"sensors": values}):
            result = sg.normalize_packet(packet)
            self.assertEqual(set(result), set(sg.UNITS))
            for key, value in values.items():
                self.assertEqual(result[key], {
                    "value": value, "unit": sg.UNITS[key], "status": "normal",
                })

    def test_all_statuses_and_raw_adc_not_forwarded(self):
        for status in sg.STATUSES:
            with self.subTest(status=status):
                value = None if status in sg.UNAVAILABLE else 20.9
                result = sg.normalize_packet({"sensors": {"o2_pct": {
                    "value": value, "unit": "%", "status": status, "raw_adc": 512,
                }}})
                self.assertEqual(result, {"o2_pct": {
                    "value": value, "unit": "%", "status": status,
                }})

    def test_uncalibrated_reading_is_never_promoted_to_ppm(self):
        result = sg.normalize_packet({"co_ppm": {
            "value": 512, "status": "uncalibrated", "unit": "ppm", "raw_adc": 512,
        }})
        self.assertIsNone(result["co_ppm"]["value"])
        self.assertEqual(result["co_ppm"]["status"], "uncalibrated")

    def test_uno_reference_packet_omits_unmeasured_channels(self):
        sensors = {
            key: {"value": None, "unit": unit, "status": "uncalibrated", "raw_adc": raw}
            for key, unit, raw in (
                ("o2_pct", "%", 200), ("co_ppm", "ppm", 400),
                ("smoke_mgm3", "mg/m3", 600), ("airflow_cms", "cm/s", 800),
            )
        }
        result = sg.decode_line(frame(sensors))
        self.assertEqual(set(result), set(sensors))
        self.assertTrue(all(v["value"] is None for v in result.values()))
        self.assertTrue(all(v["status"] == "uncalibrated" for v in result.values()))
        self.assertFalse(set(result) & {"temp_C", "humidity_pct", "pressure_kpa", "co2_ppm"})

    def test_ascii_unit_spellings_are_equivalent(self):
        result = sg.normalize_packet({
            "temp_C": {"value": 22, "unit": "C"},
            "smoke_mgm3": {"value": 0.02, "unit": "mg/m3"},
        })
        self.assertEqual(result["temp_C"]["unit"], "°C")
        self.assertEqual(result["smoke_mgm3"]["unit"], "mg/m³")

    def test_legacy_conversion_and_no_invented_channels(self):
        result = sg.normalize_packet({
            "device_id": "untrusted-device", "timestamp": "old timestamp",
            "telemetry": {
                "o2_concentration_pct": 20.9, "airflow_velocity_cms": 7.5,
                "cabin_pressure_psi": 14.7, "cabin_temp_C": 22.5, "co_ppm": 0.4,
                "smoke_obscuration_pct_m": 0.9,
            },
        })
        self.assertEqual(result["pressure_kpa"]["value"], 14.7 * 6.894757293)
        self.assertEqual(result["pressure_kpa"]["unit"], "kPa")
        self.assertEqual(result["airflow_cms"]["value"], 7.5)
        self.assertEqual(result["o2_pct"]["value"], 20.9)
        self.assertEqual(result["temp_C"]["value"], 22.5)
        self.assertEqual(result["co_ppm"]["value"], 0.4)
        self.assertEqual(result["smoke_mgm3"], {
            "value": None, "unit": "mg/m³", "status": "missing",
        })
        self.assertNotIn("co2_ppm", result)
        self.assertNotIn("humidity_pct", result)
        minimal = sg.normalize_packet({"telemetry": {"co_ppm": 0}})
        self.assertEqual(set(minimal), {"co_ppm"})

    def test_legacy_pressure_object_and_unavailable_reading(self):
        for status, value in (("warning", 14.7), ("disconnected", None)):
            result = sg.normalize_packet({"telemetry": {"cabin_pressure_psi": {
                "value": value, "unit": "psi", "status": status,
            }}})
            self.assertEqual(result["pressure_kpa"]["status"], status)
            expected = None if value is None else value * sg.PSI_TO_KPA
            self.assertEqual(result["pressure_kpa"]["value"], expected)

    def test_unsupported_units_are_absent_not_relabelled(self):
        for key, unit in (("smoke_mgm3", "%/m"), ("pressure_kpa", "psi"),
                          ("temp_C", "F"), ("co_ppm", "ADC")):
            with self.subTest(key=key):
                result = sg.normalize_packet({key: {"value": 42, "unit": unit}})
                self.assertEqual(result[key], {
                    "value": None, "unit": sg.UNITS[key], "status": "missing",
                })

    def test_invalid_values_and_objects(self):
        invalid = [True, False, "21", None, [], float("nan"), float("inf"),
                   -float("inf"), 10 ** 400, {"value": True}, {"value": "21"},
                   {"value": None, "status": "normal"}, {"value": 1, "status": "online"},
                   {"value": 1, "status": []}, {"value": 1, "unit": []},
                   {"value": 1, "raw_adc": -1}, {"value": 1, "raw_adc": 1.5},
                   {"value": None, "status": "uncalibrated", "raw_adc": float("nan")},
                   {"status": "missing"}]
        for value in invalid:
            with self.subTest(value=value), self.assertRaises(sg.InvalidPacket):
                sg.normalize_packet({"o2_pct": value})

    def test_malformed_nonfinite_duplicate_and_non_utf8_frames(self):
        invalid = [b"booting", b"{", b"[]", b"null", b"\xff", b"{}",
                   b'{"sensors":[]}', b'{"sensors":{"co_ppm":1}} trailing',
                   b'{"co_ppm":NaN}', b'{"co_ppm":Infinity}', b'{"co_ppm":-Infinity}',
                   b'{"co_ppm":1e999}', b'{"co_ppm":1,"extra":NaN}',
                   b'{"co_ppm":1,"co_ppm":2}', b'[' * 2000,
                   b'{"sensors":{"co_ppm":1},"telemetry":{"co_ppm":2}}',
                   b'{"telemetry":{"pressure_kpa":1,"cabin_pressure_psi":2}}']
        for line in invalid:
            with self.subTest(line=line[:80]), self.assertRaises(sg.InvalidPacket):
                sg.decode_line(line)

    def test_pressure_conversion_overflow_rejected(self):
        with self.assertRaises(sg.InvalidPacket):
            sg.normalize_packet({"telemetry": {"cabin_pressure_psi": 1e308}})

    def test_unknown_channels_and_commands_are_not_forwarded(self):
        result = sg.decode_line(frame({"co_ppm": 0, "pump": 1},
                                     command="relay_on", sequence=500, source="cloud"))
        self.assertEqual(set(result), {"co_ppm"})
        with self.assertRaises(sg.InvalidPacket):
            sg.decode_line(b'{"command":"relay_on"}')


class TestFraming(unittest.TestCase):
    def test_fragments_timeouts_and_multiple_lines(self):
        framer = sg.LineFramer()
        line = frame({"temp_C": {"value": 23, "unit": "°C"}}).rstrip(b"\n")
        # One byte at a time also fragments multibyte UTF-8.
        line = line.replace(b"\\u00b0", "°".encode("utf-8"))
        output = []
        for byte in line:
            output.extend(framer.feed(bytes([byte])))
            self.assertEqual(list(framer.feed(b"")), [])
        self.assertEqual(output, [])
        output.extend(framer.feed(b"\r\n\n \n" + frame({"co_ppm": 2})))
        self.assertEqual(len(output), 2)
        self.assertEqual(sg.decode_line(output[0])["temp_C"]["value"], 23)
        self.assertEqual(sg.decode_line(output[1])["co_ppm"]["value"], 2)

    def test_exact_limit_accepted_and_direct_oversize_rejected(self):
        line = frame({"co_ppm": 1}).rstrip(b"\n")
        padded = line + b" " * (sg.MAX_LINE_BYTES - len(line))
        self.assertEqual(list(sg.LineFramer().feed(padded + b"\n")), [padded])
        self.assertEqual(sg.decode_line(padded)["co_ppm"]["value"], 1)
        with self.assertRaises(sg.InvalidPacket):
            sg.decode_line(padded + b" ")

    def test_oversize_discard_is_bounded_and_recovers_at_newline(self):
        framer = sg.LineFramer()
        notices = []
        for _ in range(100):
            notices.extend(framer.feed(b"x" * sg.READ_SIZE))
            self.assertLessEqual(len(framer.buffer), sg.MAX_LINE_BYTES)
        self.assertEqual(notices, [None])
        # A JSON-looking suffix on the same oversized line must not be accepted.
        good = frame({"co_ppm": 2}).rstrip(b"\n")
        result = list(framer.feed(good + b"\n" + good + b"\n"))
        self.assertEqual(result, [good])
        self.assertEqual(len(framer.buffer), 0)
        self.assertFalse(framer.discarding)


class TestLocalHTTP(unittest.TestCase):
    def test_loopback_only_origins(self):
        for url, expected in (
            ("http://127.0.0.1:8000", "http://127.0.0.1:8000"),
            ("http://localhost:8000/", "http://127.0.0.1:8000"),
            ("http://[::1]:8000", "http://[::1]:8000"),
            ("http://127.1.2.3", "http://127.1.2.3:80"),
        ):
            self.assertEqual(sg.validate_api_url(url), expected)
        invalid = ["https://127.0.0.1:8000", "file:///etc/passwd", "http://example.com",
                   "http://192.168.1.1", "http://0.0.0.0", "http://[::]", "http://127.1",
                   "http://localhost.example.com", "http://2130706433", "http://127.0.0.1:0",
                   "http://127.0.0.1:65536", "http://127.0.0.1:abc", "http://127.0.0.1:",
                   "http://user:secret@127.0.0.1:8000", "http://127.0.0.1/api",
                   "http://127.0.0.1?cloud=x", "http://127.0.0.1#x", "http://127.0.0.1?",
                   "http://[::1%lo0]:8000", "http://127.0.0.1\n", " http://127.0.0.1"]
        for url in invalid:
            with self.subTest(url=url), self.assertRaises(ValueError):
                sg.validate_api_url(url)

    def test_post_metadata_token_and_no_response_commands(self):
        response = Mock(status=200)
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        response.read.return_value = b'{"command":"pump_on"}'
        opener = Mock()
        opener.open.return_value = response
        with patch.object(sg.urllib.request, "build_opener", return_value=opener) as build:
            client = sg.LocalAPIClient(token="private-test-token")
        handlers = build.call_args.args
        self.assertIsInstance(handlers[0], urllib.request.ProxyHandler)
        self.assertEqual(handlers[0].proxies, {})
        self.assertIsInstance(handlers[1], sg._NoRedirect)
        payload = {"sensors": {"co_ppm": {"value": 0, "unit": "ppm", "status": "normal"}}}
        client.post("/api/sensors/ingest", payload)
        request = opener.open.call_args.args[0]
        self.assertEqual(request.full_url, "http://127.0.0.1:8000/api/sensors/ingest")
        self.assertEqual(request.get_method(), "POST")
        self.assertEqual(request.get_header("X-gateway-token"), "private-test-token")
        self.assertEqual(request.get_header("User-agent"), "ShunnoShikha-Serial-Gateway/1.0")
        self.assertEqual(json.loads(request.data), payload)
        self.assertNotIn(b"private-test-token", request.data)
        self.assertEqual(opener.open.call_args.kwargs["timeout"], 5.0)
        response.read.assert_not_called()
        response.__exit__.assert_called_once()

    def test_redirects_fail_closed_and_error_text_is_sanitized(self):
        handler = sg._NoRedirect()
        self.assertIsNone(handler.redirect_request(None, None, 302, "", {}, "https://cloud.example"))
        errors = [urllib.error.URLError("private-test-token"), OSError("private-test-token"),
                  urllib.error.HTTPError("https://cloud.example", 302, "private-test-token", {}, io.BytesIO())]
        client = sg.LocalAPIClient(token="private-test-token")
        for error in errors:
            with self.subTest(error=type(error).__name__):
                with patch.object(client._opener, "open", side_effect=error):
                    with self.assertRaises(sg.GatewayHTTPError) as caught:
                        client.post("/api/sensors/ingest", {})
                self.assertNotIn("private-test-token", str(caught.exception))
                self.assertNotIn("cloud.example", str(caught.exception))
        with self.assertRaises(ValueError):
            client.post("https://cloud.example", {})

    def test_token_is_optional_and_header_injection_rejected(self):
        response = Mock(status=204)
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        client = sg.LocalAPIClient()
        with patch.object(client._opener, "open", return_value=response) as opened:
            client.post("/api/sensors/gateway-error", {})
        self.assertIsNone(opened.call_args.args[0].get_header("X-gateway-token"))
        for token in ("secret\nInjected: header", "secret\r", "secret\x00", "é"):
            with self.assertRaises(ValueError) as caught:
                sg.LocalAPIClient(token=token)
            self.assertNotIn(token, str(caught.exception))


class TestGateway(unittest.TestCase):
    def make_gateway(self, connections=(), enumeration=None, client=None):
        serial = SimpleNamespace(Serial=Mock(side_effect=connections), SerialException=SerialFailure)
        enumeration = enumeration or Mock(return_value=[port_info()])
        self.stderr = io.StringIO()
        self.sleep = Mock()
        gateway = sg.Gateway(
            PORT, "Arduino Uno", "uno-test", client or Mock(), serial, enumeration,
            sleep=self.sleep, clock=lambda: 100.0, stderr=self.stderr,
        )
        return gateway, serial

    def ingests(self, gateway):
        return [call.args[1] for call in gateway.client.post.call_args_list
                if call.args[0] == "/api/sensors/ingest"]

    def test_sequence_order_metadata_and_no_serial_writes(self):
        connection = Mock()
        connection.read.side_effect = [b"boot\n", frame({"co_ppm": 1})[:10], b"",
                                       frame({"co_ppm": 1})[10:] + frame({"co_ppm": 2}, sequence=900),
                                       frame({"co_ppm": 3}, device_id="spoof", board="ESP32"),
                                       KeyboardInterrupt()]
        gateway, serial = self.make_gateway([connection])
        self.assertEqual(gateway.run(), 0)
        ingests = self.ingests(gateway)
        self.assertEqual([p["sequence"] for p in ingests], [1, 2, 3])
        self.assertEqual([p["sensors"]["co_ppm"]["value"] for p in ingests], [1, 2, 3])
        for payload in ingests:
            self.assertEqual(set(payload), {"board", "device_id", "source", "sensors", "sequence"})
            self.assertEqual(payload["board"], "Arduino Uno")
            self.assertEqual(payload["device_id"], "uno-test")
            self.assertEqual(payload["source"], "serial")
        serial.Serial.assert_called_once_with(port=PORT, baudrate=115200, timeout=1.0,
                                              xonxoff=False, rtscts=False, dsrdtr=False)
        connection.close.assert_called_once()
        connection.write.assert_not_called()
        connection.send_break.assert_not_called()
        self.assertTrue(all(call.args == (sg.READ_SIZE,) for call in connection.read.call_args_list))
        other, _ = self.make_gateway()
        other.process_line(frame({"co_ppm": 4}))
        self.assertEqual(self.ingests(other)[0]["sequence"], 1)

    def test_disconnect_reenumerates_only_selected_port_and_drops_fragment(self):
        first, second = Mock(), Mock()
        first.read.side_effect = [frame({"co_ppm": 1}) + b'{"sensors":', SerialFailure("disconnected")]
        second.read.side_effect = [frame({"co_ppm": 2}), KeyboardInterrupt()]
        enumeration = Mock(side_effect=[[port_info(), port_info(OTHER_PORT)],
                                        [port_info(OTHER_PORT)], [port_info()]])
        gateway, serial = self.make_gateway([first, second], enumeration)
        gateway.run()
        self.assertEqual(enumeration.call_count, 3)
        self.assertEqual([c.kwargs["port"] for c in serial.Serial.call_args_list], [PORT, PORT])
        self.assertEqual([p["sequence"] for p in self.ingests(gateway)], [1, 2])
        self.assertEqual([c.args[0] for c in self.sleep.call_args_list], [1.0, 2.0])
        first.close.assert_called_once()
        second.close.assert_called_once()
        first.write.assert_not_called()
        second.write.assert_not_called()

    def test_open_and_enumeration_errors_back_off_and_interrupt_cleanly(self):
        enumeration = Mock(side_effect=[OSError("enumeration failed"), [port_info()], [port_info()]])
        gateway, serial = self.make_gateway([SerialFailure("open failed"), KeyboardInterrupt()], enumeration)
        self.assertEqual(gateway.run(), 0)
        self.assertEqual([c.args[0] for c in self.sleep.call_args_list], [1.0, 2.0])
        self.assertEqual(serial.Serial.call_count, 2)
        self.assertEqual(len(self.stderr.getvalue().splitlines()), 1)

    def test_missing_port_never_opens_any_path(self):
        gateway, serial = self.make_gateway(enumeration=Mock(return_value=[port_info(OTHER_PORT)]))
        self.sleep.side_effect = KeyboardInterrupt()
        self.assertEqual(gateway.run(), 0)
        serial.Serial.assert_not_called()

    def test_http_failure_reports_then_backs_off_without_recursive_logs(self):
        calls = []
        client = Mock()

        def post(path, payload):
            calls.append((path, payload))
            raise sg.GatewayHTTPError("private-test-token")

        client.post.side_effect = post
        gateway, _ = self.make_gateway(client=client)
        for value in range(8):
            gateway.process_line(frame({"co_ppm": value}))
        self.assertEqual(calls[0][0], "/api/sensors/ingest")
        self.assertEqual(calls[1], ("/api/sensors/gateway-error", {
            "message": "Local API ingest failed; frame not replayed; backing off.",
            "board": "Arduino Uno", "device_id": "uno-test",
        }))
        self.assertEqual([c.args[0] for c in self.sleep.call_args_list], [1, 2, 4, 8, 16, 30, 30, 30])
        self.assertEqual([p["sequence"] for p in self.ingests(gateway)], list(range(1, 9)))
        self.assertEqual(len([c for c in calls if c[0].endswith("gateway-error")]), 1)
        self.assertEqual(len(self.stderr.getvalue().splitlines()), 1)
        self.assertNotIn("private-test-token", self.stderr.getvalue())
        client.post.side_effect = None
        gateway.process_line(frame({"co_ppm": 9}))
        self.assertEqual(gateway._http_backoff.delay, 1)

    def test_malformed_frames_rate_limited_and_sequence_not_consumed(self):
        gateway, _ = self.make_gateway()
        for _ in range(10):
            gateway.process_line(b'{"co_ppm":NaN,"secret":"private-test-token"}')
        self.assertEqual(gateway.sequence, 0)
        gateway.client.post.assert_called_once()
        self.assertNotIn("private-test-token", self.stderr.getvalue())
        gateway.clock = lambda: 131.0
        gateway.process_line(b"malformed")
        self.assertEqual(gateway.client.post.call_count, 2)
        gateway.process_line(frame({"co_ppm": 0}))
        self.assertEqual(self.ingests(gateway)[0]["sequence"], 1)

    def test_oversized_and_command_frames_do_not_trigger_outputs(self):
        connection = Mock()
        connection.read.side_effect = [b"x" * sg.READ_SIZE] * 9 + [
            b'\n{"command":"relay_on"}\n' + frame({"co_ppm": 1}, command="pump_on"),
            KeyboardInterrupt(),
        ]
        client = Mock()
        client.post.return_value = {"command": "activate_pump"}
        gateway, _ = self.make_gateway([connection], client=client)
        gateway.run()
        self.assertEqual(len(self.ingests(gateway)), 1)
        self.assertNotIn("command", self.ingests(gateway)[0])
        connection.write.assert_not_called()
        self.assertTrue(all(c[0] in ("read", "close") for c in connection.method_calls))

    def test_ctrl_c_during_http_backoff_closes_serial(self):
        connection = Mock()
        connection.read.return_value = frame({"co_ppm": 1})
        client = Mock()
        client.post.side_effect = sg.GatewayHTTPError("unavailable")
        gateway, _ = self.make_gateway([connection], client=client)
        self.sleep.side_effect = KeyboardInterrupt()
        self.assertEqual(gateway.run(), 0)
        connection.close.assert_called_once()


class TestCLI(unittest.TestCase):
    def test_help_does_not_import_pyserial(self):
        with patch.object(sg, "load_pyserial") as load, contextlib.redirect_stdout(io.StringIO()) as output:
            with self.assertRaises(SystemExit) as caught:
                sg.main(["--help"])
        self.assertEqual(caught.exception.code, 0)
        load.assert_not_called()
        for text in ("A0 oxygen", "A1 CO", "A2 smoke", "A3 airflow", "D2", "A4/A5", "calibration"):
            self.assertIn(text, " ".join(output.getvalue().split()))

    def test_missing_pyserial_helpful_and_lazy(self):
        with patch.dict(sys.modules, {"serial": None, "serial.tools": None}):
            with self.assertRaisesRegex(RuntimeError, "pip install pyserial"):
                sg.load_pyserial()
        with patch.object(sg, "load_pyserial", side_effect=RuntimeError("pip install pyserial")):
            with contextlib.redirect_stderr(io.StringIO()) as output:
                self.assertEqual(sg.main(["--list"]), 2)
        self.assertIn("pip install pyserial", output.getvalue())

    def test_list_actual_ports_without_opening(self):
        serial = Mock()
        with patch.object(sg, "load_pyserial", return_value=(serial, lambda: [port_info()])):
            with contextlib.redirect_stdout(io.StringIO()) as output:
                self.assertEqual(sg.main(["--list"]), 0)
        self.assertIn(PORT, output.getvalue())
        serial.Serial.assert_not_called()

    def test_port_required_and_unenumerated_paths_rejected(self):
        serial = Mock()
        for args in ([], ["--port", "/etc/passwd"], ["--port", "socket://127.0.0.1:8000"]):
            with self.subTest(args=args):
                with patch.object(sg, "load_pyserial", return_value=(serial, lambda: [port_info()])):
                    with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit) as caught:
                        sg.main(args)
                self.assertEqual(caught.exception.code, 2)
        serial.Serial.assert_not_called()

    def test_cli_selected_board_baud_id_and_token(self):
        for board in sg.BOARDS:
            serial, ports = Mock(), Mock(return_value=[port_info()])
            with patch.object(sg, "load_pyserial", return_value=(serial, ports)), \
                    patch.object(sg, "Gateway") as gateway_type, \
                    patch.object(sg, "LocalAPIClient") as client_type, \
                    patch.dict(sg.os.environ, {"SHUNNO_GATEWAY_TOKEN": "private-test-token"}):
                gateway_type.return_value.run.return_value = 0
                self.assertEqual(sg.main(["--port", PORT, "--board", board,
                                          "--baud", "57600", "--device-id", "custom-node"]), 0)
                client_type.assert_called_once_with("http://127.0.0.1:8000", token="private-test-token")
                gateway_type.assert_called_once_with(PORT, board, "custom-node",
                                                      client_type.return_value, serial, ports)
                gateway_type.return_value.run.assert_called_once_with(57600)

    def test_invalid_config_never_opens_device(self):
        for args in (["--baud", "0"], ["--board", "Uno"], ["--api-url", "https://cloud.example"],
                     ["--device-id", "bad\nnode"]):
            with patch.object(sg, "load_pyserial") as load:
                with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit) as caught:
                    sg.main(["--port", PORT] + args)
                self.assertEqual(caught.exception.code, 2)
                load.assert_not_called()


if __name__ == "__main__":
    unittest.main()
