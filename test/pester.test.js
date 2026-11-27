const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../site/room/logic.js');
const P = L.PESTER;

test('annoyance builds with quick clicks and wears off over time', () => {
  assert.equal(L.pester(0, null, 0), 1);
  let lvl = 0, last = null;
  for (let i = 0; i < 8; i++) { lvl = L.pester(lvl, last, i * 500); last = i * 500; }
  assert.equal(lvl, 8);
  assert.equal(L.pester(5, 0, P.decayMs * 2), 4);       // two steps of decay, then this click
  assert.equal(L.pester(5, 0, P.decayMs * 60), 1);      // fully calmed down
});

test('pesterLine warns, then kicks', () => {
  assert.equal(L.pesterLine(1), null);
  assert.equal(L.pesterLine(P.warnAt - 1), null);
  assert.equal(typeof L.pesterLine(P.warnAt), 'string');
  assert.match(L.pesterLine(P.kickAt - 1), /One more/);
  assert.equal(L.pesterLine(P.kickAt), 'kick');
  assert.equal(L.pesterLine(P.kickAt + 5), 'kick');
});

test('cooldown doubles per kick and caps', () => {
  assert.equal(L.cooldownFor(1), 60e3);
  assert.equal(L.cooldownFor(2), 120e3);
  assert.equal(L.cooldownFor(4), 480e3);
  assert.equal(L.cooldownFor(5), P.maxCooldownMs);
  assert.equal(L.cooldownFor(50), P.maxCooldownMs);
});

test('kick records offences and forgets them after a day', () => {
  const a = L.kick(null, 1000);
  assert.deepEqual(a, { kicks: 1, lastKickMs: 1000, untilMs: 61000 });
  const b = L.kick(a, 100000);
  assert.equal(b.kicks, 2); assert.equal(b.untilMs, 100000 + 120e3);
  const c = L.kick(b, 100000 + P.forgetAfterMs);
  assert.equal(c.kicks, 1);
});

test('cooldownLeft and clock', () => {
  const s = { untilMs: 70000 };
  assert.equal(L.cooldownLeft(s, 10000), 60000);
  assert.equal(L.cooldownLeft(s, 90000), 0);
  assert.equal(L.cooldownLeft(null, 0), 0);
  assert.equal(L.clock(60000), '1:00');
  assert.equal(L.clock(59001), '1:00');
  assert.equal(L.clock(5000), '0:05');
  assert.equal(L.clock(1), '0:01');
  assert.equal(L.clock(0), '0:00');
});
