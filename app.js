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
  const TYPE = { original: 'Original', edit: 'Edit', remix: 'Remix', bootleg: 'Bootleg', flip: 'Flip' };
  const FIRST = 12;

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

  // ---------- options: effect, backdrop, type, accent ----------
  // The first of each is the default. A choice made in the options panel is
  // remembered on this device; the address can pick too (?fx=chrome&bg=wall).
  const OPTIONS = [
    ['fx', 'Effect', [['streak', 'Streak', 'Long exposure'], ['crumble', 'Crumble', 'Cracked stone'], ['chrome', 'Chrome', 'Liquid metal'], ['pixels', 'Pixels', 'Blocks']]],
    ['bg', 'Backdrop', [['containers', 'Containers', 'Photo'], ['warehouse', 'Warehouse', 'Photo'], ['wall', 'Wall', 'Block wall'], ['black', 'Black', '']]],
    ['type', 'Type', [['dusty', 'Dusty', 'Grotesque + serif'], ['classic', 'Classic', 'All serif'], ['poster', 'Poster', 'Stone + serif'], ['stone', 'Stone', 'Stone + mono'], ['stencil', 'Stencil', 'Spray stencil'], ['clean', 'Clean', '']]],
    ['tone', 'Accent', [['blue', 'Blue', 'Cool'], ['ice', 'Ice', 'Paler'], ['electric', 'Electric', 'Deeper']]],
  ];
  const SERIF = ['dusty', 'classic', 'poster'];    // the small type is the serif in these
  const BACK = { containers: 'photo', warehouse: 'photo', wall: 'wall', black: 'black' };
  // the backdrop pictures. x, y: the point that stays in view when the window is tall and narrow.
  // drop: how far down the hero the photo's top edge sits (0 = the photo fills the hero); ?drop=.4 tries another
  const PHOTOS = {
    containers: ['img/containers.jpg', { x: .5, drop: .45, lit: 1.15 }],
    warehouse: ['img/warehouse.jpg', { x: .4, y: .46, at: .5 }],
  };
  const dropParam = parseFloat(params.get('drop'));
  if (dropParam >= 0 && dropParam <= .8) for (const name in PHOTOS) PHOTOS[name][1].drop = dropParam;
  const look = {};
  function readLook() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('segan-look')) || {}; } catch (e) { /* private window */ }
    for (const [key, , opts] of OPTIONS) {
      const ok = opts.map((o) => o[0]);
      look[key] = ok.includes(params.get(key)) ? params.get(key) : ok.includes(saved[key]) ? saved[key] : ok[0];
    }
  }
  readLook();
  const effects = [];                              // every Fx on the page
  function applyLook(replay) {
    const root = document.documentElement;
    for (const [key, , opts] of OPTIONS.slice(1)) {
      for (const [value] of opts) root.classList.toggle(`${key}-${value}`, look[key] === value);
    }
    root.classList.toggle('serif', SERIF.includes(look.type));
    if (look.type === 'poster') root.classList.add('type-stone');   // Poster = the stone capitals over the serif
    for (const fx of effects) {
      track(fx, true);
      if (replay) fx.intro();
      fx.wake();
    }
    backdrop();
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
    if (reduced || node._busy || SERIF.includes(look.type)) return;   // the serif stays still
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

  // ---------- type that cracks when touched ----------
  // The letters split into slabs that slip apart and drop back: an SVG filter
  // (index.html, #break-l for big type, #break-s for small) whose strength is
  // stepped here.
  const BREAK = [1, .5, .78, .3, .46, .12, 0];
  const breakers = {};
  function crack(node, big) {
    if (reduced || look.type === 'clean') return;
    const id = big ? 'break-l' : 'break-s';
    const b = breakers[id] || (breakers[id] = {
      map: $(`#${id} feDisplacementMap`), noise: $(`#${id} feTurbulence`), node: null, timer: 0,
    });
    if (b.node === node) return;
    clearInterval(b.timer);
    if (b.node) b.node.style.filter = '';
    b.node = node;
    const peak = big ? Math.max(18, node.getBoundingClientRect().height * .28) : 9;
    let i = 0;
    const step = () => {
      const k = BREAK[i++];
      if (k === 0 || k === undefined) {
        clearInterval(b.timer);
        node.style.filter = '';
        b.node = null;
        return;
      }
      b.noise.setAttribute('seed', 1 + ((Math.random() * 90) | 0));
      b.map.setAttribute('scale', (peak * k).toFixed(1));
      node.style.filter = `url(#${id})`;
    };
    step();
    b.timer = setInterval(step, 62);
  }
  const breakable = (node, big) => {
    node.addEventListener('pointerenter', () => crack(node, big));
    return node;
  };
  document.querySelectorAll('[data-break]').forEach((n) => breakable(scatter(n), true));

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
    $('#dock-title').textContent = rel.title;
    $('#dock-art').src = rel.art || '';
    $('#dock-out').href = url;
    $('#dock-time').textContent = 'Loading';
    $('#dock-fill').style.width = '0';
    dock.el.hidden = false;
    document.body.style.paddingBottom = '64px';
    try { await loadWidgetApi(); } catch (e) { window.open(url, '_blank', 'noopener'); return; }
    const src = 'https://w.soundcloud.com/player/?url=' + encodeURIComponent(url) + '&auto_play=true&show_artwork=false';
    if (!dock.frame) {
      dock.frame = Object.assign(document.createElement('iframe'), { className: 'sc-frame', allow: 'autoplay; encrypted-media', title: 'SoundCloud player', src });
      document.body.appendChild(dock.frame);
      dock.widget = window.SC.Widget(dock.frame);
      const E = window.SC.Widget.Events;
      dock.widget.bind(E.READY, () => dock.widget.getDuration((ms) => { dock.dur = ms; }));
      dock.widget.bind(E.PLAY_PROGRESS, (e) => {
        $('#dock-fill').style.width = (e.relativePosition * 100).toFixed(2) + '%';
        $('#dock-time').textContent = `${clock(e.currentPosition)} / ${clock(dock.dur || rel.seconds * 1000)}`;
      });
      dock.widget.bind(E.PLAY, () => $('#dock-play').classList.remove('paused'));
      dock.widget.bind(E.PAUSE, () => $('#dock-play').classList.add('paused'));
    } else {
      dock.widget.load(url, { auto_play: true, show_artwork: false, callback: () => dock.widget.getDuration((ms) => { dock.dur = ms; }) });
    }
  }
  $('#dock-play').addEventListener('click', () => dock.widget && dock.widget.toggle());
  $('#dock-close').addEventListener('click', () => {
    if (dock.widget) dock.widget.pause();
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
      const a = el('a', big ? 'btn' + (rel.links.soundcloud ? '' : ' btn-solid') : '', 'Spotify ↗');
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
      const a = el('a', 'btn', 'SoundCloud ↗');
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

  // the newest release, at the foot of the first screen
  function heroNew(rel) {
    const s = split(rel.title);
    $('#hero-new-art').src = rel.art || '';
    $('#hero-new-kind').textContent = 'New ' + (TYPE[rel.type] || rel.type).toLowerCase();
    $('#hero-new-date').textContent = fullDay(rel.date);
    $('#hero-new-title').textContent = s.name;
    $('#hero-new-by').textContent = [s.by, s.suffix].filter(Boolean).join(' / ');
    // Play (or Spotify when it is not on SoundCloud), the free download if there is one, and the way down
    const [first, ...others] = actions(rel, true);
    const more = el('a', 'btn', 'More ↓');
    more.href = '#new';
    $('#hero-new-actions').append(first, ...others.filter((n) => n.href === rel.links.download), more);
    $('#hero-new-cover').addEventListener('click', () => play(rel));
    breakable(scatter($('#hero-new-title')), true);
    $('#hero-new').hidden = false;
  }

  function feature(rel) {
    const s = split(rel.title);
    const box = $('#feature');
    const cover = el('div', 'cover arrive');
    const img = Object.assign(el('img'), { src: rel.art, alt: rel.title + ' cover' });
    cover.append(img);
    const text = el('div', 'feature-text arrive');
    const meta = el('div', 'feature-meta');
    meta.append(tag(rel), el('span', '', rel.genre), ...(rel.label ? [el('span', '', rel.label)] : []), el('span', '', fullDay(rel.date)));
    text.append(meta);
    if (s.by) text.append(el('p', 'feature-by', s.by));
    text.append(breakable(scatter(el('h3', 'feature-title', s.name)), true));
    if (s.suffix) text.append(el('p', 'feature-suffix', s.suffix));
    if (rel.note) text.append(el('p', 'feature-note', rel.note));
    const act = el('div', 'feature-actions');
    act.append(...actions(rel, true));
    text.append(act);
    box.append(cover, text);
    $('#new-date').textContent = fullDay(rel.date);

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
      addEventListener('resize', () => { if (canvas.clientWidth) { fx.resize(); fx.setSource(coverSource(fx, img)); } });
    });
  }

  function also(rels) {
    const box = $('#also');
    for (const rel of rels) {
      const s = split(rel.title);
      const card = el('button', 'card arrive');
      card.type = 'button';
      const cover = el('div', 'cover');
      cover.append(Object.assign(el('img'), { src: rel.art, alt: '', loading: 'lazy' }));
      const text = el('div');
      const meta = el('div', 'card-meta');
      meta.append(tag(rel), el('span', '', fullDay(rel.date)));
      const name = scatter(el('div', 'card-title', s.name));
      text.append(meta, name);
      if (s.by || s.suffix) text.append(el('div', 'card-by', [s.by, s.suffix].filter(Boolean).join(' / ')));
      card.append(cover, text);
      card.addEventListener('click', () => play(rel));
      card.addEventListener('pointerenter', () => crack(name, false));
      box.append(card);
    }
  }

  const peek = { el: $('#peek'), canvas: $('#peek canvas'), cache: new Map(), cur: null };
  function showPeek(rel) {
    if (!fine || !rel.art) return;
    peek.cur = rel.slug;
    const go = (img) => { if (peek.cur === rel.slug) { resolve(peek.canvas, img); peek.el.classList.add('on'); } };
    if (peek.cache.has(rel.slug)) go(peek.cache.get(rel.slug));
    else loadImage(rel.art).then((img) => { peek.cache.set(rel.slug, img); go(img); });
  }
  if (fine) addEventListener('pointermove', (e) => {
    const x = Math.min(innerWidth - 276, e.clientX + 28), y = Math.min(innerHeight - 276, Math.max(12, e.clientY - 130));
    peek.el.style.transform = `translate(${x}px, ${y}px)`;
  }, { passive: true });

  function list(all) {
    const box = $('#list'), more = $('#more');
    const groups = { all: () => true, original: (r) => r.type === 'original', flip: (r) => r.type !== 'original' };
    let filter = 'all', open = false;
    document.querySelectorAll('.filters button').forEach((b) => {
      $('i', b).textContent = all.filter(groups[b.dataset.filter]).length;
      b.addEventListener('click', () => {
        filter = b.dataset.filter;
        document.querySelectorAll('.filters button').forEach((o) => o.setAttribute('aria-pressed', o === b));
        draw();
      });
    });
    more.addEventListener('click', () => { open = !open; draw(); });
    function draw() {
      const rows = all.filter(groups[filter]);
      const shown = open ? rows : rows.slice(0, FIRST);
      box.textContent = '';
      let year = '';
      for (const rel of shown) {
        if (rel.date.slice(0, 4) !== year) {
          year = rel.date.slice(0, 4);
          box.append(el('li', 'row-year', year));
        }
        const s = split(rel.title);
        const li = el('li', 'row');
        const title = scatter(el('button', 'row-title'));
        title.type = 'button';
        title.append(s.by ? s.by + ' - ' : '', s.name, ...(s.suffix ? [' ', el('small', '', `(${s.suffix})`)] : []));
        title.addEventListener('click', () => play(rel));
        const links = el('div', 'row-links');
        links.append(...actions(rel, false));
        const thumb = Object.assign(el('img'), { src: rel.art || '', alt: '', loading: 'lazy', width: 44, height: 44 });
        const type = el('span', 'row-type'); type.append(tag(rel));
        li.append(el('span', 'row-date', day(rel.date)), thumb, title, type, el('span', 'row-genre', rel.genre), links);
        li.addEventListener('pointerenter', () => { showPeek(rel); crack(title, false); });
        li.addEventListener('pointerleave', () => { peek.cur = null; peek.el.classList.remove('on'); });
        box.append(li);
      }
      more.hidden = rows.length <= FIRST;
      more.textContent = open ? 'Show fewer ↑' : `Show all ${rows.length} ↓`;
    }
    draw();
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

  // ---------- options panel: a tab on the right edge opens it ----------
  function options() {
    const root = document.documentElement, tab = $('#opt-tab'), panel = $('#opt'), groups = $('#opt-groups');
    const open = (on) => {
      root.classList.toggle('opt-open', on);
      panel.inert = !on;
      tab.setAttribute('aria-expanded', on);
    };
    const keep = () => {
      try { localStorage.setItem('segan-look', JSON.stringify(look)); } catch (e) { /* private window */ }
    };
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
    root.classList.toggle('past', scrollY > $('#hero').offsetHeight - 120);
  }
  addEventListener('scroll', past, { passive: true });
  addEventListener('hashchange', route);
  route();

  async function main() {
    startHero();
    const all = await (await fetch('releases.json')).json();
    const [first, ...rest] = all;
    heroNew(first);
    $('#hero-count').textContent = `${all.length} releases`;
    const originals = all.filter((r) => r.type === 'original').length;
    $('#about-count').textContent = `${originals} originals, ${all.length - originals} edits and bootlegs`;
    feature(first);
    also(rest.slice(0, 3));
    list(all);
    arrivals();
  }
  main();
})();
