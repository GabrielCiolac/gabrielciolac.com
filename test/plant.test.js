const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../site/room/logic.js');
const H = 3600000;

test('a new visitor finds the plant a bit droopy', () => {
  assert.equal(L.plantMoisture(null, 0), L.PLANT.start);
  assert.equal(L.plantStage(L.plantMoisture(null, 0)), 'droopy');
  assert.equal(L.plantMoisture({ m: 'x' }, 0), L.PLANT.start);
});

test('it dries out over about three days', () => {
  const s = { m: 100, t: 0 };
  assert.equal(L.plantMoisture(s, 0), 100);
  assert.ok(Math.abs(L.plantMoisture(s, 36 * H) - 50) < 1e-9);
  assert.equal(L.plantMoisture(s, 100 * H), 0);
  assert.equal(L.plantMoisture(s, -5 * H), 100); // clock skew never adds water
});

test('stages', () => {
  assert.equal(L.plantStage(0), 'wilted');
  assert.equal(L.plantStage(19.9), 'wilted');
  assert.equal(L.plantStage(20), 'droopy');
  assert.equal(L.plantStage(45), 'ok');
  assert.equal(L.plantStage(75), 'bloom');
  assert.equal(L.plantStage(100), 'bloom');
});

test('watering adds water, caps at 100, and refuses when full', () => {
  let r = L.waterPlant(null, 0);
  assert.equal(r.refused, false); assert.equal(r.before, 30); assert.equal(r.after, 60);
  r = L.waterPlant(r.saved, 0); assert.equal(r.after, 90); assert.equal(L.plantStage(r.after), 'bloom');
  r = L.waterPlant(r.saved, 0); assert.equal(r.after, 100);
  r = L.waterPlant(r.saved, 0); assert.equal(r.refused, true); assert.equal(r.after, 100);
});

test('after a refusal the plant is locked until it dries below full', () => {
  const H2 = 3600000;
  const s = { m: 100, t: 0, stopped: true };
  assert.equal(L.plantLocked(s, 0), true);
  assert.equal(L.plantLocked({ m: 100, t: 0 }, 0), false);          // full but nobody's been told off yet
  assert.equal(L.plantLocked(s, 3 * H2), true);                      // 100 - 4.2 = 95.8
  assert.equal(L.plantLocked(s, 4 * H2), false);                     // 94.4: dry enough to water again
  assert.equal(L.plantLocked(null, 0), false);
});
