const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const A = require('../site/room/album.js');

const photo = (id, extra = {}) => ({ id, image: id + '.jpg', title: '', note: '', place: '', taken_at: '', ...extra });

test('spreadCount leaves an empty book with one open spread', () => {
  assert.equal(A.spreadCount(0), 1);
  assert.equal(A.spreadCount(1), 1);
  assert.equal(A.spreadCount(2), 1);
  assert.equal(A.spreadCount(3), 2);
  assert.equal(A.spreadCount(4), 2);
  assert.equal(A.spreadCount(5), 3);
  assert.equal(A.spreadCount(6, 3), 2);
});

test('spreadAt hands back the prints on one spread', () => {
  const items = ['a', 'b', 'c', 'd', 'e'];
  assert.deepEqual(A.spreadAt(items, 0), ['a', 'b']);
  assert.deepEqual(A.spreadAt(items, 1), ['c', 'd']);
  assert.deepEqual(A.spreadAt(items, 2), ['e']);
  assert.deepEqual(A.spreadAt(items, 9), []);
  assert.deepEqual(A.spreadAt(null, 0), []);
});

test('clampPage keeps the page inside the book', () => {
  assert.equal(A.clampPage(-3, 5), 0);
  assert.equal(A.clampPage(0, 5), 0);
  assert.equal(A.clampPage(2, 5), 2);
  assert.equal(A.clampPage(99, 5), 2);
  assert.equal(A.clampPage(7, 0), 0);
});

test('sortPhotos puts manually ordered prints first, then newest-first', () => {
  const items = [
    photo('old', { taken_at: '2020-01-01 00:00:00.000Z' }),
    photo('second', { order: 2, taken_at: '2019-01-01 00:00:00.000Z' }),
    photo('new', { taken_at: '2025-06-01 00:00:00.000Z' }),
    photo('first', { order: 1, taken_at: '2018-01-01 00:00:00.000Z' }),
  ];
  assert.deepEqual(A.sortPhotos(items).map((p) => p.id), ['first', 'second', 'new', 'old']);
  assert.deepEqual(A.sortPhotos(null), []);
});

test('photoUrl goes through the site proxy and asks for a thumb', () => {
  assert.equal(A.photoUrl({ id: 'abc123', image: 'sunset 1.jpeg' }), 'api/files/photos/abc123/sunset%201.jpeg?thumb=1600x0');
  assert.equal(A.photoUrl({ id: 'abc123', image: 'sunset 1.jpeg' }, '480x0'), 'api/files/photos/abc123/sunset%201.jpeg?thumb=480x0');
  assert.equal(A.photoUrl({ id: 'abc123' }), '');
  assert.equal(A.photoUrl(null), '');
});

test('dateLabel reads a PocketBase date without drifting a day', () => {
  assert.equal(A.dateLabel({ taken_at: '2024-04-06 00:00:00.000Z' }), 'April 6, 2024');
  assert.equal(A.dateLabel({ taken_at: '2024-12-31 23:59:00.000Z' }), 'December 31, 2024');
  assert.equal(A.dateLabel({ taken_at: '' }), '');
  assert.equal(A.dateLabel({ taken_at: 'not a date' }), '');
  assert.equal(A.dateLabel(null), '');
});

test('the back of a print says what is known and nothing more', () => {
  assert.equal(A.backMeta({ place: 'Toronto', taken_at: '2024-04-06 00:00:00.000Z' }), 'Toronto · April 6, 2024');
  assert.equal(A.backMeta({ place: 'Toronto' }), 'Toronto');
  assert.equal(A.backMeta({ taken_at: '2024-04-06 00:00:00.000Z' }), 'April 6, 2024');
  assert.equal(A.backMeta({}), '');
  assert.equal(A.noteText({ note: '  First snow.  ' }), 'First snow.');
  assert.equal(A.noteText({}), 'Nothing written on the back.');
  assert.equal(A.altText({ title: 'Roof at dawn' }, 0), 'Roof at dawn');
  assert.equal(A.altText({}, 3), 'Photograph 4');
});

test('the page, nginx and PocketBase migration are wired for the photo book', () => {
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'site', 'index.html'), 'utf8');
  const nginx = fs.readFileSync(path.join(root, 'nginx.conf'), 'utf8');
  const migration = fs.readFileSync(path.join(root, 'pocketbase', 'pb_migrations', '1764400000_photos.js'), 'utf8');

  assert.match(html, /id="albumOv"/);
  assert.match(html, /src="room\/album\.js"/);
  assert.match(html, /hot-album' \|\| el\.id === 'hot-frames'/);
  assert.doesNotMatch(html, /win-photos|data-open="photos"/, 'the old Photos window should be gone');
  assert.match(nginx, /location = \/api\/collections\/photos\/records/);
  assert.match(nginx, /location \^~ \/api\/files\/photos\//);
  assert.match(nginx, /if \(\$arg_thumb = ""\) \{ return 404; \}/, 'only resized copies leave the NAS');
  assert.match(migration, /name: 'photos'/);
  assert.match(migration, /thumbs: \['480x0', '1600x0'\]/);
});
