#!/usr/bin/env python3
"""Hourly Toronto weather for gabrielciolac.com. Lives on the NAS as /root/bin/fetch-weather.

Fetches current conditions and today's sunrise/sunset from Open-Meteo and writes
them atomically to the site app's data folder, which nginx serves read-only as
/data/weather.json. Visitors' browsers read that file, so they never contact
Open-Meteo themselves. On any failure the previous file is kept.
Run by a TrueNAS cron job every hour. Logs: journalctl -t fetch-weather.
"""
import json
import os
import sys
import tempfile
import time
import urllib.request

# Keep in sync with openMeteoUrl() in site/room/logic.js (a test checks this).
URL = ("https://api.open-meteo.com/v1/forecast?latitude=43.6532&longitude=-79.3832"
       "&current=temperature_2m,weather_code,is_day&daily=sunrise,sunset&timezone=America%2FToronto&forecast_days=1")
OUT = os.environ.get("WEATHER_OUT", "/mnt/.ix-apps/app_mounts/gabrielciolac-site/data/weather.json")


def validate(data):
    """Return the subset of an Open-Meteo response the page needs, or raise ValueError."""
    if not isinstance(data, dict):
        raise ValueError("response is not an object")
    cur, daily = data.get("current") or {}, data.get("daily") or {}
    temp, code, t = cur.get("temperature_2m"), cur.get("weather_code"), cur.get("time")
    if not isinstance(temp, (int, float)) or not -60 <= temp <= 60:
        raise ValueError("temperature missing or out of range: %r" % (temp,))
    if not isinstance(code, int) or not 0 <= code <= 99:
        raise ValueError("weather code missing or invalid: %r" % (code,))
    sunrise, sunset = (daily.get("sunrise") or [None])[0], (daily.get("sunset") or [None])[0]
    for name, v in (("time", t), ("sunrise", sunrise), ("sunset", sunset)):
        if not isinstance(v, str) or "T" not in v:
            raise ValueError("%s missing: %r" % (name, v))
    return {
        "current": {"time": t, "temperature_2m": temp, "weather_code": code, "is_day": cur.get("is_day")},
        "daily": {"sunrise": [sunrise], "sunset": [sunset]},
    }


def write_atomic(path, obj):
    d = os.path.dirname(path)
    os.makedirs(d, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=d, prefix=".weather-", suffix=".json")
    with os.fdopen(fd, "w") as f:
        json.dump(obj, f, separators=(",", ":"))
    os.chmod(tmp, 0o644)
    os.replace(tmp, path)


def main():  # pragma: no cover - network; exercised on the NAS
    import syslog
    syslog.openlog("fetch-weather")
    try:
        req = urllib.request.Request(URL, headers={"User-Agent": "gabrielciolac.com weather"})
        with urllib.request.urlopen(req, timeout=20) as r:
            data = validate(json.load(r))
        data["fetched_at"] = int(time.time())
        write_atomic(OUT, data)
        c = data["current"]
        syslog.syslog(syslog.LOG_INFO, "ok: %s°C code %s" % (c["temperature_2m"], c["weather_code"]))
    except Exception as e:
        syslog.syslog(syslog.LOG_WARNING, "failed, keeping previous file: %s" % e)
        sys.exit(1)


if __name__ == "__main__":
    main()
