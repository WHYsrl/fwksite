/* =========================================================
   L'ORGANISMO — motore (canvas 2D) e regia dei due schermi.
   Un solo organismo per tutto il sito. Ogni segnale del Radar è un nodo che cresce nel settore del suo
   sistema (Content · Activation · Spatial · Adaptive), collegato al nodo più vicino: una colonia dendritica
   che parte dal cubo del logo. Gli umori dei visitatori danno il temperamento (i colori), il meteo di Roma
   il ritmo (battito, ondeggio, pioggia, temporale), i clic e i tocchi sono stimoli che restano.
   Le posizioni "di casa" vivono in uno spazio unitario (angolo, raggio) e si proiettano sullo schermo che
   c'è: in 16:9 è largo, in 9:16 è alto. Si riconfigura per costruzione, non per ritaglio.
   Secondo schermo: stessa stanza via SSE; tocchi e inclinazione viaggiano tra desktop e telefono.
   ========================================================= */
(() => {
  "use strict";
  const ORG = window.__ORG__ || {}; const PHONE = !!ORG.phone;
  const TAU = Math.PI * 2, DAY = 86400000;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, r = document) => r.querySelector(s);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const unit = (h, k) => (((h >>> (k * 8)) & 255) / 255); // 4 numeri 0..1 da un hash
  const SECTOR = { "content-system": 0, "activation-system": 1, "spatial-experiences": 2, "adaptive-media": 3 };
  const SECTOR_NAME = ["Content System", "Activation System", "Spatial Experiences", "Adaptive Media"];
  const SECTOR_ANGLE = [-Math.PI / 2, 0, Math.PI / 2, Math.PI]; // alto · destra · basso · sinistra
  const MOOD = { vivid: { name: "acceso", rgb: [191, 0, 255] }, calm: { name: "notturno", rgb: [138, 124, 255] }, nervous: { name: "quieto", rgb: [95, 191, 165] }, light: { name: "chiaro", rgb: [214, 150, 255] } };
  const WEATHER = { sun: { energy: 1.05, label: "sereno" }, cloud: { energy: .8, label: "nuvoloso" }, rain: { energy: .55, label: "piove", droop: 1 }, storm: { energy: 1.35, label: "temporale", storm: 1 }, snow: { energy: .45, label: "neve", droop: .5 }, night: { energy: .5, label: "notte" }, unknown: { energy: .8, label: "" } };
  const MAX_NODES = PHONE ? 64 : 140, MAX_STIM = PHONE ? 30 : 110, REP = PHONE ? 15 : 22;
  const fmtDay = (ms) => new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long" }).format(new Date(ms));
  const fmtDate = (iso) => { try { return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" }).format(new Date(iso)); } catch { return ""; } };
  const cssVar = (n, d) => (getComputedStyle(document.documentElement).getPropertyValue(n) || "").trim() || d;
  const hexRgb = (h) => { h = h.replace("#", ""); if (h.length === 3) h = h.split("").map(c => c + c).join(""); const v = parseInt(h, 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
  const mix = (a, b, k) => [Math.round(lerp(a[0], b[0], k)), Math.round(lerp(a[1], b[1], k)), Math.round(lerp(a[2], b[2], k))];
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const ease = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

  // ---------- sprite (punto luminoso) con cache per colore ----------
  const sprites = new Map();
  function sprite(rgb, size) {
    const key = rgb.join(",") + "/" + size; if (sprites.has(key)) return sprites.get(key);
    const c = document.createElement("canvas"); c.width = c.height = size; const x = c.getContext("2d");
    const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(.22, rgba(rgb, .95)); g.addColorStop(.5, rgba(rgb, .25)); g.addColorStop(1, rgba(rgb, 0));
    x.fillStyle = g; x.fillRect(0, 0, size, size); sprites.set(key, c); return c;
  }

  // ================= L'organismo =================
  class Organismo {
    constructor(stage, glow, cv) {
      this.stage = stage; this.glow = glow; this.cv = cv; this.ctx = cv.getContext("2d"); this.gctx = glow.getContext("2d");
      this.W = 0; this.H = 0; this.dpr = 1; this.t = 0; this.phase = 0; this.heart = 0;
      this.nodes = new Map(); this.list = []; this.pulses = []; this.waves = []; this.ghost = null;
      this.signals = []; this.stimoli = []; this.umori = []; this.weather = WEATHER.unknown; this.weatherRaw = null; this.born = Date.now(); this.now = Date.now(); this.until = Infinity;
      this.assimilated = 0; this.pointer = null; this.drag = false; this.g = { x: 0, y: 0 }; this.gTarget = { x: 0, y: 0 }; this.gAt = 0;
      this.temper = MOOD.vivid.rgb; this.accent = hexRgb(cssVar("--accent", "#BF00FF")); this.color = this.temper;
      this.anchor = null; this.tendril = 0; this.nextFlash = 6; this.flashEl = null; this.arrive = 0;
      this.onTick = null; this.shake = 0;
    }
    // ---- geometria: spazio unitario → schermo ----
    layout() {
      const W = this.W, H = this.H, portrait = H > W * 1.1;
      this.cx = portrait ? W * .5 : W * .6; this.cy = portrait ? H * .48 : H * .49;
      this.RX = portrait ? W * .40 : Math.min(W * .245, H * .40); this.RY = portrait ? H * .34 : H * .36;
    }
    map(a, r) { return { x: this.cx + Math.cos(a) * r * this.RX, y: this.cy + Math.sin(a) * r * this.RY }; }
    unmap(x, y) { const ux = (x - this.cx) / this.RX, uy = (y - this.cy) / this.RY; return { a: Math.atan2(uy, ux), r: Math.min(1.35, Math.hypot(ux, uy)) }; }
    resize() {
      const r = this.stage.getBoundingClientRect(); if (!r.width || !r.height) return false;
      this.dpr = Math.min(1.5, window.devicePixelRatio || 1); this.W = Math.round(r.width); this.H = Math.round(r.height);
      this.cv.width = this.W * this.dpr; this.cv.height = this.H * this.dpr; this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.gs = .25; this.glow.width = Math.max(2, Math.round(this.W * this.gs)); this.glow.height = Math.max(2, Math.round(this.H * this.gs));
      this.layout(); return true;
    }
    // ---- dati ----
    setStato(s) {
      this.born = Date.parse(s.born_at) || Date.now(); this.now = Date.parse(s.now) || Date.now();
      this.signals = s.signals.map(x => ({ ...x, ms: Date.parse(x.t) })).filter(x => x.ms).sort((a, b) => a.ms - b.ms);
      this.stimoli = s.stimoli.map(x => ({ ...x, ms: Date.parse(x.t) })).filter(x => x.ms).sort((a, b) => a.ms - b.ms);
      this.umori = s.umori.map(x => ({ ...x, ms: Date.parse(x.t) })).filter(x => x.ms);
      this.totals = s.totals || {}; this.setWeather(s.weather); this.rebuild();
    }
    setWeather(w) { this.weatherRaw = w || null; this.weather = WEATHER[(w && w.kind) || "unknown"] || WEATHER.unknown; }
    addStimolo(e) { const ms = Date.parse(e.t) || Date.now(); const k = { ...e, ms }; this.stimoli.push(k); this.rebuild(); return k; }
    // il server ha dato allo stimolo il suo orario: il nodo cambia nome senza rinascere
    retime(k, t) {
      const ms = Date.parse(t); if (!ms || ms === k.ms) return; const oldId = "k:" + k.ms + ":" + (+k.a).toFixed(3), newId = "k:" + ms + ":" + (+k.a).toFixed(3);
      const n = this.nodes.get(oldId); k.ms = ms; k.t = t; if (n) { this.nodes.delete(oldId); n.id = newId; n.ms = ms; this.nodes.set(newId, n); for (const c of this.list) if (c.parent === oldId) c.parent = newId; }
      this.rebuild();
    }
    addUmore(mood) { this.umori.push({ mood, ms: Date.now() }); this.temperament(); }
    temperament() {
      const lim = this.until; const cnt = {}; let n = 0;
      for (const u of this.umori) if (u.ms <= lim && MOOD[u.mood]) { cnt[u.mood] = (cnt[u.mood] || 0) + 1; n++; }
      let rgb = [0, 0, 0];
      if (!n) rgb = MOOD.vivid.rgb.slice(); else for (const k in cnt) rgb = rgb.map((v, i) => v + MOOD[k].rgb[i] * cnt[k] / n);
      this.temper = rgb.map(Math.round); this.moodCounts = cnt; this.moodN = n;
      this.accent = hexRgb(cssVar("--accent", "#BF00FF")); this.color = mix(this.temper, this.accent, .45);
    }
    rebuild() {
      this.temperament();
      const lim = this.until; const sig = this.signals.filter(s => s.ms <= lim); this.assimilated = Math.max(0, sig.length - MAX_NODES);
      const vis = sig.slice(this.assimilated); const want = new Map(); const placed = [];
      const span = .32 + .68 * Math.min(1, vis.length / MAX_NODES); // da giovane è piccolo: cresce con quello che mangia
      vis.forEach((s, i) => {
        const h = hash(s.id); const sec = SECTOR[s.caps[0]] != null ? SECTOR[s.caps[0]] : (h % 4); const free = SECTOR[s.caps[0]] == null;
        const a = SECTOR_ANGLE[sec] + (unit(h, 1) - .5) * (free ? TAU * .45 : TAU * .23);
        const r = (.2 + .78 * (vis.length > 1 ? i / (vis.length - 1) : .5) * (.86 + unit(h, 2) * .28)) * span;
        let parent = null, best = 1e9;
        for (const p of placed) { if (p.sec !== sec) continue; const d = Math.hypot(Math.cos(p.a) * p.r - Math.cos(a) * r, Math.sin(p.a) * p.r - Math.sin(a) * r); if (d < best) { best = d; parent = p.id; } }
        const n = { id: "s:" + s.id, kind: "sig", sec, free, a, r: Math.min(r, 1.1), size: 2 + (s.score / 100) * 2.4, parent, sig: s, ms: s.ms };
        want.set(n.id, n); placed.push(n);
      });
      const st = this.stimoli.filter(k => k.ms <= lim).slice(-MAX_STIM);
      for (const k of st) {
        let parent = null, best = 1e9;
        for (const p of placed) { const d = Math.hypot(Math.cos(p.a) * p.r - Math.cos(k.a) * k.r, Math.sin(p.a) * p.r - Math.sin(k.a) * k.r); if (d < best) { best = d; parent = p.id; } }
        const id = "k:" + k.ms + ":" + (+k.a).toFixed(3);
        want.set(id, { id, kind: "stim", sec: -1, a: k.a, r: k.r, size: 1.7, parent, stim: k, ms: k.ms });
      }
      // riconcilia: chi c'è resta (aggiorna casa), chi arriva nasce dal genitore, chi manca muore
      for (const [id, w] of want) {
        const ex = this.nodes.get(id);
        if (ex) { Object.assign(ex, { a: w.a, r: w.r, size: w.size, parent: w.parent, sec: w.sec, dying: false }); continue; }
        const pn = w.parent ? this.nodes.get(w.parent) : null; const home = this.map(w.a, w.r);
        const start = pn ? { x: pn.x, y: pn.y } : (this.arrive ? { x: this.cx + (Math.random() - .5) * this.W * .6, y: -40 } : { x: this.cx, y: this.cy });
        this.nodes.set(id, { ...w, x: start.x, y: start.y, vx: 0, vy: 0, age: 0, flash: 0, scale: 0, dying: false, ph: Math.random() * TAU, children: [] });
        void home;
      }
      for (const [id, n] of this.nodes) if (!want.has(id)) n.dying = true;
      this.list = [...this.nodes.values()];
      for (const n of this.list) n.children.length = 0;
      for (const n of this.list) { if (n.parent && this.nodes.has(n.parent)) this.nodes.get(n.parent).children.push(n); }
      this.core = this.list.filter(n => !n.parent && !n.dying);
    }
    setUntil(ms) { this.until = ms; this.rebuild(); }
    // ---- stimoli ed effetti ----
    shock(x, y, k = 1) {
      this.waves.push({ x, y, t: 0, k });
      for (const n of this.list) { const dx = n.x - x, dy = n.y - y; const d = Math.hypot(dx, dy) || 1; const f = Math.max(0, 1 - d / (240 * k)) * 9 * k; n.vx += dx / d * f; n.vy += dy / d * f; }
    }
    nodeAt(x, y) { let best = null, bd = 1e9; for (const n of this.list) { if (n.dying) continue; const d = Math.hypot(n.x - x, n.y - y); const rr = Math.max(11, n.size * 3.2); if (d < rr && d < bd) { bd = d; best = n; } } return best; }
    setTilt(gx, gy) { this.gTarget = { x: clamp(gx, -1, 1), y: clamp(gy, -1, 1) }; this.gAt = this.t; }
    // ---- fisica ----
    update(dt) {
      this.t += dt; const E = this.weather.energy; const f = clamp(dt * 60, .5, 2);
      const bpm = (46 + 34 * E) * (this.shake > 0 ? 1.4 : 1); this.phase += dt * bpm / 60 * TAU; this.heart = Math.pow(Math.max(0, Math.sin(this.phase)), 10);
      const breath = 1 + (reduced ? 0 : .012 * Math.sin(this.phase * .5) + .012 * this.heart);
      if (this.t - this.gAt > 1.6) this.gTarget = { x: 0, y: 0 };
      this.g.x = lerp(this.g.x, this.gTarget.x, .08 * f); this.g.y = lerp(this.g.y, this.gTarget.y, .08 * f);
      const wind = this.weatherRaw && this.weatherRaw.wind != null ? clamp(this.weatherRaw.wind / 30, 0, 1) : .15;
      const droop = this.weather.droop || 0; const gk = Math.min(this.W, this.H) * .16;
      this.shake = Math.max(0, this.shake - dt);
      const ptr = this.pointer, ghost = this.ghost;
      for (const n of this.list) {
        n.age += dt;
        if (n.dying) { n.scale = Math.max(0, n.scale - dt * 1.6); } else n.scale = ease(n.age / 1.3);
        n.flash = Math.max(0, n.flash - dt * 1.8);
        const h = this.map(n.a, n.r); const rn = n.r;
        let tx = this.cx + (h.x - this.cx) * breath + this.g.x * gk * (.25 + .75 * rn) + Math.sin(this.t * .55 + rn * 3 + n.ph * .2) * 9 * wind * rn;
        let ty = this.cy + (h.y - this.cy) * breath + this.g.y * gk * (.25 + .75 * rn) + droop * 16 * rn * rn + Math.cos(this.t * .4 + n.ph) * 4 * wind * rn;
        n.vx += (tx - n.x) * .028 * f; n.vy += (ty - n.y) * .028 * f;
        if (!reduced) { const amp = .06 * (.6 + E) * f; n.vx += Math.sin(this.t * 1.4 + n.ph) * amp; n.vy += Math.cos(this.t * 1.1 + n.ph * 1.3) * amp; }
        if (this.weather.storm && !reduced) { n.vx += (Math.random() - .5) * .5 * f; n.vy += (Math.random() - .5) * .5 * f; }
        if (this.shake > 0) { n.vx += (Math.random() - .5) * 3 * f; n.vy += (Math.random() - .5) * 3 * f; }
        for (const p of [ptr, ghost]) { if (!p) continue; const dx = p.x - n.x, dy = p.y - n.y; const d = Math.hypot(dx, dy); const R = p.drag ? 260 : 150; if (d < R && d > 1) { const s = (1 - d / R) * (p.drag ? .05 : .012) * f; n.vx += dx / d * s * d; n.vy += dy / d * s * d; } }
        n.vx *= Math.pow(.86, f); n.vy *= Math.pow(.86, f); n.x += n.vx * f; n.y += n.vy * f;
      }
      // repulsione fra vicini (n piccolo: va bene il quadratico)
      const L = this.list, R = REP;
      for (let i = 0; i < L.length; i++) { const a = L[i]; for (let j = i + 1; j < L.length; j++) { const b = L[j]; const dx = b.x - a.x, dy = b.y - a.y; const d2 = dx * dx + dy * dy; if (d2 < R * R && d2 > .01) { const d = Math.sqrt(d2); const s = (1 - d / R) * .9 * f; a.vx -= dx / d * s; a.vy -= dy / d * s; b.vx += dx / d * s; b.vy += dy / d * s; } } }
      // rimuovi i morti
      if (this.list.some(n => n.dying && n.scale <= 0)) { for (const [id, n] of this.nodes) if (n.dying && n.scale <= 0) this.nodes.delete(id); this.rebuild(); }
      // impulsi lungo i legami: partono dal cuore, saltano di nodo in nodo
      if (!reduced && Math.random() < dt * (0.9 + 1.6 * E) && this.core.length) { const to = this.core[Math.floor(Math.random() * this.core.length)]; this.pulses.push({ from: null, to, t: 0, v: .9 + Math.random() * .6 + E * .4 }); }
      for (let i = this.pulses.length - 1; i >= 0; i--) {
        const p = this.pulses[i]; p.t += dt * p.v; if (p.t < 1) continue;
        p.to.flash = 1; const kids = p.to.children.filter(c => !c.dying);
        if (kids.length && Math.random() < .85) { p.from = p.to; p.to = kids[Math.floor(Math.random() * kids.length)]; p.t = 0; } else this.pulses.splice(i, 1);
      }
      if (this.pulses.length > 60) this.pulses.length = 60;
      for (const w of this.waves) w.t += dt * 1.1; this.waves = this.waves.filter(w => w.t < 1);
      this.tendril = Math.max(this.phoneOn ? .3 : 0, this.tendril - dt * .6);
      if (this.weather.storm && !reduced) { this.nextFlash -= dt; if (this.nextFlash <= 0) { this.nextFlash = 4 + Math.random() * 8; if (this.flashEl) { this.flashEl.classList.remove("on"); void this.flashEl.offsetWidth; this.flashEl.classList.add("on"); } for (const n of this.list) n.flash = Math.max(n.flash, .6); } }
      if (this.arrive > 0) this.arrive = Math.max(0, this.arrive - dt);
    }
    // ---- disegno ----
    curve(ctx, a, b, i) { const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2; const dx = b.x - a.x, dy = b.y - a.y; const L = Math.hypot(dx, dy) || 1; const w = Math.sin(this.t * .8 + i) * Math.min(8, L * .12); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(mx - dy / L * w, my + dx / L * w, b.x, b.y); return { cx: mx - dy / L * w, cy: my + dx / L * w }; }
    pointOn(a, c, b, t) { const u = 1 - t; return { x: u * u * a.x + 2 * u * t * c.cx + t * t * b.x, y: u * u * a.y + 2 * u * t * c.cy + t * t * b.y }; }
    draw() {
      const ctx = this.ctx, W = this.W, H = this.H, col = this.color, E = this.weather.energy; const heart = this.heart;
      ctx.clearRect(0, 0, W, H);
      const core = { x: this.cx + this.g.x * Math.min(W, H) * .03, y: this.cy + this.g.y * Math.min(W, H) * .03 };
      // aura (bassa risoluzione, additiva): la membrana morbida che unisce i nodi vicini
      const g = this.gctx, gs = this.gs; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, this.glow.width, this.glow.height); g.globalCompositeOperation = "lighter";
      const aura = (x, y, rad, a) => { const gr = g.createRadialGradient(x * gs, y * gs, 0, x * gs, y * gs, rad * gs); gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.fillRect((x - rad) * gs, (y - rad) * gs, rad * 2 * gs, rad * 2 * gs); };
      aura(core.x, core.y, 120 + 50 * heart, .2 * (.6 + E * .4));
      for (const n of this.list) if (n.scale > 0) aura(n.x, n.y, (18 + n.size * 5) * n.scale + n.flash * 16, (n.kind === "stim" ? .07 : .1) * n.scale + n.flash * .22);
      if (this.anchor && this.tendril > 0) aura(this.anchor.x, this.anchor.y, 90, .25 * this.tendril);
      ctx.globalAlpha = 1; ctx.drawImage(this.glow, 0, 0, W, H);
      // legami
      ctx.lineCap = "round"; ctx.lineWidth = 1; let i = 0;
      ctx.beginPath(); ctx.strokeStyle = rgba(mix(col, [255, 255, 255], .25), .34);
      const ctrl = new Map();
      for (const n of this.list) { i++; if (n.scale <= 0 || n.kind === "stim") continue; const p = n.parent ? this.nodes.get(n.parent) : null; const from = p ? p : core; const c = this.curve(ctx, from, n, i); ctrl.set(n, { from, c }); }
      ctx.stroke();
      ctx.beginPath(); ctx.strokeStyle = "rgba(255,255,255,.16)"; ctx.setLineDash([2, 5]);
      for (const n of this.list) { i++; if (n.scale <= 0 || n.kind !== "stim") continue; const p = n.parent ? this.nodes.get(n.parent) : null; const from = p ? p : core; const c = this.curve(ctx, from, n, i); ctrl.set(n, { from, c }); }
      ctx.stroke(); ctx.setLineDash([]);
      // filamento verso il telefono
      if (this.anchor && this.tendril > 0) {
        let near = null, bd = 1e9; for (const n of this.list) { const d = Math.hypot(n.x - this.anchor.x, n.y - this.anchor.y); if (d < bd) { bd = d; near = n; } }
        if (near) { ctx.beginPath(); ctx.strokeStyle = rgba(col, .35 + .4 * this.tendril); ctx.lineWidth = 1.2; const c = this.curve(ctx, near, this.anchor, 99); ctx.stroke(); const k = (this.t * 1.2) % 1; const pt = this.pointOn(near, c, this.anchor, this.tendrilDir < 0 ? 1 - k : k); ctx.drawImage(sprite([255, 255, 255], 22), pt.x - 11, pt.y - 11, 22, 22); ctx.lineWidth = 1; }
      }
      // impulsi
      for (const p of this.pulses) { const e = ctrl.get(p.to); if (!e) continue; const pt = this.pointOn(e.from, e.c, p.to, ease(p.t)); const s = sprite([255, 255, 255], 18); ctx.globalAlpha = .9; ctx.drawImage(s, pt.x - 9, pt.y - 9, 18, 18); }
      ctx.globalAlpha = 1;
      // nodi
      const sp = sprite(col, 32), spW = sprite([255, 255, 255], 32), spT = sprite(mix(col, [255, 255, 255], .5), 32);
      for (const n of this.list) {
        if (n.scale <= 0) continue; const s = n.kind === "stim" ? spW : (n.free ? spT : sp);
        const sz = (n.size * 4.2 + n.flash * 10) * n.scale * (1 + heart * .06);
        ctx.globalAlpha = Math.min(1, .75 + n.flash * .5);
        ctx.drawImage(s, n.x - sz, n.y - sz, sz * 2, sz * 2);
        if (n.kind === "stim") { ctx.globalAlpha = .55 * n.scale; ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.beginPath(); ctx.arc(n.x, n.y, (4.5 + n.flash * 3) * n.scale, 0, TAU); ctx.stroke(); }
      }
      ctx.globalAlpha = 1;
      // onde d'urto
      for (const w of this.waves) { ctx.beginPath(); ctx.strokeStyle = rgba(col, .5 * (1 - w.t)); ctx.lineWidth = 1.5; ctx.arc(w.x, w.y, 10 + ease(w.t) * 170 * w.k, 0, TAU); ctx.stroke(); }
      ctx.lineWidth = 1;
      // dito del telefono (o del desktop) sull'altro schermo
      if (this.ghost) { ctx.beginPath(); ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.arc(this.ghost.x, this.ghost.y, 18, 0, TAU); ctx.stroke(); ctx.drawImage(spW, this.ghost.x - 8, this.ghost.y - 8, 16, 16); }
      // il cuore: il cubo del logo, che batte
      const S = (PHONE ? 15 : 19) * (1 + heart * .16); ctx.save(); ctx.translate(core.x, core.y);
      ctx.drawImage(sprite(col, 64), -S * 2.4, -S * 2.4, S * 4.8, S * 4.8);
      const P = (pts, a) => { ctx.beginPath(); pts.forEach((p, k) => k ? ctx.lineTo(p[0] * S, p[1] * S) : ctx.moveTo(p[0] * S, p[1] * S)); ctx.closePath(); ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.fill(); };
      P([[0, -1], [.87, -.5], [0, 0], [-.87, -.5]], 1); P([[-.87, -.5], [0, 0], [0, 1], [-.87, .5]], .78); P([[.87, -.5], [.87, .5], [0, 1], [0, 0]], .55);
      ctx.restore();
    }
  }

  // ================= regia comune =================
  const stage = $("#vo-stage"), org = new Organismo(stage, $("#vo-glow"), $("#vo-cv")); org.flashEl = $("#vo-flash");
  window.__organismo = org;
  let me = "", raf = 0, last = 0, visible = true;
  const room = PHONE ? (ORG.room || "") : (() => { try { let r = sessionStorage.getItem("vo.room"); if (!r || !/^[a-z0-9]{6}$/.test(r)) { r = Math.random().toString(36).slice(2, 8).padEnd(6, "0"); sessionStorage.setItem("vo.room", r); } return r; } catch { return Math.random().toString(36).slice(2, 8).padEnd(6, "0"); } })();
  const post = (path, body) => fetch("/organismo/api/" + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, from: me, room, role: PHONE ? "phone" : "desktop" }), keepalive: true }).then(r => r.json()).catch(() => null);
  const frame = (now) => { raf = 0; if (!visible) return; const dt = Math.min(.05, (now - (last || now)) / 1000); last = now; org.update(dt); org.draw(); if (org.onTick) org.onTick(now); raf = requestAnimationFrame(frame); };
  const start = () => { if (!raf && visible) { last = 0; raf = requestAnimationFrame(frame); } };
  document.addEventListener("visibilitychange", () => { visible = !document.hidden; if (visible) start(); });
  new ResizeObserver(() => { if (org.resize()) { org.rebuild(); placeAnchor(); } }).observe(stage);
  org.resize();

  const feedTick = (cls) => { const f = document.querySelector(".vo-feed ." + cls); if (!f) return; f.classList.remove("tick"); void f.offsetWidth; f.classList.add("tick"); };
  const mood = { get() { try { const m = sessionStorage.getItem("fw.mood"); return MOOD[m] ? m : null; } catch { return null; } }, set(m) { try { sessionStorage.setItem("fw.mood", m); } catch { } } };
  const applyMood = (m) => { document.documentElement.dataset.mood = m || "vivid"; document.querySelectorAll(".vo-mood [data-mood]").forEach(b => b.classList.toggle("on", b.dataset.mood === m)); org.temperament(); };
  applyMood(mood.get());

  // ---- stato dal server (e ogni tre minuti: il Radar mangia in silenzio) ----
  let stato = null;
  async function carica() {
    try {
      const r = await fetch("/organismo/api/stato", { cache: "no-store" }); const prev = stato; stato = await r.json(); org.setStato(stato);
      document.documentElement.dataset.weather = (stato.weather && stato.weather.kind) || "unknown"; hud(); timeline(); start();
      if (prev && stato.totals.signals > prev.totals.signals) feedTick("f-radar"); // il Radar ha mangiato
    }
    catch (e) { console.warn("Organismo: stato non disponibile", e); }
  }
  carica(); setInterval(() => { if (org.until === Infinity) carica(); }, 180000);

  // ---- HUD (desktop) ----
  const el = (id) => document.getElementById(id);
  function hud() {
    if (!stato) return; const past = org.until !== Infinity; const ref = past ? org.until : org.now; const days = Math.max(1, Math.ceil((ref - org.born) / DAY));
    const lead = el("vo-lead"); if (lead) lead.innerHTML = past ? `Così era <b>${days === 1 ? "il primo giorno" : "a " + days + " giorni"}</b>, il ${fmtDay(ref)}. Nato il ${fmtDay(org.born)}.` : `Questo è vivo da <b>${days === 1 ? "un giorno" : days + " giorni"}</b>, dal ${fmtDay(org.born)}. Non lo accudisce nessuno: lo nutre il mondo.`;
    const sig = past ? org.signals.filter(s => s.ms <= ref).length : (stato.totals.signals || org.signals.length); const vis = Math.min(sig, MAX_NODES);
    if (el("f-signals")) { el("f-signals").textContent = sig.toLocaleString("it-IT"); el("f-signals-sub").textContent = `ogni notizia del Radar è un nodo nel settore del suo sistema · ${vis} in superficie, ${Math.max(0, sig - vis)} già nel cuore`; }
    const cnt = org.moodCounts || {}; const parts = Object.keys(MOOD).filter(k => cnt[k]).sort((a, b) => cnt[b] - cnt[a]).map(k => `${cnt[k]} ${MOOD[k].name}`);
    if (el("f-moods")) { el("f-moods").textContent = org.moodN ? parts.join(" · ") : "nessuno ancora"; el("f-moods-sub").textContent = org.moodN ? "gli umori dichiarati dai visitatori danno il temperamento: i colori" : "dichiara il tuo, in alto a destra: entra nel suo temperamento"; }
    const w = stato.weather || {}; const lab = (WEATHER[w.kind] || WEATHER.unknown).label;
    if (el("f-weather")) { el("f-weather").textContent = w.temp != null ? `${w.temp}°${lab ? " · " + lab : ""}${w.wind != null ? ` · vento ${Math.round(w.wind)} km/h` : ""}` : "meteo non disponibile"; el("f-weather-sub").textContent = ({ sun: "col sole si espande e batte più forte", cloud: "nuvoloso: ritmo medio", rain: "piove: rallenta e si affloscia un po'", storm: "temporale: è agitato, ogni tanto lampeggia", snow: "neve: quasi fermo", night: "di notte si spegne quasi, e brilla piano" })[w.kind] || "il meteo regola il ritmo, il vento lo fa ondeggiare"; }
    if (el("f-stimoli")) { const n = past ? org.stimoli.filter(k => k.ms <= ref).length : (stato.totals.stimoli || 0); el("f-stimoli").textContent = n ? n.toLocaleString("it-IT") : "nessuno"; }
  }
  function presence(p) {
    const box = el("vo-presence"); if (!box || !p) return;
    if (PHONE) { box.innerHTML = p.desktops ? `<b>Collegato</b> allo schermo principale` : `Schermo principale <b>non trovato</b>: vive lo stesso`; return; }
    const v = p.viewers || 1; box.innerHTML = v <= 1 ? `Adesso lo guardi <b>solo tu</b>` : `<b>${v}</b> persone lo guardano adesso`;
  }

  // ---- timeline (desktop) ----
  const tl = el("vo-tl"), tlLabel = el("vo-tl-label"), tlToday = el("vo-tl-today");
  function timeline() {
    if (!tl) return; const days = Math.max(0, Math.floor((org.now - org.born) / DAY)); tl.max = days; if (org.until === Infinity) tl.value = days;
  }
  if (tl) {
    const startOf = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
    tl.addEventListener("input", () => {
      const v = +tl.value, days = +tl.max;
      if (v >= days) { org.setUntil(Infinity); hud(); tlLabel.textContent = "Oggi"; tlToday.hidden = true; return; }
      const until = Math.min(org.now, startOf(org.born) + (v + 1) * DAY - 1); org.setUntil(until); hud();
      tlLabel.textContent = `${days - v} ${days - v === 1 ? "giorno" : "giorni"} fa · ${fmtDay(until)}`; tlToday.hidden = false;
    });
    tl.addEventListener("change", () => { if (+tl.value >= +tl.max) hud(); });
    tlToday.addEventListener("click", () => { tl.value = tl.max; tl.dispatchEvent(new Event("input")); });
  }

  // ---- umore (desktop) ----
  document.querySelectorAll(".vo-mood [data-mood]").forEach(b => b.addEventListener("click", async () => {
    const m = b.dataset.mood; mood.set(m); applyMood(m);
    let sent = false; try { sent = sessionStorage.getItem("vo.umore") === "1"; } catch { }
    if (!sent) { try { sessionStorage.setItem("vo.umore", "1"); } catch { } await post("umore", { mood: m }); org.addUmore(m); hud(); feedTick("f-mood"); }
  }));

  // ---- puntatore: curiosità, trascinamento, clic ----
  const tip = el("vo-tip"); let press = null, tipNode = null;
  const pt = (e) => { const r = stage.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const showTip = (n) => {
    if (!tip || !n) return; tipNode = n;
    if (n.kind === "sig") { const s = n.sig; tip.innerHTML = `<span class="eyebrow"><span class="dot"></span>Nodo · ${n.free ? "senza settore" : SECTOR_NAME[n.sec]}</span><b>${s.title}</b><small>${s.src || ""}${s.date ? " · " + fmtDate(s.date) : ""}${s.score ? " · rilevanza " + s.score : ""}</small>`; }
    else { tip.innerHTML = `<span class="eyebrow"><span class="dot"></span>Stimolo</span><b>Qualcuno ha toccato qui</b><small>${fmtDate(n.stim.t)}${n.stim.src === "phone" ? " · dal telefono" : ""}${n.stim.mood ? " · umore " + MOOD[n.stim.mood].name : ""}</small>`; }
    tip.hidden = false;
  };
  const hideTip = () => { if (tip) tip.hidden = true; tipNode = null; };
  org.onTick = () => { if (tipNode && tip && !tip.hidden) { if (tipNode.dying) return hideTip(); tip.style.left = tipNode.x + "px"; tip.style.top = tipNode.y + "px"; } };
  let lastGesto = 0;
  stage.addEventListener("pointerdown", e => { const p = pt(e); press = { x: p.x, y: p.y, moved: false, t: performance.now() }; org.pointer = { x: p.x, y: p.y, drag: false }; try { stage.setPointerCapture(e.pointerId); } catch { } e.preventDefault(); });
  stage.addEventListener("pointermove", e => {
    const p = pt(e); if (press && Math.hypot(p.x - press.x, p.y - press.y) > 8) press.moved = true;
    if (press || e.pointerType === "mouse") { org.pointer = { x: p.x, y: p.y, drag: !!(press && press.moved) }; }
    if (!press && e.pointerType === "mouse") stage.style.cursor = org.nodeAt(p.x, p.y) ? "pointer" : "crosshair";
    if (press && press.moved && room) { const now = performance.now(); if (now - lastGesto > 90) { lastGesto = now; const u = org.unmap(p.x, p.y); post("gesto", { kind: "move", x: Math.cos(u.a) * u.r, y: Math.sin(u.a) * u.r }); } }
  });
  const up = (e) => {
    if (!press) return; const p = pt(e);
    if (!press.moved) {
      const n = org.nodeAt(p.x, p.y);
      if (n) { n.flash = 1; showTip(n); }
      else {
        hideTip(); const u = org.unmap(p.x, p.y); const m = mood.get() || ""; org.shock(p.x, p.y, 1);
        const local = org.addStimolo({ a: u.a, r: u.r, mood: m, src: PHONE ? "phone" : "desktop", t: new Date().toISOString() });
        if (stato) { stato.totals.stimoli = (stato.totals.stimoli || 0) + 1; hud(); feedTick("f-stim"); }
        post("stimolo", { a: u.a, r: u.r, mood: m }).then(res => { if (res && res.t) org.retime(local, res.t); });
      }
    } else if (room) post("gesto", { kind: "up" });
    press = null; if (e.pointerType !== "mouse") org.pointer = null; else org.pointer = { x: p.x, y: p.y, drag: false };
  };
  stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", () => { press = null; org.pointer = null; });
  stage.addEventListener("pointerleave", () => { press = null; org.pointer = null; });
  document.addEventListener("keydown", e => { if (e.key === "Escape") hideTip(); });

  // ---- il filamento verso il telefono (desktop): dove sta il QR ----
  function placeAnchor() { const q = el("vo-qr"); if (!q || PHONE) return; const r = q.getBoundingClientRect(), s = stage.getBoundingClientRect(); org.anchor = { x: r.left - s.left + r.width * .5, y: r.top - s.top + r.height * .5 }; }
  placeAnchor(); window.addEventListener("resize", placeAnchor);

  // ---- presenza: SSE ----
  let es = null;
  function connect() {
    if (es) es.close();
    es = new EventSource(`/organismo/stream?r=${encodeURIComponent(room)}&role=${PHONE ? "phone" : "desktop"}`);
    const J = (e) => { try { return JSON.parse(e.data); } catch { return null; } };
    es.addEventListener("ciao", e => { const d = J(e); if (!d) return; me = d.id; presence(d); phoneState(d.phones > 0, true); });
    es.addEventListener("presenza", e => { const d = J(e); if (!d) return; presence(d); phoneState(d.phones > 0, false); });
    es.addEventListener("spettatori", e => { const d = J(e); if (d && !PHONE) presence(d); });
    es.addEventListener("stimolo", e => {
      const d = J(e); if (!d || d.from === me) return;
      org.addStimolo(d); const p = org.map(d.a, d.r); org.shock(p.x, p.y, .8);
      if (stato) { stato.totals.stimoli = (stato.totals.stimoli || 0) + 1; hud(); feedTick("f-stim"); }
      if (!PHONE && d.room === room && d.src === "phone") { org.tendril = 1; org.tendrilDir = -1; }
    });
    es.addEventListener("umore", e => { const d = J(e); if (!d) return; org.addUmore(d.mood); hud(); feedTick("f-mood"); });
    es.addEventListener("tilt", e => { const d = J(e); if (!d || d.from === me) return; org.setTilt(d.gx, d.gy); });
    es.addEventListener("gesto", e => {
      const d = J(e); if (!d || d.from === me) return;
      if (d.kind === "up") org.ghost = null; else { const a = Math.atan2(d.y, d.x), r = Math.hypot(d.x, d.y); const p = org.map(a, r); org.ghost = { x: p.x, y: p.y, drag: true }; }
    });
  }
  let phoneOn = false;
  function phoneState(on, silent) {
    const q = el("vo-qr"); if (!q) return; if (on === phoneOn) return; phoneOn = on;
    q.classList.toggle("on", on); q.querySelector(".vo-qr-on").hidden = !on; org.phoneOn = on;
    if (on) { org.tendril = 1.6; org.tendrilDir = 1; if (!silent) org.shock(org.anchor ? org.anchor.x : org.cx, org.anchor ? org.anchor.y : org.cy, 1.2); }
    else org.ghost = null;
  }

  // ---- QR (desktop) ----
  if (!PHONE && el("vo-qr-img") && window.qrcode) {
    try {
      const url = location.origin + "/organismo/telefono?r=" + room;
      const q = qrcode(0, "M"); q.addData(url); q.make();
      el("vo-qr-img").innerHTML = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
      el("vo-qr-img").title = url;
    } catch (e) { el("vo-qr-img").textContent = "QR non disponibile"; }
  }

  // ---- telefono: accoglienza, inclinazione ----
  if (PHONE) {
    const overlay = el("vo-arrive"), btn = el("vo-arrive-btn");
    let lastTilt = 0, lastG = { x: 9, y: 9 };
    const onOrient = (e) => {
      if (e.gamma == null || e.beta == null) return;
      const gx = clamp(e.gamma / 32, -1, 1), gy = clamp((e.beta - 42) / 32, -1, 1);
      org.setTilt(gx, gy);
      const now = performance.now(); if (now - lastTilt > 80 && (Math.abs(gx - lastG.x) > .03 || Math.abs(gy - lastG.y) > .03)) { lastTilt = now; lastG = { x: gx, y: gy }; post("tilt", { gx, gy }); }
    };
    let lastAcc = null;
    const onMotion = (e) => { const a = e.accelerationIncludingGravity; if (!a) return; if (lastAcc) { const d = Math.abs(a.x - lastAcc.x) + Math.abs(a.y - lastAcc.y) + Math.abs(a.z - lastAcc.z); if (d > 26) { org.shake = .6; } } lastAcc = { x: a.x, y: a.y, z: a.z }; };
    const arm = async () => {
      try { if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === "function") { const s = await DeviceOrientationEvent.requestPermission(); if (s !== "granted") el("vo-hint").textContent = "Senza il permesso al movimento: tocca e trascina"; } } catch { }
      try { if (window.DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission === "function") await DeviceMotionEvent.requestPermission(); } catch { }
      window.addEventListener("deviceorientation", onOrient); window.addEventListener("devicemotion", onMotion);
      overlay.classList.add("off");
      // arrivo: l'organismo entra dall'alto e si dispone in verticale
      org.arrive = 2; for (const n of org.list) { n.x = org.cx + (Math.random() - .5) * org.W * .5; n.y = -30 - Math.random() * 160; n.age = -Math.random() * .8; n.scale = 0; }
      connect(); start();
    };
    btn.addEventListener("click", arm);
  } else connect();

  start();
})();
