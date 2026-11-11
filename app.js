// Segan site: fills the page from releases.json and wires up the effects.
(() => {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const params = new URLSearchParams(location.search);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const phone = matchMedia('(max-width: 820px)');  // phones open on the link page, not the wordmark
  const TYPE = { original: 'Original', edit: 'Edit', remix: 'Remix', bootleg: 'Bootleg', flip: 'Flip' };

  const loadImage = (src) => new Promise((ok, no) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = no;
    i.src = src;
  });
  const day = (d) => `${MONTHS[+d.slice(5, 7) - 1]} ${d.slice(8, 10)}`;
  const fullDay = (d) => `${day(d)} ${d.slice(0, 4)}`;

  // "Kettama, Prospa - Think of You (Segan Edit)" -> by / name / suffix
  function split(title) {
    const m = title.match(/^(.+?)\s+-\s+(.+)$/);
    const rest = m ? m[2] : title;
    const s = rest.match(/^(.+?)\s*(\([^()]*\))$/);
    return { by: m ? m[1] : '', name: s ? s[1] : rest, suffix: s ? s[2].slice(1, -1) : '' };
  }

  // ---------- options: effect, backdrop, accent, releases view ----------
  // The first of each is the default. A choice made in the options panel is
  // remembered on this device; the address can pick too (?fx=chrome&bg=black).
  // The type is always Dusty and the covers are always Lit: not options.
  const OPTIONS = [
    ['fx', 'Effect', [['streak', 'Streak', 'Long exposure'], ['crumble', 'Crumble', 'Cracked stone'], ['chrome', 'Chrome', 'Liquid metal'], ['pixels', 'Pixels', 'Blocks']]],
    ['bg', 'Backdrop', [['containers', 'Containers', 'Photo'], ['warehouse', 'Warehouse', 'Photo'], ['black', 'Black', '']]],
    ['tone', 'Accent', [['blue', 'Blue', 'Cool'], ['ice', 'Ice', 'Paler'], ['electric', 'Electric', 'Deeper']]],
    ['view', 'Releases', [['wheel', 'Wheel', 'Covers on an arc'], ['list', 'List', 'Every title']]],
  ];
  const BACK = { containers: 'photo', warehouse: 'photo', black: 'black' };
  // the backdrop pictures. x, y: the point that stays in view when the window is tall and narrow.
  // drop: how far down the hero the photo's top edge sits (0 = the photo fills the hero); ?drop=.4 tries another
  const PHOTOS = {
    containers: ['img/containers.jpg', { x: .5, drop: .45, lit: 1.15 }],
    warehouse: ['img/warehouse.jpg', { x: .4, y: .46, at: .5 }],
  };
  const dropParam = parseFloat(params.get('drop'));
  const streakParam = parseFloat(params.get('streak'));
  const chromeParam = parseFloat(params.get('chrome'));
  if (dropParam >= 0 && dropParam <= .8) for (const name in PHOTOS) PHOTOS[name][1].drop = dropParam;
  const look = { type: 'dusty' };
  function readLook() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('segan-look')) || {}; } catch (e) { /* private window */ }
    for (const [key, , opts] of OPTIONS) {
      const ok = opts.map((o) => o[0]);
      look[key] = ok.includes(params.get(key)) ? params.get(key) : ok.includes(saved[key]) ? saved[key] : ok[0];
    }
  }
  readLook();
  const saveLook = () => {
    try { localStorage.setItem('segan-look', JSON.stringify(look)); } catch (e) { /* private window */ }
  };
  const effects = [];                              // every Fx on the page
  const onLook = [];                               // run after a look changes
  function applyLook(replay) {
    const root = document.documentElement;
    for (const [key, , opts] of OPTIONS.slice(1)) {
      for (const [value] of opts) root.classList.toggle(`${key}-${value}`, look[key] === value);
    }
    for (const fx of effects) {
      track(fx, true);
      if (replay) fx.intro();
      fx.wake();
    }
    backdrop();
    for (const fn of onLook) fn();
  }
  // put the chosen picture behind the wordmark
  const photos = {};
  let shown = '';
  function backdrop() {
    const name = look.bg;
    if (!hero || !PHOTOS[name] || shown === name) return;
    photos[name] = photos[name] || loadImage(PHOTOS[name][0]);
    photos[name].then((img) => {
      if (!hero || look.bg !== name) return;
      shown = name;
      hero.setPhoto(img, PHOTOS[name][1]);
    }, () => {});
  }
  function track(fx, known) {
    if (!known) effects.push(fx);
    fx.fx.mode = look.fx;
    fx.fx.back = BACK[look.bg];
    if (streakParam >= 0) fx.fx.amount = Math.min(2, streakParam);   // ?streak=1 is the old, stronger streak
    if (chromeParam >= 0) fx.fx.chrome = Math.min(2, chromeParam);   // ?chrome=1 is the old, stronger chrome
    return fx;
  }

  // ---------- wordmark texture: the logo, sized for the hero ----------
  let markImage = null;
  async function markSource(fx) {
    const d = fx.dpr, W = fx.w * d, H = fx.h * d;
    markImage = markImage || await loadImage(W > 1700 ? 'img/wordmark.webp' : 'img/wordmark-1500.webp');
    let tw = Math.min(W * (fx.w < 700 ? .72 : .62), 1090 * d), th = tw * markImage.height / markImage.width;
    if (th > H * .32) { th = H * .32; tw = th * markImage.width / markImage.height; }
    const out = Object.assign(document.createElement('canvas'), { width: W, height: H });
    const c = out.getContext('2d');
    c.imageSmoothingQuality = 'high';
    c.drawImage(markImage, Math.round((W - tw) / 2), Math.round(H * .47 - th / 2), Math.round(tw), Math.round(th));
    return out;
  }

  function coverSource(fx, img) {
    const d = fx.dpr;
    const c = Object.assign(document.createElement('canvas'), { width: fx.w * d, height: fx.h * d });
    const s = Math.max(c.width / img.naturalWidth, c.height / img.naturalHeight);
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    c.getContext('2d').drawImage(img, (c.width - w) / 2, (c.height - h) / 2, w, h);
    return c;
  }

  // ---------- picture that resolves from big pixels ----------
  function resolve(canvas, img, done) {
    const c = canvas.getContext('2d');
    const size = canvas.width;
    const steps = reduced ? [size] : [6, 12, 24, 48, 96, size];
    let i = 0;
    const tiny = document.createElement('canvas');
    const tick = () => {
      const n = steps[i++];
      tiny.width = tiny.height = n;
      const t = tiny.getContext('2d');
      t.drawImage(img, 0, 0, n, n);
      c.imageSmoothingEnabled = n === size;
      c.drawImage(n === size ? img : tiny, 0, 0, size, size);
      if (i < steps.length) canvas._t = setTimeout(tick, 52);
      else if (done) done();
    };
    clearTimeout(canvas._t);
    tick();
  }

  // ---------- letters that scramble on hover ----------
  const GLYPHS = '█▓▒░/\\<>#';
  function scramble(node) {
    if (reduced || node._busy || look.type === 'dusty') return;   // the serif stays still
    const text = node.textContent;
    node._busy = true;
    node.style.display = 'inline-block';
    node.style.minWidth = node.getBoundingClientRect().width + 'px';
    let f = 0;
    const total = 9;
    const id = setInterval(() => {
      f++;
      const shown = Math.floor(text.length * f / total);
      node.textContent = text.split('').map((ch, i) =>
        i < shown || ch === ' ' ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0]).join('');
      if (f >= total) { clearInterval(id); node.textContent = text; node._busy = false; }
    }, 34);
  }
  document.querySelectorAll('[data-scramble]').forEach((n) => {
    if (n.closest('.links')) return;               // big condensed links stay still
    n.addEventListener('pointerenter', () => scramble(n));
  });

  // ---------- grit: worn-paint masks for the type, made once ----------
  // A tile that repeats without a seam: paint flaked off in ragged patches,
  // pinholes, a few scratches. wear = how much is gone.
  function gritTile(size, wear, scratches, seed, mix, cells = [6, 24, 96], specks = .03) {
    let a = seed;
    const rnd = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const layers = cells.map((n) => ({ n, v: Float32Array.from({ length: n * n }, rnd) }));
    const at = ({ n, v }, x, y) => {
      const fx = x * n / size, fy = y * n / size;
      const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = (x0 + 1) % n, y1 = (y0 + 1) % n;
      let tx = fx - x0, ty = fy - y0;
      tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
      return (v[y0 * n + x0] * (1 - tx) + v[y0 * n + x1] * tx) * (1 - ty) + (v[y1 * n + x0] * (1 - tx) + v[y1 * n + x1] * tx) * ty;
    };
    const c = Object.assign(document.createElement('canvas'), { width: size, height: size });
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const worn = at(layers[0], x, y) * mix[0] + at(layers[1], x, y) * mix[1] + at(layers[2], x, y) * mix[2] + (rnd() - .5) * .07;
      let keep = Math.min(1, Math.max(0, (wear - worn) / .035 + 1));
      if (rnd() < wear * specks) keep *= .15;
      img.data[(y * size + x) * 4 + 3] = keep * 255;
    }
    ctx.putImageData(img, 0, 0);
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < scratches; i++) {
      const x = rnd() * size, y = rnd() * size, len = 30 + rnd() * 150, tilt = (rnd() - .5) * .5;
      ctx.lineWidth = .6 + rnd() * 1.1;
      ctx.globalAlpha = .45 + rnd() * .5;
      for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
        ctx.beginPath();
        ctx.moveTo(x + ox, y + oy);
        ctx.lineTo(x + ox + len, y + oy + len * tilt);
        ctx.stroke();
      }
    }
    return `url(${c.toDataURL('image/png')})`;
  }
  function noiseTile(size) {
    const c = Object.assign(document.createElement('canvas'), { width: size, height: size });
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      img.data.set([233, 230, 223, Math.random() < .5 ? 0 : Math.random() * 20], i * 4);
    }
    ctx.putImageData(img, 0, 0);
    return `url(${c.toDataURL('image/png')})`;
  }
  const rootStyle = document.documentElement.style;
  rootStyle.setProperty('--grit', gritTile(512, .71, 16, 7, [.4, .36, .24]));
  rootStyle.setProperty('--grit-fine', gritTile(384, .76, 0, 19, [.14, .36, .5]));
  // dust: no big flakes, a cloud of small holes that thickens in patches
  rootStyle.setProperty('--dust', gritTile(512, .69, 0, 31, [.26, .2, .54], [4, 34, 200], .09));
  rootStyle.setProperty('--dust-fine', gritTile(384, .8, 0, 43, [.2, .2, .6], [4, 30, 150], .05));
  rootStyle.setProperty('--noise', noiseTile(160));
  const scatter = (node) => {                      // so no two titles wear in the same places
    node.style.setProperty('--mx', -Math.round(Math.random() * 460) + 'px');
    node.style.setProperty('--my', -Math.round(Math.random() * 460) + 'px');
    node.style.setProperty('--sx', Math.round(Math.random() * 100) + '%');
    node.style.setProperty('--sy', Math.round(Math.random() * 100) + '%');
    return node;
  };

  // ---------- type that turns to chrome when touched ----------
  // The letters go to liquid metal for a moment and set again: the wordmark's
  // Chrome effect, at the same strength, on real text (textfx.js).
  const chromeText = window.chromeText;
  if (chromeText && chromeParam >= 0) chromeText.amount = Math.min(2, chromeParam);   // ?chrome=1 is the full melt
  document.querySelectorAll('[data-chrome]').forEach((n) => { scatter(n); if (chromeText) chromeText.watch(n); });

  // ---------- player (SoundCloud's own widget, our controls) ----------
  const dock = { el: $('#dock'), widget: null, frame: null, dur: 0 };
  const clock = (ms) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  function loadWidgetApi() {
    if (window.SC) return Promise.resolve();
    return new Promise((ok, no) => {
      const s = document.createElement('script');
      s.src = 'https://w.soundcloud.com/player/api.js';
      s.onload = ok; s.onerror = no;
      document.head.appendChild(s);
    });
  }
  async function play(rel) {
    const url = rel.links.soundcloud;
    if (!url) { window.open(rel.links.spotify, '_blank', 'noopener'); return; }
    // Phones: Play opens the song on SoundCloud (Sam, 11-10). The embedded player cannot work
    // there: a phone only starts sound from a tap inside SoundCloud's own frame, and SoundCloud
    // covers that frame with a "Play on SoundCloud" banner for every song.
    if (scPhone) { window.open(url, '_blank', 'noopener'); return; }
    $('#dock-title').textContent = rel.title;
    $('#dock-art').src = rel.art || '';
    $('#dock-out').href = url;
    $('#dock-time').textContent = 'Loading';
    $('#dock-fill').style.width = '0';
    dock.el.hidden = false;
    document.body.style.paddingBottom = '64px';
    try { await loadWidgetApi(); } catch (e) { window.open(url, '_blank', 'noopener'); return; }
    const src = 'https://w.soundcloud.com/player/?url=' + encodeURIComponent(url) + '&auto_play=true&show_artwork=false';
    dock.rel = rel;
    dock.started = false;
    $('#dock-play').classList.add('paused');
    needTap(false);
    if (!dock.frame) {
      dock.frame = Object.assign(document.createElement('iframe'), { className: 'sc-frame', allow: 'autoplay; encrypted-media', title: 'SoundCloud player', src });
      dock.tap.appendChild(dock.frame);
      dock.widget = window.SC.Widget(dock.frame);
      const E = window.SC.Widget.Events;
      dock.widget.bind(E.READY, () => { dock.widget.getDuration((ms) => { dock.dur = ms; }); expectSound(); });
      dock.widget.bind(E.PLAY_PROGRESS, (e) => {
        if (!dock.started && e.currentPosition > 0) { dock.started = true; needTap(false); $('#dock-play').classList.remove('paused'); }
        $('#dock-fill').style.width = (e.relativePosition * 100).toFixed(2) + '%';
        $('#dock-time').textContent = `${clock(e.currentPosition)} / ${clock(dock.dur || dock.rel.seconds * 1000)}`;
      });
      dock.widget.bind(E.PLAY, () => $('#dock-play').classList.remove('paused'));
      dock.widget.bind(E.PAUSE, () => $('#dock-play').classList.add('paused'));
    } else {
      dock.widget.load(url, { auto_play: true, show_artwork: false, callback: () => { dock.widget.getDuration((ms) => { dock.dur = ms; }); expectSound(); } });
    }
  }
  const scPhone = /iPhone|iPod|iPad|Android/i.test(navigator.userAgent);
  // A desktop browser that refuses the autoplay (the dock sat on "Loading" for good): when a
  // song has not started by itself, SoundCloud's own player slides up above the dock for one
  // click on its play button, and goes away once sound runs.
  dock.tap = el('div', 'sc-tap');
  dock.tap.append(el('p', '', 'Press play once to start the sound'));
  document.body.appendChild(dock.tap);
  function needTap(on) {
    clearTimeout(dock.wait);
    if (on) {
      $('#dock-time').textContent = 'Press play';
      dock.tap.style.bottom = dock.el.offsetHeight + 'px';
    }
    dock.tap.classList.toggle('on', on);
  }
  function expectSound() {
    clearTimeout(dock.wait);
    dock.wait = setTimeout(() => { if (!dock.started && !dock.el.hidden) needTap(true); }, 2000);
  }
  $('#dock-play').addEventListener('click', () => {
    if (!dock.widget) return;
    dock.widget.toggle();
    if (!dock.started) expectSound();
  });
  $('#dock-close').addEventListener('click', () => {
    if (dock.widget) dock.widget.pause();
    needTap(false);
    dock.el.hidden = true;
    document.body.style.paddingBottom = '';
  });
  $('#dock-bar').addEventListener('click', (e) => {
    if (!dock.widget || !dock.dur) return;
    const b = e.currentTarget.getBoundingClientRect();
    dock.widget.seekTo(dock.dur * (e.clientX - b.left) / b.width);
  });

  // ---------- links for one release ----------
  function actions(rel, big) {
    const out = [];
    if (rel.links.soundcloud) {
      const b = el('button', big ? 'btn btn-solid' : '', big ? 'Play' : 'Play');
      b.type = 'button';
      b.addEventListener('click', (e) => { e.stopPropagation(); play(rel); });
      out.push(b);
    }
    if (rel.links.spotify) {
      const a = el('a', big ? 'btn' + (rel.links.soundcloud ? '' : ' btn-solid') : '', 'Spotify ↗\uFE0E');
      a.href = rel.links.spotify; a.target = '_blank'; a.rel = 'noopener';
      out.push(a);
    }
    if (rel.links.download) {
      const a = el('a', big ? 'btn' : 'row-dl');
      a.append(big ? 'Free download ↓' : '', ...(big ? [] : [el('span', '', 'Free DL '), '↓']));
      a.href = rel.links.download; a.target = '_blank'; a.rel = 'noopener';
      out.push(a);
    }
    if (big && rel.links.soundcloud) {
      const a = el('a', 'btn', 'SoundCloud ↗\uFE0E');
      a.href = rel.links.soundcloud; a.target = '_blank'; a.rel = 'noopener';
      out.push(a);
    }
    return out;
  }
  const tag = (rel) => el('span', 'tag tag-' + rel.type, TYPE[rel.type] || rel.type);

  // ---------- page ----------
  const fxOn = !!window.Fx && !params.has('nofx');
  let hero = null;
  async function startHero() {
    if (!fxOn) return;
    const canvas = $('.hero-canvas');
    hero = new window.Fx(canvas, $('#hero'), {
      mark: true, idle: true, cell: innerWidth < 700 ? 15 : 30,
    });
    if (hero.dead) { hero = null; return; }
    track(hero);
    backdrop();
    hero.setSource(await markSource(hero));
    document.documentElement.classList.add('fx');
    hero.intro();
    new IntersectionObserver(([e]) => { hero.visible = e.isIntersecting; if (hero.visible) hero.wake(); }).observe(canvas);
    document.addEventListener('visibilitychange', () => hero.wake());
    addEventListener('scroll', () => {
      hero.scroll = Math.min(1, scrollY / (hero.h * .9));
      hero.wake();
    }, { passive: true });
    let timer = 0;
    hero.fit = () => {                             // match the canvas again after the window changed
      if (!canvas.clientWidth || canvas.clientWidth === hero.w) return;
      clearTimeout(timer);
      timer = setTimeout(async () => { hero.resize(); hero.setSource(await markSource(hero)); }, 160);
    };
    addEventListener('resize', hero.fit);          // phones resize on every scroll (address bar): width only
  }

  // a cover that reacts to the pointer (the same effect as the wordmark)
  function coverFx(cover, img) {
    if (!fxOn) return;
    img.decode().catch(() => {}).then(() => {
      const canvas = el('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      cover.append(canvas);
      const fx = new window.Fx(canvas, cover, { cell: 26 });
      if (fx.dead) { canvas.remove(); return; }
      track(fx);
      fx.setSource(coverSource(fx, img));
      new IntersectionObserver(([e], io) => {
        if (!e.isIntersecting) return;
        fx.intro(); io.disconnect();
      }, { threshold: .35 }).observe(cover);
      addEventListener('resize', () => { if (canvas.clientWidth && canvas.clientWidth !== fx.w) { fx.resize(); fx.setSource(coverSource(fx, img)); } });
    });
  }
  const outLink = (href, text, cls) => {
    const a = el('a', cls, text);
    a.href = href; a.target = '_blank'; a.rel = 'noopener';
    return a;
  };

  // ---------- phones: the link page ----------
  // In place of a Linktree. Most important first: the release that is coming,
  // the newest one, then everywhere else. LINKS is the one list to edit.
  // brand marks from Simple Icons (CC0); the bell and the envelope are ours
  const ICONS = {
    soundcloud: 'M23.999 14.165c-.052 1.796-1.612 3.169-3.4 3.169h-8.18a.68.68 0 0 1-.675-.683V7.862a.747.747 0 0 1 .452-.724s.75-.513 2.333-.513a5.364 5.364 0 0 1 2.763.755 5.433 5.433 0 0 1 2.57 3.54c.282-.08.574-.121.868-.12.884 0 1.73.358 2.347.992s.948 1.49.922 2.373ZM10.721 8.421c.247 2.98.427 5.697 0 8.672a.264.264 0 0 1-.53 0c-.395-2.946-.22-5.718 0-8.672a.264.264 0 0 1 .53 0ZM9.072 9.448c.285 2.659.37 4.986-.006 7.655a.277.277 0 0 1-.55 0c-.331-2.63-.256-5.02 0-7.655a.277.277 0 0 1 .556 0Zm-1.663-.257c.27 2.726.39 5.171 0 7.904a.266.266 0 0 1-.532 0c-.38-2.69-.257-5.21 0-7.904a.266.266 0 0 1 .532 0Zm-1.647.77a26.108 26.108 0 0 1-.008 7.147.272.272 0 0 1-.542 0 27.955 27.955 0 0 1 0-7.147.275.275 0 0 1 .55 0Zm-1.67 1.769c.421 1.865.228 3.5-.029 5.388a.257.257 0 0 1-.514 0c-.21-1.858-.398-3.549 0-5.389a.272.272 0 0 1 .543 0Zm-1.655-.273c.388 1.897.26 3.508-.01 5.412-.026.28-.514.283-.54 0-.244-1.878-.347-3.54-.01-5.412a.283.283 0 0 1 .56 0Zm-1.668.911c.4 1.268.257 2.292-.026 3.572a.257.257 0 0 1-.514 0c-.241-1.262-.354-2.312-.023-3.572a.283.283 0 0 1 .563 0Z',
    spotify: 'M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z',
    instagram: 'M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077',
    tiktok: 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z',
    youtube: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
    x: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z',
    bell: 'M12 2a6.5 6.5 0 0 0-6.5 6.5v4.1L3.4 16.9c-.3.7.2 1.6 1 1.6h15.2c.8 0 1.3-.9 1-1.6l-2.1-4.3V8.5A6.5 6.5 0 0 0 12 2Zm-2.6 18a2.7 2.7 0 0 0 5.2 0H9.4Z',
    mail: 'M2 5.5h20v.9l-10 7.2L2 6.4v-.9Zm0 3.4 10 7.2 10-7.2v9.6H2V8.9Z',
  };
  const icon = (name) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', ICONS[name]);
    svg.append(path);
    return svg;
  };
  // name, address, logo, a line under the name, a label on the right
  const LINKS = [
    ['SoundCloud', 'https://soundcloud.com/sam-segan', 'soundcloud'],
    ['Spotify', 'https://open.spotify.com/artist/0NgWGGk9p04zLTeFbIdsVO', 'spotify'],
    ['Instagram', 'https://www.instagram.com/segan/', 'instagram'],
    ["Segan's Selects", 'https://soundcloud.com/notsegan', 'soundcloud', 'Edits and bootlegs, free'],
    ['Selected by Segan', 'https://open.spotify.com/playlist/3EVWH8cjQh8dm5UR91pK9f', 'spotify', 'Spotify playlist'],
    ['Get new tunes first', 'https://laylo.com/segan', 'bell', 'Join the list', 'Sign up'],
    ['Bookings', 'mailto:mgmt@segan.com', 'mail', 'mgmt@segan.com'],
  ];
  // the rest, as a row of small logos under the list
  const SMALL = [
    ['TikTok', 'https://www.tiktok.com/@seganmusic', 'tiktok'],
    ['YouTube', 'https://www.youtube.com/channel/UCxdXumVvOyv0oQ_HzxyNxUA', 'youtube'],
    ['X', 'https://x.com/seganofficial', 'x'],
  ];
  const upcomingAt = (up) => up && new Date(up.at || up.date + 'T00:00:00').getTime();
  const upcomingLive = (up, all) => {
    const at = upcomingAt(up);
    return !!at && !all.some((r) => r.slug === up.slug) && Date.now() - at < 21 * 864e5;
  };
  function bio(up, rel, all) {
    const box = $('#bio-list');
    const card = (r, flag, sub) => {
      const s = split(r.title);
      const cover = el('span', 'bio-cover');
      cover.append(Object.assign(el('img'), { src: r.art || '', alt: '' }));
      const text = el('span', 'bio-text');
      const under = typeof sub === 'string' ? el('span', '', sub) : sub;
      under.className = 'bio-sub';
      text.append(flag, el('strong', '', s.name), under);
      return [cover, text];
    };
    if (upcomingLive(up, all)) {
      const at = upcomingAt(up), d = new Date(up.date + 'T12:00:00');
      const href = up.links.laylo || up.links.presave || up.links.spotify;
      const flag = el('span', 'bio-flag');
      const a = outLink(href, null, 'bio-card bio-main');
      const sub = el('span');
      a.append(...card(up, flag, sub));
      const tick = () => {
        const left = Math.floor((at - Date.now()) / 1000);
        if (left <= 0) {
          flag.textContent = 'Out now';
          sub.textContent = up.links.spotify || up.links.soundcloud ? 'Listen' : 'Get the next one first';
          if (up.links.spotify || up.links.soundcloud) a.href = up.links.spotify || up.links.soundcloud;
          return false;
        }
        const p = (n) => String(n).padStart(2, '0');
        flag.textContent = 'Pre-save + get notified';
        sub.textContent = `${WEEKDAYS[d.getDay()]} ${day(up.date)} · ${Math.floor(left / 86400)}d ${p(Math.floor(left % 86400 / 3600))}h ${p(Math.floor(left % 3600 / 60))}m ${p(left % 60)}s`;
        return true;
      };
      if (tick()) { const id = setInterval(() => { if (!tick()) clearInterval(id); }, 1000); }
      box.append(a);
    }
    {
      const s = split(rel.title);
      const row = el('div', 'bio-card');
      const b = el('button', 'bio-play');
      b.type = 'button';
      b.append(...card(rel, el('span', 'bio-flag', ('New ' + (TYPE[rel.type] || rel.type || '').toLowerCase()).trim()), [s.by, s.suffix].filter(Boolean).join(' / ') || 'Segan'));
      b.addEventListener('click', () => play(rel));
      row.append(b);
      if (rel.links.download) row.append(outLink(rel.links.download, 'Free DL ↓', 'bio-side'));
      box.append(row);
    }
    const outside = (a, href) => {
      a.href = href;
      if (!href.startsWith('mailto:')) { a.target = '_blank'; a.rel = 'noopener'; }
      return a;
    };
    for (const [name, href, mark, hint, cta] of LINKS) {
      const a = outside(el('a', 'bio-link'), href);
      const text = el('span', 'bio-text');
      text.append(el('strong', '', name), ...(hint ? [el('span', 'bio-sub', hint)] : []));
      a.append(icon(mark), text, ...(cta ? [el('b', '', cta)] : []));
      box.append(a);
    }
    const small = el('div', 'bio-small');
    for (const [name, href, mark] of SMALL) {
      const a = outside(el('a'), href);
      a.setAttribute('aria-label', name);
      a.append(icon(mark));
      small.append(a);
    }
    box.append(small);
  }

  // ---------- the second screen: what is next, what is latest ----------
  // upcoming.json holds the release that is not out yet. It counts down to
  // its hour, then reads "Out now" for three weeks, then the block goes away.
  function next(up, all) {
    const at = upcomingAt(up);
    if (!upcomingLive(up, all)) {
      $('#new').classList.add('solo');
      $('#last-n').textContent = '(1)';
      return;
    }
    const box = $('#now-next'), title = $('#next-title'), cover = $('#next-cover'), img = $('#next-art');
    const s = split(up.title);
    title.textContent = s.name;
    title.style.setProperty('--len', Math.max(3, s.name.length));
    img.src = up.art || ''; img.alt = up.title + ' cover';
    const d = new Date(up.date + 'T12:00:00');
    $('#next-date').textContent = `${WEEKDAYS[d.getDay()]} ${day(up.date)}`;
    const main = up.links.laylo || up.links.presave || up.links.spotify || up.links.soundcloud;
    if (main) cover.href = main;
    const act = $('#next-actions');
    const ids = ['d', 'h', 'm', 's'].map((k) => $('#count-' + k));
    let timer = 0;
    const out = () => {
      clearInterval(timer);
      $('#next-label').textContent = 'Out now';
      $('#count').hidden = true;
      act.textContent = '';
      const live = up.links.spotify || up.links.soundcloud;
      if (live) act.append(outLink(live, 'Listen ↗\uFE0E', 'btn btn-solid'));
      if (up.links.laylo) act.append(outLink(up.links.laylo, 'Get the next one first ↗\uFE0E', live ? 'btn' : 'btn btn-solid'));
    };
    const tick = () => {
      const left = at - Date.now();
      if (left <= 0) { out(); return; }
      const sec = Math.floor(left / 1000);
      [Math.floor(sec / 86400), Math.floor(sec % 86400 / 3600), Math.floor(sec % 3600 / 60), sec % 60].forEach((v, i) => {
        const t = String(v).padStart(2, '0');
        if (ids[i].textContent === t) return;
        ids[i].textContent = t;
        if (reduced) return;
        ids[i].classList.remove('tick'); void ids[i].offsetWidth; ids[i].classList.add('tick');
      });
    };
    if (up.links.laylo) act.append(outLink(up.links.laylo, 'Get notified ↗\uFE0E', 'btn btn-solid'));
    if (up.links.presave) act.append(outLink(up.links.presave, 'Pre-save ↗\uFE0E', 'btn'));
    box.hidden = false;
    tick();
    if (at > Date.now()) timer = setInterval(tick, 1000);
    coverFx(cover, img);
  }
  function last(rel) {
    const s = split(rel.title);
    $('#last-art').src = rel.art || '';
    $('#last-date').textContent = fullDay(rel.date);
    $('#last-by').textContent = [s.by, s.suffix].filter(Boolean).join(' / ');
    $('#last-title').textContent = s.name;
    $('#last-actions').append(...actions(rel, true).slice(0, 3));
    $('#last-cover').addEventListener('click', () => play(rel));
  }

  // ---------- every release: a wheel of covers, or a list ----------
  // One screen. The wheel has its own position and is turned sideways: a
  // drag or swipe (it keeps spinning when let go, like a jog wheel), a
  // sideways trackpad swipe, the arrow keys, the years, or a click on a cover.
  // Scrolling the page up or down passes straight over it.
  function deck(all) {
    const root = $('#releases'), pin = $('#deck-pin'), wheel = $('#wheel'), list = $('#deck-list'), rowsBox = $('#deck-rows');
    const col = $('#deck-col'), act = $('#deck-act'), nextBox = $('#deck-next'), yearsBox = $('#deck-years');
    const letters = $('#deck-letters'), line = $('#deck-line'), glow = [$('#glow-a'), $('#glow-b')];
    const coverBtn = $('#deck-cover'), coverCanvas = $('canvas', coverBtn);
    const groups = { all: () => true, original: (r) => r.type === 'original', flip: (r) => r.type !== 'original' };
    const geo = {};
    const arts = new Map();
    let filter = 'all', rows = [], cards = [], rowEls = [], years = [];
    let goal = 0, pos = 0, fan = 3, active = -1, shown = -1, hover = -1, dir = 1, raf = 0, glowOn = 0, vis = new Set();
    let drag = null, idle = 0, rowH = 24, wordW = 1, still = true, coast = 0;

    const clamp = (v) => Math.max(0, Math.min(rows.length - 1, v));
    const goTo = (i) => {
      cancelAnimationFrame(coast);
      goal = clamp(Math.round(i));
      still = true;
      if (look.view === 'list' && rowEls[goal]) rowsBox.scrollTo({ top: rowEls[goal].offsetTop - rowH * 3, behavior: reduced ? 'instant' : 'smooth' });
      kick();
      clearTimeout(idle); idle = setTimeout(settle, 300);
    };

    function measure() {
      const W = pin.clientWidth, H = pin.clientHeight, small = W <= 820;
      geo.size = small ? Math.min(W * .5, H * .3) : Math.max(170, Math.min(W * .17, H * .36));
      geo.R = small ? W * 1.25 : W * .7;
      geo.a = (small ? 25 : 22) * Math.PI / 180;
      geo.cx = W / 2;
      geo.cy = H * (small ? .6 : .43);
      geo.gap = geo.R * Math.sin(geo.a);
      pin.style.setProperty('--card', geo.size.toFixed(1) + 'px');
      pin.style.setProperty('--cy', geo.cy.toFixed(1) + 'px');
      if (rowEls[0]) rowH = rowEls[0].offsetHeight || rowH;
      wordW = letters.scrollWidth / 2 || 1;
    }

    const rise = (text, cls, i) => {
      const outer = el('span', 'rise ' + cls), inner = el('span', '', text);
      inner.style.animationDelay = i * 45 + 'ms';
      outer.append(inner);
      return outer;
    };
    function links(rel) {
      const kind = TYPE[rel.type] || rel.type;   // none when the title does not say: never guessed
      const what = [kind && `(${kind})`, rel.genre].filter(Boolean).join(' ');
      const out = what ? [el('span', '', what)] : [];
      if (rel.links.soundcloud) {
        const b = el('button', '', 'Play');
        b.type = 'button';
        b.addEventListener('click', () => play(rel));
        out.push(b);
      }
      if (rel.links.download) out.push(outLink(rel.links.download, 'Free download ↓'));
      if (rel.links.spotify) out.push(outLink(rel.links.spotify, 'Spotify ↗\uFE0E'));
      if (rel.links.soundcloud) out.push(outLink(rel.links.soundcloud, 'SoundCloud ↗\uFE0E'));
      return out;
    }
    // put one release in the big type, the date, the links and the light
    function show(i) {
      if (i === shown || !rows[i]) return;
      shown = i;
      const rel = rows[i], s = split(rel.title);
      col.dataset.dir = dir;
      col.className = 'deck-col' + (s.name.length > 44 ? ' xlong' : s.name.length > 24 ? ' long' : '');
      col.replaceChildren(rise(s.by || 'Segan', 'deck-by', 0), rise(s.name, 'deck-name', 1), ...(s.suffix ? [rise(s.suffix, 'deck-suf', 2)] : []));
      $('#deck-day').textContent = day(rel.date);
      $('#deck-year').textContent = rel.date.slice(0, 4);
      const after = rows[i + 1];
      if (after) { const n = split(after.title); nextBox.replaceChildren(el('span', '', n.by || 'Segan'), el('span', '', n.name)); }
      else nextBox.textContent = '';
      act.replaceChildren(...links(rel));
      glowOn ^= 1;
      glow[glowOn].src = rel.art || '';
      glow[glowOn].classList.add('on');
      glow[glowOn ^ 1].classList.remove('on');
      for (const b of yearsBox.children) b.classList.toggle('on', b.textContent === rel.date.slice(0, 4));
      coverBtn.setAttribute('aria-label', `Play ${rel.title}`);
      if (look.view === 'list') listCover(rel);
    }
    function listCover(rel) {
      if (!rel || !rel.art) return;
      const go = (img) => { if (rows[shown] === rel) resolve(coverCanvas, img); };
      if (arts.has(rel.slug)) go(arts.get(rel.slug));
      else loadImage(rel.art).then((img) => { arts.set(rel.slug, img); go(img); }, () => {});
    }

    function draw() {
      const n = rows.length;
      const a = Math.max(0, Math.min(n - 1, Math.round(pos)));
      if (a !== active) {
        dir = a > active ? 1 : -1;
        if (rowEls[active]) rowEls[active].classList.remove('on');
        if (cards[active]) cards[active].classList.remove('on');
        active = a;
        if (rowEls[a]) rowEls[a].classList.add('on');
        if (cards[a]) cards[a].classList.add('on');
        if (hover < 0) show(a);
      }
      if (look.view === 'list') {
        /* the list scrolls by itself */
      } else {
        const lo = Math.max(0, Math.floor(pos - fan) - 4), hi = Math.min(n - 1, Math.ceil(pos - fan) + 4);
        for (const i of vis) if (i < lo || i > hi) { cards[i].classList.remove('vis'); vis.delete(i); }
        for (let i = lo; i <= hi; i++) {
          const c = cards[i], d = i - pos + fan, th = d * geo.a;
          if (!vis.has(i)) {
            vis.add(i);
            c.classList.add('vis');
            if (!c._img.src) c._img.src = rows[i].art || '';
          }
          const x = geo.cx + geo.R * Math.sin(th) - geo.size / 2, y = geo.cy + geo.R * (1 - Math.cos(th)) - geo.size / 2;
          c.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${th.toFixed(4)}rad)`;
          c.style.zIndex = 50 - Math.round(Math.abs(d) * 10);
          c._shade.style.opacity = (Math.min(1, Math.abs(d)) * .58).toFixed(3);
        }
      }
      const x = -(((pos * .13 * pin.clientWidth) % wordW) + wordW) % wordW;
      letters.style.transform = `translate3d(${x.toFixed(1)}px, -50%, 0)`;
      line.style.transform = `scaleX(${n > 1 ? (pos / (n - 1)).toFixed(4) : 1})`;
    }
    function frame() {
      raf = 0;
      // In the hand the wheel follows exactly, at any speed and with no notches.
      // Let go, and once it has slowed it eases onto the nearest release.
      const t = clamp(still && !drag ? Math.round(goal) : goal);
      pos = reduced ? t : pos + (t - pos) * (drag ? .45 : still ? .13 : .3);
      if (Math.abs(t - pos) < .0015) pos = t;
      if (fan) { fan = reduced || !pin._seen ? fan : fan * .9; if (fan < .002) fan = 0; }
      draw();
      if (pos !== t || (fan && pin._seen)) kick();
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

    // at rest: land on the nearest release, and put it in the address
    function settle() {
      if (drag) return;
      still = true;
      goal = clamp(Math.round(goal));
      kick();
      const r = root.getBoundingClientRect();
      if (rows[goal] && filter === 'all' && r.top < innerHeight * .5 && r.bottom > innerHeight * .5) {
        history.replaceState(null, '', `${location.pathname}${location.search}#releases/${rows[goal].slug}`);
      }
    }
    const turn = (by) => {                           // by: releases, may be a fraction
      still = false;
      goal = clamp(goal + by);
      kick();
      clearTimeout(idle); idle = setTimeout(settle, 140);
    };

    function build(keep) {
      rows = all.filter(groups[filter]);
      wheel.textContent = ''; list.textContent = ''; yearsBox.textContent = '';
      vis = new Set(); active = -1; shown = -1; hover = -1;
      cards = rows.map((rel, i) => {
        const c = el('button', 'wcard');
        c.type = 'button';
        c.setAttribute('aria-label', rel.title);
        c._img = Object.assign(el('img'), { alt: '', draggable: false, decoding: 'async' });
        c._shade = el('i');
        c.append(c._img, c._shade);
        c.addEventListener('click', () => { if (i === active) play(rel); else goTo(i); });
        wheel.append(c);
        return c;
      });
      rowEls = rows.map((rel, i) => {
        const s = split(rel.title), li = el('li', 'drow'), b = el('button');
        b.type = 'button';
        const name = el('span', 'drow-name', s.name);
        if (s.suffix) name.append(' ', el('small', '', s.suffix));
        b.append(el('span', 'drow-by', s.by || 'Segan'), name, el('span', 'drow-date', `${day(rel.date)} ’${rel.date.slice(2, 4)}`));
        b.addEventListener('click', () => { if (i === active) play(rel); else goTo(i); });
        b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { hover = i; show(i); } });
        b.addEventListener('pointerleave', () => { if (hover === i) { hover = -1; show(active); } });
        li.append(b);
        list.append(li);
        return li;
      });
      years = [...new Set(rows.map((r) => r.date.slice(0, 4)))];
      for (const y of years) {
        const b = el('button', '', y);
        b.type = 'button';
        b.addEventListener('click', () => goTo(rows.findIndex((r) => r.date.startsWith(y))));
        yearsBox.append(b);
      }
      measure();
      goal = pos = Math.max(0, keep ? rows.indexOf(keep) : 0);
      rowsBox.scrollTop = rowEls[goal] ? rowEls[goal].offsetTop - rowH * 3 : 0;
      draw();
    }

    // wheel / list, and the three filters
    const viewButtons = document.querySelectorAll('.deck-views button');
    const setView = () => {
      viewButtons.forEach((b) => b.setAttribute('aria-pressed', b.dataset.view === look.view));
      measure();
      shown = -1;
      show(hover < 0 ? active : hover);
      if (look.view === 'list' && rowEls[active]) rowsBox.scrollTop = rowEls[active].offsetTop - rowH * 3;
      draw();
    };
    viewButtons.forEach((b) => b.addEventListener('click', () => {
      look.view = b.dataset.view;
      saveLook();
      applyLook(false);
    }));
    onLook.push(setView);
    document.querySelectorAll('.filters button').forEach((b) => b.addEventListener('click', () => {
      const keep = rows[active];
      filter = b.dataset.filter;
      document.querySelectorAll('.filters button').forEach((o) => o.setAttribute('aria-pressed', o === b));
      build(keep);
    }));
    coverBtn.addEventListener('click', () => rows[shown] && play(rows[shown]));

    // drag sideways (mouse or finger), or swipe sideways on a trackpad
    pin.addEventListener('pointerdown', (e) => {
      if (look.view !== 'wheel' || e.button || e.target.closest('.deck-bar, .deck-foot, .deck-act')) return;
      cancelAnimationFrame(coast);
      drag = { x: e.clientX, g: goal, id: e.pointerId, moved: false, v: 0, lx: e.clientX, lt: e.timeStamp };
    });
    addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x;
      if (!drag.moved) {
        if (Math.abs(dx) < 6) return;
        drag.moved = true;
        pin.classList.add('dragging');
        try { pin.setPointerCapture(e.pointerId); } catch (err) { /* gone already */ }
      }
      const dt = e.timeStamp - drag.lt;
      if (dt > 0) { drag.v = drag.v * .6 + (e.clientX - drag.lx) / dt * .4; drag.lx = e.clientX; drag.lt = e.timeStamp; }
      still = false;
      goal = clamp(drag.g - dx / geo.gap);
      kick();
    });
    // let go mid-swing and the wheel keeps turning, slowing down
    const spin = (v) => {
      let last = performance.now();
      const run = (now) => {
        const dt = Math.min(40, now - last);
        last = now;
        v *= Math.pow(.997, dt);
        const to = goal - v * dt / geo.gap;
        if (Math.abs(v) < .05 || to < 0 || to > rows.length - 1) { settle(); return; }
        still = false;
        goal = to;
        kick();
        coast = requestAnimationFrame(run);
      };
      coast = requestAnimationFrame(run);
    };
    const drop = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      pin.classList.remove('dragging');
      const v = drag.moved && e.type === 'pointerup' && e.timeStamp - drag.lt < 90 ? drag.v : 0;
      drag = null;
      clearTimeout(idle);
      if (Math.abs(v) > .15 && !reduced) spin(Math.max(-3, Math.min(3, v)));
      else settle();
    };
    addEventListener('pointerup', drop);
    addEventListener('pointercancel', drop);
    pin.addEventListener('wheel', (e) => {
      cancelAnimationFrame(coast);
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      if (look.view !== 'wheel') return;
      e.preventDefault();
      turn(e.deltaX / geo.gap);
    }, { passive: false });
    addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
      const r = root.getBoundingClientRect();
      if (r.top > innerHeight * .5 || r.bottom < innerHeight * .5) return;
      e.preventDefault();
      goTo(active + (e.key === 'ArrowRight' ? 1 : -1));
    });

    // #releases/<slug> opens on that release
    const fromHash = (jump) => {
      const m = location.hash.match(/^#releases\/(.+)$/);
      const i = m ? rows.findIndex((r) => r.slug === m[1]) : -1;
      if (i < 0) return;
      if (jump) { goal = pos = i; root.scrollIntoView({ behavior: 'instant' }); }
      goTo(i);
    };
    addEventListener('hashchange', () => fromHash(false));
    new IntersectionObserver(([e]) => {              // out of sight: the address goes back to plain
      if (!e.isIntersecting && location.hash.startsWith('#releases/')) history.replaceState(null, '', location.pathname + location.search);
    }).observe(root);
    new IntersectionObserver(([e], io) => {
      if (!e.isIntersecting) return;
      pin._seen = true; io.disconnect(); kick();     // the covers swing in the first time
    }, { threshold: .25 }).observe(pin);
    let fit = 0;
    addEventListener('resize', () => { clearTimeout(fit); fit = setTimeout(() => { measure(); draw(); }, 120); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measure(); draw(); });

    build();
    setView();
    setTimeout(() => fromHash(true), 80);
  }

  function arrivals() {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }, { rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.arrive').forEach((n) => io.observe(n));
  }

  // ---------- about: its own view, at #about ----------
  // Swapped in place, so the player keeps playing.
  let aboutFx = null;
  function startAbout() {
    if (!fxOn || aboutFx) return;
    const box = $('#about-photo'), img = $('img', box);
    aboutFx = true;
    img.decode().catch(() => {}).then(() => {
      const canvas = el('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      box.append(canvas);
      const fx = new window.Fx(canvas, $('#about'), { cell: 30 });
      if (fx.dead) { canvas.remove(); return; }
      aboutFx = track(fx);
      fx.setSource(coverSource(fx, img));
      fx.intro();
      addEventListener('resize', () => { if (canvas.clientWidth) { fx.resize(); fx.setSource(coverSource(fx, img)); } });
    });
  }
  function route() {
    const about = location.hash === '#about';
    const was = document.documentElement.classList.contains('on-about');
    document.documentElement.classList.toggle('on-about', about);
    if (about) {
      scrollTo(0, 0);
      if (aboutFx && aboutFx.intro) { aboutFx.resize(); aboutFx.setSource(coverSource(aboutFx, $('#about-photo img'))); aboutFx.intro(); }
      else startAbout();
    } else if (was) {
      if (hero) hero.fit();
      const target = location.hash.length > 1 && document.getElementById(location.hash.slice(1));
      if (target) target.scrollIntoView(); else scrollTo(0, 0);
    }
    past();
  }

  // ---------- options panel: "Options" in the bottom left of the hero opens it ----------
  function options() {
    const root = document.documentElement, tab = $('#opt-tab'), panel = $('#opt'), groups = $('#opt-groups');
    const open = (on) => {
      root.classList.toggle('opt-open', on);
      panel.inert = !on;
      tab.setAttribute('aria-expanded', on);
    };
    const keep = saveLook;
    const draw = () => {
      groups.textContent = '';
      for (const [key, label, opts] of OPTIONS) {
        const group = el('div', 'opt-group');
        group.append(el('h3', '', label));
        for (const [value, name, hint] of opts) {
          const b = el('button');
          b.type = 'button';
          b.append(el('b', '', name), el('i', '', hint));
          b.setAttribute('aria-pressed', look[key] === value);
          b.addEventListener('click', () => {
            look[key] = value;
            keep();
            if (params.has(key)) { params.set(key, value); history.replaceState(null, '', '?' + params + location.hash); }
            group.querySelectorAll('button').forEach((o) => o.setAttribute('aria-pressed', o === b));
            applyLook(key === 'fx');
          });
          group.append(b);
        }
        groups.append(group);
      }
    };
    tab.addEventListener('click', () => open(!root.classList.contains('opt-open')));
    $('#foot-options').addEventListener('click', () => open(true));
    $('#opt-close').addEventListener('click', () => open(false));
    addEventListener('keydown', (e) => { if (e.key === 'Escape') open(false); });
    $('#opt-reset').addEventListener('click', () => {
      try { localStorage.removeItem('segan-look'); } catch (e) { /* private window */ }
      for (const [key] of OPTIONS) params.delete(key);
      history.replaceState(null, '', location.pathname + (String(params) ? '?' + params : '') + location.hash);
      readLook();
      draw();
      applyLook(true);
    });
    draw();
    onLook.push(() => groups.querySelectorAll('.opt-group').forEach((g, i) => {
      g.querySelectorAll('button').forEach((b, j) => b.setAttribute('aria-pressed', look[OPTIONS[i][0]] === OPTIONS[i][2][j][0]));
    }));
    if (params.has('clean')) tab.hidden = true;      // for screenshots
    if (params.has('options')) open(true);
  }
  applyLook(false);
  options();

  // the top bar gets a solid back once the wordmark has scrolled away
  // (and the small logo comes back, now that the big one is gone)
  function past() {
    const root = document.documentElement;
    root.classList.toggle('scrolled', scrollY > 24);
    root.classList.toggle('past', scrollY > ($('#hero').offsetHeight || $('#bio').offsetHeight) - 120);
  }
  addEventListener('scroll', past, { passive: true });
  addEventListener('hashchange', route);
  route();

  async function main() {
    if (!phone.matches) startHero();
    else phone.addEventListener('change', () => { if (!hero) startHero(); }, { once: true });
    const [all, up] = await Promise.all([
      fetch('releases.json').then((r) => r.json()),
      fetch('upcoming.json').then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    bio(up, all[0], all);
    next(up, all);
    last(all[0]);
    deck(all);
    arrivals();
  }
  main();
})();

// test switch: ?nograin takes the film grain layer off
if (/[?&]nograin/.test(location.search)) document.documentElement.classList.add('nograin');
