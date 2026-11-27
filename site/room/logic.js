/* Pure logic for the room: time of day, weather effects, thermometer.
   Loaded by index.html as window.RoomLogic and by the tests with require(). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RoomLogic = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const PHASES = ['dawn', 'day', 'dusk', 'night'];
  const TWILIGHT_MIN = 45; // minutes either side of sunrise / sunset

  /* Minutes since local midnight from an Open-Meteo local time string ("2026-11-26T07:21"). */
  function minutesOf(isoLocal) {
    const m = /T(\d{2}):(\d{2})/.exec(isoLocal || '');
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  }

  /* Phase for a time of day (minutes since midnight), given sunrise and sunset in minutes.
     Without sun times it falls back to fixed hours. */
  function phaseFor(nowMin, sunriseMin, sunsetMin) {
    if (sunriseMin == null || sunsetMin == null) { sunriseMin = 7 * 60; sunsetMin = 17 * 60; }
    const t = TWILIGHT_MIN;
    if (nowMin >= sunriseMin - t && nowMin < sunriseMin + t) return 'dawn';
    if (nowMin >= sunriseMin + t && nowMin < sunsetMin - t) return 'day';
    if (nowMin >= sunsetMin - t && nowMin < sunsetMin + t) return 'dusk';
    return 'night';
  }

  /* Map a WMO weather code (as Open-Meteo returns) to what the window shows. */
  function weatherFor(code) {
    if (code == null || Number.isNaN(Number(code))) return { kind: 'clear', label: 'clear', intensity: 0 };
    code = Number(code);
    if (code === 0) return { kind: 'clear', label: 'clear', intensity: 0 };
    if (code === 1 || code === 2) return { kind: 'clouds', label: 'partly cloudy', intensity: 0.35 };
    if (code === 3) return { kind: 'clouds', label: 'overcast', intensity: 0.75 };
    if (code === 45 || code === 48) return { kind: 'fog', label: 'foggy', intensity: 0.6 };
    if (code >= 51 && code <= 57) return { kind: 'rain', label: 'drizzle', intensity: 0.3 };
    if (code >= 61 && code <= 67) return { kind: 'rain', label: code >= 65 ? 'heavy rain' : 'rain', intensity: code >= 65 ? 1 : 0.6 };
    if (code >= 71 && code <= 77) return { kind: 'snow', label: code >= 75 ? 'heavy snow' : 'snow', intensity: code >= 75 ? 1 : 0.6 };
    if (code >= 80 && code <= 82) return { kind: 'rain', label: 'rain showers', intensity: code === 82 ? 1 : 0.6 };
    if (code === 85 || code === 86) return { kind: 'snow', label: 'snow showers', intensity: code === 86 ? 1 : 0.6 };
    if (code >= 95 && code <= 99) return { kind: 'storm', label: 'thunderstorm', intensity: 1 };
    return { kind: 'clouds', label: 'cloudy', intensity: 0.5 };
  }

  /* Thermometer: the painted scale runs from -30 °C (bottom) to +40 °C (top).
     Returns the y coordinate (room space) of the liquid's top, clamped to the tube. */
  const THERMO = { minC: -30, maxC: 40, yMin: 228, yMax: 160, tubeTop: 157, bulbY: 235.6 };
  function thermoTopY(tempC) {
    const t = Math.max(THERMO.minC, Math.min(THERMO.maxC, Number(tempC)));
    if (Number.isNaN(t)) return THERMO.yMin;
    return THERMO.yMin + (t - THERMO.minC) / (THERMO.maxC - THERMO.minC) * (THERMO.yMax - THERMO.yMin);
  }

  /* What Gabriel says about the weather. */
  function weatherLine(tempC, w) {
    if (tempC == null || Number.isNaN(Number(tempC))) return 'The thermometer is stuck. Probably frozen.';
    const t = Math.round(Number(tempC));
    const feel = t <= -10 ? ' Stay inside.' : t <= 0 ? ' Toque weather.' : t >= 28 ? ' Way too hot.' : '';
    return `It's ${t}°C in Toronto, ${w.label}.${feel}`;
  }

  function openMeteoUrl() {
    return 'https://api.open-meteo.com/v1/forecast?latitude=43.6532&longitude=-79.3832' +
      '&current=temperature_2m,weather_code,is_day&daily=sunrise,sunset&timezone=America%2FToronto&forecast_days=1';
  }

  /* Pull the bits we need out of an Open-Meteo response. Missing fields come back null. */
  function parseOpenMeteo(json) {
    const cur = (json && json.current) || {};
    const daily = (json && json.daily) || {};
    return {
      tempC: typeof cur.temperature_2m === 'number' ? cur.temperature_2m : null,
      code: typeof cur.weather_code === 'number' ? cur.weather_code : null,
      nowMin: minutesOf(cur.time),
      sunriseMin: minutesOf((daily.sunrise || [])[0]),
      sunsetMin: minutesOf((daily.sunset || [])[0]),
    };
  }

  /* Toronto wall-clock minutes for a Date, independent of the viewer's timezone. */
  function torontoMinutes(date) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
    const h = Number(parts.find(p => p.type === 'hour').value), m = Number(parts.find(p => p.type === 'minute').value);
    return h * 60 + m;
  }

  /* ---------- Pestering Gabriel ----------
     Every click on him adds one to an annoyance level that wears off over time.
     Reach KICK_AT and he shows you the door, for a cooldown that grows with repeat offences. */
  const PESTER = { decayMs: 4000, warnAt: 4, kickAt: 8, baseCooldownMs: 60 * 1000, maxCooldownMs: 10 * 60 * 1000, forgetAfterMs: 24 * 60 * 60 * 1000 };
  const PESTER_LINES = ['Okay, okay. I heard you.', 'You\u2019re poking me.', 'Seriously. Stop clicking me.', 'One more and you\u2019re out.'];

  /* Annoyance after one more click at nowMs, given the level and time of the previous click. */
  function pester(level, lastMs, nowMs) {
    const decayed = lastMs == null ? 0 : Math.max(0, (level || 0) - Math.floor((nowMs - lastMs) / PESTER.decayMs));
    return decayed + 1;
  }
  /* What he says at that level: a warning line, 'kick', or null for his normal chatter. */
  function pesterLine(level) {
    if (level >= PESTER.kickAt) return 'kick';
    if (level < PESTER.warnAt) return null;
    return PESTER_LINES[Math.min(level - PESTER.warnAt, PESTER_LINES.length - 1)];
  }
  /* Cooldown for the nth kick (1-based): 1 min, 2, 4, 8, then capped at 10. */
  function cooldownFor(kicks) {
    return Math.min(PESTER.maxCooldownMs, PESTER.baseCooldownMs * Math.pow(2, Math.max(0, kicks - 1)));
  }
  /* Record a kick on the saved state {kicks, lastKickMs, untilMs}; offences older than a day are forgotten. */
  function kick(saved, nowMs) {
    const prev = saved && saved.lastKickMs != null && nowMs - saved.lastKickMs < PESTER.forgetAfterMs ? saved.kicks || 0 : 0;
    const kicks = prev + 1;
    return { kicks, lastKickMs: nowMs, untilMs: nowMs + cooldownFor(kicks) };
  }
  /* Milliseconds left on the cooldown (0 when you may come back in). */
  function cooldownLeft(saved, nowMs) {
    return saved && saved.untilMs ? Math.max(0, saved.untilMs - nowMs) : 0;
  }
  /* "m:ss" for a countdown, rounding up so it never shows 0:00 while still locked. */
  function clock(ms) {
    const s = Math.ceil(Math.max(0, ms) / 1000);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  /* ---------- The windowsill plant (one per visitor, saved in their browser) ----------
     Moisture 0-100 dries out over about three days; each watering adds PLANT.perWater. */
  const PLANT = { dryPerHour: 100 / 72, start: 30, perWater: 30, full: 95 };
  function plantMoisture(saved, nowMs) {
    if (!saved || typeof saved.m !== 'number' || typeof saved.t !== 'number') return PLANT.start;
    const hours = Math.max(0, nowMs - saved.t) / 3600000;
    return Math.max(0, Math.min(100, saved.m - hours * PLANT.dryPerHour));
  }
  /* wilted < 20 <= droopy < 45 <= ok < 75 <= bloom */
  function plantStage(m) {
    if (m >= 75) return 'bloom';
    if (m >= 45) return 'ok';
    if (m >= 20) return 'droopy';
    return 'wilted';
  }
  /* Water it: returns the new saved state, or refused=true (state unchanged) when it is already full. */
  function waterPlant(saved, nowMs) {
    const before = plantMoisture(saved, nowMs);
    if (before >= PLANT.full) return { refused: true, before, after: before, saved: { m: before, t: nowMs } };
    const after = Math.min(100, before + PLANT.perWater);
    return { refused: false, before, after, saved: { m: after, t: nowMs } };
  }

  return { PHASES, THERMO, minutesOf, phaseFor, weatherFor, thermoTopY, weatherLine, openMeteoUrl, parseOpenMeteo, torontoMinutes,
    PESTER, pester, pesterLine, cooldownFor, kick, cooldownLeft, clock,
    PLANT, plantMoisture, plantStage, waterPlant };
});
