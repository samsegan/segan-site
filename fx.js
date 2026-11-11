// The effect on the SEGAN wordmark and on cover art. One fragment shader, no
// library. Four ways for the picture to react to the pointer:
//
//   pixels:  the canvas is cut into a coarse grid. Moving the pointer pushes the
//            grid's cells along with it (each cell slides as a block, splits
//            into smaller blocks, and its red/green/blue slide by different
//            amounts), then they settle back.
//   chrome:  where the pointer has been, the picture melts into liquid chrome
//            and flows, then sets again.
//   crumble: the picture is cracked into shards. Under the pointer they slip
//            and drop, leaving gaps, then climb back.
//   streak:  a long exposure. Moving the pointer drags the picture out into
//            light trails.
//
// Behind the wordmark:
//   back:    'photo': a picture, lit by a camera flash that follows the
//            pointer. 'wall': a block wall under the same flash. 'black': the
//            page colour and a faint dot grid. The letters throw a shadow.
//
// The canvas only redraws while something is moving.
(() => {
  'use strict';

  const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = vec2(aPos.x * .5 + .5, .5 - aPos.y * .5);   // (0,0) = top left
  gl_Position = vec4(aPos, 0., 1.);
}`;

  const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uSrc, uGrid, uPhoto;
uniform vec2 uRes, uCells, uDrift;
uniform vec4 uFit;        // the part of the photo that fills the canvas: size xy, corner xy (corner y < 0: the photo starts lower down)
uniform float uMosaic, uBarrel, uTime, uMark, uDpr, uMode, uBack, uHeat, uShard, uLit, uAmt, uChrome;
uniform vec3 uBg;

vec2 w;                   // this pixel, bent a little as the page scrolls away

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x),
             mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0., a = .5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 11.7; a *= .5; }
  return v;
}

vec4 src(vec2 p) {
  vec2 uv = p / uRes;
  if (uMark < .5) return texture2D(uSrc, clamp(uv, 0., 1.));
  float inside = step(0., uv.x) * step(uv.x, 1.) * step(0., uv.y) * step(uv.y, 1.);
  return texture2D(uSrc, uv) * inside;
}

// the picture moved by off (pixels)
void fetch(vec2 off, out vec3 col, out vec3 a) {
  vec4 s = src(w - off);
  col = s.rgb;
  a = vec3(s.a);
}

// ---- pixels: the picture after the grid has had its way, at point p
vec4 blocks(vec2 p, float spread) {
  vec2 cell = floor(p / uRes * uCells);
  vec2 dv = (texture2D(uGrid, (cell + .5) / uCells).rg - .5) * 2.;
  float e = length(dv);
  float cs = uRes.x / uCells.x;
  float m = uMosaic;
  if (e > .08) m = max(m, cs / 4.);
  if (e > .38) m = max(m, cs / 2.);
  vec2 q = m > 1. ? (floor(p / m) + .5) * m : p;
  return src(q - dv * cs * 2.6 * spread);
}

// ---- crumble: shards are the cells of a scattered-point (Voronoi) pattern
vec2 site(vec2 id) {
  return (id + .18 + .64 * vec2(hash(id + 1.3), hash(id + 27.9))) * uShard;
}
vec2 nearest(vec2 p, out float edge) {
  vec2 g = floor(p / uShard), best = g;
  float d1 = 1e9, d2 = 1e9;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 id = g + vec2(float(i), float(j));
    float d = length(p - site(id));
    if (d < d1) { d2 = d1; d1 = d; best = id; } else if (d < d2) d2 = d;
  }
  edge = d2 - d1;
  return best;
}
// how far one shard has slipped (xy, pixels) and how broken it is (z)
vec3 shard(vec2 id) {
  vec4 g = texture2D(uGrid, clamp(site(id) / uRes, 0., 1.));
  float heat = max(g.b, uHeat);
  float h1 = hash(id + 3.1), h2 = hash(id + 9.7);
  float dmg = smoothstep(h1 * .45, h1 * .45 + .4, heat);      // each shard lets go at its own moment
  vec2 dv = (g.rg - .5) * 2.;
  vec2 fall = vec2((h2 - .5) * .5, .12 + h1 * .42) * (1. + max(0., uHeat - .5));
  return vec3((fall * dmg + dv * .35) * uShard, dmg);
}

// ---- photo: the backdrop picture, cut to fill the canvas
vec3 photo(vec2 p) {
  return texture2D(uPhoto, clamp(p / uRes * uFit.xy + uFit.zw, 0., 1.)).rgb;
}

// ---- wall: painted concrete blocks
vec3 wall(vec2 p) {
  vec2 q = p / uDpr / clamp(uRes.x / uDpr / 1100., .62, 1.);   // smaller blocks on a phone
  vec2 bs = vec2(196., 94.);
  float row = floor(q.y / bs.y);
  vec2 b = vec2(q.x + mod(row, 2.) * bs.x * .5, q.y);
  vec2 id = floor(b / bs);
  vec2 f = b - id * bs;
  float joint = smoothstep(1.5, 5., min(min(f.x, bs.x - f.x), min(f.y, bs.y - f.y)));
  float tone = .8 + .28 * hash(id + 2.);
  float rough = fbm(q * .035) * .5 + fbm(q * .21) * .32 + hash(floor(q)) * .18;
  float pores = step(.982, hash(floor(q / 2.) + 7.)) * (.4 + .6 * hash(floor(q / 2.) + 19.));
  float v = tone * (.52 + .62 * rough) * (1. - .34 * pores);
  v *= 1. - .3 * smoothstep(.5, .78, fbm(q * .0062 + 11.));     // grime in patches
  v *= mix(.46, 1., joint);
  v += (1. - smoothstep(4., 9., f.y)) * joint * .07;          // the lip under each joint catches the light
  v *= .82 + .36 * fbm(vec2(q.x * .021, q.y * .0034));        // old runs down the paint
  return vec3(.85, .89, .93) * v;
}

void main() {
  vec2 frag = vUv * uRes;
  vec2 c = vUv - .5;
  w = (.5 + c * (1. + uBarrel * dot(c, c) * 2.2)) * uRes;
  float cs = uRes.x / uCells.x;

  vec3 col, a;
  vec2 smear = vec2(0.);
  float on = 0.;            // streak: how far this pixel is into the smear (0 = untouched)
  if (uMode < .5) {
    vec4 sr = blocks(w, 1.), sg = blocks(w, .84), sb = blocks(w, .68);
    col = vec3(sr.r, sg.g, sb.b);
    a = vec3(sr.a, sg.a, sb.a);
  } else if (uMode < 1.5) {
    vec4 g = texture2D(uGrid, w / uRes);
    vec2 dv = (g.rg - .5) * 2.;
    float heat = clamp(max(g.b, uHeat), 0., 1.);
    vec2 np = w / uDpr * .0045;
    vec2 flow = vec2(fbm(np + vec2(0., uTime * .11)), fbm(np + vec2(5.2, -uTime * .13))) - .5;
    // uChrome: how far the picture flows and how much of it turns to metal (1 = the old, full melt)
    fetch((dv * cs * 2.4 + flow * heat * 90. * uDpr) * uChrome, col, a);
    float lum = dot(col, vec3(.3, .5, .2)) / max(a.g, .0001);
    float band = .5 + .5 * cos(lum * 13. + flow.x * 9. + flow.y * 5. + heat * 2.);
    vec3 chrome = mix(vec3(.03, .05, .07), vec3(.93, .97, 1.), smoothstep(.1, .9, band));
    chrome += pow(band, 18.) * .5;
    col = mix(col, chrome * a, smoothstep(.04, .55, heat) * min(uChrome, 1.));
  } else if (uMode < 2.5) {
    vec4 g = texture2D(uGrid, w / uRes);
    if (uHeat <= 0. && g.b < .002 && length(g.rg - .5) < .006) {
      fetch(vec2(0.), col, a);                                // nothing broken near here
    } else {
      vec2 gid = floor(w / uShard), hit = gid;
      vec3 sh = vec3(0.);
      float best = -1., edge = 0.;
      for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
        vec2 id = gid + vec2(float(i), float(j));
        vec3 s = shard(id);
        float e;
        vec2 n = nearest(w - s.xy, e);
        float pr = hash(id + 41.);
        if (abs(n.x - id.x) + abs(n.y - id.y) < .5 && pr > best) { best = pr; sh = s; edge = e; hit = id; }
      }
      if (best < 0.) { col = vec3(0.); a = vec3(0.); }        // a gap where a shard used to be
      else {
        fetch(sh.xy, col, a);
        float seam = 1. - smoothstep(0., 1.8 * uDpr, edge);
        float shade = 1. - sh.z * (.6 * seam + .22 * hash(hit + 5.));
        col *= shade;
      }
    }
  } else {
    vec4 g = texture2D(uGrid, w / uRes);
    vec2 dv = (g.rg - .5) * 2. + uDrift;
    float len = length(dv);
    // The smear fades in from nothing. A hard start left a brighter round
    // patch, with an edge, wherever the pointer had been.
    on = smoothstep(.02, .3, len);
    vec3 sharp, sa;
    fetch(vec2(0.), sharp, sa);
    if (on <= 0.) { col = sharp; a = sa; }
    else {
      vec2 stepv = dv * cs * .62 * uAmt * on;
      smear = stepv;
      float jit = hash(frag + 3.3);
      vec3 acc = vec3(0.), far = vec3(0.), aa = vec3(0.), tc, ta;
      float sum = 0., fsum = 0.;
      for (int i = 0; i < 14; i++) {
        float w = 1. - float(i) / 14.;
        fetch(stepv * (float(i) + jit), tc, ta);
        acc += tc * w; aa += ta * w; sum += w;
        far += tc * (1. - w); fsum += 1. - w;
      }
      acc /= sum; aa /= sum; far /= fsum;
      // only the brightest stone leaves a cold blue tail, like lights in a long exposure
      float hot = pow(dot(far, vec3(.34)), 3.) * smoothstep(.04, .5, len);
      vec3 trail = acc * (1. + .1 * uAmt) + hot * vec3(.3, .72, 1.3) * .7 * uAmt;
      float keep = 1. - smoothstep(.1, .8, len) * .5 * uAmt;   // the sharp picture thins out as it smears
      col = mix(sharp, max(sharp * keep, trail), on);
      a = mix(sa, clamp(max(sa * keep, aa * (1. + .45 * uAmt)), 0., 1.), on);
    }
  }

  vec3 outc;
  if (uMark > .5) {
    vec2 e = (vUv - .5) * vec2(1.16, 1.3);
    float edge = 1. - .58 * smoothstep(.38, .9, length(e));   // even light, darker towards the corners
    vec2 away = w - uRes * vec2(.5, .2);                      // the letters' shadow falls down and outwards
    float grit = .9 + .2 * hash(floor(w / uDpr));             // fine grain on the stone
    vec3 bg;
    float light;
    if (uBack > 1.5) {
      vec3 ph = photo(w);
      if (on > 0.) {                                           // streak: the lights in the picture drag too
        vec3 acc = vec3(0.);
        float jit = hash(frag + 7.1);
        for (int i = 0; i < 6; i++) acc += photo(w - smear * (float(i) + jit) * 2.2);
        ph = mix(ph, max(ph, acc / 6. * (1. + .12 * uAmt)), on);
      }
      float fade = smoothstep(0., .2, 1. - vUv.y) * (.62 + .38 * smoothstep(0., .13, vUv.y));
      fade *= smoothstep(0., .07, w.y / uRes.y * uFit.y + uFit.w);   // nothing above the photo's top edge
      bg = mix(uBg, ph * uLit * edge, fade);
      float shadow = src(w - away * .03 - vec2(0., 4. * uDpr)).a;
      bg *= 1. - .6 * shadow;
      light = 1.;
    } else if (uBack > .5) {
      float fade = smoothstep(0., .24, 1. - vUv.y) * (.55 + .45 * smoothstep(0., .14, vUv.y));
      vec3 flash = vec3(.92, .97, 1.) * .74 * edge;
      bg = uBg * .7 + wall(w) * flash * fade;
      float shadow = src(w - away * .034 - vec2(0., 3. * uDpr)).a;
      bg *= 1. - .82 * shadow;
      light = .96;
    } else {
      // a faint dot grid
      float sp = 34. * uDpr;
      vec2 dg = mod(w, sp) - sp * .5;
      float dots = (1. - smoothstep(.7 * uDpr, 1.5 * uDpr, length(dg))) * .11;
      bg = uBg + dots;
      light = .98;
    }
    outc = bg * (1. - a) + col * light * grit;
  } else {
    outc = col;
  }
  outc += (hash(frag + fract(uTime) * 91.7) - .5) * .05;
  gl_FragColor = vec4(outc, 1.);
}`;

  const MODES = { pixels: 0, chrome: 1, crumble: 2, streak: 3 };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

  class Fx {
    // canvas: where to draw. host: the element whose pointer moves drive it.
    // opts: mark (true = wordmark on a background), cell (css px per grid cell),
    //       idle (drift on its own when nobody is pointing)
    // fx:   mode ('pixels' | 'chrome' | 'crumble' | 'streak'), back ('photo' | 'wall' | 'black')
    constructor(canvas, host, opts = {}) {
      this.canvas = canvas;
      this.host = host;
      this.o = Object.assign({ mark: false, cell: 30, idle: false }, opts);
      // amount: how strong the streak is. chrome: how strong the chrome is. For both, 1 = the old look.
      this.fx = { mode: 'pixels', back: 'black', amount: .6, chrome: .4 };
      const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
      if (!gl) { this.dead = true; return; }
      this.gl = gl;
      this.prog = this.program(VERT, FRAG);
      gl.useProgram(this.prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(this.prog, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      this.u = {};
      for (const n of ['uSrc', 'uGrid', 'uPhoto', 'uFit', 'uRes', 'uCells', 'uDrift',
        'uMosaic', 'uBarrel', 'uTime', 'uMark', 'uDpr', 'uMode', 'uBack', 'uHeat', 'uShard', 'uLit', 'uAmt', 'uChrome', 'uBg']) {
        this.u[n] = gl.getUniformLocation(this.prog, n);
      }
      this.srcTex = this.texture();
      this.gridTex = this.texture();
      this.bg = hex('#06080b');

      this.pointer = { x: 0, y: 0, lx: 0, ly: 0, on: false, at: -1e9 };
      this.light = { x: 0, y: 0 };      // the point that stirs the picture: the pointer, or a slow drift
      this.scroll = 0;        // 0..1, set by the page
      this.visible = true;
      this.t0 = performance.now();
      this.last = this.t0;
      this.nextGust = 2.5;
      this.raf = 0;

      const move = (e) => {
        const b = canvas.getBoundingClientRect();
        this.pointer.x = e.clientX - b.left;
        this.pointer.y = e.clientY - b.top;
        if (!this.pointer.on) { this.pointer.lx = this.pointer.x; this.pointer.ly = this.pointer.y; }
        this.pointer.on = true;
        this.pointer.at = performance.now();
        this.wake();
      };
      host.addEventListener('pointermove', move, { passive: true });
      host.addEventListener('pointerdown', move, { passive: true });
      host.addEventListener('pointerleave', () => { this.pointer.on = false; this.wake(); });
      this.resize();
    }

    program(vs, fs) {
      const gl = this.gl;
      const p = gl.createProgram();
      for (const [type, text] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
        const s = gl.createShader(type);
        gl.shaderSource(s, text);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        gl.attachShader(p, s);
      }
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      return p;
    }

    texture() {
      const gl = this.gl;
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }

    resize() {
      if (this.dead) return;
      const b = this.canvas.getBoundingClientRect();
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.w = Math.max(1, Math.round(b.width));
      this.h = Math.max(1, Math.round(b.height));
      this.canvas.width = this.w * this.dpr;
      this.canvas.height = this.h * this.dpr;
      this.cols = Math.max(8, Math.round(this.w / this.o.cell));
      this.rows = Math.max(4, Math.round(this.h / (this.w / this.cols)));
      this.vx = new Float32Array(this.cols * this.rows);
      this.vy = new Float32Array(this.cols * this.rows);
      this.heat = new Float32Array(this.cols * this.rows);
      this.bytes = new Uint8Array(this.cols * this.rows * 4).fill(255);
      this.light.x = this.w / 2;
      this.light.y = this.h / 2;
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      this.wake();
    }

    // source: a canvas or image already sized for this canvas
    setSource(source) {
      if (this.dead) return;
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.srcTex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      this.ready = true;
      this.wake();
    }

    // The backdrop picture. focus: the point of the picture (x, y as 0..1) that
    // should sit at height `at` (0..1) of the canvas, as far as the cut allows.
    setPhoto(img, focus) {
      if (this.dead) return;
      const gl = this.gl;
      this.photoTex = this.photoTex || this.texture();
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, this.photoTex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      gl.activeTexture(gl.TEXTURE0);
      this.photo = Object.assign({ x: .5, y: .5, at: .5, drop: 0, lit: .95 }, focus, { aspect: img.naturalWidth / img.naturalHeight });
      this.wake();
    }

    // Arrive: out of big blocks, out of liquid chrome, out of rubble, or out of a streak.
    intro() {
      if (reduced) return;
      this.introAt = performance.now();
      this.wake();
    }

    wake() {
      if (this.dead || this.raf || !this.ready) return;
      this.last = performance.now();
      this.raf = requestAnimationFrame((t) => this.frame(t));
    }

    push(cx, cy, dx, dy, radius, gain, warm) {
      const { cols, rows, vx, vy, heat } = this;
      const x0 = Math.max(0, Math.floor(cx - radius)), x1 = Math.min(cols - 1, Math.ceil(cx + radius));
      const y0 = Math.max(0, Math.floor(cy - radius)), y1 = Math.min(rows - 1, Math.ceil(cy + radius));
      for (let j = y0; j <= y1; j++) {
        for (let i = x0; i <= x1; i++) {
          const d = Math.hypot(i + .5 - cx, j + .5 - cy) / radius;
          if (d >= 1) continue;
          const w = (1 - d) * (1 - d);
          vx[j * cols + i] += dx * w * gain;
          vy[j * cols + i] += dy * w * gain;
          heat[j * cols + i] = Math.min(1, heat[j * cols + i] + warm * w);
        }
      }
    }

    frame(now) {
      this.raf = 0;
      const gl = this.gl;
      const dt = Math.min(.05, (now - this.last) / 1000);
      this.last = now;
      const t = (now - this.t0) / 1000;
      const cell = this.w / this.cols;
      const p = this.pointer;
      const mode = MODES[this.fx.mode] || 0;
      const pointing = p.on && now - p.at < 2600;
      const idle = this.o.idle && !pointing && !reduced;

      // where the stirring point wants to be
      let tx = p.x, ty = p.y;
      if (idle) {
        tx = this.w * (.5 + .33 * Math.sin(t * .34));
        ty = this.h * (.47 + .09 * Math.sin(t * .52 + 1.3));
      } else if (!pointing && this.o.mark) {
        tx = this.w / 2; ty = this.h * .47;
      }
      const ease = 1 - Math.exp(-dt * (idle ? 3 : 11));
      const px = this.light.x, py = this.light.y;
      this.light.x += (tx - px) * ease;
      this.light.y += (ty - py) * ease;
      const gliding = Math.abs(tx - this.light.x) + Math.abs(ty - this.light.y) > .5;

      // the grid: settle, then take a push from whatever moved
      const decay = Math.exp(-dt * (mode === 3 ? 4 : 4.2)), cool = Math.exp(-dt * 1.15);
      const hot = mode === 1 || mode === 2;
      let energy = 0, peak = 0;
      for (let i = 0; i < this.vx.length; i++) {
        this.vx[i] *= decay;
        this.vy[i] *= decay;
        this.heat[i] *= cool;
        energy += Math.abs(this.vx[i]) + Math.abs(this.vy[i]) + (hot ? this.heat[i] : 0);
      }
      if (!reduced) {
        if (pointing) {
          const dx = (p.x - p.lx) / cell, dy = (p.y - p.ly) / cell;
          this.push(p.x / cell, p.y / cell, dx, dy, 4.6, .34, dt * 1.5 + Math.hypot(dx, dy) * .1);
        } else if (idle) {
          // streak: nothing wanders on its own. The drifting point left a round
          // smudge crawling over the letters after the pointer had stopped.
          if (mode !== 3) this.push(this.light.x / cell, this.light.y / cell,
            (this.light.x - px) / cell, (this.light.y - py) / cell, 4, .6, dt * 1.1);
          if (t > this.nextGust) {            // a short sideways jolt across the letters
            this.nextGust = t + 2.4 + Math.random() * 3.2;
            const row = Math.floor(this.rows * (.34 + Math.random() * .3));
            const len = 4 + Math.floor(Math.random() * this.cols * .28);
            const start = Math.floor(Math.random() * (this.cols - len));
            const force = (Math.random() < .5 ? -1 : 1) * (.3 + Math.random() * .35);
            const tall = 1 + Math.floor(Math.random() * 2) + (mode ? 1 : 0);
            for (let j = row; j < Math.min(this.rows, row + tall); j++) {
              for (let i = start; i < start + len; i++) {
                this.vx[j * this.cols + i] += force;
                this.heat[j * this.cols + i] = Math.min(1, this.heat[j * this.cols + i] + .55);
              }
            }
          }
        }
      }
      p.lx = p.x; p.ly = p.y;
      for (let i = 0; i < this.vx.length; i++) {
        const m = Math.hypot(this.vx[i], this.vy[i]);
        const s = m > 1 ? 1 / m : 1;
        this.vx[i] *= s; this.vy[i] *= s;
        peak = Math.max(peak, m);
        this.bytes[i * 4] = 127.5 + this.vx[i] * 127.5;
        this.bytes[i * 4 + 1] = 127.5 + this.vy[i] * 127.5;
        this.bytes[i * 4 + 2] = this.heat[i] * 255;
      }

      // arriving, and breaking up as the page scrolls away
      let mosaic = 0, floor = 0, driftX = 0, driftY = 0;
      let running = false;
      if (this.introAt) {
        const k = (now - this.introAt) / (mode ? 1500 : 1100);
        if (k < 1) {
          running = true;
          const left = (1 - k) * (1 - k);
          if (mode === 0) mosaic = [72, 48, 28, 16, 8, 4][Math.floor(k * 6)];
          else if (mode === 3) driftX = left * 1.3;
          else floor = left * (mode === 2 ? 1.5 : 1);
        } else this.introAt = 0;
      }
      if (this.scroll > .03) {
        if (mode === 0) mosaic = Math.max(mosaic, [0, 4, 8, 16, 28, 44, 64][Math.min(6, Math.floor(this.scroll * 8))]);
        else if (mode === 3) driftY = -this.scroll * 1.2;
        else floor = Math.max(floor, this.scroll * 1.15);
      }

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.gridTex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.cols, this.rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.bytes);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.srcTex);
      const d = this.dpr, u = this.u;
      gl.uniform1i(u.uSrc, 0);
      gl.uniform1i(u.uGrid, 1);
      gl.uniform2f(u.uRes, this.w * d, this.h * d);
      gl.uniform2f(u.uCells, this.cols, this.rows);
      gl.uniform2f(u.uDrift, driftX, driftY);
      gl.uniform1f(u.uMosaic, mosaic * d);
      gl.uniform1f(u.uBarrel, this.scroll * .9);
      gl.uniform1f(u.uTime, reduced ? 0 : t);
      gl.uniform1f(u.uMark, this.o.mark ? 1 : 0);
      gl.uniform1f(u.uDpr, d);
      gl.uniform1f(u.uMode, mode);
      let back = this.fx.back === 'wall' ? 1 : 0;
      if (this.fx.back === 'photo' && this.photo) {
        back = 2;
        const f = this.photo, ca = this.w / this.h;
        const sx = Math.min(1, ca / f.aspect), sy = Math.min(1, f.aspect / ca);
        const ox = Math.min(1 - sx, Math.max(0, f.x - sx / 2));
        // drop: the photo's top edge sits that far down the canvas, with nothing above it
        const oy = f.drop ? -f.drop * sy : Math.min(1 - sy, Math.max(0, f.y - f.at * sy));
        gl.uniform4f(u.uFit, sx, sy, ox, oy);
        gl.uniform1f(u.uLit, f.lit);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, this.photoTex);
        gl.activeTexture(gl.TEXTURE0);
      }
      gl.uniform1i(u.uPhoto, 2);
      gl.uniform1f(u.uBack, back);
      gl.uniform1f(u.uHeat, floor);
      gl.uniform1f(u.uAmt, this.fx.amount);
      gl.uniform1f(u.uChrome, this.fx.chrome);
      gl.uniform1f(u.uShard, cell * 1.5 * d);
      gl.uniform3fv(u.uBg, this.bg);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      const moving = idle || pointing || running || gliding || energy > .02 || peak > .004;
      if (moving && this.visible && !document.hidden) this.wake();
    }
  }

  window.Fx = Fx;
})();
