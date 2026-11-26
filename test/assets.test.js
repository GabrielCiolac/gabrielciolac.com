// Every file the homepage references must exist, so a typo can't ship a broken room.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const site = path.join(__dirname, '..', 'site');
const html = fs.readFileSync(path.join(site, 'index.html'), 'utf8');

test('all local assets referenced by index.html exist', () => {
  const refs = new Set();
  for (const m of html.matchAll(/(?:href|src)="([^"#:]+?\.(?:webp|jpg|png|js|css|svg))"/g)) refs.add(m[1]);
  for (const m of html.matchAll(/['"`](room\/[\w.-]+\.(?:webp|jpg|png))['"`]/g)) refs.add(m[1]);
  assert.ok(refs.size > 5, 'expected to find the room assets');
  for (const r of refs) assert.ok(fs.existsSync(path.join(site, r)), `missing ${r}`);
});

test('there is a painted room for every time of day', () => {
  const { PHASES } = require('../site/room/logic.js');
  for (const p of PHASES) assert.ok(fs.existsSync(path.join(site, 'room', `room-${p}.webp`)), `missing room-${p}.webp`);
});

test('the page loads the logic module before its own script', () => {
  const logic = html.indexOf('src="room/logic.js"');
  const inline = html.lastIndexOf('<script>');
  assert.ok(logic > 0 && logic < inline);
});

test('no internal network addresses in the shipped site or nginx config', () => {
  const nginx = fs.readFileSync(path.join(__dirname, '..', 'nginx.conf'), 'utf8');
  for (const [name, text] of [['index.html', html], ['nginx.conf', nginx]]) {
    assert.doesNotMatch(text, /\b(?:192\.168|10\.\d+|172\.(?:1[6-9]|2\d|3[01]))\.\d+\.\d+\b/, name);
  }
});
