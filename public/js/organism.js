/* =========================================================
   ORGANISMO SINTETICO VIVENTE — laboratorio di fisica (canvas)
   Non una pianta: una creatura aliena a corpo morbido (medusa/cellula) simulata
   con particelle e vincoli (integrazione di Verlet). Vive in un mezzo con leggi
   fisiche che il visitatore regola: gravità, densità del mezzo (attrito e
   spinta di Archimede), temperatura (agitazione). Reagisce alla luce
   (trascinabile: fototassi e colore), alle correnti (trascina nel vuoto) e al
   cibo: i "dati" cadono, seguono la stessa fisica, e l'organismo nuota per
   mangiarli. Evolve: cellula → medusa → organismo → colonia (simbionti delle
   collab) → mitosi (si divide in due). Cambia stato: affamato si riduce,
   dormiente si spegne, energico coi media diventa bioluminescente e galleggia.
   Uso: window.OrganismLab.mount(elemento) — il loop gira solo quando è visibile.
   ========================================================= */
(function () {
  "use strict";
  const PI = Math.PI, TAU = PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cssVar = (n, d) => { const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(n)); return isNaN(v) ? d : v; };
  const STAGES = ["Cellula", "Medusa", "Organismo", "Colonia", "Mitosi"];
  const HUNGRY_AFTER = 14, DORMANT_AFTER = 26, MAX_CREATURES = 3;

  const ICON = {
    water: '<svg viewBox="0 0 24 24"><path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/></svg>',
    media: '<svg viewBox="0 0 24 24"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></svg>',
    collab: '<svg viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="8" rx="4"/><path d="M12 8v8"/></svg>',
    reset: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v5h5"/></svg>'
  };

  /* ---------- particelle e vincoli ---------- */
  const P = (x, y, m = 1) => ({ x, y, px: x, py: y, m, fx: 0, fy: 0 });
  function dist(a, b, rest, k = 0.5, wa = 0.5) { // vincolo di distanza (wa = quota di correzione su a)
    const dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy) || 1e-6; const diff = (d - rest) / d * k;
    a.x += dx * diff * wa; a.y += dy * diff * wa; b.x -= dx * diff * (1 - wa); b.y -= dy * diff * (1 - wa);
  }

  /* ---------- creatura ---------- */
  class Creature {
    constructor(lab, x, y, r0, generation = 0) {
      this.lab = lab; this.R0 = r0; this.gen = generation; this.growth = generation ? 4 : 0; this.N = 18;
      this.c = P(x, y, 3); this.ring = []; this.tent = []; this.symb = [];
      for (let i = 0; i < this.N; i++) { const a = i / this.N * TAU; this.ring.push(P(x + Math.cos(a) * r0, y + Math.sin(a) * r0)); }
      this.phase = Math.random() * TAU; this.pulse = 0; this.prevPulse = 0; this.dir = { x: 0, y: -1 }; this.seed = Math.random() * 10;
      this.lobe = Array.from({ length: this.N }, (_, i) => 1 + 0.09 * Math.sin(i * 3 * TAU / this.N + this.seed) + 0.05 * Math.sin(i * 5 * TAU / this.N + this.seed * 2)); // membrana lobata, non un cerchio
      this.lastFood = lab.t; this.gulp = 0; this.organelles = Array.from({ length: 5 }, (_, i) => ({ a: i / 5 * TAU, r: rnd(0.25, 0.55), s: rnd(0.2, 0.5) }));
      this.rebuild();
    }
    get R() { return this.R0 * Math.min(2.1, 1 + 0.04 * this.growth); }
    get stage() { if (this.symb.length && this.growth >= 8) return 3; if (this.growth >= 8) return 2; if (this.growth >= 3) return 1; return 0; }
    rebuild() { // tentacoli in base alla crescita
      const want = this.growth < 3 ? 0 : Math.min(10, 2 + Math.floor(this.growth / 3)), K = Math.min(16, 6 + Math.floor(this.growth / 3));
      while (this.tent.length < want) { const i = this.tent.length; const at = this.bottomIndex(i); const a = this.ring[at]; const ch = []; for (let k = 1; k <= K; k++) ch.push(P(a.x + rnd(-2, 2), a.y + k * 4)); this.tent.push({ at, ch, ph: rnd(0, TAU) }); }
      while (this.tent.length > want) this.tent.pop();
      for (const t of this.tent) { while (t.ch.length < K) { const l = t.ch[t.ch.length - 1]; t.ch.push(P(l.x, l.y + 3)); } while (t.ch.length > K) t.ch.pop(); }
    }
    bottomIndex(i) { const order = [4, 5, 3, 6, 2, 7, 1, 8, 0, 9]; return (order[i % order.length] + Math.round(this.N * 0.25) - 4 + this.N) % this.N; } // attorno al "basso" del ring (angolo 90°)
    feed() { this.growth++; this.lastFood = this.lab.t; this.gulp = 1; this.rebuild(); }
    starve() { if (this.growth > 0) { this.growth--; this.rebuild(); } }
    all() { const a = [this.c, ...this.ring]; for (const t of this.tent) a.push(...t.ch); for (const s of this.symb) a.push(s.c, ...s.ring, ...s.fil.flat()); return a; }
    step(dt, env) {
      const lab = this.lab; const R = this.R;
      // ritmo del "campanello": contrazione → spinta (nuoto) nella direzione scelta
      const energy = lab.media; const freq = (0.9 + energy * 0.35 + env.temp * 0.5) * (lab.dormant ? 0.35 : 1);
      this.phase += dt * freq * TAU; this.prevPulse = this.pulse; this.pulse = Math.pow(Math.max(0, Math.sin(this.phase)), 3);
      const contracting = Math.max(0, this.pulse - this.prevPulse);
      // direzione: verso il cibo più vicino, altrimenti verso la luce (fototassi); i satelliti (figli) seguono la luce e basta
      let tx = lab.light.x, ty = lab.light.y; let nearest = null, nd = 1e9;
      for (const f of lab.food) { const d = Math.hypot(f.x - this.c.x, f.y - this.c.y); if (d < nd) { nd = d; nearest = f; } }
      if (nearest && nd < Math.max(lab.W, lab.H)) { tx = nearest.x; ty = nearest.y; }
      const dx = tx - this.c.x, dy = ty - this.c.y, dd = Math.hypot(dx, dy) || 1; this.dir.x = lerp(this.dir.x, dx / dd, 0.08); this.dir.y = lerp(this.dir.y, dy / dd, 0.08);
      const thrust = contracting * 7000 * (lab.dormant ? 0.25 : 1) * (0.5 + 0.5 * Math.min(1, dd / 160));
      // forze sul corpo
      const body = [this.c, ...this.ring];
      for (const p of body) { p.fx += this.dir.x * thrust; p.fy += this.dir.y * thrust + env.net; }
      // tentacoli: pendono (più densi del corpo), ondeggiano
      for (const t of this.tent) t.ch.forEach((p, k) => { p.fy += env.g * 380 * 0.55 + env.net * 0.25; p.fx += Math.sin(lab.t * 2.2 + t.ph + k * 0.5) * (14 + energy * 8) * (k / t.ch.length); });
      // simbionti: seguono, attaccati con un vincolo
      for (const s of this.symb) { for (const p of [s.c, ...s.ring]) { p.fy += env.net * 0.6; } s.fil.forEach(f => f.forEach((p, k) => { p.fy += env.g * 200; p.fx += Math.sin(lab.t * 3 + k) * 10; })); }
      // agitazione termica
      if (env.temp > 0.02) for (const p of this.all()) { p.fx += rnd(-1, 1) * env.temp * 260; p.fy += rnd(-1, 1) * env.temp * 260; }
      this.gulp *= Math.pow(0.03, dt);
    }
    constrain(iter) {
      const R = this.R * (1 - 0.16 * this.pulse) * (1 + 0.06 * this.gulp * Math.sin(this.lab.t * 30));
      const chord = 2 * R * Math.sin(PI / this.N);
      for (let it = 0; it < iter; it++) {
        for (let i = 0; i < this.N; i++) { dist(this.ring[i], this.ring[(i + 1) % this.N], chord, 0.5); dist(this.c, this.ring[i], R * this.lobe[i], 0.35, 0.15); dist(this.ring[i], this.ring[(i + this.N / 2) % this.N], R * 2, 0.08); }
        for (const t of this.tent) { let prev = this.ring[t.at]; const seg = this.R * 0.22; t.ch.forEach((p, k) => { dist(prev, p, seg, 0.5, k === 0 ? 0.02 : 0.5); prev = p; }); }
        for (const s of this.symb) {
          const r = s.r; const ch = 2 * r * Math.sin(PI / s.ring.length);
          for (let i = 0; i < s.ring.length; i++) { dist(s.ring[i], s.ring[(i + 1) % s.ring.length], ch, 0.5); dist(s.c, s.ring[i], r, 0.35, 0.15); }
          dist(this.ring[s.at], s.c, this.R * 0.15 + r, 0.4, 0.1);
          s.fil.forEach((f, j) => { let prev = s.ring[(j * 3 + 2) % s.ring.length]; f.forEach((p, k) => { dist(prev, p, r * 0.45, 0.5, k === 0 ? 0.05 : 0.5); prev = p; }); });
        }
      }
    }
    addSymbiont() {
      const at = Math.floor(Math.random() * this.N); const a = this.ring[at]; const r = this.R0 * 0.32;
      const s = { c: P(a.x, a.y, 2), ring: [], r, at, fil: [[], []], born: this.lab.t };
      for (let i = 0; i < 9; i++) { const an = i / 9 * TAU; s.ring.push(P(a.x + Math.cos(an) * r, a.y + Math.sin(an) * r)); }
      s.fil.forEach(f => { for (let k = 0; k < 6; k++) f.push(P(a.x, a.y + k * 3)); });
      this.symb.push(s);
    }
  }

  /* ---------- laboratorio ---------- */
  class Lab {
    constructor(W, H) { this.W = W; this.H = H; this.reset(); }
    reset() {
      this.t = 0; this.lastAction = 0; this.creatures = []; this.food = []; this.rings = []; this.sparks = []; this.snow = [];
      this.g = 1; this.rho = 1; this.temp = 0.15; this.media = 0; this.drops = 0; this.collabs = 0; this.eaten = 0; this.splits = 0;
      this.sun = 0.5; this.sunT = 0.5; this.lastMark = 0.5; this.reorients = 0; this.flow = null; this.incoming = null; this.dissolving = 0;
      this.creatures.push(new Creature(this, this.W * 0.5, this.H * 0.45, Math.min(this.W, this.H) * 0.085));
      for (let i = 0; i < 40; i++) this.snow.push({ x: rnd(0, this.W), y: rnd(0, this.H), r: rnd(0.6, 1.6), s: rnd(0.3, 1) });
    }
    get main() { return this.creatures[0]; }
    get light() { return this.sunPos(); }
    get dormant() { return this.t - this.lastAction > DORMANT_AFTER; }
    get floor() { return this.H * 0.93; }
    touch() { this.lastAction = this.t; }
    sunPos(t = this.sunT) { const th = PI * (1 - t); const R = this.W * 0.46; return { x: this.W / 2 + R * Math.cos(th), y: this.H * 0.5 - R * 0.42 * Math.sin(th) }; }
    env() { // leggi fisiche del mezzo
      const rhoBody = 1.35 - 0.16 * this.media;                     // i media rendono l'organismo più leggero (gas bioluminescente)
      const net = this.g * 380 * (1 - this.rho / rhoBody);           // gravità meno spinta di Archimede: ρ alta = galleggia, ρ bassa = affonda
      const damp = 1 - clamp(0.004 + 0.011 * this.rho, 0.004, 0.05); // attrito viscoso (per sotto-passo)
      return { g: this.g, rho: this.rho, temp: this.temp, net, damp };
    }
    // ---- azioni ----
    feed(x) {
      this.touch(); this.drops++; const sx = x == null ? this.W * 0.5 + rnd(-this.W * 0.2, this.W * 0.2) : x;
      for (let i = 0; i < 5; i++) this.food.push({ x: sx + rnd(-26, 26), y: rnd(-30, -4), px: sx, py: -10, life: 40, r: rnd(2, 3.4) });
      for (const f of this.food.slice(-5)) { f.px = f.x - rnd(-1, 1); f.py = f.y; }
    }
    energize() { this.touch(); this.media = (this.media + 1) % 4; const c = this.main; this.rings.push({ x: c.c.x, y: c.c.y, r: c.R, life: 1, col: "217,107,255" }); if (this.media) for (let i = 0; i < 12; i++) this.sparks.push({ x: c.c.x + rnd(-c.R, c.R), y: c.c.y + rnd(-c.R, c.R), vx: rnd(-60, 60), vy: rnd(-90, 20), life: rnd(0.5, 1.1), r: rnd(1, 2) }); }
    collab() { this.touch(); if (this.incoming) return; const side = Math.random() < 0.5 ? -1 : 1; this.incoming = { x: side < 0 ? -30 : this.W + 30, y: rnd(this.H * 0.2, this.H * 0.6), p: 0 }; }
    regenerate() { this.touch(); this.dissolving = 1; }
    // ---- stato ----
    stageIndex() { return this.creatures.length > 1 ? 4 : this.main.stage; }
    stateLabel() {
      if (this.dissolving) return "Si rigenera"; if (this.dormant) return "Dormiente";
      const c = this.main; if (this.t - c.lastFood > HUNGRY_AFTER && c.growth > 0) return "Affamato";
      if (this.food.length) return "In caccia"; if (this.incoming) return "Simbionte in arrivo";
      const e = this.env(); if (e.net > 60 && c.c.y > this.floor - c.R - 6) return "A riposo sul fondo"; if (e.net < -60) return "Galleggia";
      return this.media ? "Energico" : "Vitale";
    }
    hint() {
      if (this.dissolving) return "Si dissolve e ricomincia da una cellula";
      if (this.dormant) return "Dormiente: nessuno interagisce. Dagli dati o sposta la luce";
      const c = this.main, st = this.stageIndex();
      if (st === 0 && !this.drops) return "Una cellula. Dagli «Dati»: cadono, e lei nuota per mangiarli";
      if (this.t - c.lastFood > HUNGRY_AFTER && c.growth > 0) return "Affamato: senza dati si riduce. Nutrilo";
      if (this.g === 1 && this.rho === 1 && this.reorients === 0) return "Prova le leggi: gravità, densità, temperatura. E trascina la luce";
      if (!this.media && st >= 1) return "Paid media: diventa bioluminescente e più leggero";
      if (!this.collabs && st >= 2) return "Collab: un simbionte arriva e si aggancia";
      if (st === 3) return `Colonia: a ${25 - c.growth > 0 ? 25 - c.growth : 0} dati dalla mitosi`;
      if (st === 4) return "Mitosi: ora sono due. Il mezzo li muove insieme";
      return "Continua a nutrirlo: cresce, evolve, si divide";
    }
    vitality() { const c = this.main; return clamp(Math.round((12 + c.growth * 5 + this.media * 8 + this.collabs * 7 + (this.creatures.length - 1) * 12) * (this.dormant ? 0.7 : 1)), 0, 100); }
    // ---- simulazione ----
    update(dt) {
      this.t += dt;
      this.sunT = lerp(this.sunT, this.sun, 1 - Math.pow(0.002, dt));
      if (Math.abs(this.sun - this.lastMark) > 0.2) { this.lastMark = this.sun; this.reorients++; this.touch(); }
      const env = this.env();
      // rigenerazione: tutto si dissolve in scintille, poi una cellula nuova
      if (this.dissolving) { this.dissolving += dt; for (const c of this.creatures) for (const p of c.all()) if (Math.random() < dt * 6) this.sparks.push({ x: p.x, y: p.y, vx: rnd(-40, 40), vy: rnd(-60, 60), life: 0.7, r: 1.5 }); if (this.dissolving > 0.9) { const keep = { sun: this.sun, g: this.g, rho: this.rho, temp: this.temp }; this.reset(); Object.assign(this, keep); this.sunT = keep.sun; this.lastMark = keep.sun; } this.effects(dt); return; }
      // fame e crescita
      for (const c of this.creatures) { if (this.t - c.lastFood > HUNGRY_AFTER && c.growth > 0 && Math.random() < dt / 9) c.starve(); }
      // mitosi: a 12 dati la creatura principale si divide
      const m = this.main;
      if (m.growth >= 25 && this.creatures.length < MAX_CREATURES) { m.growth = 12; m.rebuild(); const child = new Creature(this, m.c.x + m.R * 1.6, m.c.y, this.R0Child(), this.creatures.length); child.lastFood = this.t; this.creatures.push(child); this.splits++; this.rings.push({ x: m.c.x, y: m.c.y, r: m.R, life: 1, col: "255,255,255" }); }
      // simbionte in arrivo
      if (this.incoming) { const i = this.incoming; const tgt = m.c; i.p += dt * 0.9; i.x = lerp(i.x, tgt.x, dt * 1.6); i.y = lerp(i.y, tgt.y, dt * 1.6) + Math.sin(this.t * 6) * 0.6; if (Math.hypot(i.x - tgt.x, i.y - tgt.y) < m.R * 1.2 || i.p > 1.2) { m.addSymbiont(); this.collabs++; this.incoming = null; this.rings.push({ x: tgt.x, y: tgt.y, r: m.R * 0.6, life: 1, col: "255,255,255" }); } }
      // cibo: stessa fisica del mezzo; mangiato quando tocca un corpo
      for (const f of this.food) { f.life -= dt; const vx = (f.x - f.px) * env.damp, vy = (f.y - f.py) * env.damp; f.px = f.x; f.py = f.y; f.x += vx + (this.flow ? this.flowAt(f.x, f.y).x : 0) * dt; f.y += vy + (env.g * 380 * (1 - this.rho / 1.1)) * dt * dt; if (f.y > this.floor) { f.y = this.floor; f.py = f.y + vy * 0.3; } if (f.y < 6) { f.y = 6; f.py = f.y - vy * 0.3; } if (f.x < 4 || f.x > this.W - 4) { f.x = clamp(f.x, 4, this.W - 4); f.px = f.x + vx; } }
      for (const c of this.creatures) for (const f of this.food) { if (f.life > 0 && Math.hypot(f.x - c.c.x, f.y - c.c.y) < c.R * 0.95) { f.life = 0; c.feed(); this.eaten++; this.rings.push({ x: f.x, y: f.y, r: 3, life: 0.8, col: "150,210,255" }); } }
      this.food = this.food.filter(f => f.life > 0);
      // creature: forze
      for (const c of this.creatures) c.step(dt, env);
      // corrente del visitatore
      if (this.flow) for (const c of this.creatures) for (const p of c.all()) { const fl = this.flowAt(p.x, p.y); p.fx += fl.x * 6; p.fy += fl.y * 6; }
      // integrazione di Verlet + vincoli + confini (sotto-passi)
      const sub = 3, h = dt / sub;
      for (let s = 0; s < sub; s++) {
        for (const c of this.creatures) {
          for (const p of c.all()) { const vx = (p.x - p.px) * env.damp, vy = (p.y - p.py) * env.damp; p.px = p.x; p.py = p.y; p.x += vx + p.fx * h * h; p.y += vy + p.fy * h * h; }
          c.constrain(3);
          for (const p of c.all()) { if (p.y > this.floor) { p.y = this.floor; p.px = p.x + (p.x - p.px) * 0.4; } if (p.y < 8) { p.y = 8; p.py = p.y; } if (p.x < 6) { p.x = 6; p.px = p.x - (p.px - p.x) * 0.5; } if (p.x > this.W - 6) { p.x = this.W - 6; p.px = p.x - (p.px - p.x) * 0.5; } }
        }
      }
      for (const c of this.creatures) for (const p of c.all()) { p.fx = 0; p.fy = 0; }
      // le creature si respingono un po' tra loro
      for (let i = 0; i < this.creatures.length; i++) for (let j = i + 1; j < this.creatures.length; j++) { const a = this.creatures[i].c, b = this.creatures[j].c; const d = Math.hypot(a.x - b.x, a.y - b.y), min = this.creatures[i].R + this.creatures[j].R; if (d < min && d > 0) { const k = (min - d) / d * 0.3; a.x -= (b.x - a.x) * k; a.y -= (b.y - a.y) * k; b.x += (b.x - a.x) * k; b.y += (b.y - a.y) * k; } }
      if (this.flow) { this.flow.life -= dt; if (this.flow.life <= 0) this.flow = null; }
      this.effects(dt);
    }
    R0Child() { return Math.min(this.W, this.H) * 0.06; }
    flowAt(x, y) { const f = this.flow; const d = Math.hypot(x - f.x, y - f.y); const k = Math.max(0, 1 - d / 170) * f.life; return { x: f.vx * k, y: f.vy * k }; }
    effects(dt) {
      for (const r of this.rings) { r.life -= dt * 0.9; r.r += dt * 120; } this.rings = this.rings.filter(r => r.life > 0);
      for (const s of this.sparks) { s.life -= dt; s.vy += 80 * dt; s.x += s.vx * dt; s.y += s.vy * dt; } this.sparks = this.sparks.filter(s => s.life > 0);
      const drift = (this.env().net) * 0.01;
      for (const s of this.snow) { s.y += (drift * s.s + Math.sin(this.t * 0.5 + s.x) * 0.15) * dt * 8 + (this.flow ? this.flowAt(s.x, s.y).y * dt * 0.4 : 0); s.x += (this.flow ? this.flowAt(s.x, s.y).x * dt * 0.4 : 0) + Math.sin(this.t * 0.3 + s.y * 0.02) * 0.1; if (s.y > this.H) s.y = 0; if (s.y < 0) s.y = this.H; if (s.x < 0) s.x = this.W; if (s.x > this.W) s.x = 0; }
    }
    resize(W, H) { const kx = W / this.W, ky = H / this.H; this.W = W; this.H = H; for (const c of this.creatures) { for (const p of c.all()) { p.x *= kx; p.px *= kx; p.y *= ky; p.py *= ky; } c.R0 = Math.min(W, H) * (c.gen ? 0.06 : 0.085); } }
  }

  /* ---------- disegno ---------- */
  const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
  function membrane(ctx, ring) { // curva chiusa morbida per i punti medi
    const n = ring.length; ctx.beginPath();
    let m0 = { x: (ring[0].x + ring[1].x) / 2, y: (ring[0].y + ring[1].y) / 2 }; ctx.moveTo(m0.x, m0.y);
    for (let i = 1; i <= n; i++) { const p = ring[i % n], q = ring[(i + 1) % n]; const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2; ctx.quadraticCurveTo(p.x, p.y, mx, my); }
    ctx.closePath();
  }
  function tentacle(ctx, from, ch, w0, col, glow) {
    const pts = [from, ...ch];
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < pts.length - 1; i++) { const k = i / (pts.length - 1); ctx.lineWidth = pass ? Math.max(0.6, w0 * (1 - k * 0.85)) : w0 * (1 - k * 0.6) * 2.4 + 3; ctx.strokeStyle = pass ? col : glow; ctx.globalAlpha = pass ? 0.95 : 0.16; ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); const m = pts[i + 1]; ctx.lineTo(m.x, m.y); ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
  }
  function draw(ctx, lab, W, H) {
    ctx.clearRect(0, 0, W, H);
    const sp = lab.sunPos(); const warm = lab.sunT; const hueSun = lerp(200, 28, warm); const hue = lerp(212, 318, warm) + lab.temp * 14; const env = lab.env();
    // mezzo: più denso = più profondo e blu; luce del sole
    let g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, hsl(lerp(270, 225, clamp(lab.rho / 3, 0, 1)), 40, lerp(6, 4, clamp(lab.rho / 3, 0, 1)))); g.addColorStop(1, hsl(280, 45, lerp(9, 5, clamp(lab.rho / 3, 0, 1)))); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    g = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, W * 0.6); g.addColorStop(0, hsl(hueSun, 90, 72, 0.22 + lab.temp * 0.1)); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.setLineDash([2, 7]); ctx.lineWidth = 1; ctx.strokeStyle = "rgba(255,255,255,.12)"; ctx.beginPath(); for (let i = 0; i <= 48; i++) { const p = lab.sunPos(i / 48); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); } ctx.stroke(); ctx.setLineDash([]);
    // neve marina (densità del mezzo)
    ctx.fillStyle = `rgba(255,255,255,${0.12 + clamp(lab.rho / 3, 0, 1) * 0.25})`; for (const s of lab.snow) { ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill(); }
    // fondo
    g = ctx.createLinearGradient(0, lab.floor - 40, 0, H); g.addColorStop(0, hsl(hue, 70, 40, 0)); g.addColorStop(1, hsl(hue, 70, 40, 0.25)); ctx.fillStyle = g; ctx.fillRect(0, lab.floor - 40, W, H); ctx.strokeStyle = "rgba(255,255,255,.1)"; ctx.beginPath(); ctx.moveTo(0, lab.floor + .5); ctx.lineTo(W, lab.floor + .5); ctx.stroke();
    // corrente
    if (lab.flow) { const f = lab.flow; ctx.strokeStyle = `rgba(255,255,255,${0.25 * f.life})`; ctx.lineWidth = 1; for (let i = 0; i < 7; i++) { const a = i / 7 * TAU, r = 30 + i * 18; const x = f.x + Math.cos(a) * r, y = f.y + Math.sin(a) * r; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + f.vx * 0.06, y + f.vy * 0.06); ctx.stroke(); } }
    // cibo (dati)
    for (const f of lab.food) { ctx.fillStyle = "rgba(150,210,255,.95)"; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.fill(); ctx.strokeStyle = "rgba(150,210,255,.35)"; ctx.beginPath(); ctx.moveTo(f.px, f.py); ctx.lineTo(f.x, f.y); ctx.stroke(); }
    // creature
    const S = lab.dormant ? 30 : 88;
    for (const c of lab.creatures) {
      const R = c.R, alive = lab.dormant ? 0.55 : 1;
      const col = hsl(hue, S, 62), glow = hsl(hue, 90, 60);
      // tentacoli (dietro)
      for (const t of c.tent) tentacle(ctx, c.ring[t.at], t.ch, Math.max(1.5, R * 0.09), hsl(hue + 8, S, 70), glow);
      // simbionti (bianchi)
      for (const s of c.symb) { s.fil.forEach((f, j) => tentacle(ctx, s.ring[(j * 3 + 2) % s.ring.length], f, 1.6, "rgba(255,255,255,.85)", "#fff")); membrane(ctx, s.ring); g = ctx.createRadialGradient(s.c.x, s.c.y, 0, s.c.x, s.c.y, s.r * 1.1); g.addColorStop(0, "rgba(255,255,255,.75)"); g.addColorStop(1, "rgba(255,255,255,.12)"); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 1.2; ctx.stroke(); ctx.fillStyle = "#BF00FF"; ctx.beginPath(); ctx.arc(s.c.x, s.c.y, s.r * 0.25, 0, TAU); ctx.fill(); }
      // alone
      g = ctx.createRadialGradient(c.c.x, c.c.y, R * 0.6, c.c.x, c.c.y, R * (1.9 + lab.media * 0.35)); g.addColorStop(0, hsl(hue, 90, 60, 0.22 + lab.media * 0.1)); g.addColorStop(1, hsl(hue, 90, 60, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.c.x, c.c.y, R * (1.9 + lab.media * 0.35), 0, TAU); ctx.fill();
      // membrana
      membrane(ctx, c.ring);
      g = ctx.createRadialGradient(c.c.x - R * 0.25, c.c.y - R * 0.3, 0, c.c.x, c.c.y, R * 1.05); g.addColorStop(0, hsl(hue + 10, S, 78, 0.5 * alive)); g.addColorStop(0.6, hsl(hue, S, 55, 0.28 * alive)); g.addColorStop(1, hsl(hue - 10, S, 40, 0.42 * alive));
      ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = Math.max(1.2, R * 0.05); ctx.strokeStyle = hsl(hue + 12, S, 76, 0.95); ctx.stroke();
      ctx.lineWidth = Math.max(4, R * 0.16); ctx.strokeStyle = hsl(hue, 90, 65, 0.16); ctx.stroke();
      // organelli e nucleo
      for (const o of c.organelles) { o.a += 0.004 * o.s * (1 + lab.temp * 3); const x = c.c.x + Math.cos(o.a) * R * o.r, y = c.c.y + Math.sin(o.a * 1.3) * R * o.r * 0.8; ctx.fillStyle = hsl(hue + 20, S, 80, 0.55 * alive); ctx.beginPath(); ctx.arc(x, y, R * 0.07, 0, TAU); ctx.fill(); }
      const nr = R * (0.26 + 0.05 * c.pulse + 0.05 * c.gulp); g = ctx.createRadialGradient(c.c.x, c.c.y, 0, c.c.x, c.c.y, nr); g.addColorStop(0, "#fff"); g.addColorStop(0.4, hsl(hue + 15, 95, 80, 0.95)); g.addColorStop(1, hsl(hue, 90, 55, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.c.x, c.c.y, nr, 0, TAU); ctx.fill();
      // bioluminescenza sui nodi (media)
      if (lab.media && !lab.dormant) for (let i = 0; i < c.N; i++) { const p = c.ring[i]; const k = 0.5 + 0.5 * Math.sin(lab.t * 4 + i * 0.7 + c.seed); ctx.fillStyle = `rgba(255,255,255,${(0.25 + 0.6 * k) * Math.min(1, lab.media / 2)})`; ctx.beginPath(); ctx.arc(p.x, p.y, 1.5 + k * 1.5 * lab.media, 0, TAU); ctx.fill(); }
    }
    // simbionte in arrivo
    if (lab.incoming) { const i = lab.incoming; g = ctx.createRadialGradient(i.x, i.y, 0, i.x, i.y, 18); g.addColorStop(0, "#fff"); g.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(i.x, i.y, 18, 0, TAU); ctx.fill(); }
    // onde e scintille
    for (const r of lab.rings) { ctx.strokeStyle = `rgba(${r.col},${0.6 * r.life})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke(); }
    for (const s of lab.sparks) { ctx.globalAlpha = clamp(s.life, 0, 1); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill(); } ctx.globalAlpha = 1;
    // la luce (mercato)
    g = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, 40); g.addColorStop(0, "#fff"); g.addColorStop(0.3, hsl(hueSun, 95, 78, 0.9)); g.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sp.x, sp.y, 40, 0, TAU); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(sp.x, sp.y, 8, 0, TAU); ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(sp.x, sp.y, 14 + Math.sin(lab.t * 2) * 1.5, 0, TAU); ctx.stroke();
    ctx.font = "500 10px 'Geist Mono', ui-monospace, monospace"; ctx.fillStyle = "rgba(255,255,255,.72)"; ctx.textAlign = "center"; ctx.fillText("LUCE · MERCATO", sp.x, sp.y + 34);
  }

  /* ---------- montaggio ---------- */
  function mount(root) {
    if (!root || root.dataset.mounted) return; root.dataset.mounted = "1";
    root.innerHTML = `<div class="org-stage"><canvas aria-label="Organismo sintetico vivente: una creatura a corpo morbido che vive nelle leggi fisiche che regoli tu"></canvas><div class="org-hud" aria-live="polite"></div><div class="org-hint"></div></div>
      <div class="org-env">
        <label><span>Gravità <em data-v="g">1.0 g</em></span><input type="range" data-env="g" min="0" max="2" step="0.05" value="1"></label>
        <label><span>Densità del mezzo <em data-v="rho">1.0</em></span><input type="range" data-env="rho" min="0.2" max="3" step="0.05" value="1"></label>
        <label><span>Temperatura <em data-v="temp">15°</em></span><input type="range" data-env="temp" min="0" max="1" step="0.01" value="0.15"></label>
      </div>
      <div class="org-controls">
        <button type="button" data-act="water" class="pulse">${ICON.water}<b>Dati</b><small>cibo: cade e lo insegue</small></button>
        <button type="button" data-act="media">${ICON.media}<b>Paid media</b><small>energia <em>0</em>/3</small></button>
        <button type="button" data-act="collab">${ICON.collab}<b>Collab</b><small>un simbionte si aggancia</small></button>
        <button type="button" data-act="reset">${ICON.reset}<b>Rigenera</b><small>da una cellula</small></button>
      </div>`;
    const stage = root.querySelector(".org-stage"), cv = root.querySelector("canvas"), ctx = cv.getContext("2d"), hud = root.querySelector(".org-hud"), hint = root.querySelector(".org-hint");
    let W = 0, H = 0, dpr = 1, lab = null, visible = false, raf = 0, last = 0, hudAt = 0, drag = null;
    const size = () => {
      const r = stage.getBoundingClientRect(); if (!r.width || !r.height) return false;
      dpr = Math.min(2, window.devicePixelRatio || 1); W = Math.round(r.width); H = Math.round(r.height);
      cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!lab) { lab = new Lab(W, H); root._lab = lab; } else lab.resize(W, H);
      return true;
    };
    const updHud = () => {
      const e = lab.env();
      hud.innerHTML = `<span class="vit">Vitalità <b>${lab.vitality()}%</b> · <b>${STAGES[lab.stageIndex()]}</b> · ${lab.stateLabel()}</span><span>Dati <b>${lab.eaten}</b></span><span>Energia <b>${lab.media}</b></span><span>Simbionti <b>${lab.main.symb.length}</b></span><span>Organismi <b>${lab.creatures.length}</b></span><span>Spinta <b>${e.net < -30 ? "↑" : e.net > 30 ? "↓" : "="}</b></span>`;
      hint.textContent = lab.hint();
      root.querySelector('[data-act="media"] em').textContent = lab.media;
      root.querySelector('[data-act="water"]').classList.toggle("pulse", !lab.drops || lab.dormant);
      root.classList.toggle("dormant", lab.dormant);
    };
    const frame = (now) => {
      raf = 0; if (!visible || !root.isConnected) return;
      const dt = Math.min(1 / 30, (now - (last || now)) / 1000); last = now;
      lab.update(dt * (reduced ? 0.6 : 1)); draw(ctx, lab, W, H);
      if (now - hudAt > 250) { hudAt = now; updHud(); }
      raf = requestAnimationFrame(frame);
    };
    const start = () => { if (!raf && visible && size()) { last = 0; raf = requestAnimationFrame(frame); } };
    const io = new IntersectionObserver(es => { visible = es.some(e => e.isIntersecting); if (visible) start(); }, { threshold: 0.05 });
    io.observe(stage);
    new ResizeObserver(() => { if (size()) draw(ctx, lab, W, H); }).observe(stage);
    root.querySelector(".org-controls").addEventListener("click", e => {
      const b = e.target.closest("[data-act]"); if (!b || !lab) return; const act = b.dataset.act;
      if (act === "water") lab.feed(); else if (act === "media") lab.energize(); else if (act === "collab") lab.collab(); else if (act === "reset") lab.regenerate();
      updHud(); start();
    });
    root.querySelector(".org-env").addEventListener("input", e => {
      const i = e.target.closest("[data-env]"); if (!i || !lab) return; const v = parseFloat(i.value); lab[i.dataset.env] = v; lab.touch();
      const out = root.querySelector(`[data-v="${i.dataset.env}"]`); if (out) out.textContent = i.dataset.env === "g" ? v.toFixed(1) + " g" : i.dataset.env === "rho" ? v.toFixed(1) : Math.round(v * 100) + "°";
      updHud(); start();
    });
    const pt = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    stage.addEventListener("pointerdown", e => {
      if (!lab) return; const p = pt(e); const sp = lab.sunPos();
      if (Math.hypot(p.x - sp.x, p.y - sp.y) < 44) drag = { kind: "sun" };
      else drag = { kind: "flow", x: p.x, y: p.y, t: performance.now(), moved: false };
      stage.setPointerCapture(e.pointerId); stage.classList.add("dragging"); e.preventDefault();
    });
    stage.addEventListener("pointermove", e => {
      if (!drag || !lab) return; const p = pt(e);
      if (drag.kind === "sun") { lab.sun = clamp((p.x - W * 0.02) / (W * 0.96), 0, 1); return; }
      const now = performance.now(), dt = Math.max(8, now - drag.t) / 1000; const vx = (p.x - drag.x) / dt, vy = (p.y - drag.y) / dt;
      if (Math.hypot(p.x - drag.x, p.y - drag.y) > 3) { drag.moved = true; lab.flow = { x: p.x, y: p.y, vx: clamp(vx, -900, 900), vy: clamp(vy, -900, 900), life: 1 }; lab.touch(); }
      drag.x = p.x; drag.y = p.y; drag.t = now;
    });
    const end = (e) => { if (drag && drag.kind === "flow" && !drag.moved && lab) { const p = pt(e); if (p.y < lab.floor) lab.feed(p.x); updHud(); } drag = null; stage.classList.remove("dragging"); };
    stage.addEventListener("pointerup", end); stage.addEventListener("pointercancel", () => { drag = null; stage.classList.remove("dragging"); });
    if (size()) { draw(ctx, lab, W, H); updHud(); }
  }
  window.OrganismLab = { mount, mountAll: (sel) => document.querySelectorAll(sel || "[data-organism]").forEach(mount) };
})();
