/* The room's soundscape: every sound is synthesized with Web Audio (no audio files).
   Off by default: browsers only allow audio after a click, and the room should never
   surprise anyone. Loaded by index.html as window.RoomSound and by the tests with require(). */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RoomSound = api;
})(typeof self !== 'undefined' ? self : this, function (root) {
  const KEY = 'gabe-sound';
  let ctx = null, master = null, enabled = false, rainNode = null;

  function stored() {
    try { return !!(root.localStorage && root.localStorage.getItem(KEY) === 'on'); } catch (e) { return false; }
  }
  function audio() {
    if (ctx) return ctx;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
    return ctx;
  }

  /* --- small building blocks --- */
  function env(g, t, a, peak, d) {           // attack to peak, exponential decay
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function tone(freq, t, { type = 'sine', a = 0.005, peak = 0.3, d = 0.4, to = master, detune = 0 } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); o.detune.value = detune;
    env(g, t, a, peak, d); o.connect(g); g.connect(to);
    o.start(t); o.stop(t + a + d + 0.05);
    return o;
  }
  let noiseBuf = null;
  function noise() {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; return s;
  }
  function burst(t, { freq = 1200, q = 1, peak = 0.3, d = 0.05, type = 'bandpass', to = master } = {}) {
    const s = noise(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    env(g, t, 0.002, peak, d); s.connect(f); f.connect(g); g.connect(to);
    s.start(t, Math.random() * 1.5); s.stop(t + d + 0.05);
  }
  function echo(time = 0.18, fb = 0.32, wet = 0.35) {    // a little room for the chime to ring in
    const d = ctx.createDelay(1), f = ctx.createGain(), w = ctx.createGain(), lp = ctx.createBiquadFilter();
    d.delayTime.value = time; f.gain.value = fb; w.gain.value = wet; lp.type = 'lowpass'; lp.frequency.value = 2400;
    d.connect(lp); lp.connect(f); f.connect(d); d.connect(w); w.connect(master);
    const input = ctx.createGain(); input.connect(master); input.connect(d);
    return input;
  }

  /* --- the sounds --- */
  const SOUNDS = {
    // an original startup chime: a warm rising bell arpeggio over a soft pad
    boot(t) {
      const bus = echo(0.22, 0.35, 0.4);
      [392.0, 493.88, 587.33, 783.99, 987.77].forEach((f, i) => {
        tone(f, t + i * 0.16, { type: 'triangle', peak: 0.22, d: 1.6, to: bus });
        tone(f * 2, t + i * 0.16, { peak: 0.05, d: 0.9, to: bus });
      });
      [196.0, 293.66, 392.0].forEach((f) => tone(f, t + 0.05, { type: 'sine', a: 0.6, peak: 0.09, d: 2.4, to: bus, detune: 4 }));
      tone(1567.98, t + 0.95, { type: 'sine', peak: 0.08, d: 1.4, to: bus });
    },
    // the hard drive chattering while the BIOS checks things
    hdd(t, secs = 1.4) {
      for (let x = t; x < t + secs; x += 0.03 + Math.random() * 0.09) burst(x, { freq: 2200 + Math.random() * 2500, q: 3, peak: 0.12 + Math.random() * 0.1, d: 0.018 });
      const hum = ctx.createOscillator(), g = ctx.createGain();
      hum.type = 'sawtooth'; hum.frequency.value = 120; g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.012, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + secs + 0.4);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
      hum.connect(lp); lp.connect(g); g.connect(master); hum.start(t); hum.stop(t + secs + 0.5);
    },
    // CRT power-on: a thunk and the high whine settling
    crt(t) {
      burst(t, { freq: 140, q: 0.7, peak: 0.5, d: 0.18, type: 'lowpass' });
      const o = tone(15200, t + 0.02, { peak: 0.018, a: 0.05, d: 1.2 }); o.frequency.exponentialRampToValueAtTime(14800, t + 1);
    },
    click(t) { burst(t, { freq: 3200, q: 2, peak: 0.18, d: 0.02 }); },
    switch(t) { burst(t, { freq: 1800, q: 4, peak: 0.35, d: 0.025 }); burst(t + 0.06, { freq: 900, q: 4, peak: 0.2, d: 0.03 }); },
    knock(t) { [0, 0.16, 0.32].forEach((k) => { burst(t + k, { freq: 160, q: 1.2, peak: 0.7, d: 0.09, type: 'lowpass' }); tone(110, t + k, { peak: 0.2, d: 0.08 }); }); },
    // Muscles purring: a ~25 Hz flutter on a low rumble, swelling on each breath in and out
    purr(t, secs = 3.2) {
      const s = noise(), lp = ctx.createBiquadFilter(), g = ctx.createGain(), am = ctx.createGain(), lfo = ctx.createOscillator(), lfoAmt = ctx.createGain();
      lp.type = 'lowpass'; lp.frequency.value = 210; lfo.frequency.value = 25; lfoAmt.gain.value = 0.45; am.gain.value = 0.55;
      lfo.connect(lfoAmt); lfoAmt.connect(am.gain); s.connect(lp); lp.connect(am); am.connect(g); g.connect(master);
      const breath = 0.8;                                  // in (louder, a touch higher), out (softer)
      g.gain.setValueAtTime(0.0001, t);
      for (let x = t, n = 0; x < t + secs; x += breath, n++) {
        g.gain.linearRampToValueAtTime(n % 2 ? 0.32 : 0.6, x + breath * 0.45);
        g.gain.linearRampToValueAtTime(0.12, x + breath * 0.95);
        lp.frequency.setValueAtTime(n % 2 ? 180 : 240, x);
      }
      g.gain.linearRampToValueAtTime(0.0001, t + secs + 0.2);
      s.start(t); s.stop(t + secs + 0.3); lfo.start(t); lfo.stop(t + secs + 0.3);
    },
    // a hand patting fur: two soft, muffled brushes
    pat(t) { [0, 0.23].forEach((k) => burst(t + k, { freq: 700, q: 0.5, peak: 0.12, d: 0.12, type: 'lowpass' })); },
    // the chirpy little trill cats make when they wake up happy
    mrrp(t) {
      const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter(), trem = ctx.createOscillator(), tg = ctx.createGain();
      o.type = 'sawtooth'; f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 1.6;
      o.frequency.setValueAtTime(330, t); o.frequency.linearRampToValueAtTime(560, t + 0.22); o.frequency.linearRampToValueAtTime(470, t + 0.34);
      trem.frequency.value = 32; tg.gain.value = 0.5; trem.connect(tg); tg.connect(g.gain);
      env(g, t, 0.03, 0.12, 0.33); o.connect(f); f.connect(g); g.connect(master);
      o.start(t); o.stop(t + 0.45); trem.start(t); trem.stop(t + 0.45);
    },

    /* --- Minesweeper --- */
    tick(t) { burst(t, { freq: 2600, q: 3, peak: 0.14, d: 0.015 }); tone(880, t, { type: 'square', peak: 0.02, d: 0.03 }); },
    // a big empty area opening: a quick flurry of ticks, more squares = longer flurry
    cascade(t, n = 10) {
      const k = Math.min(18, Math.max(4, Math.round(n / 3)));
      for (let i = 0; i < k; i++) burst(t + i * 0.022, { freq: 2000 + i * 90, q: 3, peak: 0.1, d: 0.012 });
      tone(660, t, { type: 'triangle', peak: 0.05, d: 0.18 }); tone(990, t + 0.06, { type: 'triangle', peak: 0.04, d: 0.18 });
    },
    flag(t) { const o = tone(500, t, { type: 'triangle', peak: 0.12, d: 0.09 }); o.frequency.exponentialRampToValueAtTime(1300, t + 0.07); burst(t, { freq: 4000, q: 1, peak: 0.05, d: 0.03 }); },
    unflag(t) { const o = tone(1200, t, { type: 'triangle', peak: 0.1, d: 0.09 }); o.frequency.exponentialRampToValueAtTime(450, t + 0.08); },
    // you hit a mine: a muffled boom with a sinking thud underneath
    boom(t) {
      burst(t, { freq: 900, q: 0.4, peak: 0.6, d: 0.6, type: 'lowpass' });
      burst(t + 0.02, { freq: 220, q: 0.6, peak: 0.7, d: 1.1, type: 'lowpass' });
      const o = tone(110, t, { peak: 0.5, d: 0.9 }); o.frequency.exponentialRampToValueAtTime(32, t + 0.8);
    },
    // board cleared: a bright little original fanfare
    win(t) {
      const bus = echo(0.14, 0.25, 0.3);
      [[523.25, 0], [659.25, 0.1], [783.99, 0.2], [1046.5, 0.32], [783.99, 0.46], [1046.5, 0.56]].forEach(([f, k]) => {
        tone(f, t + k, { type: 'square', peak: 0.06, d: 0.16, to: bus }); tone(f, t + k, { type: 'triangle', peak: 0.12, d: 0.3, to: bus });
      });
      [1318.5, 1568.0, 2093.0].forEach((f, i) => tone(f, t + 0.7 + i * 0.05, { peak: 0.05, d: 0.6, to: bus }));
    },

    /* --- logging off --- */
    // an original shutdown chime: the startup bells, falling and settling
    shutdown(t) {
      const bus = echo(0.24, 0.32, 0.4);
      [987.77, 783.99, 587.33, 493.88, 392.0].forEach((f, i) => tone(f, t + i * 0.15, { type: 'triangle', peak: 0.18, d: 1.2, to: bus }));
      [196.0, 246.94, 293.66].forEach((f) => tone(f, t + 0.55, { a: 0.3, peak: 0.07, d: 1.6, to: bus, detune: -4 }));
    },
    // the CRT switching off: the whine dropping away and the picture popping
    crtoff(t) {
      const o = tone(15000, t, { peak: 0.02, a: 0.01, d: 0.5 }); o.frequency.exponentialRampToValueAtTime(6000, t + 0.45);
      burst(t + 0.05, { freq: 3000, q: 0.8, peak: 0.25, d: 0.06 });
      burst(t + 0.08, { freq: 160, q: 0.7, peak: 0.35, d: 0.2, type: 'lowpass' });
    },

    /* --- the guestbook --- */
    // a page turning: a papery swish that sweeps up, then settles
    page(t) {
      const s = noise(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
      bp.type = 'bandpass'; bp.Q.value = 0.8; bp.frequency.setValueAtTime(900, t); bp.frequency.exponentialRampToValueAtTime(3200, t + 0.18); bp.frequency.exponentialRampToValueAtTime(1400, t + 0.34);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
      s.connect(bp); bp.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + 0.42);
      burst(t + 0.33, { freq: 500, q: 0.7, peak: 0.12, d: 0.05, type: 'lowpass' });
    },
    // a rubber stamp: a soft thunk with a papery tap
    stamp(t) { burst(t, { freq: 220, q: 0.8, peak: 0.5, d: 0.07, type: 'lowpass' }); burst(t + 0.005, { freq: 2600, q: 1.5, peak: 0.08, d: 0.02 }); },
    // the nib scratching the page
    scribble(t) { burst(t, { freq: 4200 + Math.random() * 1800, q: 2.5, peak: 0.05, d: 0.05 }); },
    // water from the can: a handful of bubbly blips
    glug(t) {
      for (let i = 0; i < 7; i++) {
        const x = t + i * 0.13 + Math.random() * 0.04, o = tone(260 + Math.random() * 120, x, { peak: 0.16, a: 0.004, d: 0.09 });
        o.frequency.exponentialRampToValueAtTime(520 + Math.random() * 200, x + 0.08);
      }
      burst(t, { freq: 900, q: 0.6, peak: 0.05, d: 1.0, type: 'bandpass' });
    },
    // Gabe "talking": short pitched blips, like old adventure-game voices
    blip(t) { tone(180 + Math.random() * 120, t, { type: 'square', peak: 0.05, d: 0.06 }); },
    meow(t) {
      const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = 'sawtooth'; f.type = 'bandpass'; f.frequency.value = 1200; f.Q.value = 2;
      o.frequency.setValueAtTime(520, t); o.frequency.linearRampToValueAtTime(760, t + 0.18); o.frequency.linearRampToValueAtTime(430, t + 0.5);
      env(g, t, 0.04, 0.16, 0.5); o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t + 0.6);
    },
  };

  function play(name, arg) {
    if (!enabled || !SOUNDS[name] || !audio()) return false;
    if (ctx.state === 'suspended') ctx.resume();
    SOUNDS[name](ctx.currentTime + 0.01, arg);
    return true;
  }

  /* --- weather ambience: soft rain behind the window while it's raining --- */
  function setRain(level) {
    if (!enabled || !audio()) { stopRain(); return; }
    if (!rainNode && level > 0) {
      const s = noise(), hp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
      s.loop = true; hp.type = 'highpass'; hp.frequency.value = 500; lp.type = 'lowpass'; lp.frequency.value = 5000;
      g.gain.value = 0.0001; s.connect(hp); hp.connect(lp); lp.connect(g); g.connect(master); s.start();
      rainNode = { s, g };
    }
    if (rainNode) rainNode.g.gain.setTargetAtTime(level > 0 ? 0.02 + 0.06 * level : 0.0001, ctx.currentTime, 0.8);
  }
  function stopRain() { if (rainNode) { try { rainNode.s.stop(); } catch (e) { /* already stopped */ } rainNode = null; } }

  /* --- the fireplace on the computer screen when it snows: a low roar plus crackles and pops --- */
  let fire = null;
  function setFire(on) {
    if (!on || !enabled || !audio()) { stopFire(); return; }
    if (fire) return;
    const s = noise(), lp = ctx.createBiquadFilter(), g = ctx.createGain(), wob = ctx.createOscillator(), wg = ctx.createGain();
    s.loop = true; lp.type = 'lowpass'; lp.frequency.value = 320; g.gain.value = 0.0001;
    wob.frequency.value = 0.35; wg.gain.value = 0.025; wob.connect(wg); wg.connect(g.gain);     // the roar breathes slowly
    s.connect(lp); lp.connect(g); g.connect(master); s.start(); wob.start();
    g.gain.setTargetAtTime(0.07, ctx.currentTime, 1.2);
    const crackle = () => {
      if (!fire) return;
      const t = ctx.currentTime + 0.02, r = Math.random();
      if (r < 0.12) {                                     // a pop: one sharp snap and a couple of tiny sparks
        burst(t, { freq: 2400, q: 1.2, peak: 0.28, d: 0.03 }); burst(t + 0.03, { freq: 5200, q: 2, peak: 0.08, d: 0.015 });
      } else {                                            // the usual soft crackle
        for (let i = 0, n = 2 + Math.floor(Math.random() * 4); i < n; i++) burst(t + i * (0.01 + Math.random() * 0.03), { freq: 1500 + Math.random() * 3500, q: 2, peak: 0.04 + Math.random() * 0.08, d: 0.008 });
      }
      fire.timer = setTimeout(crackle, 60 + Math.random() * 260);
    };
    fire = { s, g, wob, timer: null }; crackle();
  }
  function stopFire() {
    if (!fire) return;
    clearTimeout(fire.timer);
    try { fire.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.3); const f = fire; setTimeout(() => { try { f.s.stop(); f.wob.stop(); } catch (e) { /* gone */ } }, 1200); } catch (e) { /* gone */ }
    fire = null;
  }

  function setEnabled(on) {
    enabled = !!on;
    try { root.localStorage && root.localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch (e) { /* this visit only */ }
    if (enabled && audio() && ctx.state === 'suspended') ctx.resume();
    if (!enabled) { stopRain(); stopFire(); }
    return enabled;
  }
  enabled = stored();

  /* --- the travel globe spinning: an airy whoosh that follows the speed, plus faint axle ticks --- */
  let spin = null;
  function setGlobeSpin(degPerSec) {
    const v = Math.min(1, Math.abs(degPerSec || 0) / 360);
    if (!enabled || !audio() || (v < 0.01 && !spin)) return;
    if (!spin) {
      const s = noise(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
      s.loop = true; bp.type = 'bandpass'; bp.Q.value = 0.9; bp.frequency.value = 400; g.gain.value = 0.0001;
      s.connect(bp); bp.connect(g); g.connect(master); s.start();
      spin = { s, bp, g, v: 0, timer: null };
      const tick = () => {                                // axle ticks: faster spin, faster ticks
        if (!spin) return;
        if (spin.v > 0.03) burst(ctx.currentTime + 0.01, { freq: 3400, q: 4, peak: 0.03 + 0.06 * spin.v, d: 0.01 });
        spin.timer = setTimeout(tick, spin.v > 0.03 ? 40 + 220 * (1 - spin.v) : 120);
      };
      tick();
    }
    spin.v = v;
    spin.g.gain.setTargetAtTime(v < 0.01 ? 0.0001 : 0.015 + 0.1 * v, ctx.currentTime, 0.08);
    spin.bp.frequency.setTargetAtTime(300 + 1400 * v, ctx.currentTime, 0.08);
    if (v < 0.01) {                                       // settled: let the whoosh fade, then free it
      const sp = spin; spin = null; clearTimeout(sp.timer);
      setTimeout(() => { try { sp.s.stop(); } catch (e) { /* gone */ } }, 600);
    }
  }

  return { play, setEnabled, setRain, setFire, setGlobeSpin, isEnabled: () => enabled, names: Object.keys(SOUNDS) };
});
