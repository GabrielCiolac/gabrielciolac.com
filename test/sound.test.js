const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const S = require('../site/room/sound.js');

test('sound module loads without Web Audio and stays silent', () => {
  assert.equal(S.isEnabled(), false);              // off by default
  assert.equal(S.play('boot'), false);             // nothing plays while off
  S.setEnabled(true);
  assert.equal(S.play('boot'), false);             // no AudioContext in node: still a safe no-op
  assert.doesNotThrow(() => S.setRain(0.6));
  S.setEnabled(false);
});

test('every sound the page asks for exists', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'site', 'index.html'), 'utf8');
  const asked = new Set([...html.matchAll(/RoomSound\.play\('([a-z]+)'/g), ...html.matchAll(/S\.play\('([a-z]+)'/g)].map((m) => m[1]));
  for (const n of ['purr', 'meow']) asked.add(n);
  for (const name of asked) assert.ok(S.names.includes(name), `missing sound: ${name}`);
  assert.ok(html.indexOf('src="room/sound.js"') > 0 && html.indexOf('src="room/sound.js"') < html.lastIndexOf('<script>'), 'sound.js loads before the page script');
});
