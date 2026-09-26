/* =========================================================
   UN ASSET, TUTTI I FORMATI — particelle che si riconfigurano (canvas)
   Tecnica classica e collaudata (particle slider / particles-to-text): si
   disegna una composizione su un canvas nascosto, si campionano i pixel pieni
   e ogni particella riceve un punto da raggiungere con una molla. Cambiando
   composizione le stesse particelle si riorganizzano: la parola del visitatore,
   poi la stessa parola dentro un 16:9, un 9:16 (stories), un 1:1, un 32:9
   (DOOH), poi il logo. Il cursore le scompiglia, un tocco le fa esplodere, e
   si ricompongono da sole: l'organismo sopravvive e si adatta.
   Uso: window.OrganismLab.mount(elemento) — il loop gira solo quando è visibile.
   ========================================================= */
(function () {
  "use strict";
  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isMobile = () => matchMedia("(max-width: 820px)").matches;
  const FONT = '"Helvetica Now Display","Helvetica Neue",Helvetica,Arial,sans-serif';
  const COMPS = [
    { id: "word", name: "La parola", label: "il tuo asset" },
    { id: "16:9", name: "16:9", label: "TV · web · presentazioni", ratio: 16 / 9 },
    { id: "9:16", name: "9:16", label: "stories · reels · TikTok", ratio: 9 / 16 },
    { id: "1:1", name: "1:1", label: "feed social", ratio: 1 },
    { id: "32:9", name: "32:9", label: "DOOH · LED wall", ratio: 32 / 9 },
    { id: "logo", name: "Logo", label: "Frameworks" }
  ];
  const IDLE_NEXT = 7;

  function sprite(color, size) { // punto luminoso pre-renderizzato: veloce da disegnare migliaia di volte
    const c = document.createElement("canvas"); c.width = c.height = size; const x = c.getContext("2d");
    const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2); g.addColorStop(0, "#fff"); g.addColorStop(0.28, color); g.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = g; x.fillRect(0, 0, size, size); return c;
  }

  class Morph {
    constructor(W, H) {
      this.W = W; this.H = H; this.mobile = isMobile();
      this.N = this.mobile ? 1300 : 2600; this.gap = this.mobile ? 5 : 4;
      this.text = "FRAMEWORKS"; this.comp = 0; this.t = 0; this.lastAction = 0; this.scatter = 0; this.pointer = null; this.morphs = 0; this.explosions = 0;
      this.ps = Array.from({ length: this.N }, () => ({ x: rnd(0, W), y: rnd(0, H), vx: 0, vy: 0, tx: W / 2, ty: H / 2, w: Math.random() < 0.14, s: rnd(0.7, 1.3), ph: rnd(0, TAU) }));
      this.off = document.createElement("canvas"); this.octx = this.off.getContext("2d", { willReadFrequently: true });
      this.logoImg = null; this.loadLogo();
      this.compose();
    }
    loadLogo() {
      const sym = document.getElementById("fw-logo"); if (!sym) return;
      const inner = sym.innerHTML.replace(/<g[^>]*>|<\/g>/g, "");
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 421.23 59"><g fill="#fff">${inner}</g></svg>`;
      const img = new Image(); img.onload = () => { this.logoImg = img; if (COMPS[this.comp].id === "logo") this.compose(); };
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    }
    touch() { this.lastAction = this.t; }
    setText(t) { t = String(t || "").trim().toUpperCase().slice(0, 16); if (!t) return; this.text = t; this.touch(); this.compose(true); }
    setComp(i) { this.comp = (i + COMPS.length) % COMPS.length; this.touch(); this.morphs++; this.compose(true); }
    next() { this.setComp(this.comp + 1); }
    // ---- composizione → punti bersaglio ----
    fitText(ctx, text, maxW, maxH, weight = 700) {
      let size = maxH; ctx.font = `${weight} ${size}px ${FONT}`; const w = ctx.measureText(text).width;
      if (w > maxW) size = Math.floor(size * maxW / w); return Math.max(10, size);
    }
    drawText(ctx, text, cx, cy, maxW, maxH) {
      const words = text.split(/\s+/); let lines = [text];
      if (words.length > 1 && maxH > maxW * 0.9) lines = words; // formato verticale: una parola per riga
      const lineH = maxH / lines.length;
      let size = Infinity; lines.forEach(l => { size = Math.min(size, this.fitText(ctx, l, maxW, lineH * 0.82)); });
      ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#fff";
      const total = size * 1.05 * lines.length; lines.forEach((l, i) => ctx.fillText(l, cx, cy - total / 2 + size * 1.05 * (i + 0.5)));
    }
    roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
    compose(animate) {
      const W = this.W, H = this.H, o = this.off, ctx = this.octx; o.width = W; o.height = H; ctx.clearRect(0, 0, W, H);
      const c = COMPS[this.comp]; const cx = W / 2, cy = H * 0.5;
      if (c.id === "word") this.drawText(ctx, this.text, cx, cy, W * 0.82, H * 0.34);
      else if (c.id === "logo") { if (this.logoImg) { const w = W * 0.78, h = w * 59 / 421.23; ctx.drawImage(this.logoImg, cx - w / 2, cy - h / 2, w, h); } else this.drawText(ctx, "FRAMEWORKS", cx, cy, W * 0.8, H * 0.2); }
      else {
        // cornice del formato + la stessa parola dentro
        let fw = W * 0.8, fh = fw / c.ratio; if (fh > H * 0.74) { fh = H * 0.74; fw = fh * c.ratio; }
        const x = cx - fw / 2, y = cy - fh / 2, lw = Math.max(3, Math.min(W, H) * 0.012);
        ctx.lineWidth = lw; ctx.strokeStyle = "#fff"; this.roundRect(ctx, x, y, fw, fh, Math.min(18, fw * 0.05)); ctx.stroke();
        if (c.id === "9:16") { ctx.fillStyle = "#fff"; this.roundRect(ctx, cx - fw * 0.16, y + lw * 1.6, fw * 0.32, lw * 1.4, lw * 0.7); ctx.fill(); this.roundRect(ctx, cx - fw * 0.2, y + fh - lw * 3, fw * 0.4, lw * 1.2, lw * 0.6); ctx.fill(); }
        if (c.id === "32:9") { ctx.fillStyle = "#fff"; ctx.fillRect(cx - fw * 0.28, y + fh, lw * 1.2, H * 0.08); ctx.fillRect(cx + fw * 0.28 - lw * 1.2, y + fh, lw * 1.2, H * 0.08); }
        this.drawText(ctx, this.text, cx, cy, fw * 0.78, fh * 0.6);
      }
      // campionamento dei pixel pieni
      const img = ctx.getImageData(0, 0, W, H).data; const pts = []; const g = this.gap;
      for (let yy = 0; yy < H; yy += g) for (let xx = 0; xx < W; xx += g) { if (img[(yy * W + xx) * 4 + 3] > 110) pts.push({ x: xx + rnd(-1, 1), y: yy + rnd(-1, 1) }); }
      if (!pts.length) return;
      // assegnazione ordinata (per x) così il morphing scorre invece di incrociarsi a caso
      for (let i = pts.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pts[i], pts[j]] = [pts[j], pts[i]]; }
      const take = pts.length >= this.N ? pts.slice(0, this.N) : Array.from({ length: this.N }, (_, i) => { const p = pts[i % pts.length]; return { x: p.x + rnd(-1.5, 1.5), y: p.y + rnd(-1.5, 1.5) }; });
      take.sort((a, b) => a.x - b.x); const order = this.ps.map((p, i) => i).sort((a, b) => this.ps[a].x - this.ps[b].x);
      order.forEach((pi, k) => { this.ps[pi].tx = take[k].x; this.ps[pi].ty = take[k].y; });
      if (animate) { this.scatter = Math.max(this.scatter, 0.35); }
    }
    explode(x, y) { this.touch(); this.explosions++; this.scatter = 1; for (const p of this.ps) { const a = Math.atan2(p.y - y, p.x - x) + rnd(-0.3, 0.3); const d = Math.hypot(p.x - x, p.y - y); const k = (1 - clamp(d / (this.W * 0.7), 0, 1)) * rnd(8, 22); p.vx += Math.cos(a) * k; p.vy += Math.sin(a) * k; } }
    update(dt) {
      this.t += dt; const f = clamp(dt * 60, 0.5, 2); // normalizzato a 60 fps
      if (this.t - this.lastAction > IDLE_NEXT && !reduced) { this.next(); this.lastAction = this.t; }
      this.scatter = Math.max(0, this.scatter - dt * 0.9);
      const k = (0.045 - 0.04 * this.scatter) * f, fr = Math.pow(0.86, f), pr = this.pointer, R = this.mobile ? 70 : 95;
      for (const p of this.ps) {
        p.vx += (p.tx - p.x) * k; p.vy += (p.ty - p.y) * k;
        if (!reduced) { p.vx += Math.sin(this.t * 1.7 + p.ph) * 0.05 * f; p.vy += Math.cos(this.t * 1.3 + p.ph) * 0.05 * f; }
        if (pr) { const dx = p.x - pr.x, dy = p.y - pr.y; const d = Math.hypot(dx, dy); if (d < R && d > 0.1) { const s = (1 - d / R) * 9 * f; p.vx += dx / d * s; p.vy += dy / d * s; } }
        p.vx *= fr; p.vy *= fr; p.x += p.vx * f; p.y += p.vy * f;
      }
    }
    settled() { let n = 0; for (const p of this.ps) if (Math.abs(p.x - p.tx) + Math.abs(p.y - p.ty) < 3) n++; return n / this.N; }
    resize(W, H) { const kx = W / this.W, ky = H / this.H; this.W = W; this.H = H; for (const p of this.ps) { p.x *= kx; p.y *= ky; } this.compose(); }
  }

  function draw(ctx, m, W, H, sp, spW) {
    // scia: si scurisce un po' ogni frame invece di cancellare
    ctx.globalCompositeOperation = "source-over"; ctx.fillStyle = "rgba(5,3,7,.34)"; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";
    const half = sp.width / 2, scale = m.mobile ? 0.8 : 1;
    for (const p of m.ps) { const s = (p.w ? spW : sp); const sz = sp.width * p.s * scale; ctx.drawImage(s, p.x - sz / 2, p.y - sz / 2, sz, sz); }
    ctx.globalCompositeOperation = "source-over";
    if (m.pointer) { ctx.strokeStyle = "rgba(255,255,255,.18)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(m.pointer.x, m.pointer.y, m.mobile ? 70 : 95, 0, TAU); ctx.stroke(); }
  }

  function mount(root) {
    if (!root || root.dataset.mounted) return; root.dataset.mounted = "1";
    root.innerHTML = `<div class="org-stage"><canvas aria-label="Le stesse particelle si riconfigurano: la tua parola in ogni formato"></canvas><div class="org-hud" aria-live="polite"></div><div class="org-hint"></div></div>
      <form class="org-word" autocomplete="off"><label for="org-word-${Date.now().toString(36)}" class="sr-only">La tua parola</label><input id="org-word-${Date.now().toString(36)}" type="text" maxlength="16" placeholder="Scrivi il tuo brand o un messaggio" enterkeyhint="go"><button type="submit">Forma</button></form>
      <div class="org-controls formats">${COMPS.map((c, i) => `<button type="button" data-comp="${i}" class="${i === 0 ? "on" : ""}"><b>${c.name}</b><small>${c.label}</small></button>`).join("")}</div>`;
    const stage = root.querySelector(".org-stage"), cv = root.querySelector("canvas"), ctx = cv.getContext("2d"), hud = root.querySelector(".org-hud"), hint = root.querySelector(".org-hint"), form = root.querySelector(".org-word");
    let W = 0, H = 0, dpr = 1, m = null, visible = false, raf = 0, last = 0, hudAt = 0, press = null;
    const sp = sprite("#BF00FF", 11), spW = sprite("#FFFFFF", 11);
    const size = () => {
      const r = stage.getBoundingClientRect(); if (!r.width || !r.height) return false;
      dpr = Math.min(2, window.devicePixelRatio || 1); W = Math.round(r.width); H = Math.round(r.height);
      cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!m) { m = new Morph(W, H); root._morph = m; } else m.resize(W, H);
      return true;
    };
    const updHud = () => {
      const c = COMPS[m.comp];
      hud.innerHTML = `<span class="vit"><b>${m.N.toLocaleString("it-IT")}</b> particelle · un solo asset · <b>${c.id === "word" ? "«" + m.text + "»" : c.name}</b></span><span>Riconfigurazioni <b>${m.morphs}</b></span><span>Esplosioni <b>${m.explosions}</b></span><span>Integrità <b>${Math.round(m.settled() * 100)}%</b></span>`;
      hint.textContent = m.explosions ? (m.mobile ? "Tocca: esplode · trascina: si scompiglia · si ricompone sempre" : "Clic: esplode · passa col mouse: si scompiglia · si ricompone sempre") : (m.mobile ? "Tocca lo schermo per farlo esplodere, poi cambia formato" : "Clicca per farlo esplodere, poi cambia formato");
      root.querySelectorAll("[data-comp]").forEach(b => b.classList.toggle("on", +b.dataset.comp === m.comp));
    };
    const frame = (now) => {
      raf = 0; if (!visible || !root.isConnected) return;
      const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
      m.update(dt); draw(ctx, m, W, H, sp, spW);
      if (now - hudAt > 300) { hudAt = now; updHud(); }
      raf = requestAnimationFrame(frame);
    };
    const start = () => { if (!raf && visible && size()) { last = 0; raf = requestAnimationFrame(frame); } };
    const io = new IntersectionObserver(es => { visible = es.some(e => e.isIntersecting); if (visible) start(); }, { threshold: 0.05 });
    io.observe(stage);
    new ResizeObserver(() => { if (size()) draw(ctx, m, W, H, sp, spW); }).observe(stage);
    root.querySelector(".org-controls").addEventListener("click", e => { const b = e.target.closest("[data-comp]"); if (!b || !m) return; m.setComp(+b.dataset.comp); updHud(); start(); });
    form.addEventListener("submit", e => { e.preventDefault(); const i = form.querySelector("input"); if (!m) return; m.setText(i.value); if (COMPS[m.comp].id === "logo") m.setComp(0); i.blur(); updHud(); start(); });
    const pt = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    stage.addEventListener("pointerdown", e => { if (!m) return; const p = pt(e); press = { x: p.x, y: p.y, moved: false }; m.pointer = p; m.touch(); stage.setPointerCapture(e.pointerId); e.preventDefault(); });
    stage.addEventListener("pointermove", e => { if (!m) return; const p = pt(e); if (press && Math.hypot(p.x - press.x, p.y - press.y) > 6) press.moved = true; if (press || e.pointerType === "mouse") { m.pointer = p; if (press) m.touch(); } });
    const up = (e) => { if (!m) return; if (press && !press.moved) { const p = pt(e); m.explode(p.x, p.y); updHud(); } press = null; if (e.pointerType !== "mouse") m.pointer = null; };
    stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", () => { press = null; m && (m.pointer = null); });
    stage.addEventListener("pointerleave", () => { press = null; if (m) m.pointer = null; });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (m) m.compose(); });
    if (size()) { draw(ctx, m, W, H, sp, spW); updHud(); }
  }
  window.OrganismLab = { mount, mountAll: (sel) => document.querySelectorAll(sel || "[data-organism]").forEach(mount) };
})();
