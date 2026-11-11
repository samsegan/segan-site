// The Chrome effect on type: the wordmark's Chrome (fx.js), for real text.
// Touch a word and its letters turn to liquid metal for a moment, flow a
// little, then set again. An SVG filter on the element itself does it, so the
// text stays text. Used by the landing page and by /plugins.
//
//   chromeText.watch(node)   the word reacts to the pointer from now on
//   chromeText.amount        how strong. The same number as Fx's `chrome`:
//                            .4 is the subtle one, 1 is the full melt.
(() => {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COOL = 1.6;         // how fast the metal sets again (per second)
  const TURN = 42;          // how fast it flows (degrees of the noise's hue per second)
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const make = (tag, attrs, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.append(n);
    return n;
  };
  // the metal: dark and bright bands, as cold as the wordmark's
  const bands = (dark, bright) => Array.from({ length: 15 }, (_, i) => (i % 2 ? bright : dark)).join(' ');

  let defs = null, made = 0, raf = 0, last = 0;
  const live = new Set();   // the words that are liquid right now

  // One filter: a slow noise field bends the letters and decides where the
  // metal's bands fall; the metal is then mixed into the letters.
  function filter(seed) {
    defs = defs || make('svg', { width: 0, height: 0, 'aria-hidden': 'true', focusable: 'false', style: 'position:absolute' }, document.body);
    const id = `chrome-text-${++made}`;
    const f = make('filter', { id, 'color-interpolation-filters': 'sRGB' }, defs);
    const noise = make('feTurbulence', { type: 'fractalNoise', baseFrequency: '.014', numOctaves: 2, seed, result: 'noise' }, f);
    const turn = make('feColorMatrix', { in: 'noise', type: 'hueRotate', values: 0, result: 'flow' }, f);
    const bend = make('feDisplacementMap', { in: 'SourceGraphic', in2: 'flow', scale: 0, xChannelSelector: 'R', yChannelSelector: 'G', result: 'bent' }, f);
    make('feColorMatrix', { in: 'flow', type: 'matrix', values: '.64 .36 0 0 0  .64 .36 0 0 0  .64 .36 0 0 0  0 0 0 0 1', result: 'field' }, f);
    const metal = make('feComponentTransfer', { in: 'field', result: 'bands' }, f);
    make('feFuncR', { type: 'table', tableValues: bands('.03', '.93') }, metal);
    make('feFuncG', { type: 'table', tableValues: bands('.05', '.97') }, metal);
    make('feFuncB', { type: 'table', tableValues: bands('.07', '1') }, metal);
    make('feComposite', { in: 'bands', in2: 'bent', operator: 'in', result: 'metal' }, f);
    const mix = make('feComposite', { in: 'metal', in2: 'bent', operator: 'arithmetic', k1: 0, k2: 0, k3: 1, k4: 0 }, f);
    return { id, el: f, noise, turn, bend, mix };
  }

  // Fit a word's filters to its size: the noise as coarse as the letters are
  // tall, and just enough room around the box for the letters to move in.
  function fit(w) {
    const box = w.node.getBoundingClientRect();
    const size = parseFloat(getComputedStyle(w.node).fontSize) || 16;
    if (size === w.size && box.width === w.bw && box.height === w.bh) return;
    w.size = size; w.bw = box.width; w.bh = box.height;
    const pad = size * .1 + 2;
    const mx = pad / Math.max(1, box.width), my = pad / Math.max(1, box.height);
    for (const f of w.f) {
      f.noise.setAttribute('baseFrequency', (1.4 / size).toFixed(4));
      f.el.setAttribute('x', (-mx * 100).toFixed(2) + '%');
      f.el.setAttribute('y', (-my * 100).toFixed(2) + '%');
      f.el.setAttribute('width', ((1 + mx * 2) * 100).toFixed(2) + '%');
      f.el.setAttribute('height', ((1 + my * 2) * 100).toFixed(2) + '%');
    }
  }

  function frame(now) {
    raf = 0;
    const dt = Math.min(.05, Math.max(0, (now - last) / 1000));
    last = now;
    const amount = api.amount;
    for (const w of live) {
      const add = w.warm * (1 - Math.exp(-dt * 16));        // warms up over a few frames, no pop
      w.warm -= add;
      w.heat = Math.min(1, w.heat + add) * Math.exp(-dt * COOL);
      w.angle = (w.angle + dt * TURN) % 360;
      if (w.heat < .04 && w.warm < .04) {                   // set again: back to plain text
        w.heat = w.warm = 0;
        w.node.style.filter = '';
        live.delete(w);
        continue;
      }
      // Each frame goes to the word's other filter. A changed address makes
      // every browser draw it again; changed numbers alone do not, in Safari.
      const f = w.f[w.side ^= 1];
      const m = smooth(.04, .55, w.heat) * Math.min(amount, 1);
      f.turn.setAttribute('values', w.angle.toFixed(1));
      // small type bends less for its size: thin strokes break up when they move
      f.bend.setAttribute('scale', (w.size * .375 * amount * w.heat * Math.min(1, w.size / 48)).toFixed(2));
      f.mix.setAttribute('k2', m.toFixed(3));
      f.mix.setAttribute('k3', (1 - m).toFixed(3));
      w.node.style.filter = `url(#${f.id})`;
    }
    if (live.size) raf = requestAnimationFrame(frame);
  }

  // level: how liquid the word should get (1 = just touched, less = still being stirred)
  function warm(w, level) {
    if (api.amount <= 0) return;
    if (!w.f) {
      const seed = 1 + ((Math.random() * 90) | 0);
      w.f = [filter(seed), filter(seed)];
    }
    if (!live.has(w)) { fit(w); live.add(w); }
    w.warm = Math.max(w.warm, level - w.heat);
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }

  const api = {
    amount: .4,
    watch(node) {
      if (reduced || !node) return node;
      const w = { node, f: null, side: 0, heat: 0, warm: 0, angle: 0, size: 0, bw: 0, bh: 0 };
      node.addEventListener('pointerenter', () => warm(w, 1));
      node.addEventListener('pointermove', () => warm(w, .5), { passive: true });
      return node;
    },
  };
  window.chromeText = api;
})();
