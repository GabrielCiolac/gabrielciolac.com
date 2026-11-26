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

  return { PHASES, THERMO, minutesOf, phaseFor, weatherFor, thermoTopY, weatherLine, openMeteoUrl, parseOpenMeteo, torontoMinutes };
});
