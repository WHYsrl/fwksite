/* =========================================================
   DENOISE — nomina un oggetto, il modello lo genera; ogni clic è un passo di denoising.
   Il server genera l'immagine (OpenAI Images) e la mette in cache; qui si simula il campionamento:
   rumore → macchie di colore → forma → dettaglio, un passo per clic. Alla fine, l'asset si adatta ai formati.
   Espone window.Diffusion { mount(root), mountAll() }.
   ========================================================= */
window.Diffusion = (() => {
  "use strict";
  const N = 9; // passi di denoising (clic)
  const PREVIEW = !!window.__PREVIEW__;
  const SUGGEST = ["una sneaker di ghiaccio", "un casco spaziale di vetro", "un profumo in una bottiglia di lava", "una sedia intrecciata di luce", "un drone a forma di medusa", "una macchina fotografica di corallo"];
  const FORMATS = [{ id: "free", name: "Libero", label: "come nasce", ratio: 0 }, { id: "16:9", name: "16:9", label: "tv · web", ratio: 16 / 9 }, { id: "9:16", name: "9:16", label: "stories · totem", ratio: 9 / 16 }, { id: "1:1", name: "1:1", label: "feed", ratio: 1 }, { id: "32:9", name: "32:9", label: "led wall", ratio: 32 / 9 }];
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const cssVar = (el, n, d) => (getComputedStyle(el).getPropertyValue(n) || "").trim() || d;
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0); };
  const rnd = (seed) => { let x = seed || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 100000) / 100000; }; };
  const hexRgb = (h) => { h = h.replace("#", ""); if (h.length === 3) h = h.split("").map(c => c + c).join(""); const v = parseInt(h, 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };

  // ---------- rumore: tessere pre-calcolate, ridisegnate a ogni passo con un seed nuovo ----------
  const TILE = 192, NT = 5, tiles = [];
  function makeTiles(accent) {
    tiles.length = 0; const [ar, ag, ab] = hexRgb(accent);
    for (let t = 0; t < NT; t++) {
      const c = document.createElement("canvas"); c.width = c.height = TILE; const x = c.getContext("2d"); const im = x.createImageData(TILE, TILE); const d = im.data; const r = rnd(1000 + t * 77);
      for (let i = 0; i < d.length; i += 4) { const v = 20 + r() * 215; const k = r() < 0.03 ? 1 : 0; d[i] = v * 0.86 + k * ar * 0.25; d[i + 1] = v * 0.78 + k * ag * 0.25; d[i + 2] = v * 0.98 + k * ab * 0.25; d[i + 3] = 255; }
      x.putImageData(im, 0, 0); tiles.push(c);
    }
  }

  // "latente": macchie di colore seminate dal nome dell'oggetto, usate finché il modello non risponde
  function latent(subject, accent, step) {
    const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d"); const r = rnd(hash(subject || "seed") + step * 31);
    x.fillStyle = "#0a0610"; x.fillRect(0, 0, 64, 64);
    const [ar, ag, ab] = hexRgb(accent);
    for (let i = 0; i < 6; i++) { const cx = 12 + r() * 40, cy = 12 + r() * 40, rad = 10 + r() * 26; const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad); const k = r(); g.addColorStop(0, `rgba(${Math.round(ar * (0.5 + k * 0.5))},${Math.round(ag * 0.6 + 80 * k)},${Math.round(ab)},${0.55 + 0.3 * r()})`); g.addColorStop(1, "rgba(10,6,16,0)"); x.fillStyle = g; x.fillRect(0, 0, 64, 64); }
    return c;
  }
  // anteprima statica (senza server): un "oggetto" procedurale al posto dell'immagine generata
  function previewImage(subject, accent) {
    const c = document.createElement("canvas"); c.width = c.height = 512; const x = c.getContext("2d"); const r = rnd(hash(subject) + 7); const [ar, ag, ab] = hexRgb(accent);
    const bg = x.createRadialGradient(256, 300, 40, 256, 256, 360); bg.addColorStop(0, "#1a1022"); bg.addColorStop(1, "#050307"); x.fillStyle = bg; x.fillRect(0, 0, 512, 512);
    x.fillStyle = "rgba(255,255,255,.06)"; x.beginPath(); x.ellipse(256, 392, 170, 26, 0, 0, Math.PI * 2); x.fill();
    const n = 3 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) { const w = 90 + r() * 140, h = 90 + r() * 200, cx = 200 + r() * 112, cy = 200 + r() * 120, rot = (r() - 0.5) * 0.8; x.save(); x.translate(cx, cy); x.rotate(rot); const g = x.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); g.addColorStop(0, `rgba(${ar},${ag},${ab},.95)`); g.addColorStop(0.5, `rgba(${Math.min(255, ar + 60)},${Math.min(255, ag + 90)},${Math.min(255, ab + 40)},.9)`); g.addColorStop(1, "rgba(20,10,30,.95)"); x.fillStyle = g; x.beginPath(); if (x.roundRect) x.roundRect(-w / 2, -h / 2, w, h, 28 + r() * 40); else x.rect(-w / 2, -h / 2, w, h); x.fill(); x.fillStyle = "rgba(255,255,255,.35)"; x.beginPath(); x.ellipse(-w * 0.2, -h * 0.28, w * 0.18, h * 0.08, -0.6, 0, Math.PI * 2); x.fill(); x.restore(); }
    const img = new Image(); img.src = c.toDataURL("image/jpeg", 0.85); return img;
  }

  function mount(root) {
    if (!root || root.dataset.mounted) return; root.dataset.mounted = "1";
    root.innerHTML = `<div class="org-stage dn-stage" role="button" tabindex="0" aria-label="Un passo di denoising"><canvas></canvas><div class="org-hud dn-hud" aria-live="polite"></div><div class="org-hint dn-hint"></div></div>
      <form class="org-word dn-form" autocomplete="off"><input type="text" maxlength="60" placeholder="Nomina un oggetto, anche impossibile" enterkeyhint="go" aria-label="Nomina un oggetto"><button type="submit">Genera</button></form>
      <div class="dn-chips">${SUGGEST.map(s => `<button type="button" data-s="${esc(s)}">${esc(s)}</button>`).join("")}</div>
      <div class="org-controls formats dn-formats" hidden>${FORMATS.map((f, i) => `<button type="button" data-f="${f.id}" class="${i === 0 ? "on" : ""}"><b>${f.name}</b><small>${f.label}</small></button>`).join("")}</div>
      <div class="dn-regen" hidden><span class="dn-regen-note"></span><button type="button" class="dn-replay">↻ Rivedi il denoising</button></div>`;
    const stage = root.querySelector(".dn-stage"), cv = root.querySelector("canvas"), ctx = cv.getContext("2d"), hud = root.querySelector(".dn-hud"), hint = root.querySelector(".dn-hint"), form = root.querySelector(".dn-form"), input = form.querySelector("input"), fmts = root.querySelector(".dn-formats"), regen = root.querySelector(".dn-regen"), regenNote = root.querySelector(".dn-regen-note");
    const accent = () => cssVar(root, "--accent", "#BF00FF"), bgCol = () => cssVar(root, "--bg", "#050307");
    if (!tiles.length) makeTiles(accent());
    const st = { step: 0, img: null, subject: "", status: "idle", seed: 1, format: "free", W: 0, H: 0, dpr: 1, raf: 0, last: 0, visible: false, msg: "", model: "", lat: null, tick: 0, variants: {}, pending: {}, fstep: {}, bad: {} };
    const small = document.createElement("canvas"), sctx = small.getContext("2d");

    function size() { const r = stage.getBoundingClientRect(); if (!r.width || !r.height) return false; st.dpr = Math.min(1.5, window.devicePixelRatio || 1); st.W = Math.round(r.width); st.H = Math.round(r.height); cv.width = st.W * st.dpr; cv.height = st.H * st.dpr; ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0); return true; }
    // rettangolo del formato (contain per "libero", cover per gli altri)
    function frameRect() { const pad = 18, top = 50, bottom = 34; const f = FORMATS.find(x => x.id === st.format) || FORMATS[0]; const ratio = f.ratio || 1; const availH = st.H - top - bottom; let fw = st.W - pad * 2, fh = fw / ratio; if (fh > availH) { fh = availH; fw = fh * ratio; } return { x: (st.W - fw) / 2, y: top + (availH - fh) / 2, w: fw, h: fh }; }
    function coverSrc(img, ratio) { const iw = img.width || 512, ih = img.height || 512; let sw = iw, sh = iw / ratio; if (sh > ih) { sh = ih; sw = ih * ratio; } return { sx: (iw - sw) / 2, sy: (ih - sh) / 2, sw, sh }; }

    // ---------- adattamento ai formati: dov'è il soggetto, quanto si può tagliare, dove si estende ----------
    // Mappa di interesse a bassa risoluzione: bordi + distanza dal colore di sfondo. Ritorna il riquadro del soggetto (0..1).
    const salCache = new WeakMap();
    function analyze(img, withBars) {
      if (salCache.has(img)) return salCache.get(img);
      const S = 48; const c = document.createElement("canvas"); c.width = c.height = S; const x = c.getContext("2d"); const bx = bars(img, withBars); const iw = img.naturalWidth || img.width || 512, ih = img.naturalHeight || img.height || 512; x.drawImage(img, bx.x0 * iw, bx.y0 * ih, (bx.x1 - bx.x0) * iw, (bx.y1 - bx.y0) * ih, 0, 0, S, S); // si guarda solo dentro le bande
      const d = x.getImageData(0, 0, S, S).data; const lum = new Float32Array(S * S);
      let br = 0, bg = 0, bb = 0, bn = 0;
      for (let i = 0; i < S * S; i++) { lum[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11); const px = i % S, py = (i / S) | 0; if (px < 3 || py < 3 || px >= S - 3 || py >= S - 3) { br += d[i * 4]; bg += d[i * 4 + 1]; bb += d[i * 4 + 2]; bn++; } }
      br /= bn; bg /= bn; bb /= bn;
      const w = new Float32Array(S * S); let tot = 0;
      for (let y = 1; y < S - 1; y++) for (let xq = 1; xq < S - 1; xq++) { const i = y * S + xq; const e = Math.abs(lum[i + 1] - lum[i - 1]) + Math.abs(lum[i + S] - lum[i - S]); const cd = (Math.abs(d[i * 4] - br) + Math.abs(d[i * 4 + 1] - bg) + Math.abs(d[i * 4 + 2] - bb)) / 3; const v = e * 1.2 + cd * 0.8; w[i] = v; tot += v; }
      // riquadro che contiene il 96% dell'interesse, per righe e colonne (le estremità sottili, come le orecchie, pesano poco)
      const col = new Float32Array(S), row = new Float32Array(S); for (let y = 0; y < S; y++) for (let xq = 0; xq < S; xq++) { col[xq] += w[y * S + xq]; row[y] += w[y * S + xq]; }
      const span = (arr) => { let lo = 0, hi = S - 1, acc = 0; const cut = tot * 0.02; while (lo < S - 1 && acc + arr[lo] < cut) { acc += arr[lo]; lo++; } acc = 0; while (hi > lo && acc + arr[hi] < cut) { acc += arr[hi]; hi--; } return [lo / S, (hi + 1) / S]; };
      const [x0, x1] = span(col), [y0, y1] = span(row);
      const X = (v) => bx.x0 + v * (bx.x1 - bx.x0), Y = (v) => bx.y0 + v * (bx.y1 - bx.y0); // coordinate riportate all'immagine intera
      const out = { x0: X(x0), y0: Y(y0), x1: X(x1), y1: Y(y1), cx: X((x0 + x1) / 2), cy: Y((y0 + y1) / 2) }; salCache.set(img, out); return out;
    }
    // Bande piatte ai bordi (i formati nascono come riquadro con bande nere, letterbox o pillarbox): ritorna il riquadro utile in 0..1
    const barCache = new WeakMap();
    function bars(img, on) {
      if (on === false) return { x0: 0, y0: 0, x1: 1, y1: 1 }; // la base non ha bande: solo le varianti composte dal modello le hanno
      if (barCache.has(img)) return barCache.get(img);
      const W = 96, H = 96; const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d"); x.drawImage(img, 0, 0, W, H);
      const d = x.getImageData(0, 0, W, H).data;
      // statistica di una riga (axis 0) o di una colonna (axis 1): colore medio e scarto medio
      const stat = (axis, n) => { const L = axis ? H : W; let r = 0, g = 0, b = 0; const at = (i) => ((axis ? i * W + n : n * W + i) * 4); for (let i = 0; i < L; i++) { const k = at(i); r += d[k]; g += d[k + 1]; b += d[k + 2]; } r /= L; g /= L; b /= L; let dev = 0; for (let i = 0; i < L; i++) { const k = at(i); dev += Math.abs(d[k] - r) + Math.abs(d[k + 1] - g) + Math.abs(d[k + 2] - b); } return { r, g, b, dev: dev / (L * 3) }; };
      const flat = (s, ref) => s.dev < 7 && Math.abs(s.r - ref.r) + Math.abs(s.g - ref.g) + Math.abs(s.b - ref.b) < 36;
      const dark = (s) => s.dev < 7 && (s.r + s.g + s.b) / 3 < 48; // le bande chieste al modello sono nere: un fondale uniforme chiaro non è una banda
      const span = (axis) => { const L = axis ? W : H; const a = stat(axis, 0), z = stat(axis, L - 1); let lo = 0, hi = L; if (dark(a)) while (lo < L && flat(stat(axis, lo), a)) lo++; if (dark(z)) while (hi > lo && flat(stat(axis, hi - 1), z)) hi--;
        // bande vere solo se sono almeno il 4% e lasciano un'area utile di almeno un quinto
        if (lo > 0) lo++; if (hi < L) hi--; // un campione di margine: il bordo delle bande è sfumato dalla compressione
        return (lo + (L - hi)) >= L * 0.04 && (hi - lo) >= L * 0.2 ? [lo / L, hi / L] : [0, 1]; };
      const [y0, y1] = span(0), [x0, x1] = span(1);
      const out = { x0, y0, x1, y1 }; barCache.set(img, out); return out;
    }
    // Ritaglio al formato dentro il riquadro utile, che contiene per intero il riquadro del soggetto quando ci sta (nessuna estensione: i formati veri li genera il modello)
    function reframe(img, ratio, withBars) {
      const iw = img.naturalWidth || img.width || 512, ih = img.naturalHeight || img.height || 512; const sal = analyze(img, withBars), b = bars(img, withBars);
      const bx = b.x0 * iw, by = b.y0 * ih, bw = (b.x1 - b.x0) * iw, bh = (b.y1 - b.y0) * ih; // area utile
      let sw = bw, sh = bw / ratio; if (sh > bh) { sh = bh; sw = bh * ratio; }
      // riquadro del soggetto con un piccolo margine (area sicura); il ritaglio si sposta per contenerlo, se ci sta
      const m = 0.04, kx0 = Math.max(bx, (sal.x0 - m) * iw), kx1 = Math.min(bx + bw, (sal.x1 + m) * iw), ky0 = Math.max(by, (sal.y0 - m) * ih), ky1 = Math.min(by + bh, (sal.y1 + m) * ih);
      let sx = sal.cx * iw - sw / 2, sy = sal.cy * ih - sh / 2;
      if (kx1 - kx0 <= sw) sx = Math.min(Math.max(sx, kx1 - sw), kx0);
      else if (sal.x0 < b.x0 + .06 && sal.x1 < b.x1 - .06) sx = bx; else if (sal.x1 > b.x1 - .06 && sal.x0 > b.x0 + .06) sx = bx + bw - sw; // non ci sta: si tiene il lato dove il soggetto tocca già il bordo
      if (ky1 - ky0 <= sh) sy = Math.min(Math.max(sy, ky1 - sh), ky0);
      else sy = (sal.y1 > b.y1 - .06 && sal.y0 > b.y0 + .06) ? by + bh - sh : ky0; // non ci sta in altezza: si tiene la parte alta (teste, orecchie), si sacrificano pavimento e riflessi; se il soggetto tocca solo il fondo, il fondo
      sx = Math.min(Math.max(bx, sx), bx + bw - sw); sy = Math.min(Math.max(by, sy), by + bh - sh);
      return { sx, sy, sw, sh };
    }
    function drawAdapted(src, fr, ratio) { const r = reframe(src, ratio); ctx.save(); ctx.beginPath(); ctx.rect(fr.x, fr.y, fr.w, fr.h); ctx.clip(); ctx.imageSmoothingEnabled = true; ctx.drawImage(src, r.sx, r.sy, r.sw, r.sh, fr.x, fr.y, fr.w, fr.h); ctx.restore(); }

    // Cosa c'è sul palco adesso: la base (formato libero/1:1, o finché la base non è finita) oppure una variante di formato,
    // che ha il suo contatore di passi: se il modello non l'ha ancora composta si parte dal rumore e si clicca, come la prima volta
    const ok = (im) => !!(im && im.complete && im.naturalWidth);
    const VARIANTS = ["16:9", "9:16", "32:9"]; // formati composti dal modello, in parallelo, appena c'è la base
    function view() {
      const f = FORMATS.find(x => x.id === st.format) || FORMATS[0];
      if (!VARIANTS.includes(f.id) || !ok(st.img) || st.step < N) return { f, ratio: f.ratio, img: ok(st.img) ? st.img : null, step: st.step, status: st.status, base: true };
      if (st.pending[f.id] === false) return { f, ratio: f.ratio, img: st.img, step: N, status: "ready", base: true, fallback: true }; // il modello non ha risposto: ritaglio della base
      const vi = ok(st.variants[f.id]) ? st.variants[f.id] : null;
      return { f, ratio: f.ratio, img: vi, step: st.fstep[f.id] ?? (vi ? N : 0), status: vi ? "ready" : "loading" };
    }
    function draw() {
      if (!st.W) return;
      const v = view(); const t = v.step / N, sigma = Math.pow(1 - t, 1.5), res = Math.max(1, Math.round(Math.pow(1 - t, 2.2) * 40)); // rumore 1→0, blocchi 40px→1px
      ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1; ctx.fillStyle = bgCol(); ctx.fillRect(0, 0, st.W, st.H);
      const fr = frameRect(); const src = v.img || (st.lat || (st.lat = latent(st.subject, accent(), 0)));
      const f = v.f;
      const s = v.img && f.ratio ? reframe(v.img, f.ratio, !v.base) : { sx: 0, sy: 0, sw: src.width || 64, sh: src.height || 64 };
      const done = v.step >= N && v.img;
      if (done) { ctx.save(); ctx.beginPath(); ctx.rect(fr.x, fr.y, fr.w, fr.h); ctx.clip(); ctx.imageSmoothingEnabled = true; ctx.drawImage(src, s.sx, s.sy, s.sw, s.sh, fr.x, fr.y, fr.w, fr.h); ctx.restore(); }
      else if (v.step === 0 && !v.img && v.status !== "loading") { /* seme puro: solo rumore */ }
      else {
        // sorgente ridotta (macchie/blocchi), poi riportata al formato
        const dw = Math.max(1, Math.round(fr.w / res)), dh = Math.max(1, Math.round(fr.h / res));
        small.width = dw; small.height = dh; sctx.imageSmoothingEnabled = true; sctx.drawImage(src, s.sx, s.sy, s.sw, s.sh, 0, 0, dw, dh);
        ctx.save(); ctx.beginPath(); ctx.rect(fr.x, fr.y, fr.w, fr.h); ctx.clip();
        ctx.imageSmoothingEnabled = t > 0.62; ctx.drawImage(small, 0, 0, dw, dh, fr.x, fr.y, fr.w, fr.h);
        if (t > 0.62 && t < 1) { ctx.globalAlpha = 0.5; ctx.imageSmoothingEnabled = true; const dw2 = Math.max(1, Math.round(dw * 1.6)), dh2 = Math.max(1, Math.round(dh * 1.6)); small.width = dw2; small.height = dh2; sctx.imageSmoothingEnabled = true; sctx.drawImage(src, s.sx, s.sy, s.sw, s.sh, 0, 0, dw2, dh2); ctx.drawImage(small, 0, 0, dw2, dh2, fr.x, fr.y, fr.w, fr.h); ctx.globalAlpha = 1; }
        // velo di colore che si dissolve
        const [ar, ag, ab] = hexRgb(accent()); ctx.fillStyle = `rgba(${ar},${ag},${ab},${0.22 * sigma})`; ctx.fillRect(fr.x, fr.y, fr.w, fr.h);
        ctx.restore();
      }
      // rumore: grana fine + blocchi grossi, con un seed diverso a ogni passo
      if (sigma > 0.001 || v.status === "loading") {
        const r = rnd(st.seed * 7 + st.tick * 13 + 1); const a = v.step === 0 ? 1 : sigma;
        ctx.save(); ctx.beginPath(); ctx.rect(fr.x, fr.y, fr.w, fr.h); ctx.clip();
        // blocchi grossi (la "latente" rumorosa), poi grana fine: griglie complete, con un solo scarto casuale per frame
        const big = 2 + Math.round(sigma * 6); const bx = r() * TILE, by = r() * TILE;
        ctx.globalAlpha = Math.min(1, a * 0.6); ctx.imageSmoothingEnabled = false;
        for (let y = fr.y - TILE - by; y < fr.y + fr.h; y += TILE) for (let x = fr.x - TILE - bx; x < fr.x + fr.w; x += TILE) { const tl = tiles[Math.floor(r() * NT)]; ctx.drawImage(tl, 0, 0, TILE / big, TILE / big, x, y, TILE, TILE); }
        const fx = r() * TILE, fy = r() * TILE; ctx.globalAlpha = Math.min(1, a * 0.72);
        for (let y = fr.y - TILE - fy; y < fr.y + fr.h; y += TILE) for (let x = fr.x - TILE - fx; x < fr.x + fr.w; x += TILE) { const tl = tiles[Math.floor(r() * NT)]; ctx.drawImage(tl, x, y); }
        ctx.restore(); ctx.globalAlpha = 1;
      }
      // cornice del formato e vignetta finale
      if (v.step >= N) { const g = ctx.createRadialGradient(st.W / 2, st.H / 2, Math.min(st.W, st.H) * 0.35, st.W / 2, st.H / 2, Math.max(st.W, st.H) * 0.75); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.35)"); ctx.fillStyle = g; ctx.fillRect(0, 0, st.W, st.H); }
      if (f.ratio) { ctx.strokeStyle = `rgba(255,255,255,${v.step >= N ? .5 : .18})`; ctx.lineWidth = 1; ctx.strokeRect(fr.x + .5, fr.y + .5, fr.w - 1, fr.h - 1); ctx.fillStyle = "rgba(255,255,255,.6)"; ctx.font = '500 10px "Geist Mono",ui-monospace,Menlo,monospace'; ctx.textAlign = "right"; ctx.fillText(f.id, fr.x + fr.w - 8, fr.y + fr.h - 8); }
    }
    function updHud() {
      const v = view(); const t = v.step / N, sigma = Math.pow(1 - t, 1.5); const fid = v.f.id;
      const state = v.status === "loading" ? `<span class="vit">${v.base ? "campionamento in corso…" : "il modello compone il " + fid + "…"}</span>` : v.status === "error" ? `<span class="vit">${esc(st.msg)}</span>` : v.step >= N ? `<span class="vit">${v.fallback ? fid + " · ritaglio della base" : v.base ? "immagine generata · " + esc(st.model || "modello") : fid + " composto dal modello"}</span>` : v.img ? `<span class="vit">campione pronto · continua a cliccare</span>` : `<span class="vit">nomina un oggetto</span>`;
      hud.innerHTML = `${state}<span><b>DENOISE</b> ${st.subject ? "· «" + esc(st.subject) + "»" : ""}</span><span>passo <b>${v.step}</b>/${N}</span><span>σ <b>${sigma.toFixed(2)}</b></span><span>seed <b>${st.seed}</b></span>`;
      hint.textContent = v.status === "idle" && !st.subject ? "Scrivi un oggetto (o scegline uno), poi clicca qui: ogni clic è un passo di denoising"
        : v.status === "loading" ? (v.step < 3 ? (v.base ? "Clicca: intanto il rumore comincia a organizzarsi" : `Clicca: il modello sta componendo il ${fid}, intanto il rumore si organizza`) : (v.base ? "Il modello sta ancora campionando: un attimo" : `Il modello sta ancora componendo il ${fid}: un attimo`))
        : v.status === "error" ? "Riprova con un altro oggetto"
        : v.step >= N ? (v.base && !v.fallback ? "Pronto. Ora adattalo ai formati qui sotto" : v.fallback ? `Per il ${fid} il modello non ha risposto: ritaglio della base` : `${fid} pronto. Prova un altro formato`)
        : `Clicca: ${N - v.step} ${N - v.step === 1 ? "passo" : "passi"} al ${v.base ? "risultato" : fid}`;
    }
    function reseed() { st.seed = 1000 + Math.floor(Math.random() * 9000); st.tick++; }
    function stepClick() {
      if (!st.subject) { input.focus(); st.tick++; draw(); return; }
      const v = view();
      if (v.status === "loading" && v.step >= 3) { reseed(); st.lat = latent(st.subject, accent(), st.tick); updHud(); draw(); return; } // si aspetta il modello
      if (v.status === "error") { input.focus(); return; }
      if (v.step >= N) { st.tick++; draw(); return; } // al traguardo si ferma: per rivederlo c'è il pulsante
      if (v.base) { st.step++; } else { st.fstep[v.f.id] = v.step + 1; } // ogni formato ha i suoi passi
      reseed(); if (!v.img) st.lat = latent(st.subject, accent(), v.step + 1);
      if (v.base && st.step >= N) { fmts.hidden = false; regen.hidden = false; root.classList.add("done"); }
      syncRegen(); updHud(); draw();
    }
    function replay() { if (!st.img) return; st.step = 0; st.fstep = {}; reseed(); st.format = "free"; syncFormats(); fmts.hidden = true; regen.hidden = true; root.classList.remove("done"); updHud(); draw(); }
    function syncFormats() { fmts.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.f === st.format)); syncRegen(); }
    // Varianti di formato: appena c'è la base, il modello compone in parallelo orizzontale (16:9), verticale (9:16) e panoramica (32:9)
    function syncRegen() {
      const f = st.format; if (st.step < N || !st.img) { regenNote.textContent = ""; return; }
      if (VARIANTS.includes(f)) regenNote.textContent = st.variants[f] ? `${f} composto dal modello` : st.pending[f] ? `${f} in arrivo dal modello · intanto clicca: ogni clic è un passo` : st.pending[f] === false ? (st.bad[f] === "stretched" ? `${f}: il modello aveva solo deformato la base, quindi ritaglio della base` : `${f}: il modello non ha risposto, ritaglio della base`) : "";
      else regenNote.textContent = f === "1:1" ? "1:1 · l'immagine com'è nata" : "";
      fmts.querySelectorAll("button").forEach(b => { const id = b.dataset.f; b.classList.toggle("wait", VARIANTS.includes(id) && !!st.pending[id]); b.classList.toggle("ready", VARIANTS.includes(id) && !!st.variants[id]); });
    }
    // La variante è solo la base stirata al nuovo formato? Si riportano entrambe a 48×48 (la variante schiacciata) e si confrontano le mappe dei bordi:
    // una copia deformata ha gli stessi bordi negli stessi punti (correlazione alta), una vera ricomposizione no
    function stretched(v, base) {
      try {
        const S = 48; const c = document.createElement("canvas"); c.width = c.height = S; const x = c.getContext("2d");
        const grad = (img) => { x.clearRect(0, 0, S, S); x.drawImage(img, 0, 0, S, S); const d = x.getImageData(0, 0, S, S).data; const l = new Float32Array(S * S); for (let i = 0; i < S * S; i++) l[i] = d[i * 4] * .3 + d[i * 4 + 1] * .59 + d[i * 4 + 2] * .11; const g = []; for (let y = 1; y < S - 1; y++) for (let q = 1; q < S - 1; q++) { const i = y * S + q; g.push(Math.hypot(l[i + 1] - l[i - 1], l[i + S] - l[i - S])); } const m = g.reduce((t, w) => t + w, 0) / g.length; const sd = Math.sqrt(g.reduce((t, w) => t + (w - m) ** 2, 0) / g.length) || 1; return g.map(w => (w - m) / sd); };
        const a = grad(base), b = grad(v); let r = 0; for (let i = 0; i < a.length; i++) r += a[i] * b[i];
        return r / a.length > 0.7;
      } catch { return false; }
    }
    function requestVariants(subject) {
      VARIANTS.forEach(async (f) => {
        if (st.variants[f] || st.pending[f] || PREVIEW) return; st.pending[f] = true; syncRegen();
        try {
          const r = await fetch("/api/ai/image", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q: subject, mood: document.documentElement.dataset.mood || "", format: f }) });
          const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "Il modello non risponde");
          const img = new Image(); img.src = j.image; await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error("Immagine non leggibile")); });
          if (st.subject !== subject) return;
          if (st.img && stretched(img, st.img)) { st.pending[f] = false; st.bad[f] = "stretched"; } // il modello ha solo deformato la base: meglio un ritaglio onesto
          else { st.variants[f] = img; st.pending[f] = null; }
        } catch (e) { if (st.subject !== subject) return; st.pending[f] = false; }
        syncRegen(); if (st.format === f) { updHud(); draw(); }
      });
    }
    async function generate(subject) {
      subject = String(subject || "").trim().slice(0, 60); if (subject.length < 2) { input.focus(); return; }
      st.subject = subject; st.step = 0; st.img = null; st.lat = null; st.status = "loading"; st.msg = ""; st.format = "free"; st.variants = {}; st.pending = {}; st.fstep = {}; st.bad = {}; syncFormats(); fmts.hidden = true; regen.hidden = true; root.classList.remove("done"); reseed(); updHud(); draw(); loop();
      try {
        let img;
        if (PREVIEW) { await new Promise(r => setTimeout(r, 1400)); img = previewImage(subject, accent()); st.model = "anteprima"; }
        else {
          const r = await fetch("/api/ai/image", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q: subject, mood: document.documentElement.dataset.mood || "" }) });
          const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "Il modello non risponde");
          img = new Image(); img.src = j.image; st.model = j.model || "";
        }
        await new Promise((res, rej) => { if (img.complete && img.naturalWidth) return res(); img.onload = res; img.onerror = () => rej(new Error("Immagine non leggibile")); });
        if (st.subject !== subject) return; // nel frattempo ha chiesto altro
        st.img = img; st.status = "ready"; requestVariants(subject);
      } catch (e) { if (st.subject !== subject) return; st.status = "error"; st.msg = e.message || "Errore"; }
      updHud(); draw();
    }
    // durante il campionamento il rumore vive (pochi frame al secondo, solo se visibile)
    function loop() { cancelAnimationFrame(st.raf); const f = (now) => { if (view().status !== "loading" || !st.visible) return; if (now - st.last > 110) { st.last = now; st.tick++; draw(); } st.raf = requestAnimationFrame(f); }; st.raf = requestAnimationFrame(f); }

    stage.addEventListener("click", stepClick);
    stage.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); stepClick(); } });
    form.addEventListener("submit", e => { e.preventDefault(); generate(input.value); });
    root.querySelector(".dn-chips").addEventListener("click", e => { const b = e.target.closest("[data-s]"); if (!b) return; input.value = b.dataset.s; generate(b.dataset.s); });
    fmts.addEventListener("click", e => { const b = e.target.closest("[data-f]"); if (!b) return; st.format = b.dataset.f; syncFormats(); updHud(); draw(); if (view().status === "loading") loop(); });
    root.querySelector(".dn-replay").addEventListener("click", replay);
    document.addEventListener("fw:theme", () => { makeTiles(accent()); st.lat = null; draw(); });
    new ResizeObserver(() => { if (size()) draw(); }).observe(stage);
    new IntersectionObserver(en => en.forEach(x => { st.visible = x.isIntersecting; if (st.visible && view().status === "loading") loop(); }), { threshold: 0.2 }).observe(stage);
    if (size()) draw(); updHud();
    root.__dn = { reframe, bars, analyze, stretched }; // per i test
  }
  function mountAll() { document.querySelectorAll("[data-diffusion]").forEach(mount); }
  return { mount, mountAll };
})();
