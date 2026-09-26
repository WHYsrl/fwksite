/* =========================================================
   ORGANISMO SINTETICO VIVENTE — laboratorio interattivo
   Una pianta aliena su canvas che cresce con i dati, si orienta verso il sole
   (il mercato), fiorisce con i paid media e si innesta con le collab.
   Uso: window.OrganismLab.mount(elemento)  — l'elemento viene riempito con
   canvas, HUD e controlli; il loop gira solo quando è visibile.
   ========================================================= */
(function () {
  "use strict";
  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const angDiff = (to, from) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cssVar = (n, d) => { const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(n)); return isNaN(v) ? d : v; };
  const MAX_DEPTH = 7, MAX_SEGS = 240;

  const ICON = {
    water: '<svg viewBox="0 0 24 24"><path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/></svg>',
    media: '<svg viewBox="0 0 24 24"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></svg>',
    collab: '<svg viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="8" rx="4"/><path d="M12 8v8"/></svg>',
    reset: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v5h5"/></svg>'
  };

  /* ---------- modello ---------- */
  class Organism {
    constructor(W, H) { this.reset(W, H); }
    reset(W, H) {
      this.W = W; this.H = H; this.t = 0;
      this.segs = []; this.blooms = 0; this.particles = [];
      this.energy = 5; this.drops = 0; this.media = 0; this.collabs = 0; this.reorients = 0;
      this.sun = 0.5; this.sunT = 0.5; this.lastMark = 0.5;
      this.base = { x: W * 0.5, y: H * 0.86 };
      const trunk = this.add(null, -Math.PI / 2 + rnd(-0.06, 0.06), Math.min(W, H) * 0.23, 0, "self");
      trunk.pool = this; // il tronco attinge all'energia dell'organismo (i dati)
    }
    add(parent, angle, len, depth, kind) {
      const k = clamp(Math.min(this.W, this.H) / 600, 0.7, 1.2); // spessori in proporzione alla scena
      const s = { parent, angle, len, depth, kind, g: 0, w: Math.max(1.1, (9 - depth * 1.25) * k), spawned: false, children: [], seed: Math.random() * 10, x0: 0, y0: 0, x1: 0, y1: 0, a: angle, bloom: null, pool: parent ? parent.pool : this };
      this.segs.push(s); if (parent) parent.children.push(s); return s;
    }
    take(pool) { // un'unità di energia: dai dati (organismo) o dal budget della collab
      if (pool === this) { if (this.energy < 1) return false; this.energy -= 1; return true; }
      if (pool.budget < 1) return false; pool.budget -= 1; return true;
    }
    sunPos(t = this.sunT) { const th = Math.PI * (1 - t); const R = this.W * 0.48; return { x: this.W / 2 + R * Math.cos(th), y: this.H * 0.62 - R * 0.62 * Math.sin(th) }; }
    water(x) {
      this.energy += 4; this.drops++;
      const sx = x == null ? this.base.x : x;
      for (let i = 0; i < 14; i++) this.particles.push({ kind: "drop", x: sx + rnd(-34, 34), y: rnd(-40, -4), vx: (this.base.x - sx) * rnd(0.5, 1.1) / 1.4 + rnd(-6, 6), vy: rnd(140, 260), life: 1.4, r: rnd(1.4, 3) });
    }
    fertilize() {
      this.media = (this.media + 1) % 4;
      if (this.media) this.bloomSome(2 + this.media * 2); else { this.segs.forEach(s => s.bloom = null); this.blooms = 0; }
    }
    graft() {
      const cands = this.segs.filter(s => s.g >= 1 && s.depth >= 1 && s.depth <= 3 && s.kind === "self");
      if (!cands.length) { this.energy += 2; return false; } // troppo giovane: la collab porta comunque energia
      const p = cands[Math.floor(Math.random() * cands.length)];
      const a = clamp(p.angle + (Math.random() < 0.5 ? -1 : 1) * rnd(0.6, 1.1), -Math.PI + 0.3, -0.3);
      const c = this.add(p, a, p.len * 0.95, p.depth + 1, "collab");
      c.pool = { budget: 5 }; this.collabs++; return true;
    }
    bloomSome(n) {
      const tips = this.segs.filter(s => s.g >= 1 && s.depth >= 2 && !s.bloom && s.kind === "self");
      for (let i = 0; i < n && tips.length; i++) { const s = tips.splice(Math.floor(Math.random() * tips.length), 1)[0]; s.bloom = { r: rnd(5, 8) + this.media * 1.5, phase: Math.random() * TAU, born: this.t, orb: Math.random() < 0.4 }; this.blooms++; }
    }
    update(dt) {
      this.t += dt;
      if (!reduced && this.particles.filter(p => p.kind === "spore").length < 18 && Math.random() < dt * 4) this.particles.push({ kind: "spore", x: rnd(this.W * 0.15, this.W * 0.85), y: rnd(this.H * 0.2, this.base.y), vx: rnd(-6, 6), vy: rnd(-14, -4), life: rnd(4, 8), r: rnd(0.8, 1.8) });
      this.sunT = lerp(this.sunT, this.sun, 1 - Math.pow(0.002, dt));
      if (Math.abs(this.sun - this.lastMark) > 0.2) { this.lastMark = this.sun; this.reorients++; }
      const sp = this.sunPos(this.sun); const toSun = Math.atan2(sp.y - this.base.y, sp.x - this.base.x);
      const rate = (0.6 + this.media * 0.12) * (reduced ? 2.5 : 1);
      for (const s of this.segs) {
        if (s.g < 1) { s.g = Math.min(1, s.g + rate * dt * (1 + 0.12 * s.depth)); continue; }
        if (s.spawned || s.depth >= MAX_DEPTH || this.segs.length >= MAX_SEGS) continue;
        const avail = s.pool === this ? this.energy : s.pool.budget; if (avail < 1) continue;
        s.spawned = true;
        const r = Math.random(); const n = s.depth === 0 ? 3 : (r < 0.15 ? 3 : r < 0.7 ? 2 : 1);
        for (let i = 0; i < n; i++) {
          if (!this.take(s.pool)) break;
          const spread = s.depth === 0 ? 0.95 : 0.7;
          let a = s.angle + rnd(-spread, spread) * (n === 1 ? 0.55 : 1) + (n > 1 ? (i - (n - 1) / 2) * 0.35 : 0);
          a += angDiff(toSun, a) * 0.34;              // fototropismo: i nuovi rami inclinano verso il mercato
          a = clamp(a, -Math.PI + 0.22, -0.22);      // mai verso il basso
          this.add(s, a, s.len * rnd(0.68, 0.82), s.depth + 1, s.kind);
        }
      }
      if (this.media && Math.random() < dt * 0.22 * this.media) this.bloomSome(1);
      for (const p of this.particles) {
        p.life -= dt;
        if (p.kind === "drop") { p.y += p.vy * dt; p.x += p.vx * dt; if (p.y >= this.base.y - 4) { p.kind = "sap"; p.life = 1.5; p.y = this.base.y - 2; p.x = this.base.x + rnd(-6, 6); p.vy = -rnd(70, 130); p.vx = rnd(-10, 10); } }
        else if (p.kind === "spore") { p.y += p.vy * dt; p.x += p.vx * dt + Math.sin(this.t * 1.3 + p.y * 0.05) * 0.25; }
        else { p.y += p.vy * dt; p.x += p.vx * dt + Math.sin(this.t * 7 + p.x) * 0.5; }
      }
      this.particles = this.particles.filter(p => p.life > 0 && p.y < this.H + 10);
    }
    layout(amp, speed) {
      const sp = this.sunPos(); const toSun = Math.atan2(sp.y - this.base.y, sp.x - this.base.x);
      for (const s of this.segs) {
        if (s.parent) { s.x0 = s.parent.x1; s.y0 = s.parent.y1; } else { s.x0 = this.base.x; s.y0 = this.base.y; }
        const bend = angDiff(toSun, s.angle) * 0.11 * Math.min(1, s.depth / 3);   // tutto l'organismo si piega verso il sole (si somma lungo i rami)
        const sway = reduced ? 0 : Math.sin(this.t * 0.9 * speed + s.seed + s.depth * 0.7) * 0.035 * (0.3 + s.depth / 5) * amp;
        s.a = s.angle + bend + sway; const L = s.len * s.g;
        s.x1 = s.x0 + Math.cos(s.a) * L; s.y1 = s.y0 + Math.sin(s.a) * L;
      }
    }
    resize(W, H) { const k = Math.min(W, H) / Math.min(this.W, this.H); this.W = W; this.H = H; this.base = { x: W * 0.5, y: H * 0.86 }; this.segs.forEach(s => s.len *= k); }
    vitality() { return clamp(Math.round(8 + this.segs.length * 0.9 + this.blooms * 2 + this.media * 5 + this.collabs * 6), 0, 100); }
    hint() {
      if (!this.drops && this.segs.length < 6) return "Tocca «Dati» per nutrirlo · trascina il sole";
      if (this.energy < 1 && this.segs.length < 30) return "Ha finito i dati: nutrilo ancora";
      if (!this.media && this.segs.length >= 12) return "Aggiungi paid media: fiorisce";
      if (!this.collabs && this.segs.length >= 20) return "Innesta una collab: una capsule bianca";
      if (this.reorients === 0) return "Sposta il sole: il mercato cambia, lui si riorienta";
      return this.segs.length >= MAX_SEGS ? "Organismo maturo · rigeneralo" : "Continua a nutrirlo: cresce finché ha dati";
    }
  }

  /* ---------- disegno ---------- */
  function draw(ctx, o, W, H) {
    ctx.clearRect(0, 0, W, H);
    const sp = o.sunPos(); const warm = o.sunT;
    const hue = lerp(278, 28, warm);
    let g = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, W * 0.62); g.addColorStop(0, `hsla(${hue},90%,72%,.26)`); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // arco del mercato (guida del sole)
    ctx.setLineDash([2, 7]); ctx.lineWidth = 1; ctx.strokeStyle = "rgba(255,255,255,.14)"; ctx.beginPath();
    for (let i = 0; i <= 48; i++) { const p = o.sunPos(i / 48); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); } ctx.stroke(); ctx.setLineDash([]);
    // terreno
    g = ctx.createLinearGradient(0, o.base.y - 30, 0, H); g.addColorStop(0, "rgba(190,0,255,0)"); g.addColorStop(1, "rgba(190,0,255,.22)"); ctx.fillStyle = g; ctx.fillRect(0, o.base.y - 30, W, H - o.base.y + 30);
    ctx.strokeStyle = "rgba(255,255,255,.1)"; ctx.beginPath(); ctx.moveTo(0, o.base.y + .5); ctx.lineTo(W, o.base.y + .5); ctx.stroke();
    // ombra opposta al sole
    const shx = (o.base.x - sp.x) * 0.22;
    g = ctx.createRadialGradient(o.base.x + shx * 0.5, o.base.y + 4, 0, o.base.x + shx * 0.5, o.base.y + 4, 90); g.addColorStop(0, "rgba(0,0,0,.55)"); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.save(); ctx.scale(1, 0.25); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(o.base.x + shx * 0.5, (o.base.y + 4) * 4, 90, 0, TAU); ctx.fill(); ctx.restore();
    // rami: prima l'alone, poi il corpo
    ctx.lineCap = "round";
    for (let pass = 0; pass < 2; pass++) {
      for (const s of o.segs) {
        if (s.g <= 0.01) continue;
        const d = s.depth / MAX_DEPTH;
        const col = s.kind === "collab" ? `hsl(0,0%,${lerp(78, 100, d)}%)` : `hsl(${lerp(282, 298, d)},88%,${lerp(40, 70, d)}%)`;
        const mx = (s.x0 + s.x1) / 2, my = (s.y0 + s.y1) / 2, nx = -(s.y1 - s.y0), ny = (s.x1 - s.x0), k = Math.sin(s.seed) * 0.13;
        ctx.beginPath(); ctx.moveTo(s.x0, s.y0); ctx.quadraticCurveTo(mx + nx * k, my + ny * k, s.x1, s.y1);
        if (pass === 0) { ctx.globalAlpha = s.kind === "collab" ? 0.22 : 0.16; ctx.lineWidth = s.w * 2.6 + 4; ctx.strokeStyle = s.kind === "collab" ? "#fff" : "#BE00FF"; }
        else { ctx.globalAlpha = 0.95; ctx.lineWidth = Math.max(0.8, s.w * (0.55 + 0.45 * s.g)); ctx.strokeStyle = col; }
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    // giunture, foglie (alle punte e lungo i rami profondi), fiori, capsule
    for (const s of o.segs) {
      if (s.g < 1) continue;
      const tip = !s.children.length;
      if (s.depth >= 1) { ctx.fillStyle = s.kind === "collab" ? "rgba(255,255,255,.9)" : "rgba(217,107,255,.9)"; ctx.beginPath(); ctx.arc(s.x1, s.y1, Math.max(1.2, s.w * 0.28), 0, TAU); ctx.fill(); }
      if (s.depth >= 2 && !s.bloom) {
        const lw = 7 + (MAX_DEPTH - s.depth) * 1.1, lh = 3;
        ctx.save(); ctx.translate(s.x1, s.y1); ctx.rotate(s.a);
        ctx.fillStyle = s.kind === "collab" ? "rgba(255,255,255,.72)" : "rgba(217,107,255,.66)";
        if (tip) { ctx.beginPath(); ctx.ellipse(lw * 0.5, 0, lw * 0.5, lh, 0, 0, TAU); ctx.fill(); }
        else { ctx.beginPath(); ctx.ellipse(0, -lh * 1.4, lw * 0.42, lh * 0.8, -0.6, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(0, lh * 1.4, lw * 0.42, lh * 0.8, 0.6, 0, TAU); ctx.fill(); }
        ctx.restore();
        if (s.kind === "collab" && tip && s.depth >= 4) capsule(ctx, s);
      }
      if (s.bloom) bloom(ctx, s, o.t);
    }
    // particelle: dati che cadono, linfa che sale
    for (const p of o.particles) { ctx.globalAlpha = p.kind === "spore" ? clamp(Math.min(p.life, 1) * 0.55, 0, 1) : clamp(p.life, 0, 1); ctx.fillStyle = p.kind === "drop" ? "rgba(150,210,255,.95)" : p.kind === "spore" ? "rgba(255,255,255,.9)" : "rgba(217,107,255,.95)"; ctx.beginPath(); ctx.arc(p.x, p.y, p.r || 2, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
    // il sole (mercato)
    g = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, 40); g.addColorStop(0, "#fff"); g.addColorStop(0.3, `hsla(${hue},95%,78%,.9)`); g.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sp.x, sp.y, 40, 0, TAU); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(sp.x, sp.y, 8, 0, TAU); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(sp.x, sp.y, 14 + Math.sin(o.t * 2) * 1.5, 0, TAU); ctx.stroke();
    ctx.font = "500 10px 'Geist Mono', ui-monospace, monospace"; ctx.fillStyle = "rgba(255,255,255,.72)"; ctx.textAlign = "center"; ctx.fillText("MERCATO", sp.x, sp.y + 34);
  }
  function bloom(ctx, s, t) {
    const b = s.bloom, age = clamp((t - b.born) * 1.2, 0, 1), r = b.r * age;
    const g = ctx.createRadialGradient(s.x1, s.y1, 0, s.x1, s.y1, r * 3.2); g.addColorStop(0, "rgba(255,255,255,.55)"); g.addColorStop(0.4, "rgba(217,107,255,.35)"); g.addColorStop(1, "rgba(190,0,255,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x1, s.y1, r * 3.2, 0, TAU); ctx.fill();
    if (b.orb) { // sfera sintetica con anello
      const og = ctx.createRadialGradient(s.x1 - r * 0.3, s.y1 - r * 0.3, 0, s.x1, s.y1, r * 1.1); og.addColorStop(0, "#fff"); og.addColorStop(0.5, "#D96BFF"); og.addColorStop(1, "#7a00b3");
      ctx.fillStyle = og; ctx.beginPath(); ctx.arc(s.x1, s.y1, r * 1.05, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(s.x1, s.y1); ctx.rotate(b.phase + t * 0.5); ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.9, r * 0.55, 0, 0, TAU); ctx.stroke(); ctx.restore();
      return;
    }
    ctx.save(); ctx.translate(s.x1, s.y1); ctx.rotate(b.phase + t * 0.25);
    ctx.fillStyle = "rgba(255,255,255,.85)";
    for (let i = 0; i < 5; i++) { ctx.rotate(TAU / 5); ctx.beginPath(); ctx.ellipse(r * 0.9, 0, r * 0.9, r * 0.38, 0, 0, TAU); ctx.fill(); }
    ctx.restore();
    ctx.fillStyle = "#BE00FF"; ctx.beginPath(); ctx.arc(s.x1, s.y1, r * 0.42, 0, TAU); ctx.fill();
  }
  function capsule(ctx, s) {
    ctx.save(); ctx.translate(s.x1, s.y1); ctx.rotate(s.a);
    const g = ctx.createRadialGradient(6, 0, 0, 6, 0, 26); g.addColorStop(0, "rgba(255,255,255,.5)"); g.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(6, 0, 26, 0, TAU); ctx.fill();
    const rr = (x, y, w, h, r) => { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); ctx.fill(); };
    ctx.fillStyle = "#fff"; rr(0, -4, 18, 8, 4);
    ctx.fillStyle = "#BE00FF"; rr(9, -4, 9, 8, [0, 4, 4, 0]);
    ctx.restore();
  }

  /* ---------- montaggio ---------- */
  function mount(root) {
    if (!root || root.dataset.mounted) return; root.dataset.mounted = "1";
    root.innerHTML = `<div class="org-stage"><canvas aria-label="Organismo sintetico vivente: cresce con i dati, si orienta verso il mercato, fiorisce con i media"></canvas><div class="org-hud" aria-live="polite"></div><div class="org-hint"></div></div>
      <div class="org-controls">
        <button type="button" data-act="water" class="pulse">${ICON.water}<b>Dati</b><small>nutri l'organismo</small></button>
        <button type="button" data-act="media">${ICON.media}<b>Paid media</b><small>livello <em>0</em>/3</small></button>
        <button type="button" data-act="collab">${ICON.collab}<b>Collab</b><small>innesta una capsule</small></button>
        <button type="button" data-act="reset">${ICON.reset}<b>Rigenera</b><small>dal seme</small></button>
      </div>`;
    const stage = root.querySelector(".org-stage"), cv = root.querySelector("canvas"), ctx = cv.getContext("2d"), hud = root.querySelector(".org-hud"), hint = root.querySelector(".org-hint");
    let W = 0, H = 0, dpr = 1, o = null, visible = false, raf = 0, last = 0, hudAt = 0, dragging = false;
    const size = () => {
      const r = stage.getBoundingClientRect(); if (!r.width || !r.height) return false;
      dpr = Math.min(2, window.devicePixelRatio || 1); W = Math.round(r.width); H = Math.round(r.height);
      cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!o) { o = new Organism(W, H); root._organism = o; } else o.resize(W, H);
      return true;
    };
    const updHud = () => {
      hud.innerHTML = `<span class="vit">Vitalità <b>${o.vitality()}%</b></span><span>Dati <b>${o.drops}</b></span><span>Rami <b>${o.segs.length}</b></span><span>Fioriture <b>${o.blooms}</b></span><span>Collab <b>${o.collabs}</b></span><span>Riconfig. <b>${o.reorients}</b></span>`;
      hint.textContent = o.hint();
      root.querySelector('[data-act="media"] em').textContent = o.media;
      root.querySelector('[data-act="water"]').classList.toggle("pulse", !o.drops);
    };
    const frame = (now) => {
      raf = 0; if (!visible || !root.isConnected) return;
      const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
      o.update(dt); o.layout(cssVar("--amp", 1), cssVar("--speed", 1)); draw(ctx, o, W, H);
      if (now - hudAt > 250) { hudAt = now; updHud(); }
      raf = requestAnimationFrame(frame);
    };
    const start = () => { if (!raf && visible && size()) { last = 0; raf = requestAnimationFrame(frame); } };
    // visibile → gira; fuori schermo → si ferma
    const io = new IntersectionObserver(es => { visible = es.some(e => e.isIntersecting); if (visible) start(); }, { threshold: 0.05 });
    io.observe(stage);
    new ResizeObserver(() => { if (size()) { o.layout(1, 1); draw(ctx, o, W, H); } }).observe(stage);
    // controlli
    root.querySelector(".org-controls").addEventListener("click", e => {
      const b = e.target.closest("[data-act]"); if (!b || !o) return;
      const act = b.dataset.act;
      if (act === "water") o.water();
      else if (act === "media") o.fertilize();
      else if (act === "collab") o.graft();
      else if (act === "reset") o.reset(W, H);
      updHud(); start();
    });
    // sul canvas: trascina il sole, oppure fai piovere dati dove tocchi
    const pt = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    stage.addEventListener("pointerdown", e => {
      if (!o) return; const p = pt(e); const sp = o.sunPos();
      if (Math.hypot(p.x - sp.x, p.y - sp.y) < 44) { dragging = true; stage.setPointerCapture(e.pointerId); stage.classList.add("dragging"); }
      else if (p.y < o.base.y) { o.water(p.x); updHud(); }
      e.preventDefault();
    });
    stage.addEventListener("pointermove", e => { if (!dragging || !o) return; const p = pt(e); o.sun = clamp((p.x - W * 0.02) / (W * 0.96), 0, 1); });
    const end = () => { dragging = false; stage.classList.remove("dragging"); };
    stage.addEventListener("pointerup", end); stage.addEventListener("pointercancel", end);
    if (size()) { o.layout(1, 1); draw(ctx, o, W, H); updHud(); }
  }
  window.OrganismLab = { mount, mountAll: (sel) => document.querySelectorAll(sel || "[data-organism]").forEach(mount) };
})();
