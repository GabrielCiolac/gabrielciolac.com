const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../site/room/logic.js');

const SUNRISE = 7 * 60 + 15, SUNSET = 16 * 60 + 45; // a late-November Toronto day

test('minutesOf reads Open-Meteo local times', () => {
  assert.equal(L.minutesOf('2026-11-26T07:21'), 441);
  assert.equal(L.minutesOf('2026-11-26T00:00'), 0);
  assert.equal(L.minutesOf(''), null);
  assert.equal(L.minutesOf(undefined), null);
});

test('phaseFor splits the day around sunrise and sunset', () => {
  assert.equal(L.phaseFor(3 * 60, SUNRISE, SUNSET), 'night');
  assert.equal(L.phaseFor(SUNRISE - 45, SUNRISE, SUNSET), 'dawn');
  assert.equal(L.phaseFor(SUNRISE + 44, SUNRISE, SUNSET), 'dawn');
  assert.equal(L.phaseFor(SUNRISE + 45, SUNRISE, SUNSET), 'day');
  assert.equal(L.phaseFor(12 * 60, SUNRISE, SUNSET), 'day');
  assert.equal(L.phaseFor(SUNSET - 45, SUNRISE, SUNSET), 'dusk');
  assert.equal(L.phaseFor(SUNSET + 44, SUNRISE, SUNSET), 'dusk');
  assert.equal(L.phaseFor(SUNSET + 45, SUNRISE, SUNSET), 'night');
  assert.equal(L.phaseFor(23 * 60 + 59, SUNRISE, SUNSET), 'night');
});

test('phaseFor falls back to fixed hours without sun times', () => {
  assert.equal(L.phaseFor(12 * 60, null, null), 'day');
  assert.equal(L.phaseFor(2 * 60, null, null), 'night');
});

test('every phase is one of the four painted rooms', () => {
  for (let m = 0; m < 24 * 60; m += 7) assert.ok(L.PHASES.includes(L.phaseFor(m, SUNRISE, SUNSET)));
});

test('weatherFor maps WMO codes to window effects', () => {
  assert.equal(L.weatherFor(0).kind, 'clear');
  assert.equal(L.weatherFor(2).kind, 'clouds');
  assert.equal(L.weatherFor(3).label, 'overcast');
  assert.equal(L.weatherFor(45).kind, 'fog');
  assert.equal(L.weatherFor(53).kind, 'rain');
  assert.equal(L.weatherFor(65).label, 'heavy rain');
  assert.equal(L.weatherFor(71).kind, 'snow');
  assert.equal(L.weatherFor(86).kind, 'snow');
  assert.equal(L.weatherFor(81).kind, 'rain');
  assert.equal(L.weatherFor(95).kind, 'storm');
  assert.equal(L.weatherFor(null).kind, 'clear');
  assert.equal(L.weatherFor(12345).kind, 'clouds');
});

test('every WMO code gives a known effect with intensity 0..1', () => {
  const kinds = new Set(['clear', 'clouds', 'fog', 'rain', 'snow', 'storm']);
  for (let c = 0; c <= 99; c++) {
    const w = L.weatherFor(c);
    assert.ok(kinds.has(w.kind), `code ${c}`);
    assert.ok(w.intensity >= 0 && w.intensity <= 1, `code ${c}`);
  }
});

test('thermometer liquid rises with temperature and stays in the tube', () => {
  assert.equal(L.thermoTopY(-30), L.THERMO.yMin);
  assert.equal(L.thermoTopY(40), L.THERMO.yMax);
  assert.equal(L.thermoTopY(-80), L.THERMO.yMin);
  assert.equal(L.thermoTopY(90), L.THERMO.yMax);
  assert.ok(L.thermoTopY(20) < L.thermoTopY(0), 'warmer is higher (smaller y)');
  assert.ok(L.thermoTopY(40) >= L.THERMO.tubeTop);
  assert.equal(L.thermoTopY(NaN), L.THERMO.yMin);
});

test('weatherLine reads naturally', () => {
  assert.equal(L.weatherLine(-3.4, L.weatherFor(71)), "It's -3°C in Toronto, snow. Toque weather.");
  assert.equal(L.weatherLine(31, L.weatherFor(0)), "It's 31°C in Toronto, clear. Way too hot.");
  assert.match(L.weatherLine(null, L.weatherFor(0)), /stuck/);
});

test('parseOpenMeteo pulls current conditions and sun times', () => {
  const sample = {
    current: { time: '2026-11-26T17:30', temperature_2m: 2.1, weather_code: 3, is_day: 0 },
    daily: { sunrise: ['2026-11-26T07:15'], sunset: ['2026-11-26T16:45'] },
  };
  assert.deepEqual(L.parseOpenMeteo(sample), { tempC: 2.1, code: 3, nowMin: 1050, sunriseMin: 435, sunsetMin: 1005 });
  assert.deepEqual(L.parseOpenMeteo({}), { tempC: null, code: null, nowMin: null, sunriseMin: null, sunsetMin: null });
  assert.deepEqual(L.parseOpenMeteo(null), { tempC: null, code: null, nowMin: null, sunriseMin: null, sunsetMin: null });
});

test('torontoMinutes uses Toronto time, not the machine timezone', () => {
  // 2026-11-26 22:30 UTC is 17:30 in Toronto (EST, UTC-5)
  assert.equal(L.torontoMinutes(new Date(Date.UTC(2026, 10, 26, 22, 30))), 17 * 60 + 30);
  // 2026-07-01 12:00 UTC is 08:00 in Toronto (EDT, UTC-4)
  assert.equal(L.torontoMinutes(new Date(Date.UTC(2026, 6, 1, 12, 0))), 8 * 60);
});

test('openMeteoUrl asks for Toronto with everything parseOpenMeteo reads', () => {
  const u = new URL(L.openMeteoUrl());
  assert.equal(u.hostname, 'api.open-meteo.com');
  assert.match(u.searchParams.get('current'), /temperature_2m/);
  assert.match(u.searchParams.get('current'), /weather_code/);
  assert.match(u.searchParams.get('daily'), /sunrise/);
  assert.equal(u.searchParams.get('timezone'), 'America/Toronto');
});
