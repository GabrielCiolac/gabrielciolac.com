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
    // Muscles purring: low rumble with a ~25 Hz flutter
    purr(t, secs = 1.6) {
      const s = noise(), lp = ctx.createBiquadFilter(), g = ctx.createGain(), am = ctx.createGain(), lfo = ctx.createOscillator();
      lp.type = 'lowpass'; lp.frequency.value = 230; lfo.frequency.value = 24; am.gain.value = 0.5;
      lfo.connect(am.gain); s.connect(lp); lp.connect(am); am.connect(g); g.connect(master);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + secs);
      s.start(t); s.stop(t + secs + 0.1); lfo.start(t); lfo.stop(t + secs + 0.1);
    },
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

  function setEnabled(on) {
    enabled = !!on;
    try { root.localStorage && root.localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch (e) { /* this visit only */ }
    if (enabled && audio() && ctx.state === 'suspended') ctx.resume();
    if (!enabled) stopRain();
    return enabled;
  }
  enabled = stored();

  return { play, setEnabled, setRain, isEnabled: () => enabled, names: Object.keys(SOUNDS) };
});
