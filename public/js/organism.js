/* =========================================================
   ORGANISMO SINTETICO VIVENTE — laboratorio interattivo (canvas)
   Evolve per stadi (seme → germoglio → organismo → fioritura → rete → sciame),
   cambia stato (in crescita, vitale, dormiente: si spegne e si riduce se nessuno
   lo nutre), cambia elemento con il clima del mercato (freddo = cristallino e
   azzurro, caldo = magenta e morbido). Ogni azione ha una risposta immediata:
   i dati fanno "bere" l'organismo con un'onda, i media lo fanno fiorire con un
   impulso di luce lungo i rami, la collab arriva da fuori come una cometa e si
   innesta, il sole trascinato lo piega in tempo reale. Una camera lo tiene
   sempre dentro l'inquadratura.
   Uso: window.OrganismLab.mount(elemento) — il loop gira solo quando è visibile.
   ========================================================= */
(function () {
  "use strict";
  const PI = Math.PI, TAU = PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const angDiff = (to, from) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cssVar = (n, d) => { const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(n)); return isNaN(v) ? d : v; };
  const MAX_DEPTH = 7, MAX_SEGS = 260, DORMANT_AFTER = 18;
  const STAGES = ["Seme", "Germoglio", "Organismo", "Fioritura", "Rete", "Sciame"];

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
      this.W = W; this.H = H; this.t = 0; this.lastAction = 0;
      this.segs = []; this.blooms = 0; this.particles = []; this.rings = []; this.pulses = []; this.spores = []; this.sats = []; this.links = [];
      this.energy = 3; this.drops = 0; this.media = 0; this.collabs = 0; this.reorients = 0;
      this.sun = 0.5; this.sunT = 0.5; this.lastMark = 0.5;
      this.vigor = 1; this.sat = 1; this.gulp = 0; this.spurt = 0; this.dissolving = false; this.incoming = null;
      this.cam = { s: 1 }; this.pulseAt = 0; this.linkAt = 0; this.sporeAt = 0;
      this.base = { x: W * 0.5, y: H * 0.86 };
      const trunk = this.add(null, -PI / 2 + rnd(-0.05, 0.05), Math.min(W, H) * 0.22, 0, "self"); trunk.pool = this;
    }
    get climate() { return this.sunT; }               // 0 freddo → 1 caldo
    get dormant() { return this.t - this.lastAction > DORMANT_AFTER && !this.dissolving; }
    touch() { this.lastAction = this.t; }
    add(parent, angle, len, depth, kind) {
      const k = clamp(Math.min(this.W, this.H) / 600, 0.7, 1.2);
      const s = { parent, angle, len, depth, kind, g: 0, w: Math.max(1.1, (9 - depth * 1.25) * k), spawned: false, children: [], seed: Math.random() * 10, x0: 0, y0: 0, x1: 0, y1: 0, cx: 0, cy: 0, a: angle, bloom: null, pool: parent ? parent.pool : this };
      this.segs.push(s); if (parent) parent.children.push(s); return s;
    }
    take(pool) { if (pool === this) { if (this.energy < 1) return false; this.energy -= 1; return true; } if (pool.budget < 1) return false; pool.budget -= 1; return true; }
    sunPos(t = this.sunT) { const th = PI * (1 - t); const R = this.W * 0.48; return { x: this.W / 2 + R * Math.cos(th), y: this.H * 0.6 - R * 0.6 * Math.sin(th) }; }
    // ---- azioni ----
    water(x) {
      this.touch(); this.energy += 4; this.drops++; this.gulp = 1; this.spurt = 1;
      const sx = x == null ? this.base.x : x;
      for (let i = 0; i < 16; i++) this.particles.push({ kind: "drop", x: sx + rnd(-36, 36), y: rnd(-60, -6), vx: (this.base.x - sx) * rnd(0.5, 1.1) / 1.4 + rnd(-6, 6), vy: rnd(160, 280), life: 1.6, r: rnd(1.4, 3) });
      this.rings.push({ x: this.base.x, y: this.base.y, r: 4, life: 1, col: "150,210,255" });
    }
    fertilize() {
      this.touch(); this.media = (this.media + 1) % 4;
      if (this.media) { this.bloomSome(2 + this.media * 2); for (let i = 0; i < 3; i++) this.spawnPulse(); this.rings.push({ x: this.base.x, y: this.base.y - Math.min(this.W, this.H) * 0.25, r: 10, life: 1, col: "217,107,255" }); }
      else { this.segs.forEach(s => s.bloom = null); this.blooms = 0; }
    }
    graft() {
      this.touch();
      const cands = this.segs.filter(s => s.g >= 1 && s.depth >= 1 && s.depth <= 3 && s.kind === "self");
      if (!cands.length) { this.energy += 2; this.spurt = 1; return false; }
      const p = cands[Math.floor(Math.random() * cands.length)];
      const side = Math.random() < 0.5 ? -1 : 1;
      this.incoming = { x: this.base.x + side * this.W * 0.6, y: -this.H * 0.1, target: p, side, p: 0 };
      return true;
    }
    doGraft(p, side) {
      const a = clamp(p.angle + side * rnd(0.6, 1.1), -PI + 0.3, -0.3);
      const c = this.add(p, a, p.len * 0.95, p.depth + 1, "collab"); c.pool = { budget: 5 }; this.collabs++;
      this.rings.push({ x: p.x1, y: p.y1, r: 3, life: 1, col: "255,255,255" });
      for (let i = 0; i < 10; i++) this.particles.push({ kind: "spark", x: p.x1, y: p.y1, vx: rnd(-90, 90), vy: rnd(-90, 40), life: rnd(0.4, 0.9), r: rnd(1, 2.2) });
    }
    regenerate() { this.touch(); this.dissolving = true; }
    bloomSome(n) {
      const tips = this.segs.filter(s => s.g >= 1 && s.depth >= 2 && !s.bloom && s.kind === "self");
      for (let i = 0; i < n && tips.length; i++) {
        const s = tips.splice(Math.floor(Math.random() * tips.length), 1)[0];
        s.bloom = { r: rnd(5, 8) + this.media * 1.5, phase: Math.random() * TAU, born: this.t, orb: Math.random() < 0.4 }; this.blooms++;
        for (let k = 0; k < 6; k++) this.particles.push({ kind: "pollen", x: s.x1, y: s.y1, vx: rnd(-30, 30), vy: rnd(-40, -5), life: rnd(1, 2), r: rnd(0.8, 1.6) });
      }
    }
    spawnPulse() { const t = this.segs[0]; if (t && t.g >= 1 && this.pulses.length < 40) this.pulses.push({ seg: t, p: 0 }); }
    // ---- stadio / stato ----
    stage() {
      const n = this.segs.length;
      if (n <= 1 && this.segs[0].g < 1) return 0;
      if (n < 10) return 1;
      if (this.sats.length) return 5;
      if (this.links.length) return 4;
      if (this.blooms >= 3) return 3;
      return 2;
    }
    stateLabel() { if (this.dissolving) return "Si rigenera"; if (this.dormant) return "Dormiente"; if (this.spurt > 0.25) return "In crescita"; if (this.incoming) return "Innesto in arrivo"; if (this.media && this.blooms) return "In fioritura"; return "Vitale"; }
    climateLabel() { return this.sunT < 0.33 ? "Freddo" : this.sunT < 0.66 ? "Temperato" : "Caldo"; }
    vitality() { return clamp(Math.round((8 + this.segs.length * 0.8 + this.blooms * 2 + this.media * 5 + this.collabs * 6 + this.links.length * 2 + this.sats.length * 4) * this.vigor), 0, 100); }
    hint() {
      if (this.dissolving) return "Si dissolve e riparte dal seme";
      if (this.dormant) return "Dormiente: senza dati si spegne e si riduce. Nutrilo";
      const st = this.stage();
      if (st === 0) return "Un seme. Tocca «Dati» per farlo germogliare";
      if (this.energy < 1 && st <= 2) return "Ha finito i dati: nutrilo ancora e cresce";
      if (this.reorients === 0) return "Trascina il sole: cambia clima, forma e colore";
      if (!this.media && st >= 2) return "Paid media: fiorisce e la luce corre nei rami";
      if (!this.collabs && this.segs.length >= 16) return "Collab: arriva da fuori e si innesta";
      if (st === 4) return "Rete: le collab collegano i rami tra loro";
      if (st === 5) return "Sciame: semina altri organismi intorno a sé";
      return "Continua a nutrirlo: più dati, più stadi";
    }
    // ---- simulazione ----
    update(dt) {
      this.t += dt;
      this.sunT = lerp(this.sunT, this.sun, 1 - Math.pow(0.002, dt));
      if (Math.abs(this.sun - this.lastMark) > 0.2) { this.lastMark = this.sun; this.reorients++; this.touch(); }
      // stato: dormienza (si spegne e si riduce) / risveglio
      const tv = this.dormant ? 0.72 : 1, ts = this.dormant ? 0.28 : 1;
      this.vigor = lerp(this.vigor, tv, 1 - Math.pow(0.15, dt)); this.sat = lerp(this.sat, ts, 1 - Math.pow(0.15, dt));
      this.gulp *= Math.pow(0.02, dt); this.spurt *= Math.pow(0.35, dt);
      // rigenerazione: si dissolve dalle punte, poi riparte dal seme
      if (this.dissolving) {
        for (const s of this.segs) { const tip = !s.children.some(c => c.g > 0); if (tip) { s.g -= dt * 2.2; if (s.g < 0.2 && Math.random() < 0.3) this.particles.push({ kind: "spark", x: s.x1, y: s.y1, vx: rnd(-20, 20), vy: rnd(40, 120), life: 0.8, r: 1.5 }); } if (s.g < 0) s.g = 0; }
        this.segs = this.segs.filter(s => s.g > 0 || !s.parent); this.segs.forEach(s => { s.children = s.children.filter(c => c.g > 0); s.bloom = null; });
        this.blooms = 0; this.links = []; this.pulses = []; this.sats = []; this.spores = [];
        if (this.segs[0].g <= 0) { const W = this.W, H = this.H, sun = this.sun; this.reset(W, H); this.sun = sun; this.sunT = sun; this.lastMark = sun; }
        this.tick(dt); return;
      }
      const sp = this.sunPos(this.sun); const toSun = Math.atan2(sp.y - this.base.y, sp.x - this.base.x);
      const rate = (0.7 + this.media * 0.12) * (1 + this.spurt * 2) * (reduced ? 2 : 1) * (this.dormant ? 0.25 : 1);
      const cold = 1 - this.climate;
      for (const s of this.segs) {
        if (s.g < 1) { if (s.depth === 0 && !this.drops) continue; s.g = Math.min(1, s.g + rate * dt * (1 + 0.12 * s.depth)); continue; } // il seme germoglia al primo dato
        if (s.spawned || s.depth >= MAX_DEPTH || this.segs.length >= MAX_SEGS || this.dormant) continue;
        const avail = s.pool === this ? this.energy : s.pool.budget; if (avail < 1) continue;
        s.spawned = true;
        const r = Math.random(); const n = s.depth === 0 ? 3 : (r < 0.18 ? 3 : r < 0.7 ? 2 : 1);
        for (let i = 0; i < n; i++) {
          if (!this.take(s.pool)) break;
          // forma: col freddo cresce stretto e cristallino (angoli a scatti), col caldo largo e morbido
          const spread = lerp(1.15, 0.7, cold) * (s.depth === 0 ? 1.15 : 0.85);
          let a = s.angle + rnd(-spread, spread) * (n === 1 ? 0.55 : 1) + (n > 1 ? (i - (n - 1) / 2) * spread * 0.5 : 0);
          a += angDiff(toSun, a) * 0.26;
          if (cold > 0.6) a = Math.round(a / (PI / 6)) * (PI / 6) + rnd(-0.04, 0.04);
          a = clamp(a, -PI + 0.22, -0.22);
          this.add(s, a, s.len * lerp(rnd(0.7, 0.84), rnd(0.62, 0.74), cold), s.depth + 1, s.kind);
        }
      }
      if (this.media && !this.dormant && Math.random() < dt * 0.22 * this.media) this.bloomSome(1);
      // innesto in arrivo (cometa)
      if (this.incoming) { const c = this.incoming; c.p += dt * 1.4; if (c.p >= 1) { this.doGraft(c.target, c.side); this.incoming = null; } }
      // impulsi di luce lungo i rami (bioluminescenza): frequenza con la vitalità
      if (!this.dormant && this.t > this.pulseAt) { this.spawnPulse(); this.pulseAt = this.t + (1.9 - this.vitality() / 90) / (1 + this.media * 0.4); }
      for (const p of this.pulses) { p.p += dt * 1.6; if (p.p >= 1) { const ch = p.seg.children.filter(c => c.g > 0.5); p.done = true; ch.slice(0, 2).forEach(c => { if (this.pulses.length < 60) this.pulses.push({ seg: c, p: 0 }); }); } }
      this.pulses = this.pulses.filter(p => !p.done);
      // rete: le collab collegano rami vicini
      if (this.collabs && this.segs.length >= 20 && !this.dormant && this.t > this.linkAt && this.links.length < 7) {
        this.linkAt = this.t + 1.6;
        const tips = this.segs.filter(s => s.g >= 1 && s.depth >= 3 && !s.children.length);
        if (tips.length > 3) { const a = tips[Math.floor(Math.random() * tips.length)]; const near = tips.filter(b => b !== a && b.parent !== a.parent && Math.hypot(a.x1 - b.x1, a.y1 - b.y1) < this.W * 0.32 && Math.hypot(a.x1 - b.x1, a.y1 - b.y1) > 30); if (near.length) { const b = near[Math.floor(Math.random() * near.length)]; if (!this.links.some(l => (l.a === a && l.b === b) || (l.a === b && l.b === a))) this.links.push({ a, b, born: this.t, ph: Math.random() }); } }
      }
      if (this.dormant && this.links.length && Math.random() < dt * 0.5) this.links.pop();
      // sciame: dalle fioriture partono spore che seminano intorno
      if (this.segs.length >= 55 && this.blooms >= 6 && this.drops >= 7 && !this.dormant && this.t > this.sporeAt) {
        this.sporeAt = this.t + 1.4; const bl = this.segs.filter(s => s.bloom); if (bl.length) { const s = bl[Math.floor(Math.random() * bl.length)]; this.spores.push({ x: s.x1, y: s.y1, vx: rnd(-40, 40) + (sp.x - s.x1) * 0.12, vy: rnd(-60, -20), life: 7, r: 2.2, seed: Math.random() < 0.5 && this.sats.length < 5 }); }
      }
      for (const s of this.spores) { s.life -= dt; s.vy += 70 * dt; s.x += s.vx * dt + Math.sin(this.t * 3 + s.x * 0.05) * 0.5; s.y += s.vy * dt; if (s.seed && s.y >= this.base.y) { s.life = 0; const x = clamp(s.x, this.W * 0.08, this.W * 0.92); if (Math.abs(x - this.base.x) > 40) { this.sats.push({ x, g: 0, size: rnd(0.22, 0.34), seed: Math.random() * 10 }); this.rings.push({ x, y: this.base.y, r: 3, life: 1, col: "217,107,255" }); } } }
      this.spores = this.spores.filter(s => s.life > 0 && s.y < this.H + 20);
      for (const st of this.sats) st.g = Math.min(1, st.g + dt * 0.35);
      this.tick(dt);
    }
    tick(dt) { // effetti comuni
      if (!reduced && this.particles.filter(p => p.kind === "spore").length < 16 && Math.random() < dt * 4) this.particles.push({ kind: "spore", x: rnd(this.W * 0.1, this.W * 0.9), y: rnd(this.H * 0.2, this.base.y), vx: rnd(-6, 6), vy: rnd(-14, -4), life: rnd(4, 8), r: rnd(0.8, 1.8) });
      for (const p of this.particles) {
        p.life -= dt;
        if (p.kind === "drop") { p.y += p.vy * dt; p.x += p.vx * dt; if (p.y >= this.base.y - 4) { p.kind = "sap"; p.life = 1.5; p.y = this.base.y - 2; p.x = this.base.x + rnd(-6, 6); p.vy = -rnd(70, 130); p.vx = rnd(-10, 10); } }
        else if (p.kind === "spore") { p.y += p.vy * dt; p.x += p.vx * dt + Math.sin(this.t * 1.3 + p.y * 0.05) * 0.25; }
        else if (p.kind === "spark" || p.kind === "pollen") { p.vy += (p.kind === "spark" ? 160 : 10) * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
        else { p.y += p.vy * dt; p.x += p.vx * dt + Math.sin(this.t * 7 + p.x) * 0.5; }
      }
      this.particles = this.particles.filter(p => p.life > 0 && p.y < this.H + 10);
      for (const r of this.rings) { r.life -= dt * 0.9; r.r += dt * 140; }
      this.rings = this.rings.filter(r => r.life > 0);
    }
    layout(amp, speed) {
      const sp = this.sunPos(); const toSun = Math.atan2(sp.y - this.base.y, sp.x - this.base.x);
      const warm = this.climate; const gulp = 1 + this.gulp * 0.05 * Math.sin(this.t * 26);
      let minY = this.base.y, minX = this.base.x, maxX = this.base.x;
      for (const s of this.segs) {
        if (s.parent) { s.x0 = s.parent.x1; s.y0 = s.parent.y1; } else { s.x0 = this.base.x; s.y0 = this.base.y; }
        const bend = angDiff(toSun, s.angle) * 0.14 * Math.min(1, s.depth / 3);
        const sway = reduced ? 0 : Math.sin(this.t * 0.9 * speed + s.seed + s.depth * 0.7) * lerp(0.02, 0.045, warm) * (0.3 + s.depth / 5) * amp * this.vigor;
        s.a = s.angle + bend + sway; const L = s.len * s.g * this.vigor * gulp;
        s.x1 = s.x0 + Math.cos(s.a) * L; s.y1 = s.y0 + Math.sin(s.a) * L;
        const k = Math.sin(s.seed) * lerp(0.04, 0.16, warm); // curvatura: dritta col freddo, morbida col caldo
        s.cx = (s.x0 + s.x1) / 2 - (s.y1 - s.y0) * k; s.cy = (s.y0 + s.y1) / 2 + (s.x1 - s.x0) * k;
        if (s.y1 < minY) minY = s.y1; if (s.x1 < minX) minX = s.x1; if (s.x1 > maxX) maxX = s.x1;
      }
      // camera: l'organismo resta sempre dentro l'inquadratura
      const height = Math.max(1, this.base.y - minY + 40), half = Math.max(Math.abs(maxX - this.base.x), Math.abs(minX - this.base.x)) + 40;
      const fit = Math.min(1, (this.base.y - this.H * 0.17) / height, (this.W * 0.47) / half);
      this.cam.s = lerp(this.cam.s, fit, 1 - Math.pow(0.05, 1 / 60));
    }
    resize(W, H) { const k = Math.min(W, H) / Math.min(this.W, this.H); const kx = W / this.W; this.W = W; this.H = H; this.base = { x: W * 0.5, y: H * 0.86 }; this.segs.forEach(s => s.len *= k); this.sats.forEach(s => s.x *= kx); }
  }

  /* ---------- disegno ---------- */
  const qpt = (s, t) => { const u = 1 - t; return { x: u * u * s.x0 + 2 * u * t * s.cx + t * t * s.x1, y: u * u * s.y0 + 2 * u * t * s.cy + t * t * s.y1 }; };
  const hsl = (h, sat, l, a = 1) => `hsla(${h},${sat}%,${l}%,${a})`;
  function draw(ctx, o, W, H) {
    ctx.clearRect(0, 0, W, H);
    const sp = o.sunPos(); const warm = o.climate; const hueSun = lerp(200, 28, warm); const hue = lerp(212, 318, warm); const S = 88 * o.sat + 8;
    // luce del sole
    let g = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, W * 0.62); g.addColorStop(0, hsl(hueSun, 90, 72, 0.26)); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // arco del mercato
    ctx.setLineDash([2, 7]); ctx.lineWidth = 1; ctx.strokeStyle = "rgba(255,255,255,.14)"; ctx.beginPath();
    for (let i = 0; i <= 48; i++) { const p = o.sunPos(i / 48); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); } ctx.stroke(); ctx.setLineDash([]);
    // terreno
    g = ctx.createLinearGradient(0, o.base.y - 30, 0, H); g.addColorStop(0, hsl(hue, S, 50, 0)); g.addColorStop(1, hsl(hue, S, 50, 0.22)); ctx.fillStyle = g; ctx.fillRect(0, o.base.y - 30, W, H - o.base.y + 30);
    ctx.strokeStyle = "rgba(255,255,255,.1)"; ctx.beginPath(); ctx.moveTo(0, o.base.y + .5); ctx.lineTo(W, o.base.y + .5); ctx.stroke();
    // --- mondo (con camera ancorata alla base) ---
    const cs = o.cam.s; ctx.save(); ctx.translate(o.base.x, o.base.y); ctx.scale(cs, cs); ctx.translate(-o.base.x, -o.base.y);
    const shx = (o.base.x - sp.x) * 0.22;
    g = ctx.createRadialGradient(o.base.x + shx * 0.5, o.base.y + 4, 0, o.base.x + shx * 0.5, o.base.y + 4, 90); g.addColorStop(0, "rgba(0,0,0,.55)"); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.save(); ctx.scale(1, 0.25); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(o.base.x + shx * 0.5, (o.base.y + 4) * 4, 90 / cs + 40, 0, TAU); ctx.fill(); ctx.restore();
    for (const st of o.sats) satellite(ctx, o, st, hue, S);
    if (o.stage() === 0) { const r = 7 + Math.sin(o.t * 3) * 1.5; g = ctx.createRadialGradient(o.base.x, o.base.y - 8, 0, o.base.x, o.base.y - 8, 30); g.addColorStop(0, "rgba(255,255,255,.5)"); g.addColorStop(1, "rgba(191,0,255,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(o.base.x, o.base.y - 8, 30, 0, TAU); ctx.fill(); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(o.base.x, o.base.y - 8, r * 0.7, r, 0, 0, TAU); ctx.fill(); }
    // rami: alone, poi corpo
    ctx.lineCap = "round";
    for (let pass = 0; pass < 2; pass++) {
      for (const s of o.segs) {
        if (s.g <= 0.01) continue;
        const d = s.depth / MAX_DEPTH;
        ctx.beginPath(); ctx.moveTo(s.x0, s.y0); ctx.quadraticCurveTo(s.cx, s.cy, s.x1, s.y1);
        if (pass === 0) { ctx.globalAlpha = (s.kind === "collab" ? 0.22 : 0.16) * o.sat; ctx.lineWidth = s.w * 2.6 + 4; ctx.strokeStyle = s.kind === "collab" ? "#fff" : hsl(hue, 90, 55); }
        else { ctx.globalAlpha = 0.95; ctx.lineWidth = Math.max(0.8, s.w * (0.55 + 0.45 * s.g) * (0.85 + 0.15 * o.vigor)); ctx.strokeStyle = s.kind === "collab" ? `hsl(0,0%,${lerp(78, 100, d)}%)` : hsl(lerp(hue - 6, hue + 12, d), S, lerp(40, 70, d) * (0.7 + 0.3 * o.vigor)); }
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    // giunture e foglie (cristalli col freddo, foglie tonde col caldo), fiori, capsule
    const leafRound = smooth(0.3, 0.7, warm);
    for (const s of o.segs) {
      if (s.g < 1) continue;
      const tip = !s.children.length;
      if (s.depth >= 1) { ctx.fillStyle = s.kind === "collab" ? "rgba(255,255,255,.9)" : hsl(hue + 10, S, 72, 0.9); ctx.beginPath(); ctx.arc(s.x1, s.y1, Math.max(1.2, s.w * 0.28), 0, TAU); ctx.fill(); }
      if (s.depth >= 2 && !s.bloom) {
        const lw = (7 + (MAX_DEPTH - s.depth) * 1.1) * lerp(0.9, 1.15, warm) * o.vigor, lh = 3 * lerp(0.7, 1.25, warm) * o.vigor;
        ctx.save(); ctx.translate(s.x1, s.y1); ctx.rotate(s.a);
        ctx.fillStyle = s.kind === "collab" ? "rgba(255,255,255,.72)" : hsl(hue + 12, S, 70, 0.68);
        const leaf = (rot, sc) => { ctx.save(); ctx.rotate(rot); ctx.scale(sc, sc);
          if (leafRound < 0.999) { ctx.globalAlpha = 1 - leafRound; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(lw * 0.5, -lh * 0.8); ctx.lineTo(lw, 0); ctx.lineTo(lw * 0.5, lh * 0.8); ctx.closePath(); ctx.fill(); }
          if (leafRound > 0.001) { ctx.globalAlpha = leafRound; ctx.beginPath(); ctx.ellipse(lw * 0.5, 0, lw * 0.5, lh, 0, 0, TAU); ctx.fill(); }
          ctx.globalAlpha = 1; ctx.restore(); };
        if (tip) leaf(0, 1); else { leaf(-0.9, 0.7); leaf(0.9, 0.7); }
        ctx.restore();
        if (s.kind === "collab" && tip && s.depth >= 4) capsule(ctx, s);
      }
      if (s.bloom) bloom(ctx, s, o.t, hue, S);
    }
    // rete: filamenti tra i rami, con un segnale che corre
    for (const l of o.links) { const age = clamp((o.t - l.born) * 1.5, 0, 1); const mx = (l.a.x1 + l.b.x1) / 2, my = (l.a.y1 + l.b.y1) / 2 - 30; ctx.setLineDash([3, 5]); ctx.strokeStyle = `rgba(255,255,255,${0.35 * age})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(l.a.x1, l.a.y1); ctx.quadraticCurveTo(mx, my, l.b.x1, l.b.y1); ctx.stroke(); ctx.setLineDash([]);
      const tt = (o.t * 0.35 + l.ph) % 1, u = 1 - tt; const px = u * u * l.a.x1 + 2 * u * tt * mx + tt * tt * l.b.x1, py = u * u * l.a.y1 + 2 * u * tt * my + tt * tt * l.b.y1; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(px, py, 1.8, 0, TAU); ctx.fill(); }
    // impulsi di luce
    for (const p of o.pulses) { const q = qpt(p.seg, clamp(p.p, 0, 1)); g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, 9); g.addColorStop(0, "rgba(255,255,255,.95)"); g.addColorStop(0.4, hsl(hue + 20, 95, 80, 0.6)); g.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, 9, 0, TAU); ctx.fill(); }
    // cometa della collab
    if (o.incoming) { const c = o.incoming, e = c.p * c.p; const tx = c.target.x1, ty = c.target.y1; const x = lerp(c.x, tx, e), y = lerp(c.y, ty, e) - Math.sin(c.p * PI) * 60; g = ctx.createRadialGradient(x, y, 0, x, y, 22); g.addColorStop(0, "#fff"); g.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 22, 0, TAU); ctx.fill(); const e2 = Math.max(0, e - 0.12), p2 = Math.max(0, c.p - 0.1); ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(lerp(c.x, tx, e2), lerp(c.y, ty, e2) - Math.sin(p2 * PI) * 60); ctx.stroke(); }
    // onde, particelle, spore-semi
    for (const r of o.rings) { ctx.strokeStyle = `rgba(${r.col},${0.6 * r.life})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke(); }
    for (const p of o.particles) { ctx.globalAlpha = p.kind === "spore" ? clamp(Math.min(p.life, 1) * 0.55, 0, 1) : clamp(p.life, 0, 1); ctx.fillStyle = p.kind === "drop" ? "rgba(150,210,255,.95)" : p.kind === "spore" || p.kind === "spark" ? "rgba(255,255,255,.9)" : hsl(hue + 15, 90, 75, 0.95); ctx.beginPath(); ctx.arc(p.x, p.y, p.r || 2, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
    for (const s of o.spores) { ctx.fillStyle = s.seed ? "#fff" : hsl(hue + 15, 90, 80); ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill(); }
    ctx.restore();
    // --- schermo: il sole ---
    g = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, 40); g.addColorStop(0, "#fff"); g.addColorStop(0.3, hsl(hueSun, 95, 78, 0.9)); g.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sp.x, sp.y, 40, 0, TAU); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(sp.x, sp.y, 8, 0, TAU); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(sp.x, sp.y, 14 + Math.sin(o.t * 2) * 1.5, 0, TAU); ctx.stroke();
    ctx.font = "500 10px 'Geist Mono', ui-monospace, monospace"; ctx.fillStyle = "rgba(255,255,255,.72)"; ctx.textAlign = "center"; ctx.fillText("MERCATO · " + o.climateLabel().toUpperCase(), sp.x, sp.y + 34);
  }
  function bloom(ctx, s, t, hue, S) {
    const b = s.bloom, age = clamp((t - b.born) * 1.2, 0, 1), r = b.r * age;
    let g = ctx.createRadialGradient(s.x1, s.y1, 0, s.x1, s.y1, r * 3.2); g.addColorStop(0, "rgba(255,255,255,.55)"); g.addColorStop(0.4, hsl(hue + 15, S, 72, 0.35)); g.addColorStop(1, hsl(hue, S, 50, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x1, s.y1, r * 3.2, 0, TAU); ctx.fill();
    if (b.orb) {
      const og = ctx.createRadialGradient(s.x1 - r * 0.3, s.y1 - r * 0.3, 0, s.x1, s.y1, r * 1.1); og.addColorStop(0, "#fff"); og.addColorStop(0.5, hsl(hue + 15, S, 72)); og.addColorStop(1, hsl(hue, S, 35));
      ctx.fillStyle = og; ctx.beginPath(); ctx.arc(s.x1, s.y1, r * 1.05, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(s.x1, s.y1); ctx.rotate(b.phase + t * 0.5); ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.9, r * 0.55, 0, 0, TAU); ctx.stroke(); ctx.restore();
      return;
    }
    ctx.save(); ctx.translate(s.x1, s.y1); ctx.rotate(b.phase + t * 0.25); ctx.fillStyle = "rgba(255,255,255,.85)";
    for (let i = 0; i < 5; i++) { ctx.rotate(TAU / 5); ctx.beginPath(); ctx.ellipse(r * 0.9, 0, r * 0.9, r * 0.38, 0, 0, TAU); ctx.fill(); }
    ctx.restore();
    ctx.fillStyle = hsl(hue, S, 50); ctx.beginPath(); ctx.arc(s.x1, s.y1, r * 0.42, 0, TAU); ctx.fill();
  }
  function capsule(ctx, s) {
    ctx.save(); ctx.translate(s.x1, s.y1); ctx.rotate(s.a);
    const g = ctx.createRadialGradient(6, 0, 0, 6, 0, 26); g.addColorStop(0, "rgba(255,255,255,.5)"); g.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(6, 0, 26, 0, TAU); ctx.fill();
    const rr = (x, y, w, h, r) => { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); ctx.fill(); };
    ctx.fillStyle = "#fff"; rr(0, -4, 18, 8, 4); ctx.fillStyle = "#BF00FF"; rr(9, -4, 9, 8, [0, 4, 4, 0]);
    ctx.restore();
  }
  function satellite(ctx, o, st, hue, S) { // mini-organismo seminato dallo sciame
    const h = Math.min(o.W, o.H) * st.size * st.g; if (h < 2) return;
    ctx.lineCap = "round"; ctx.strokeStyle = hsl(hue + 8, S, 62, 0.9);
    for (let i = 0; i < 4; i++) { const a = -PI / 2 + (i - 1.5) * 0.42 + Math.sin(o.t * 0.8 + st.seed + i) * 0.05; const L = h * (i === 1 || i === 2 ? 1 : 0.7); ctx.lineWidth = Math.max(1, 3 * st.g); ctx.beginPath(); ctx.moveTo(st.x, o.base.y); ctx.quadraticCurveTo(st.x + Math.cos(a) * L * 0.5 + 6, o.base.y + Math.sin(a) * L * 0.5, st.x + Math.cos(a) * L, o.base.y + Math.sin(a) * L); ctx.stroke();
      if (st.g > 0.9) { ctx.fillStyle = hsl(hue + 15, S, 75, 0.8); ctx.beginPath(); ctx.arc(st.x + Math.cos(a) * L, o.base.y + Math.sin(a) * L, 2.2, 0, TAU); ctx.fill(); } }
  }

  /* ---------- montaggio ---------- */
  function mount(root) {
    if (!root || root.dataset.mounted) return; root.dataset.mounted = "1";
    root.innerHTML = `<div class="org-stage"><canvas aria-label="Organismo sintetico vivente: evolve con i dati, il mercato, i media e le collab"></canvas><div class="org-hud" aria-live="polite"></div><div class="org-hint"></div></div>
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
      hud.innerHTML = `<span class="vit">Vitalità <b>${o.vitality()}%</b> · <b>${STAGES[o.stage()]}</b> · ${o.stateLabel()}</span><span>Dati <b>${o.drops}</b></span><span>Rami <b>${o.segs.length}</b></span><span>Fioriture <b>${o.blooms}</b></span><span>Collab <b>${o.collabs}</b></span><span>Rete <b>${o.links.length}</b></span><span>Semi <b>${o.sats.length}</b></span>`;
      hint.textContent = o.hint();
      root.querySelector('[data-act="media"] em').textContent = o.media;
      root.querySelector('[data-act="water"]').classList.toggle("pulse", !o.drops || o.dormant);
      root.classList.toggle("dormant", o.dormant);
    };
    const frame = (now) => {
      raf = 0; if (!visible || !root.isConnected) return;
      const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
      o.update(dt); o.layout(cssVar("--amp", 1), cssVar("--speed", 1)); draw(ctx, o, W, H);
      if (now - hudAt > 250) { hudAt = now; updHud(); }
      raf = requestAnimationFrame(frame);
    };
    const start = () => { if (!raf && visible && size()) { last = 0; raf = requestAnimationFrame(frame); } };
    const io = new IntersectionObserver(es => { visible = es.some(e => e.isIntersecting); if (visible) start(); }, { threshold: 0.05 });
    io.observe(stage);
    new ResizeObserver(() => { if (size()) { o.layout(1, 1); draw(ctx, o, W, H); } }).observe(stage);
    root.querySelector(".org-controls").addEventListener("click", e => {
      const b = e.target.closest("[data-act]"); if (!b || !o) return;
      const act = b.dataset.act;
      if (act === "water") o.water(); else if (act === "media") o.fertilize(); else if (act === "collab") o.graft(); else if (act === "reset") o.regenerate();
      updHud(); start();
    });
    const pt = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    stage.addEventListener("pointerdown", e => {
      if (!o) return; const p = pt(e); const sp = o.sunPos();
      if (Math.hypot(p.x - sp.x, p.y - sp.y) < 44) { dragging = true; stage.setPointerCapture(e.pointerId); stage.classList.add("dragging"); }
      else if (p.y < o.base.y) { o.water(o.base.x + (p.x - o.base.x) / o.cam.s); updHud(); }
      e.preventDefault();
    });
    stage.addEventListener("pointermove", e => { if (!dragging || !o) return; const p = pt(e); o.sun = clamp((p.x - W * 0.02) / (W * 0.96), 0, 1); });
    const end = () => { dragging = false; stage.classList.remove("dragging"); };
    stage.addEventListener("pointerup", end); stage.addEventListener("pointercancel", end);
    if (size()) { o.layout(1, 1); draw(ctx, o, W, H); updHud(); }
  }
  window.OrganismLab = { mount, mountAll: (sel) => document.querySelectorAll(sel || "[data-organism]").forEach(mount) };
})();
