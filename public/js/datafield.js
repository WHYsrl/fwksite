/* Campo dati — la sezione "Il contesto" come particellare: le particelle compongono i numeri del contesto
   (utenti dei social, assistenti AI, token, modelli) e li lasciano andare: un dato alla volta, con fonte e data.
   Dati in window.__DATA__.figures (server/figures.js, modificabili da /admin/dati). Colori dalla palette del mood. */
const DataField = (() => {
  const PREVIEW = !!window.__PREVIEW__;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const cssVar = (el, n, d) => (getComputedStyle(el).getPropertyValue(n) || "").trim() || d;
  const fmtInt = (n) => Math.floor(n).toLocaleString("it-IT");
  const SANS = '"Helvetica Now Display","Helvetica Neue",Helvetica,Arial,sans-serif', MONO = '"Geist Mono",ui-monospace,Menlo,monospace';
  const HOLD = { number: 6500, bars: 8500, stream: 9000, words: 1150 }; // ms per scena (words: per parola)

  function mount(root) {
    if (root.dataset.mounted) return; root.dataset.mounted = "1";
    const figs = ((window.__DATA__ || {}).figures || []).filter(f => f && f.kind);
    if (!figs.length) return;
    root.innerHTML = `<canvas aria-hidden="true"></canvas><div class="df-dots" aria-hidden="true">${figs.map(() => "<i></i>").join("")}</div><div class="df-hint">tocca · prossimo dato</div><div class="df-cap"><div class="df-eyebrow"></div><div class="df-title"></div><div class="df-src"></div></div>`;
    root.setAttribute("role", "img"); root.setAttribute("aria-label", "Dati del contesto: " + figs.map(f => `${f.display} ${f.label}`).join("; "));
    const cv = root.querySelector("canvas"), ctx = cv.getContext("2d");
    const oc = document.createElement("canvas"), octx = oc.getContext("2d", { willReadFrequently: true });
    const capEye = root.querySelector(".df-eyebrow"), capTitle = root.querySelector(".df-title"), capSrc = root.querySelector(".df-src"), dots = root.querySelectorAll(".df-dots i");
    const mobile = matchMedia("(max-width: 820px)").matches;
    const N = mobile ? 1100 : 2300;
    const st = { W: 0, H: 0, dpr: 1, i: -1, fig: null, at: 0, word: 0, wordAt: 0, labels: [], streams: null, counter: 0, parts: [], visible: false, raf: 0, last: 0, col: null };

    // ---- palette dal mood: accento, inchiostro e un tono intermedio
    function colors() {
      const acc = cssVar(root, "--accent-rgb", "191,0,255").split(",").map(Number), ink = cssVar(root, "--ink-rgb", "255,255,255").split(",").map(Number);
      const mid = acc.map((v, k) => Math.round(v * 0.55 + ink[k] * 0.45));
      st.col = { acc, ink, mid, accS: cssVar(root, "--accent", "#BF00FF"), inkS: cssVar(root, "--ink", "#fff"), ink3: cssVar(root, "--ink-3", "#8B8197") };
    }
    const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

    // ---- particelle
    const rnd = (a, b) => a + Math.random() * (b - a);
    function seed() { st.parts = []; for (let k = 0; k < N; k++) st.parts.push({ x: rnd(0, st.W), y: rnd(0, st.H), tx: 0, ty: 0, vx: 0, vy: 0, g: k % 3, free: true, ph: rnd(0, Math.PI * 2), s: rnd(1.6, 2.8), lane: 0, sp: rnd(0.6, 1.4), off: rnd(0, 1) }); }
    function size() {
      const r = root.getBoundingClientRect(); if (!r.width || !r.height) return false;
      const dpr = Math.min(2, window.devicePixelRatio || 1); const W = Math.round(r.width), H = Math.round(r.height);
      if (W === st.W && H === st.H && dpr === st.dpr) return true;
      const first = !st.W; st.W = W; st.H = H; st.dpr = dpr; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); oc.width = W; oc.height = H;
      if (first) seed(); else layout(); return true;
    }

    // ---- da testo a punti: si scrive sul canvas nascosto e si campionano i pixel
    function textPoints(text, px, cx, cy, maxW, step, weight = 700, font = SANS) {
      octx.clearRect(0, 0, st.W, st.H); octx.fillStyle = "#fff"; octx.textAlign = "center"; octx.textBaseline = "middle";
      let f = px; octx.font = `${weight} ${f}px ${font}`; const w = octx.measureText(text).width; if (w > maxW) { f = Math.floor(px * maxW / w); octx.font = `${weight} ${f}px ${font}`; }
      octx.fillText(text, cx, cy);
      const d = octx.getImageData(0, 0, st.W, st.H).data, pts = [];
      for (let y = 0; y < st.H; y += step) { const yy = Math.round(y); for (let x = 0; x < st.W; x += step) { const xx = Math.round(x); if (d[(yy * st.W + xx) * 4 + 3] > 110) pts.push({ x: xx + rnd(-0.6, 0.6), y: yy + rnd(-0.6, 0.6) }); } } // indici interi: il passo può essere frazionario
      return pts;
    }
    function rectPoints(x0, y0, w, h, step) { const pts = []; for (let y = y0; y < y0 + h; y += step) for (let x = x0; x < x0 + w; x += step) pts.push({ x: x + rnd(-0.5, 0.5), y: y + rnd(-0.5, 0.5) }); return pts; }
    // assegna i punti alle particelle (le altre vagano libere e leggere)
    function assign(pts) {
      for (let i = pts.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pts[i], pts[j]] = [pts[j], pts[i]]; }
      if (pts.length > N) { const k = pts.length / N; pts = pts.filter((_, i) => Math.floor(i / k) !== Math.floor((i - 1) / k)); }
      st.parts.forEach((p, k) => { const q = pts[k]; if (q) { p.tx = q.x; p.ty = q.y; p.free = false; } else { p.free = true; } });
    }

    // ---- scene
    function layout() {
      const f = st.fig; if (!f || !st.W) return; st.labels = []; st.streams = null;
      const pad = mobile ? 16 : 24, capH = mobile ? 78 : 92; // spazio della didascalia in basso
      const step = mobile ? 2.6 : 2.7;
      if (f.kind === "number") assign(textPoints(f.display, Math.round(st.W * 0.24), st.W / 2, (st.H - capH) / 2 + 4, st.W - pad * 2, step));
      else if (f.kind === "words") assign(textPoints(f.words[st.word % f.words.length], Math.round(st.W * 0.27), st.W / 2, (st.H - capH) / 2 + 4, st.W - pad * 2, step, 700));
      else if (f.kind === "bars") {
        const bars = f.bars, max = Math.max(...bars.map(b => b.value)); const top = pad + 18, avail = st.H - capH - top - 6; const rowH = avail / bars.length; const bh = Math.max(6, Math.min(mobile ? 12 : 16, rowH * 0.5));
        const lw = mobile ? 84 : 118, vw = mobile ? 74 : 104; const x0 = pad + lw, zone = st.W - x0 - pad - vw; let pts = [];
        bars.forEach((b, k) => { const y = top + rowH * k + (rowH - bh) / 2; const w = Math.max(6, zone * b.value / max); pts = pts.concat(rectPoints(x0, y, w, bh, mobile ? 3 : 3.4)); st.labels.push({ text: b.name, x: x0 - 10, y: y + bh / 2, align: "right", font: `500 ${mobile ? 10.5 : 12}px ${SANS}`, col: "ink" }); st.labels.push({ text: b.display, x: x0 + w + 10, y: y + bh / 2, align: "left", font: `500 ${mobile ? 10 : 11}px ${MONO}`, col: "acc" }); });
        assign(pts);
      } else if (f.kind === "stream") {
        // tre correnti che attraversano il campo: le particelle scorrono, il contatore corre
        const cy = (st.H - capH) / 2; const amp = Math.min(st.H * 0.16, 70); st.streams = [0, 1, 2].map(k => ({ y: cy + (k - 1) * amp * 0.9, amp: amp * (0.6 + k * 0.25), k: (0.9 + k * 0.35) * Math.PI * 2 / st.W, ph: k * 1.7 }));
        st.parts.forEach(p => { p.free = false; p.lane = p.g; p.x = rnd(-20, st.W + 20); p.off = rnd(0, 1); });
      }
    }
    function caption() {
      const f = st.fig; capEye.textContent = f.cat || ""; capSrc.textContent = [f.source, f.date].filter(Boolean).join(" · ");
      if (f.kind === "stream") capTitle.innerHTML = `<b>${fmtInt(st.counter)}</b> ${esc(f.counter || f.label)}<small>${esc(f.display)} ${esc(f.label)}</small>`;
      else if (f.kind === "words") capTitle.innerHTML = `<b>${esc(f.display)}</b> ${esc(f.label)}`;
      else if (f.kind === "bars") capTitle.textContent = f.label;
      else capTitle.innerHTML = `${esc(f.label)}`;
      dots.forEach((d, k) => d.classList.toggle("on", k === st.i));
    }
    function show(i) {
      st.i = (i + figs.length) % figs.length; st.fig = figs[st.i]; st.at = performance.now(); st.word = 0; st.wordAt = st.at; st.counter = 0;
      if (st.fig.kind !== "stream") st.parts.forEach(p => { p.vx = 0; p.vy = 0; });
      layout(); caption(); if (!st.visible) draw();
    }
    function next() { show(st.i + 1); }

    // ---- disegno
    function draw(dt = 16) {
      const f = st.fig; if (!f || !st.W) return; const c = st.col; const t = performance.now();
      ctx.clearRect(0, 0, st.W, st.H);
      const ease = reduced ? 1 : 0.075;
      if (f.kind === "stream") {
        const speed = (mobile ? 55 : 85) * dt / 1000;
        st.parts.forEach(p => { const s = st.streams[p.lane]; p.x += speed * p.sp; if (p.x > st.W + 12) p.x = -12; p.y = s.y + Math.sin(p.x * s.k + s.ph + p.off * 1.2) * s.amp + (p.off - 0.5) * 18; });
      } else {
        st.parts.forEach(p => {
          if (p.free) { p.vx += rnd(-0.03, 0.03); p.vy += rnd(-0.03, 0.03); p.vx *= 0.985; p.vy *= 0.985; p.x += p.vx; p.y += p.vy; if (p.x < -6) p.x = st.W + 6; if (p.x > st.W + 6) p.x = -6; if (p.y < -6) p.y = st.H + 6; if (p.y > st.H + 6) p.y = -6; }
          else { p.x += (p.tx - p.x) * ease; p.y += (p.ty - p.y) * ease; if (!reduced) { p.x += Math.sin(t * 0.0012 + p.ph) * 0.12; p.y += Math.cos(t * 0.0011 + p.ph * 1.3) * 0.12; } }
        });
      }
      // gruppi di colore, disegnati a lotti
      const groups = [[c.acc, 0.95], [c.mid, 0.85], [c.ink, 0.7]];
      groups.forEach(([col, a], g) => {
        ctx.fillStyle = rgba(col, a); st.parts.forEach(p => { if (p.g !== g || p.free) return; ctx.fillRect(p.x, p.y, p.s, p.s); });
        ctx.fillStyle = rgba(col, 0.16); st.parts.forEach(p => { if (p.g !== g || !p.free) return; ctx.fillRect(p.x, p.y, p.s * 0.9, p.s * 0.9); });
      });
      // etichette delle barre
      if (st.labels.length) { ctx.textBaseline = "middle"; st.labels.forEach(l => { ctx.font = l.font; ctx.textAlign = l.align; ctx.fillStyle = l.col === "acc" ? c.accS : c.inkS; ctx.fillText(l.text, l.x, l.y); }); }
    }
    function loop() {
      cancelAnimationFrame(st.raf);
      const step = (now) => {
        if (!st.visible) return; const dt = Math.min(50, now - (st.last || now)); st.last = now; const f = st.fig;
        if (f) {
          if (f.kind === "stream") { st.counter += f.rate * dt / 1000; if (now - st.at > 0 && Math.floor(now / 90) !== Math.floor((now - dt) / 90)) caption(); }
          if (f.kind === "words" && now - st.wordAt > HOLD.words) { st.word++; st.wordAt = now; if (st.word >= Math.min(f.words.length, 7)) { next(); } else layout(); }
          else if (f.kind !== "words" && now - st.at > HOLD[f.kind]) next();
        }
        draw(dt); st.raf = requestAnimationFrame(step);
      };
      st.raf = requestAnimationFrame(step);
    }

    colors(); size(); show(0);
    root.addEventListener("click", next);
    root.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); next(); } }); root.tabIndex = 0;
    document.addEventListener("fw:theme", () => { colors(); draw(); });
    new ResizeObserver(() => { if (size()) draw(); }).observe(root);
    new IntersectionObserver(en => en.forEach(x => { st.visible = x.isIntersecting; if (st.visible) { st.last = 0; st.at = performance.now() - Math.min(performance.now() - st.at, 2000); loop(); } }), { threshold: 0.25 }).observe(root);
  }
  function mountAll() { document.querySelectorAll("[data-datafield]").forEach(mount); }
  return { mount, mountAll };
})();
window.DataField = DataField;
