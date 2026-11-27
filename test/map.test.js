const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const L = require('../site/room/logic.js');
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

test('globePoint: the centre longitude faces the viewer', () => {
  const p = L.globePoint(0, 40, 40, 0);
  assert.ok(near(p.x, 0) && near(p.y, 0) && near(p.z, 1));
  assert.ok(L.globePoint(0, 40 + 180, 40, 0).z < 0);              // the far side is hidden
  assert.ok(L.globePoint(90, 0, 0, 20).y > 0.9);                   // north pole near the top
  const e = L.globePoint(0, 130, 40, 0); assert.ok(near(e.x, 1));  // 90 degrees east is the right edge
});

test('globeLatLon inverts globePoint', () => {
  for (const [lat, lon, lon0, tilt] of [[43.65, -79.38, -60, 18], [-33.9, 151.2, 120, 18], [10, 5, 0, 0]]) {
    const p = L.globePoint(lat, lon, lon0, tilt); assert.ok(p.z > 0);
    const q = L.globeLatLon(p.x, p.y, tilt);
    assert.ok(near(q.lat, lat, 1e-6) && near(q.dlon + lon0, lon, 1e-6), JSON.stringify({ q, lat, lon }));
  }
  assert.equal(L.globeLatLon(0.9, 0.9, 0), null);                  // outside the disc
});

test('spinTarget takes the short way round', () => {
  assert.equal(L.spinTarget(170, -170), 190);
  assert.equal(L.spinTarget(-170, 170), -190);
  assert.equal(L.spinTarget(0, 90), 90);
  assert.equal(L.spinTarget(720, 10), 730);
});

test('the land outline ships with the site and is a valid path', () => {
  const d = fs.readFileSync(path.join(__dirname, '..', 'site', 'room', 'world-land.svgpath'), 'utf8');
  assert.match(d, /^M[\d.]+ [\d.]+ L/);
  assert.ok((d.match(/M/g) || []).length > 50);
});
