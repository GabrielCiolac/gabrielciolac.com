import importlib.util
import json
import os
import pathlib
import re
import tempfile
import unittest

ROOT = pathlib.Path(__file__).parent.parent
spec = importlib.util.spec_from_file_location("fetch_weather", ROOT / "ops" / "fetch-weather.py")
fw = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fw)

GOOD = {
    "latitude": 43.65, "longitude": -79.38, "generationtime_ms": 0.1,
    "current": {"time": "2026-11-26T17:30", "interval": 900, "temperature_2m": 2.1, "weather_code": 3, "is_day": 0},
    "daily": {"time": ["2026-11-26"], "sunrise": ["2026-11-26T07:15"], "sunset": ["2026-11-26T16:45"]},
}


class ValidateTests(unittest.TestCase):
    def test_keeps_only_what_the_page_needs(self):
        out = fw.validate(GOOD)
        self.assertEqual(out, {
            "current": {"time": "2026-11-26T17:30", "temperature_2m": 2.1, "weather_code": 3, "is_day": 0},
            "daily": {"sunrise": ["2026-11-26T07:15"], "sunset": ["2026-11-26T16:45"]},
        })

    def test_rejects_missing_or_silly_values(self):
        bad_cases = [
            None, [], {},
            {**GOOD, "current": {**GOOD["current"], "temperature_2m": None}},
            {**GOOD, "current": {**GOOD["current"], "temperature_2m": 999}},
            {**GOOD, "current": {**GOOD["current"], "weather_code": "3"}},
            {**GOOD, "current": {**GOOD["current"], "weather_code": 150}},
            {**GOOD, "daily": {"sunrise": [], "sunset": ["2026-11-26T16:45"]}},
            {**GOOD, "current": {**GOOD["current"], "time": None}},
        ]
        for case in bad_cases:
            with self.assertRaises(ValueError, msg=repr(case)[:80]):
                fw.validate(case)


class WriteTests(unittest.TestCase):
    def test_write_is_atomic_and_readable(self):
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "data", "weather.json")
            fw.write_atomic(path, {"a": 1})
            fw.write_atomic(path, {"a": 2})
            self.assertEqual(json.load(open(path)), {"a": 2})
            self.assertEqual(oct(os.stat(path).st_mode & 0o777), "0o644")
            self.assertEqual([f for f in os.listdir(os.path.dirname(path)) if f.startswith(".weather-")], [])


class SyncTests(unittest.TestCase):
    def test_url_matches_the_page_logic(self):
        js = (ROOT / "site" / "room" / "logic.js").read_text()
        body = js[js.index("function openMeteoUrl"):]
        js_url = "".join(re.findall(r"'([^']*)'", body[:body.index("}")]))
        self.assertEqual(js_url, fw.URL)


if __name__ == "__main__":
    unittest.main()
