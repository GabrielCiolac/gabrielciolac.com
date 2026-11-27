const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('../site/room/win98.js');

/* deterministic rng so a deal is reproducible */
function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/* ---------------------------- Minesweeper ---------------------------- */

test('minesweeper starts closed, unflagged, and not started', () => {
  const b = W.minesweeper(9, 9, 10);
  assert.equal(b.cells.length, 81);
  assert.equal(b.started, false);
  assert.equal(b.lost, false);
  assert.ok(b.cells.every((c) => !c.open && !c.flag && !c.mine && c.adj === 0));
});

test('the first click is never a mine', () => {
  for (let seed = 1; seed < 30; seed++) {
    const b = W.minesweeper(9, 9, 10);
    W.reveal(b, 40);
    assert.equal(b.cells[40].mine, false);
    assert.equal(b.lost, false);
    assert.equal(W.neighbors(b, 40).filter((i) => b.cells[i].mine).length, 0, 'the clicked cell is fully clear');
    assert.equal(b.cells.filter((c) => c.mine).length, 10);
  }
});

test('adjacency counts are right and flood fill opens a zero region', () => {
  const b = W.minesweeper(5, 5, 1);
  // place a single mine by hand at 12, then open 0: the whole zero region should open
  b.started = true;
  b.cells[12].mine = true;
  for (let i = 0; i < 25; i++) b.cells[i].adj = W.neighbors(b, i).filter((j) => b.cells[j].mine).length;
  const r = W.reveal(b, 0);
  assert.equal(r.lost, false);
  assert.equal(b.cells[0].open, true);
  assert.equal(b.cells[12].open, false, 'mine stays shut');
  assert.equal(b.cells[7].open, true, 'flood fill reaches a 1 next to the mine');
  assert.equal(b.cells[8].open, true, 'and the number itself');
  assert.equal(b.cells.filter((c) => c.open).length, 24);
  assert.equal(r.won, true, 'a lone mine: opening the rest is a win');
});

test('flags block a reveal and the counter follows them', () => {
  const b = W.minesweeper(9, 9, 10);
  assert.equal(W.remaining(b), 10);
  assert.equal(W.toggleFlag(b, 3), true);
  assert.equal(b.cells[3].flag, true);
  assert.equal(W.remaining(b), 9);
  assert.equal(W.reveal(b, 3).changed, false);
  assert.equal(b.cells[3].open, false);
  W.toggleFlag(b, 3);
  assert.equal(W.remaining(b), 10);
});

test('clicking a mine loses and shows every mine', () => {
  const b = W.minesweeper(5, 5, 3);
  W.placeMines(b, 0, seeded(7));
  const mine = b.cells.findIndex((c) => c.mine);
  const r = W.reveal(b, mine);
  assert.equal(r.lost, true);
  assert.equal(b.lost, true);
  assert.ok(b.cells.filter((c) => c.mine).every((c) => c.open));
  assert.equal(W.reveal(b, 24).changed, false, 'a lost board is finished');
});

test('opening every safe cell wins and flags the mines', () => {
  const b = W.minesweeper(4, 4, 2);
  W.placeMines(b, 0, seeded(3));
  for (let i = 0; i < b.cells.length; i++) if (!b.cells[i].mine) W.reveal(b, i);
  assert.equal(b.won, true);
  assert.ok(b.cells.filter((c) => c.mine).every((c) => c.flag));
});

test('chord only fires when the flag count matches', () => {
  const b = W.minesweeper(5, 5, 1);
  b.started = true;
  b.cells[12].mine = true;
  for (let i = 0; i < 25; i++) b.cells[i].adj = W.neighbors(b, i).filter((j) => b.cells[j].mine).length;
  W.reveal(b, 0);
  // cell 6 is an opened 1 next to the mine at 12
  const opened = b.cells.findIndex((c, i) => i !== 12 && c.open && c.adj === 1);
  assert.ok(opened >= 0);
  const before = b.cells.filter((c) => c.open).length;
  assert.equal(W.chord(b, opened).changed, false, 'no flags yet');
  W.neighbors(b, opened).forEach((n) => { if (!b.cells[n].open) W.toggleFlag(b, n); });
  W.chord(b, opened);
  assert.ok(b.cells.filter((c) => c.open).length >= before);
});

/* ---------------------------- Solitaire ---------------------------- */

test('a new deal has 1..7 cards per column with only the last one face up', () => {
  const s = W.newGame(seeded(11));
  s.tableau.forEach((pile, col) => {
    assert.equal(pile.length, col + 1);
    pile.forEach((c, k) => assert.equal(c.up, k === col));
  });
  assert.equal(s.stock.length, 24);
  assert.equal(s.waste.length, 0);
  assert.equal(s.stock.every((c) => !c.up), true);
  assert.equal(new Set(s.tableau.flat().concat(s.stock).map((c) => c.suit * 100 + c.rank)).size, 52);
});

