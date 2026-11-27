const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../site/room/logic.js');

test('Easter Sunday', () => {
  assert.deepEqual(L.easter(2024), { m: 3, d: 31 });
  assert.deepEqual(L.easter(2025), { m: 4, d: 20 });
  assert.deepEqual(L.easter(2026), { m: 4, d: 5 });
  assert.deepEqual(L.easter(2027), { m: 3, d: 28 });
  assert.deepEqual(L.easter(2038), { m: 4, d: 25 });
});

test('Canadian Thanksgiving is the second Monday of October', () => {
  assert.deepEqual(L.thanksgiving(2024), { m: 10, d: 14 });
  assert.deepEqual(L.thanksgiving(2025), { m: 10, d: 13 });
  assert.deepEqual(L.thanksgiving(2026), { m: 10, d: 12 });
  assert.deepEqual(L.thanksgiving(2027), { m: 10, d: 11 });
  assert.deepEqual(L.thanksgiving(2029), { m: 10, d: 8 });
});

test('Christmas runs Dec 10-25, Halloween Oct 16-31', () => {
  assert.equal(L.holidayFor(2026, 12, 9), null);
  assert.equal(L.holidayFor(2026, 12, 10), 'christmas');
  assert.equal(L.holidayFor(2026, 12, 25), 'christmas');
  assert.equal(L.holidayFor(2026, 12, 26), null);
  assert.equal(L.holidayFor(2026, 10, 15), null);
  assert.equal(L.holidayFor(2026, 10, 16), 'halloween');
  assert.equal(L.holidayFor(2026, 10, 31), 'halloween');
  assert.equal(L.holidayFor(2026, 11, 1), null);
});

test('single-day holidays', () => {
  assert.equal(L.holidayFor(2027, 1, 1), 'newyear');
  assert.equal(L.holidayFor(2027, 1, 2), null);
  assert.equal(L.holidayFor(2026, 4, 5), 'easter');
  assert.equal(L.holidayFor(2026, 6, 24), 'stjean');
  assert.equal(L.holidayFor(2026, 7, 1), 'canada');
  assert.equal(L.holidayFor(2026, 10, 12), 'thanksgiving');
  assert.equal(L.holidayFor(2026, 11, 17), 'birthday');
  assert.equal(L.holidayFor(2026, 11, 26), null);
});

test('torontoDate uses Toronto time, not the viewer’s', () => {
  // 2026-12-25 03:00 UTC is still Dec 24 in Toronto
  assert.deepEqual(L.torontoDate(new Date(Date.UTC(2026, 11, 25, 3))), { y: 2026, m: 12, d: 24 });
  assert.deepEqual(L.torontoDate(new Date(Date.UTC(2026, 11, 25, 6))), { y: 2026, m: 12, d: 25 });
});
