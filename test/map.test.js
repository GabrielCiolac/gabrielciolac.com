const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const L = require('../site/room/logic.js');

test('mapXY puts places where the land outline expects them', () => {
  assert.deepEqual(L.mapXY(84, -180), { x: 0, y: 0 });
  assert.deepEqual(L.mapXY(-60, 180), { x: 1000, y: 400 });
  assert.deepEqual(L.mapXY(0, 0), { x: 500, y: 233.3 });
  const to = L.mapXY(43.65, -79.38);            // Toronto
  assert.ok(to.x > 275 && to.x < 285 && to.y > 110 && to.y < 116, JSON.stringify(to));
  assert.deepEqual(L.mapXY(-80, 0).y, 400);     // clamped to the map
});

test('the land outline ships with the site and is a valid path', () => {
  const d = fs.readFileSync(path.join(__dirname, '..', 'site', 'room', 'world-land.svgpath'), 'utf8');
  assert.match(d, /^M[\d.]+ [\d.]+ L/);
  assert.ok((d.match(/M/g) || []).length > 50);
});
