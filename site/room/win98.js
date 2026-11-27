/* Pure rules for the room's Windows 98 desktop: Minesweeper and Klondike solitaire.
   Loaded by index.html as window.Win98 and by the tests with require().
   The UI never decides a rule on its own; it calls these functions. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Win98 = api;
})(typeof self !== 'undefined' ? self : this, function () {
  function randInt(rng, n) { return Math.floor(rng() * n); }
  function shuffled(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = randInt(rng, i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  /* ------------------------------------------------------------------ *
   * Minesweeper
   * ------------------------------------------------------------------ */
  function minesweeper(w, h, mineCount) {
    return {
      w, h, mineCount, started: false, lost: false, won: false,
      cells: Array.from({ length: w * h }, () => ({ mine: false, open: false, flag: false, adj: 0 })),
    };
  }

  function neighbors(board, i) {
    const x = i % board.w, y = Math.floor(i / board.w), out = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < board.w && ny >= 0 && ny < board.h) out.push(ny * board.w + nx);
      }
    }
    return out;
  }

  /* Place the mines after the first click, keeping the clicked cell and its
     neighbours clear, so the first click always opens a patch of board. */
  function placeMines(board, safe, rng) {
    rng = rng || Math.random;
    const banned = new Set([safe].concat(neighbors(board, safe)));
    let spots = board.cells.map((_, i) => i).filter((i) => !banned.has(i));
    if (spots.length < board.mineCount) {
      spots = board.cells.map((_, i) => i).filter((i) => i !== safe);
    }
    for (const i of shuffled(spots, rng).slice(0, board.mineCount)) board.cells[i].mine = true;
    for (let i = 0; i < board.cells.length; i++) {
      board.cells[i].adj = neighbors(board, i).filter((j) => board.cells[j].mine).length;
    }
    board.started = true;
    return board;
  }

  function flags(board) { return board.cells.filter((c) => c.flag).length; }
  function remaining(board) { return board.mineCount - flags(board); }

  function finishCheck(board) {
    const hidden = board.cells.filter((c) => !c.open && !c.mine).length;
    if (hidden > 0) return false;
    board.won = true;
    for (const c of board.cells) if (c.mine) c.flag = true;
    return true;
  }

  /* Open a cell. Returns what changed so the UI can draw and the wizard can talk. */
  function reveal(board, i) {
    const res = { changed: false, lost: false, won: false };
    if (board.lost || board.won) return res;
    const c = board.cells[i];
    if (!c || c.open || c.flag) return res;
    if (!board.started) placeMines(board, i);
    if (c.mine) {
      board.lost = true;
      for (const x of board.cells) if (x.mine) x.open = true;
      res.changed = res.lost = true;
      return res;
    }
    const stack = [i];
    while (stack.length) {
      const k = stack.pop(), cell = board.cells[k];
      if (cell.open || cell.flag) continue;
      cell.open = true;
      res.changed = true;
      if (cell.adj === 0) {
        for (const n of neighbors(board, k)) {
          const nc = board.cells[n];
          if (!nc.open && !nc.flag && !nc.mine) stack.push(n);
        }
      }
    }
    res.won = finishCheck(board);
    return res;
  }

  function toggleFlag(board, i) {
    const c = board.cells[i];
    if (!c || c.open || board.lost || board.won) return false;
    c.flag = !c.flag;
    return true;
  }

  /* Middle-click / double-click on an opened number: open all neighbours once
     the right number of flags are planted. */
  function chord(board, i) {
    const res = { changed: false, lost: false, won: false };
    const c = board.cells[i];
    if (!c || !c.open || !c.adj || board.lost || board.won) return res;
    const ns = neighbors(board, i);
    if (ns.filter((n) => board.cells[n].flag).length !== c.adj) return res;
    for (const n of ns) {
      const nc = board.cells[n];
      if (nc.open || nc.flag) continue;
      const r = reveal(board, n);
      res.changed = res.changed || r.changed;
      if (r.lost) { res.lost = true; return res; }
    }
    res.won = board.won;
    return res;
  }

  /* ------------------------------------------------------------------ *
   * Klondike solitaire (draw one card at a time)
   * ------------------------------------------------------------------ */
  const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
  const RANKS = [null, 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const RED = [false, true, true, false];

  function isRed(card) { return RED[card.suit]; }
  function makeDeck() {
    const d = [];
    for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) d.push({ suit: s, rank: r, up: false });
    return d;
  }

  function newGame(rng) {
    rng = rng || Math.random;
    const deck = shuffled(makeDeck(), rng);
    const state = {
      stock: [], waste: [], foundations: [[], [], [], []],
      tableau: [[], [], [], [], [], [], []], moves: 0,
    };
    for (let col = 0; col < 7; col++) {
      for (let k = 0; k <= col; k++) {
        const card = deck.pop();
        card.up = k === col;
        state.tableau[col].push(card);
      }
    }
    for (const c of deck) c.up = false;
    state.stock = deck;
    return state;
  }

  function top(pile) { return pile.length ? pile[pile.length - 1] : null; }

  function canTableau(card, pile) {
    if (!card || !card.up) return false;
    const t = top(pile);
    if (!t) return card.rank === 13;
    return t.up && isRed(t) !== isRed(card) && card.rank === t.rank - 1;
  }

  function canFoundation(card, pile) {
    if (!card || !card.up) return false;
    const t = top(pile);
    if (!t) return card.rank === 1;
    return t.suit === card.suit && card.rank === t.rank + 1;
  }

  function isRun(cards) {
    if (!cards.length) return false;
    for (let i = 0; i < cards.length; i++) {
      if (!cards[i].up) return false;
      if (i && (cards[i].rank !== cards[i - 1].rank - 1 || isRed(cards[i]) === isRed(cards[i - 1]))) return false;
    }
    return true;
  }

  /* A source is {t:'waste'} | {t:'foundation', col} | {t:'tableau', col, idx}. */
  function runFrom(state, from) {
    if (!from) return null;
    if (from.t === 'waste') { const c = top(state.waste); return c ? [c] : null; }
    if (from.t === 'foundation') { const c = top(state.foundations[from.col]); return c ? [c] : null; }
    if (from.t === 'tableau') {
      const pile = state.tableau[from.col];
      if (!pile || from.idx == null || from.idx < 0) return null;
      const cards = pile.slice(from.idx);
      return cards.length ? cards : null;
    }
    return null;
  }

  function flipTop(pile) { const t = top(pile); if (t && !t.up) t.up = true; }

  function move(state, from, to) {
    if (!from || !to) return false;
    if (to.t === 'tableau' && from.t === 'tableau' && from.col === to.col) return false;
    const run = runFrom(state, from);
    if (!run) return false;
    const dest = to.t === 'tableau' ? state.tableau[to.col] : to.t === 'foundation' ? state.foundations[to.col] : null;
    if (!dest) return false;
    if (to.t === 'foundation' && run.length !== 1) return false;
    if (to.t === 'tableau' ? !canTableau(run[0], dest) : !canFoundation(run[0], dest)) return false;

    let moved;
    if (from.t === 'tableau') {
      const src = state.tableau[from.col];
      moved = src.splice(from.idx);
      flipTop(src);
    } else if (from.t === 'waste') {
      moved = [state.waste.pop()];
    } else {
      moved = [state.foundations[from.col].pop()];
    }
    for (const c of moved) dest.push(c);
    state.moves++;
    return true;
  }

  /* Draw from the stock. When it is empty, turn the waste back over. */
  function draw(state) {
    if (state.stock.length) {
      const c = state.stock.pop();
      c.up = true;
      state.waste.push(c);
      state.moves++;
      return 'draw';
    }
    if (state.waste.length) {
      while (state.waste.length) {
        const c = state.waste.pop();
        c.up = false;
        state.stock.push(c);
      }
      state.moves++;
      return 'recycle';
    }
    return false;
  }

  /* Send a single exposed card to the first foundation that accepts it.
     Returns the foundation column, or -1. */
  function auto(state, from) {
    const run = runFrom(state, from);
    if (!run || run.length !== 1 || !run[0].up) return -1;
    for (let f = 0; f < 4; f++) {
      if (canFoundation(run[0], state.foundations[f]) && move(state, from, { t: 'foundation', col: f })) return f;
    }
    return -1;
  }

  function isWon(state) { return state.foundations.every((p) => p.length === 13); }

  return {
    SUITS, RANKS, isRed, makeDeck, newGame, top, canTableau, canFoundation, isRun,
    runFrom, move, draw, auto, isWon,
    minesweeper, neighbors, placeMines, reveal, toggleFlag, chord, flags, remaining,
  };
});
