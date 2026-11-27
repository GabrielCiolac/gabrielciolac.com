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

test('the page loads the logic modules before its own script', () => {
  const logic = html.indexOf('src="room/logic.js"');
  const games = html.indexOf('src="room/win98.js"');
  const inline = html.lastIndexOf('<script>');
  assert.ok(logic > 0 && logic < inline, 'logic.js loads before the page script');
  assert.ok(games > logic && games < inline, 'win98.js loads after logic.js and before the page script');
});

test('every desktop shortcut opens a real window', () => {
  const opens = new Set([...html.matchAll(/data-open="([^"]+)"/g)].map((m) => m[1]));
  const wins = new Set([...html.matchAll(/data-win="([^"]+)"/g)].map((m) => m[1]));
  assert.ok(opens.size > 3);
  for (const id of opens) {
    if (id === 'wizard') continue; // the wizard is a pop-up, not a window
    assert.ok(wins.has(id), `data-open="${id}" has no window with that data-win`);
  }
});

test('no internal network addresses in the shipped site or nginx config', () => {
  const nginx = fs.readFileSync(path.join(__dirname, '..', 'nginx.conf'), 'utf8');
  for (const [name, text] of [['index.html', html], ['nginx.conf', nginx]]) {
    assert.doesNotMatch(text, /\b(?:192\.168|10\.\d+|172\.(?:1[6-9]|2\d|3[01]))\.\d+\.\d+\b/, name);
  }
});

test('the Dockerfile cache-busts the exact script tags the page uses', () => {
  const docker = fs.readFileSync(path.join(__dirname, '..', 'Dockerfile'), 'utf8');
  assert.ok(html.includes('src="room/logic.js"'), 'page should reference room/logic.js plainly; the build adds ?v=');
  assert.ok(html.includes('src="room/win98.js"'), 'page should reference room/win98.js plainly; the build adds ?v=');
  assert.match(docker, /src=\\"room\/logic\.js\\"/);
  assert.match(docker, /src=\\"room\/win98\.js\\"/);
});
