/* =========================================================
   L'ORGANISMO — motore (canvas 2D) e regia. Un solo organismo per tutto il sito.
   Ogni segnale del Radar è un nodo che cresce nel settore del suo sistema (Content · Activation ·
   Spatial · Adaptive), collegato al nodo più vicino: una colonia dendritica che parte dal cubo del
   logo. Gli umori dei visitatori danno il temperamento (i colori), il meteo di Roma il ritmo
   (battito, ondeggio, pioggia, temporale), i clic e i tocchi sono stimoli che restano per tutti.
   Le posizioni "di casa" vivono in uno spazio unitario (angolo, raggio) e si proiettano sullo
   schermo che c'è: in 16:9 è largo, in 9:16 è alto. Si riconfigura per costruzione, non per ritaglio.
   Secondo schermo: stessa stanza via SSE; tocchi, sguardo e inclinazione viaggiano tra gli schermi.
   Uso: window.Organismo.mount(root) su un blocco [data-organismo] (partial views/partials/organismo.ejs);
   mountAll() monta tutti quelli presenti. Il loop gira solo quando il blocco è visibile.
   ========================================================= */
(() => {
  "use strict";
  const TAU = Math.PI * 2, DAY = 86400000;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Lingua: tr("testo italiano") → inglese dal dizionario di i18n.js quando <html lang="en">, altrimenti il testo com'è
  const LANG = String(document.documentElement.lang || "it").toLowerCase().startsWith("en") ? "en" : "it"; const LOCALE = LANG === "en" ? "en-GB" : "it-IT";
  const tr = window.FW_I18N ? window.FW_I18N.make(LANG) : Object.assign((x, vars) => { let o = String(x); if (vars) Object.keys(vars).forEach(k => { o = o.split("{" + k + "}").join(vars[k]); }); return o; }, { lang: "it" });
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const unit = (h, k) => (((h >>> (k * 8)) & 255) / 255); // 4 numeri 0..1 da un hash
  const SECTOR = { "content-system": 0, "activation-system": 1, "spatial-experiences": 2, "adaptive-media": 3 };
  const SECTOR_NAME = ["Content System", "Activation System", "Spatial Experiences", "Adaptive Media"];
  const SECTOR_ANGLE = [-Math.PI / 2, 0, Math.PI / 2, Math.PI]; // alto · destra · basso · sinistra
  const MOOD = { vivid: { name: "acceso", rgb: [191, 0, 255] }, calm: { name: "notturno", rgb: [138, 124, 255] }, nervous: { name: "quieto", rgb: [95, 191, 165] }, light: { name: "chiaro", rgb: [214, 150, 255] } };
  const WEATHER = { sun: { energy: 1.05, label: "sereno" }, cloud: { energy: .8, label: "nuvoloso" }, rain: { energy: .55, label: "piove", droop: 1 }, storm: { energy: 1.35, label: "temporale", storm: 1 }, snow: { energy: .45, label: "neve", droop: .5 }, night: { energy: .5, label: "notte" }, unknown: { energy: .8, label: "" } };
  const fmtDay = (ms) => new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "long" }).format(new Date(ms));
  const fmtDate = (iso) => { try { return new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short" }).format(new Date(iso)); } catch { return ""; } };
  const cssVar = (n, d) => (getComputedStyle(document.documentElement).getPropertyValue(n) || "").trim() || d;
  const hexRgb = (h) => { h = h.replace("#", ""); if (h.length === 3) h = h.split("").map(c => c + c).join(""); const v = parseInt(h, 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
  const mix = (a, b, k) => [Math.round(lerp(a[0], b[0], k)), Math.round(lerp(a[1], b[1], k)), Math.round(lerp(a[2], b[2], k))];
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const ease = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const esc = (s) => String(s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const newRoom = () => Math.random().toString(36).slice(2, 8).padEnd(6, "0");

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
    constructor(stage, glow, cv, small) {
      this.stage = stage; this.glow = glow; this.cv = cv; this.ctx = cv.getContext("2d"); this.gctx = glow.getContext("2d");
      this.MAX_NODES = small ? 64 : 140; this.MAX_STIM = small ? 30 : 110; this.REP = small ? 15 : 22; this.small = small;
      this.W = 0; this.H = 0; this.dpr = 1; this.t = 0; this.phase = 0; this.heart = 0;
      this.nodes = new Map(); this.list = []; this.pulses = []; this.waves = []; this.ghost = null;
      this.signals = []; this.stimoli = []; this.umori = []; this.weather = WEATHER.unknown; this.weatherRaw = null; this.born = Date.now(); this.now = Date.now(); this.until = Infinity;
      this.assimilated = 0; this.pointer = null; this.g = { x: 0, y: 0 }; this.gTarget = { x: 0, y: 0 }; this.gAt = 0;
      this.temper = MOOD.vivid.rgb; this.accent = hexRgb(cssVar("--accent", "#BF00FF")); this.color = this.temper;
      this.anchor = null; this.tendril = 0; this.tendrilDir = 1; this.phoneOn = false; this.nextFlash = 6; this.flashEl = null; this.arrive = 0;
      this.onTick = null; this.shake = 0; this.core = [];
    }
    // ---- geometria: spazio unitario → schermo ----
    layout() {
      const W = this.W, H = this.H, portrait = H > W * 1.1, narrow = W < 900;
      this.cx = portrait || narrow ? W * .5 : W * .6; this.cy = portrait ? H * .48 : H * .49;
      this.RX = portrait ? W * .40 : Math.min(W * (narrow ? .38 : .245), H * .40); this.RY = portrait ? H * .34 : H * .36;
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
      const lim = this.until; const sig = this.signals.filter(s => s.ms <= lim); this.assimilated = Math.max(0, sig.length - this.MAX_NODES);
      const vis = sig.slice(this.assimilated); const want = new Map(); const placed = [];
      const span = .32 + .68 * Math.min(1, vis.length / this.MAX_NODES); // da giovane è piccolo: cresce con quello che mangia
      vis.forEach((s, i) => {
        const h = hash(s.id); const sec = SECTOR[s.caps[0]] != null ? SECTOR[s.caps[0]] : (h % 4); const free = SECTOR[s.caps[0]] == null;
        const a = SECTOR_ANGLE[sec] + (unit(h, 1) - .5) * (free ? TAU * .45 : TAU * .23);
        const r = (.2 + .78 * (vis.length > 1 ? i / (vis.length - 1) : .5) * (.86 + unit(h, 2) * .28)) * span;
        let parent = null, best = 1e9;
        for (const p of placed) { if (p.sec !== sec) continue; const d = Math.hypot(Math.cos(p.a) * p.r - Math.cos(a) * r, Math.sin(p.a) * p.r - Math.sin(a) * r); if (d < best) { best = d; parent = p.id; } }
        const n = { id: "s:" + s.id, kind: "sig", sec, free, a, r: Math.min(r, 1.1), size: 2 + (s.score / 100) * 2.4, parent, sig: s, ms: s.ms };
        want.set(n.id, n); placed.push(n);
      });
      const st = this.stimoli.filter(k => k.ms <= lim).slice(-this.MAX_STIM);
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
        const pn = w.parent ? this.nodes.get(w.parent) : null;
        const start = pn ? { x: pn.x, y: pn.y } : (this.arrive ? { x: this.cx + (Math.random() - .5) * this.W * .6, y: -40 } : { x: this.cx, y: this.cy });
        this.nodes.set(id, { ...w, x: start.x, y: start.y, vx: 0, vy: 0, age: 0, flash: 0, scale: 0, dying: false, ph: Math.random() * TAU, children: [] });
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
        const tx = this.cx + (h.x - this.cx) * breath + this.g.x * gk * (.25 + .75 * rn) + Math.sin(this.t * .55 + rn * 3 + n.ph * .2) * 9 * wind * rn;
        const ty = this.cy + (h.y - this.cy) * breath + this.g.y * gk * (.25 + .75 * rn) + droop * 16 * rn * rn + Math.cos(this.t * .4 + n.ph) * 4 * wind * rn;
        n.vx += (tx - n.x) * .028 * f; n.vy += (ty - n.y) * .028 * f;
        if (!reduced) { const amp = .06 * (.6 + E) * f; n.vx += Math.sin(this.t * 1.4 + n.ph) * amp; n.vy += Math.cos(this.t * 1.1 + n.ph * 1.3) * amp; }
        if (this.weather.storm && !reduced) { n.vx += (Math.random() - .5) * .5 * f; n.vy += (Math.random() - .5) * .5 * f; }
        if (this.shake > 0) { n.vx += (Math.random() - .5) * 3 * f; n.vy += (Math.random() - .5) * 3 * f; }
        for (const p of [ptr, ghost]) { if (!p) continue; const dx = p.x - n.x, dy = p.y - n.y; const d = Math.hypot(dx, dy); const R = p.drag ? 260 : 150; if (d < R && d > 1) { const s = (1 - d / R) * (p.drag ? .05 : .012) * f; n.vx += dx * s; n.vy += dy * s; } }
        n.vx *= Math.pow(.86, f); n.vy *= Math.pow(.86, f); n.x += n.vx * f; n.y += n.vy * f;
      }
      // repulsione fra vicini (n piccolo: va bene il quadratico)
      const L = this.list, R = this.REP;
      for (let i = 0; i < L.length; i++) { const a = L[i]; for (let j = i + 1; j < L.length; j++) { const b = L[j]; const dx = b.x - a.x, dy = b.y - a.y; const d2 = dx * dx + dy * dy; if (d2 < R * R && d2 > .01) { const d = Math.sqrt(d2); const s = (1 - d / R) * .9 * f; a.vx -= dx / d * s; a.vy -= dy / d * s; b.vx += dx / d * s; b.vy += dy / d * s; } } }
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
      // dito dell'altro schermo
      if (this.ghost) { ctx.beginPath(); ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.arc(this.ghost.x, this.ghost.y, 18, 0, TAU); ctx.stroke(); ctx.drawImage(spW, this.ghost.x - 8, this.ghost.y - 8, 16, 16); }
      // il cuore: il cubo del logo, che batte
      const S = (this.small ? 15 : 19) * (1 + heart * .16); ctx.save(); ctx.translate(core.x, core.y);
      ctx.drawImage(sprite(col, 64), -S * 2.4, -S * 2.4, S * 4.8, S * 4.8);
      const P = (pts, a) => { ctx.beginPath(); pts.forEach((p, k) => k ? ctx.lineTo(p[0] * S, p[1] * S) : ctx.moveTo(p[0] * S, p[1] * S)); ctx.closePath(); ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.fill(); };
      P([[0, -1], [.87, -.5], [0, 0], [-.87, -.5]], 1); P([[-.87, -.5], [0, 0], [0, 1], [-.87, .5]], .78); P([[.87, -.5], [.87, .5], [0, 1], [0, 0]], .55);
      ctx.restore();
    }
  }

  // ================= regia di un blocco =================
  function mount(root) {
    if (!root || root.dataset.mounted) return;
    if (!root.getClientRects().length) return; // il blocco dell'altro layout (desktop/mobile), nascosto, resta spento
    root.dataset.mounted = "1";
    const MODE = root.dataset.organismo || "desktop"; const PHONE = MODE === "phone", MOBILE = MODE === "mobile", DESK = MODE === "desktop";
    const STANDALONE = document.documentElement.classList.contains("vo-page"); // pagina a sé (non dentro il sito)
    const q = (cls) => root.querySelector("." + cls); const f = (name) => root.querySelector(`[data-f="${name}"]`);
    const stage = q("vo-stage"), org = new Organismo(stage, q("vo-glow"), q("vo-cv"), PHONE || MOBILE); org.flashEl = q("vo-flash");
    root._organismo = org; window.__organismo = org;
    let me = "", raf = 0, last = 0, visible = false, onScreen = false, stato = null;
    const room = PHONE ? (root.dataset.room || "") : MOBILE ? "" : (() => { try { let r = sessionStorage.getItem("vo.room"); if (!r || !/^[a-z0-9]{6}$/.test(r)) { r = newRoom(); sessionStorage.setItem("vo.room", r); } return r; } catch { return newRoom(); } })();
    const post = (path, body) => fetch("/organismo/api/" + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, from: me, room, role: PHONE ? "phone" : "desktop" }), keepalive: true }).then(r => r.json()).catch(() => null);
    const frame = (now) => { raf = 0; if (!visible) return; if (!org.W && !org.resize()) { raf = requestAnimationFrame(frame); return; } const dt = Math.min(.05, (now - (last || now)) / 1000); last = now; org.update(dt); org.draw(); if (org.onTick) org.onTick(now); raf = requestAnimationFrame(frame); };
    const start = () => { if (!raf && visible) { last = 0; raf = requestAnimationFrame(frame); } };
    const refreshVisible = () => { visible = onScreen && !document.hidden; if (visible) start(); };
    document.addEventListener("visibilitychange", refreshVisible);
    new IntersectionObserver(es => { onScreen = es.some(e => e.isIntersecting); refreshVisible(); if (onScreen) firstSight(); }, { threshold: .15 }).observe(stage);
    new ResizeObserver(() => { if (org.resize()) { org.rebuild(); placeAnchor(); } }).observe(stage);
    org.resize();

    const feedTick = (cls) => { const el = root.querySelector(".vo-feed ." + cls); if (!el) return; el.classList.remove("tick"); void el.offsetWidth; el.classList.add("tick"); };
    const mood = { get() { try { const m = sessionStorage.getItem("fw.mood"); return MOOD[m] ? m : null; } catch { return null; } }, set(m) { try { sessionStorage.setItem("fw.mood", m); } catch { } } };

    // ---- didascalie: raccontano cosa lo nutre, una alla volta, in basso; un clic le chiude ----
    const Say = (() => {
      const box = q("vo-say"); const queue = []; const shown = new Set(); let showing = false, timer = 0, lastHide = -1e9;
      // "Non mostrarle più": scelta che resta (localStorage) per tutte le pagine con l'organismo; una pillola in basso permette di riattivarle
      const QUIET = "vo.quiet"; const quiet = () => { try { return localStorage.getItem(QUIET) === "1"; } catch { return false; } };
      const pill = document.createElement("button"); pill.type = "button"; pill.className = "vo-quiet"; pill.textContent = tr("Didascalie disattivate · riattiva"); pill.hidden = !quiet();
      const bottom = root.querySelector(".vo-bottom"); if (bottom) bottom.appendChild(pill);
      const setQuiet = (on) => { try { if (on) localStorage.setItem(QUIET, "1"); else localStorage.removeItem(QUIET); } catch {} pill.hidden = !on; if (on) { queue.length = 0; hide(); } };
      pill.addEventListener("click", () => setQuiet(false));
      const render = () => { if (!box || showing || !queue.length || !onScreen || quiet()) return; const m = queue.shift(); showing = true; box.innerHTML = `<span class="eyebrow"><span class="dot"></span>${m.k}</span>${m.t}<span class="say-actions"><button type="button" class="say-stop">${tr("Non mostrarle più")}</button><button type="button" class="say-x" aria-label="${tr("Chiudi")}">✕</button></span><i class="say-bar" style="animation-duration:${m.ms}ms"></i>`; box.classList.add("on"); timer = setTimeout(hide, m.ms); };
      const hide = () => { if (!box) return; box.classList.remove("on"); clearTimeout(timer); lastHide = performance.now(); setTimeout(() => { showing = false; render(); }, 650); };
      if (box) box.addEventListener("click", e => { if (e.target.closest(".say-stop")) { setQuiet(true); return; } hide(); });
      const push = (k, t, o = {}) => { if (!box || quiet()) return; if (o.key && queue.some(m => m.key === o.key)) return; const m = { k, t, ms: o.ms || 7500, key: o.key }; if (o.front) queue.unshift(m); else queue.push(m); if (queue.length > 4) queue.length = 4; render(); };
      return {
        push, once(key, k, t, o) { if (shown.has(key)) return; shown.add(key); push(k, t, { ...(o || {}), key }); }, kick: render,
        idle: () => !showing && !queue.length && performance.now() - lastHide > 45000,
        seq(list, gap, delay) { list.forEach((m, i) => setTimeout(() => push(m.k, m.t, { ms: m.ms || 8000 }), (delay || 0) + i * gap)); return (delay || 0) + list.length * gap; }
      };
    })();
    const weatherSay = (w) => {
      const k = (w && w.kind) || "unknown", t = w && w.temp != null ? ", " + w.temp + "°" : "";
      const base = { sun: tr("Sereno{t}: col sole si espande e il cuore batte più forte.", { t }), cloud: tr("Nuvoloso{t}: ritmo medio, respira piano.", { t }), rain: tr("Piove{t}: rallenta, e i rami si afflosciano un po'.", { t }), storm: tr("Temporale{t}: è agitato, e ogni tanto lampeggia.", { t }), snow: tr("Neve{t}: quasi fermo.", { t }), night: tr("È notte{t}: si spegne quasi, e brilla piano.", { t }) }[k] || tr("Meteo non disponibile: va a ritmo medio.");
      return base + (w && w.wind > 8 ? " " + tr("Vento a {v} km/h: ondeggia.", { v: Math.round(w.wind) }) : "");
    };
    const moodsSay = () => { const c = org.moodCounts || {}; return Object.keys(MOOD).filter(k => c[k]).sort((a, b) => c[b] - c[a]).map(k => `${c[k]} ${tr(MOOD[k].name)}`).join(" · "); };
    let introEnd = 0, introDone = false;
    function intro() {
      if (introDone || !stato) return; introDone = true;
      const days = Math.max(1, Math.ceil((org.now - org.born) / DAY)); const last = org.signals[org.signals.length - 1]; const w = stato.weather || {};
      const list = [
        { k: tr("Un solo organismo"), t: tr("È lo stesso per chiunque apra questo sito. Vive da <b>{days}</b> e non lo accudisce nessuno: lo nutre il mondo.", { days: days === 1 ? tr("un giorno") : tr("{n} giorni", { n: days }) }) },
        { k: tr("Il Radar lo nutre"), t: tr("Ogni notizia che il Radar pubblica diventa un nodo, nel settore del suo sistema. Finora ne ha assimilate <b>{n}</b>", { n: (stato.totals.signals || 0).toLocaleString(LOCALE) }) + (last ? tr("; l'ultima: «{title}».", { title: esc(last.title) }) : ".") },
        { k: tr("Gli stimoli"), t: tr("{who} lasciano un nodo bianco che resta per tutti: finora <b>{n}</b>.", { who: MOBILE ? tr("Tocchi e clic") : tr("Clic e tocchi"), n: stato.totals.stimoli || 0 }) + " " + (MOBILE ? tr("Tocca nel vuoto per lasciare il tuo; tocca un nodo per sapere da quale notizia è nato.") : tr("Clicca nel vuoto per lasciare il tuo; clicca un nodo per sapere da quale notizia è nato.")) },
        DESK ? { k: tr("Continua sul telefono"), t: tr("Inquadra il QR: l'organismo passa sul telefono, sullo schermo o nella stanza in AR, e i due schermi restano collegati.") } : { k: tr("Nella stanza"), t: tr("Con «Portalo nella stanza» esce dallo schermo: in realtà aumentata, a un metro da te.") }
      ];
      introEnd = performance.now() + Say.seq(list, 12000, 2500); // quattro didascalie, una ogni 12 secondi
    }
    const AMBIENT = [
      () => tr("Gli impulsi corrono dal cuore verso i rami: è il contenuto che viaggia tra i touchpoint."),
      () => tr("I nodi più vecchi finiscono nel cuore: ne ha già assimilati <b>{n}</b>.", { n: org.assimilated }),
      () => tr("Batte a circa <b>{n}</b> al minuto: il ritmo lo decide il meteo.", { n: Math.round(46 + 34 * org.weather.energy) }),
      () => tr("Le stesse posizioni valgono in 16:9 e in 9:16: si riconfigura per costruzione, non per ritaglio."),
      () => tr("Alto: Content System · destra: Activation System · basso: Spatial Experiences · sinistra: Adaptive Media."),
      () => (org.now - org.born > DAY ? (DESK ? tr("Cresce di giorno in giorno: trascina «Com'era» per vederlo com'era.") : tr("Cresce di giorno in giorno, da quando il sito è on air.")) : tr("È il suo primo giorno: da domani si vedrà come cresce."))
    ];
    let lastAmbient = -1;
    setInterval(() => {
      if (PHONE || !stato || !onScreen || performance.now() < introEnd || !Say.idle() || Math.random() > .25 || org.until !== Infinity) return;
      let i; do { i = Math.floor(Math.random() * AMBIENT.length); } while (i === lastAmbient); lastAmbient = i;
      Say.push(tr("L'organismo"), AMBIENT[i](), { ms: 7000 });
    }, 30000);
    let seen = false;
    function firstSight() { if (seen) return; seen = true; if (!PHONE) { if (stato) intro(); Say.kick(); } }

    // ---- umore: nel sito lo decide la Modalità (html[data-mood]); nella pagina a sé il selettore in alto ----
    let umoreSent = (() => { try { return sessionStorage.getItem("vo.umore") === "1"; } catch { return false; } })();
    async function dichiara(m, mine) {
      if (!MOOD[m]) return; org.temperament();
      if (!umoreSent) { umoreSent = true; try { sessionStorage.setItem("vo.umore", "1"); } catch { } await post("umore", { mood: m }); org.addUmore(m); hud(); feedTick("f-mood"); }
      if (mine) Say.once("umore-mio", tr("Il tuo umore"), tr("«{mood}» entra nel temperamento: i colori dell'organismo sono la media di tutti gli umori dichiarati ({moods}). La pagina invece segue solo te.", { mood: tr(MOOD[m].name), moods: moodsSay() || tr("il tuo è il primo") }), { front: true });
    }
    document.addEventListener("fw:theme", () => { org.temperament(); const m = document.documentElement.dataset.mood; if (MOOD[m] && !STANDALONE) dichiara(m, seen); }); // "il tuo umore" solo se l'organismo è già in vista
    if (STANDALONE) {
      const applyMood = (m) => { document.documentElement.dataset.mood = m || "vivid"; document.querySelectorAll(".vo-mood [data-mood]").forEach(b => b.classList.toggle("on", b.dataset.mood === m)); org.temperament(); };
      applyMood(mood.get());
      document.querySelectorAll(".vo-mood [data-mood]").forEach(b => b.addEventListener("click", () => { const m = b.dataset.mood; mood.set(m); applyMood(m); dichiara(m, true); }));
    } else { const m = document.documentElement.dataset.mood; if (MOOD[m]) dichiara(m, false); }

    // ---- stato dal server (e ogni tre minuti: il Radar mangia in silenzio) ----
    async function carica() {
      try {
        const r = await fetch("/organismo/api/stato", { cache: "no-store" }); const prev = stato; stato = await r.json(); org.setStato(stato);
        if (STANDALONE) document.documentElement.dataset.weather = (stato.weather && stato.weather.kind) || "unknown";
        hud(); timeline(); start();
        if (!prev) { if (seen && !PHONE) intro(); return; }
        if (stato.totals.signals > prev.totals.signals) { // il Radar ha mangiato
          feedTick("f-radar"); const n = stato.totals.signals - prev.totals.signals; const last = org.signals[org.signals.length - 1];
          Say.push(tr("Il Radar ha appena mangiato"), `<b>${n}</b> ${n === 1 ? tr("notizia nuova") : tr("notizie nuove")} ${tr("in questo giro")}${last ? tr("; l'ultima: «{title}» ({src})", { title: esc(last.title), src: esc(last.src) }) : ""}. ${n === 1 ? tr("Un nodo nuovo") : tr("Nodi nuovi")} ${tr("in superficie")}.`, { key: "radar", front: true });
        }
        const wk = (k) => (k && k.weather && k.weather.kind) || "unknown";
        if (wk(stato) !== wk(prev)) Say.push(tr("A Roma è cambiato il tempo"), weatherSay(stato.weather), { key: "meteo", front: true });
      } catch (e) { console.warn("Organismo: stato non disponibile", e); }
    }
    carica(); setInterval(() => { if (org.until === Infinity) carica(); }, 180000);

    // ---- pannello ----
    function hud() {
      if (!stato) return; const past = org.until !== Infinity; const ref = past ? org.until : org.now; const days = Math.max(1, Math.ceil((ref - org.born) / DAY));
      const lead = q("vo-lead"); if (lead) lead.innerHTML = past ? tr("Così era <b>{age}</b>, il {day}. Nato il {born}.", { age: days === 1 ? tr("il primo giorno") : tr("a {n} giorni", { n: days }), day: fmtDay(ref), born: fmtDay(org.born) }) : tr("Questo è vivo da <b>{age}</b>, dal {born}. Non lo accudisce nessuno: lo nutre il mondo.", { age: days === 1 ? tr("un giorno") : tr("{n} giorni", { n: days }), born: fmtDay(org.born) });
      const leadM = q("vo-lead-m"); if (leadM) leadM.textContent = `${tr("vivo da")} ${days === 1 ? tr("un giorno") : tr("{n} giorni", { n: days })} · ${(stato.totals.signals || 0)} ${tr("segnali")} · ${stato.totals.stimoli || 0} ${tr("stimoli")}`;
      const sig = past ? org.signals.filter(s => s.ms <= ref).length : (stato.totals.signals || org.signals.length); const vis = Math.min(sig, org.MAX_NODES);
      if (f("signals")) { f("signals").textContent = sig.toLocaleString(LOCALE); f("signals-sub").textContent = tr("ogni notizia del Radar è un nodo nel settore del suo sistema · {vis} in superficie, {core} già nel cuore", { vis, core: Math.max(0, sig - vis) }); }
      if (f("moods")) { f("moods").textContent = org.moodN ? moodsSay() : tr("nessuno ancora"); f("moods-sub").textContent = org.moodN ? tr("gli umori dichiarati dai visitatori danno il temperamento: i colori") : tr("dichiara il tuo dal tasto Modalità: entra nel suo temperamento"); }
      const w = stato.weather || {}; const lab0 = (WEATHER[w.kind] || WEATHER.unknown).label; const lab = lab0 ? tr(lab0) : "";
      if (f("weather")) { f("weather").textContent = w.temp != null ? `${w.temp}°${lab ? " · " + lab : ""}${w.wind != null ? ` · ${tr("vento")} ${Math.round(w.wind)} km/h` : ""}` : tr("meteo non disponibile"); const ws = ({ sun: "col sole si espande e batte più forte", cloud: "nuvoloso: ritmo medio", rain: "piove: rallenta e si affloscia un po'", storm: "temporale: è agitato, ogni tanto lampeggia", snow: "neve: quasi fermo", night: "di notte si spegne quasi, e brilla piano" })[w.kind]; f("weather-sub").textContent = ws ? tr(ws) : tr("il meteo regola il ritmo, il vento lo fa ondeggiare"); }
      if (f("stimoli")) { const n = past ? org.stimoli.filter(k => k.ms <= ref).length : (stato.totals.stimoli || 0); f("stimoli").textContent = n ? n.toLocaleString(LOCALE) : tr("nessuno"); }
    }
    function presence(p) {
      const box = q("vo-presence"); if (!box || !p) return;
      if (PHONE) { box.innerHTML = p.desktops ? tr("<b>Collegato</b> allo schermo principale") : tr("Schermo principale <b>non trovato</b>: vive lo stesso"); return; }
      const v = p.viewers || 1; box.innerHTML = v <= 1 ? tr("Adesso lo guardi <b>solo tu</b>") : tr("<b>{n}</b> persone lo guardano adesso", { n: v });
      if (v > 1) Say.once("non-solo", tr("Non sei solo"), tr("<b>{n}</b> persone lo guardano in questo momento, ognuna dal suo schermo: ogni stimolo lo vedete tutti.", { n: v }));
    }

    // ---- timeline (desktop) ----
    const tl = q("vo-tl-range"), tlLabel = q("vo-tl-label"), tlToday = q("vo-tl-today");
    function timeline() {
      if (!tl) return; const days = Math.max(0, Math.floor((org.now - org.born) / DAY)); tl.max = days; if (org.until === Infinity) tl.value = days;
      tl.disabled = days === 0; tl.closest(".vo-tl").style.opacity = days === 0 ? .45 : 1; if (days === 0 && tlLabel) tlLabel.textContent = tr("Oggi · il primo giorno");
    }
    if (tl) {
      const startOf = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
      tl.addEventListener("input", () => {
        const v = +tl.value, days = +tl.max;
        if (v >= days) { org.setUntil(Infinity); hud(); tlLabel.textContent = tr("Oggi"); tlToday.hidden = true; return; }
        const until = Math.min(org.now, startOf(org.born) + (v + 1) * DAY - 1); org.setUntil(until); hud();
        tlLabel.textContent = `${days - v === 1 ? tr("un giorno fa") : tr("{n} giorni fa", { n: days - v })} · ${fmtDay(until)}`; tlToday.hidden = false;
        Say.once("comera", tr("Com'era"), tr("La storia si ricostruisce dagli eventi: le notizie, gli umori e gli stimoli fino a quel giorno. Più è giovane, più è piccolo."), { front: true });
      });
      tlToday.addEventListener("click", () => { tl.value = tl.max; tl.dispatchEvent(new Event("input")); });
    }

    // ---- puntatore: curiosità, trascinamento, clic; il descrittore del nodo ----
    const tip = q("vo-tip"); let press = null, tipNode = null, tipTimer = 0;
    const pt = (e) => { const r = stage.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const showTip = (n, remote) => {
      if (!tip || !n) return; tipNode = n; clearTimeout(tipTimer);
      const who = remote ? (PHONE ? tr("Dallo schermo principale") : tr("Dal telefono")) + " · " : "";
      if (n.kind === "sig") { const s = n.sig; tip.innerHTML = `<span class="eyebrow"><span class="dot"></span>${who}Radar${n.free ? "" : " · " + SECTOR_NAME[n.sec]}</span><b>${esc(s.title)}</b><small>${esc(s.src)}${s.date ? " · " + fmtDate(s.date) : ""}${s.score ? " · " + tr("rilevanza") + " " + s.score : ""}</small>`; }
      else { tip.innerHTML = `<span class="eyebrow"><span class="dot"></span>${who}${tr("Stimolo")}</span><b>${tr("Qualcuno ha toccato qui")}</b><small>${fmtDate(n.stim.t)}${n.stim.src === "phone" ? " · " + tr("dal telefono") : ""}${n.stim.mood && MOOD[n.stim.mood] ? " · " + tr("umore") + " " + tr(MOOD[n.stim.mood].name) : ""}</small>`; }
      tip.classList.toggle("remote", !!remote); tip.hidden = false; n.flash = 1;
      if (remote || MOBILE) tipTimer = setTimeout(hideTip, 9000);
    };
    const hideTip = () => { if (tip) tip.hidden = true; tipNode = null; clearTimeout(tipTimer); };
    org.onTick = () => {
      if (!(tipNode && tip && !tip.hidden)) return; if (tipNode.dying) return hideTip();
      const m = Math.min(150, org.W / 2 - 10), x = clamp(tipNode.x, m, org.W - m), below = tipNode.y < 140;
      tip.style.left = x + "px"; tip.style.top = tipNode.y + "px"; tip.style.setProperty("--ax", (50 + (tipNode.x - x) / (tip.offsetWidth || 1) * 100).toFixed(1) + "%"); tip.classList.toggle("below", below);
    };
    let lastGesto = 0, armed = false;
    stage.addEventListener("pointerdown", e => { const p = pt(e); press = { x: p.x, y: p.y, moved: false }; org.pointer = { x: p.x, y: p.y, drag: false }; try { stage.setPointerCapture(e.pointerId); } catch { } e.preventDefault(); if (MOBILE && !armed) arm(); });
    stage.addEventListener("pointermove", e => {
      const p = pt(e); if (press && Math.hypot(p.x - press.x, p.y - press.y) > 8) press.moved = true;
      if (press || e.pointerType === "mouse") org.pointer = { x: p.x, y: p.y, drag: !!(press && press.moved) };
      if (!press && e.pointerType === "mouse") stage.style.cursor = org.nodeAt(p.x, p.y) ? "pointer" : "crosshair";
      if (press && press.moved && room) { const now = performance.now(); if (now - lastGesto > 90) { lastGesto = now; const u = org.unmap(p.x, p.y); post("gesto", { kind: "move", x: Math.cos(u.a) * u.r, y: Math.sin(u.a) * u.r }); } }
    });
    const up = (e) => {
      if (!press) return; const p = pt(e);
      if (!press.moved) {
        const n = org.nodeAt(p.x, p.y);
        if (n) { showTip(n, false); if (room) post("gesto", { kind: "nodo", id: n.id }); } // il descrittore si apre anche sull'altro schermo
        else {
          hideTip(); const u = org.unmap(p.x, p.y); const m = mood.get() || ""; org.shock(p.x, p.y, 1);
          const local = org.addStimolo({ a: u.a, r: u.r, mood: m, src: PHONE ? "phone" : "desktop", t: new Date().toISOString() });
          if (stato) { stato.totals.stimoli = (stato.totals.stimoli || 0) + 1; hud(); feedTick("f-stim"); }
          post("stimolo", { a: u.a, r: u.r, mood: m }).then(res => { if (res && res.t) org.retime(local, res.t); });
          Say.once("stimolo-mio", tr("Il tuo stimolo"), PHONE ? tr("È arrivato anche sullo schermo principale, e resta: lo vedrà chiunque lo guardi.") : tr("Resta: lo vedrà chiunque lo guardi, da qualsiasi schermo.") + " " + (MOBILE ? tr("Tocca un nodo per sapere da quale notizia è nato.") : tr("Clicca un nodo per sapere da quale notizia è nato.")));
        }
      } else if (room) post("gesto", { kind: "up" });
      press = null; if (e.pointerType !== "mouse") org.pointer = null; else org.pointer = { x: p.x, y: p.y, drag: false };
    };
    stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", () => { press = null; org.pointer = null; });
    stage.addEventListener("pointerleave", () => { press = null; org.pointer = null; });
    document.addEventListener("keydown", e => { if (e.key === "Escape") hideTip(); });

    // ---- il filamento verso il telefono (desktop): dove sta il QR ----
    function placeAnchor() { const c = q("vo-qr"); if (!c || !DESK) return; const r = c.getBoundingClientRect(), s = stage.getBoundingClientRect(); org.anchor = { x: r.left - s.left + r.width * .5, y: r.top - s.top + r.height * .5 }; }
    placeAnchor(); window.addEventListener("resize", placeAnchor);

    // ---- presenza: SSE ----
    let es = null;
    function connect() {
      if (es) es.close();
      es = new EventSource(`/organismo/stream?r=${encodeURIComponent(room)}&role=${PHONE ? "phone" : "desktop"}`);
      const J = (e) => { try { return JSON.parse(e.data); } catch { return null; } };
      es.addEventListener("ciao", e => { const d = J(e); if (!d) return; me = d.id; presence(d); phoneState(d.phones > 0, true, d.ar > 0); });
      es.addEventListener("presenza", e => { const d = J(e); if (!d) return; presence(d); phoneState(d.phones > 0, false, d.ar > 0); });
      es.addEventListener("spettatori", e => { const d = J(e); if (d && !PHONE) presence(d); });
      es.addEventListener("stimolo", e => {
        const d = J(e); if (!d || d.from === me) return;
        org.addStimolo(d); const p = org.map(d.a, d.r); org.shock(p.x, p.y, .8);
        if (stato) { stato.totals.stimoli = (stato.totals.stimoli || 0) + 1; hud(); feedTick("f-stim"); }
        const mine = d.room === room && d.room;
        if (DESK && mine && d.src === "phone") { org.tendril = 1; org.tendrilDir = -1; }
        Say.push(tr("Uno stimolo adesso"), mine ? (PHONE ? tr("Dallo schermo principale: è arrivato anche qui, e resta.") : tr("Dal telefono collegato: è arrivato qui lungo il filamento, e resta.")) : tr("Qualcuno, da un altro schermo, l'ha appena toccato: il nodo resta anche per te."), { key: "stim-remote", ms: 5500 });
      });
      es.addEventListener("umore", e => { const d = J(e); if (!d || d.from === me) return; org.addUmore(d.mood); hud(); feedTick("f-mood"); if (MOOD[d.mood]) Say.push(tr("Un umore nuovo"), tr("Un visitatore si è dichiarato «{mood}»: entra nella media dei colori.", { mood: tr(MOOD[d.mood].name) }), { key: "umore-remote", ms: 6000 }); });
      es.addEventListener("tilt", e => { const d = J(e); if (!d || d.from === me) return; org.setTilt(d.gx, d.gy); });
      es.addEventListener("gesto", e => {
        const d = J(e); if (!d || d.from === me) return;
        if (d.kind === "up") org.ghost = null;
        else if (d.kind === "nodo") { const n = org.nodes.get(d.id); if (n && !n.dying) showTip(n, true); }
        else { const a = Math.atan2(d.y, d.x), r = Math.hypot(d.x, d.y); const p = org.map(a, r); org.ghost = { x: p.x, y: p.y, drag: true }; }
      });
    }
    let phoneOn = false, arOn = false;
    function phoneState(on, silent, ar) {
      const c = q("vo-qr"); if (!c) return;
      if (on && !!ar !== arOn) { // il telefono è passato nella stanza (o è tornato sullo schermo)
        arOn = !!ar; const p = q("vo-qr-on-text"); if (p) p.textContent = arOn ? tr("Il telefono lo guarda nella stanza, in realtà aumentata: dove punta lo sguardo, qui si inclina. Un tocco di là arriva qui.") : tr("Inclina il telefono: l'organismo lo sente. Toccalo: risponde qui.");
        if (arOn && !silent) Say.push(tr("È nella stanza"), tr("Il telefono lo sta guardando in realtà aumentata, a un metro da chi lo tiene: lo stesso organismo, in tre dimensioni. Dove punta lo sguardo, qui si inclina."), { key: "ar-on", front: true, ms: 9000 });
      }
      if (on === phoneOn) return; phoneOn = on;
      c.classList.toggle("on", on); c.querySelector(".vo-qr-on").hidden = !on; org.phoneOn = on;
      if (on) { org.tendril = 1.6; org.tendrilDir = 1; if (!silent) { org.shock(org.anchor ? org.anchor.x : org.cx, org.anchor ? org.anchor.y : org.cy, 1.2); Say.push(tr("Telefono collegato"), tr("Lo stesso organismo, riconfigurato in verticale sul telefono. Inclinalo: si sposta anche qui. Toccalo: lascia uno stimolo su entrambi gli schermi. Tocca un nodo di là: la sua notizia si apre qui."), { key: "tel-on", front: true, ms: 9000 }); } }
      else { org.ghost = null; if (!silent) Say.push(tr("Telefono scollegato"), tr("L'organismo resta com'è: gli stimoli lasciati dal telefono sono rimasti."), { key: "tel-off", ms: 5500 }); }
    }

    // ---- QR (desktop) ----
    const qrBox = q("vo-qr-img");
    if (DESK && qrBox && window.qrcode) {
      try { const url = location.origin + "/organismo/telefono?r=" + room; const qr = qrcode(0, "M"); qr.addData(url); qr.make(); qrBox.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); qrBox.title = url; }
      catch (e) { qrBox.textContent = tr("QR non disponibile"); }
    }

    // ---- telefono e mobile: inclinazione (con permesso, su iOS, dopo un gesto) ----
    let lastTilt = 0, lastG = { x: 9, y: 9 }, lastAcc = null;
    const onOrient = (e) => {
      if (e.gamma == null || e.beta == null) return;
      const gx = clamp(e.gamma / 32, -1, 1), gy = clamp((e.beta - 42) / 32, -1, 1); org.setTilt(gx, gy);
      if (!PHONE) return; const now = performance.now();
      if (now - lastTilt > 80 && (Math.abs(gx - lastG.x) > .03 || Math.abs(gy - lastG.y) > .03)) { lastTilt = now; lastG = { x: gx, y: gy }; post("tilt", { gx, gy }); }
    };
    const onMotion = (e) => { const a = e.accelerationIncludingGravity; if (!a) return; if (lastAcc) { const d = Math.abs(a.x - lastAcc.x) + Math.abs(a.y - lastAcc.y) + Math.abs(a.z - lastAcc.z); if (d > 26) org.shake = .6; } lastAcc = { x: a.x, y: a.y, z: a.z }; };
    async function arm() {
      if (armed) return; armed = true;
      try { if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === "function") { const s = await DeviceOrientationEvent.requestPermission(); if (s !== "granted" && q("vo-hint")) q("vo-hint").textContent = tr("Senza il permesso al movimento: tocca e trascina"); } } catch { }
      try { if (window.DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission === "function") await DeviceMotionEvent.requestPermission(); } catch { }
      window.addEventListener("deviceorientation", onOrient); window.addEventListener("devicemotion", onMotion);
    }
    if (PHONE) {
      const overlay = q("vo-arrive"), btn = q("vo-arrive-btn");
      btn.addEventListener("click", async () => {
        await arm(); overlay.classList.add("off");
        // arrivo: l'organismo entra dall'alto e si dispone in verticale
        org.arrive = 2; for (const n of org.list) { n.x = org.cx + (Math.random() - .5) * org.W * .5; n.y = -30 - Math.random() * 160; n.age = -Math.random() * .8; n.scale = 0; }
        connect(); start();
        Say.seq([
          { k: "È passato qui", t: "Lo stesso organismo dello schermo principale, riconfigurato in verticale. Inclina il telefono: lo sente anche di là." },
          { k: "Tocca e trascina", t: "Un tocco lascia uno stimolo su entrambi gli schermi. Un nodo toccato apre la sua notizia anche di là." }
        ], 8500, 2500);
      });
    } else connect();
    if (MOBILE && !("ontouchstart" in window)) { const h = q("vo-hint"); if (h) h.textContent = tr("Tocca · trascina"); }
    start();
  }

  window.Organismo = { mount, mountAll: (sel) => document.querySelectorAll(sel || "[data-organismo]").forEach(mount) };
  // nelle pagine a sé (html.vo-page) i blocchi sono già nel DOM: si montano subito
  if (document.documentElement.classList.contains("vo-page")) { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => window.Organismo.mountAll()); else window.Organismo.mountAll(); }
})();