test('tableau stacking is descending and alternating', () => {
  const pile = [{ suit: 0, rank: 10, up: true }];
  assert.equal(W.canTableau({ suit: 1, rank: 9, up: true }, pile), true, 'red 9 on black 10');
  assert.equal(W.canTableau({ suit: 3, rank: 9, up: true }, pile), false, 'same colour');
  assert.equal(W.canTableau({ suit: 1, rank: 8, up: true }, pile), false, 'wrong rank');
  assert.equal(W.canTableau({ suit: 0, rank: 13, up: true }, []), true, 'only a king on an empty column');
  assert.equal(W.canTableau({ suit: 0, rank: 12, up: true }, []), false);
  assert.equal(W.canTableau({ suit: 1, rank: 9, up: false }, pile), false, 'face down moves nowhere');
});

test('foundations build ace to king in one suit', () => {
  assert.equal(W.canFoundation({ suit: 2, rank: 1, up: true }, []), true);
  assert.equal(W.canFoundation({ suit: 2, rank: 2, up: true }, []), false);
  assert.equal(W.canFoundation({ suit: 2, rank: 1, up: false }, []), false, 'face down');
  const pile = [{ suit: 2, rank: 1, up: true }];
  assert.equal(W.canFoundation({ suit: 2, rank: 2, up: true }, pile), true);
  assert.equal(W.canFoundation({ suit: 1, rank: 2, up: true }, pile), false);
});

test('a face-up run moves as a group and exposes the next card', () => {
  const s = W.newGame(seeded(5));
  // build a known tableau: hidden king, face-up queen of hearts, jack of spades
  s.tableau[0] = [
    { suit: 0, rank: 13, up: false },
    { suit: 1, rank: 12, up: true },
    { suit: 0, rank: 11, up: true },
  ];
  s.tableau[1] = [{ suit: 3, rank: 13, up: true }];
  assert.equal(W.move(s, { t: 'tableau', col: 0, idx: 1 }, { t: 'tableau', col: 1 }), true);
  assert.deepEqual(s.tableau[1].map((c) => c.rank), [13, 12, 11]);
  assert.equal(s.tableau[0].length, 1);
  assert.equal(s.tableau[0][0].up, true, 'the hidden king turns over');
});

test('illegal moves are refused and leave the board untouched', () => {
  const s = W.newGame(seeded(9));
  const before = JSON.stringify(s);
  assert.equal(W.move(s, { t: 'tableau', col: 0, idx: 0 }, { t: 'tableau', col: 0 }), false);
  assert.equal(W.move(s, { t: 'waste' }, { t: 'tableau', col: 0 }), false, 'empty waste');
  assert.equal(W.move(s, { t: 'tableau', col: 0, idx: 0 }, { t: 'foundation', col: 0 }), false, 'not an ace');
  assert.equal(JSON.stringify(s), before);
});

test('stock draws one card, then turns the waste back over', () => {
  const s = W.newGame(seeded(2));
  const n = s.stock.length;
  assert.equal(W.draw(s), 'draw');
  assert.equal(s.stock.length, n - 1);
  assert.equal(s.waste.length, 1);
  assert.equal(s.waste[0].up, true);
  while (s.stock.length) W.draw(s);
  assert.equal(W.draw(s), 'recycle');
  assert.equal(s.stock.length, n);
  assert.equal(s.waste.length, 0);
  assert.equal(s.stock.every((c) => !c.up), true);
  assert.equal(W.draw(s) === false, false);
});

test('auto sends an ace to a foundation', () => {
  const s = W.newGame(seeded(4));
  s.tableau[0] = [{ suit: 0, rank: 1, up: true }];
  assert.equal(W.auto(s, { t: 'tableau', col: 0, idx: 0 }), 0);
  assert.equal(s.foundations[0].length, 1);
  assert.equal(s.tableau[0].length, 0);
  assert.equal(W.auto(s, { t: 'tableau', col: 0 }), -1, 'nothing left there');
});

test('a full set of foundations is a win', () => {
  const s = W.newGame(seeded(6));
  s.foundations = [0, 1, 2, 3].map((suit) =>
    Array.from({ length: 13 }, (_, i) => ({ suit, rank: i + 1, up: true })));
  assert.equal(W.isWon(s), true);
  s.foundations[3].pop();
  assert.equal(W.isWon(s), false);
});
