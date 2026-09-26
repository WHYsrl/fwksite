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
      <div class="org-controls formats dn-formats" hidden>${FORMATS.map((f, i) => `<button type="button" data-f="${f.id}" class="${i === 0 ? "on" : ""}"><b>${f.name}</b><small>${f.label}</small></button>`).join("")}</div>`;
    const stage = root.querySelector(".dn-stage"), cv = root.querySelector("canvas"), ctx = cv.getContext("2d"), hud = root.querySelector(".dn-hud"), hint = root.querySelector(".dn-hint"), form = root.querySelector(".dn-form"), input = form.querySelector("input"), fmts = root.querySelector(".dn-formats");
    const accent = () => cssVar(root, "--accent", "#BF00FF"), bgCol = () => cssVar(root, "--bg", "#050307");
    if (!tiles.length) makeTiles(accent());
    const st = { step: 0, img: null, subject: "", status: "idle", seed: 1, format: "free", W: 0, H: 0, dpr: 1, raf: 0, last: 0, visible: false, msg: "", model: "", lat: null, tick: 0 };
    const small = document.createElement("canvas"), sctx = small.getContext("2d");

    function size() { const r = stage.getBoundingClientRect(); if (!r.width || !r.height) return false; st.dpr = Math.min(1.5, window.devicePixelRatio || 1); st.W = Math.round(r.width); st.H = Math.round(r.height); cv.width = st.W * st.dpr; cv.height = st.H * st.dpr; ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0); return true; }
    // rettangolo del formato (contain per "libero", cover per gli altri)
    function frameRect() { const pad = 18, top = 50, bottom = 34; const f = FORMATS.find(x => x.id === st.format) || FORMATS[0]; const ratio = f.ratio || 1; const availH = st.H - top - bottom; let fw = st.W - pad * 2, fh = fw / ratio; if (fh > availH) { fh = availH; fw = fh * ratio; } return { x: (st.W - fw) / 2, y: top + (availH - fh) / 2, w: fw, h: fh }; }
    function coverSrc(img, ratio) { const iw = img.width || 512, ih = img.height || 512; let sw = iw, sh = iw / ratio; if (sh > ih) { sh = ih; sw = ih * ratio; } return { sx: (iw - sw) / 2, sy: (ih - sh) / 2, sw, sh }; }

    function draw() {
      if (!st.W) return;
      const t = st.step / N, sigma = Math.pow(1 - t, 1.5), res = Math.max(1, Math.round(Math.pow(1 - t, 2.2) * 40)); // rumore 1→0, blocchi 40px→1px
      ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1; ctx.fillStyle = bgCol(); ctx.fillRect(0, 0, st.W, st.H);
      const fr = frameRect(); const src = st.img && st.img.complete && st.img.naturalWidth ? st.img : (st.lat || (st.lat = latent(st.subject, accent(), 0)));
      const f = FORMATS.find(x => x.id === st.format) || FORMATS[0];
      const s = f.ratio ? coverSrc(src, f.ratio) : { sx: 0, sy: 0, sw: src.width || 64, sh: src.height || 64 };
      if (st.step === 0 && !st.img && st.status !== "loading") { /* seme puro: solo rumore */ }
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
      if (sigma > 0.001 || st.status === "loading") {
        const r = rnd(st.seed * 7 + st.tick * 13 + 1); const a = st.step === 0 ? 1 : sigma;
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
      if (st.step >= N) { const g = ctx.createRadialGradient(st.W / 2, st.H / 2, Math.min(st.W, st.H) * 0.35, st.W / 2, st.H / 2, Math.max(st.W, st.H) * 0.75); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.35)"); ctx.fillStyle = g; ctx.fillRect(0, 0, st.W, st.H); }
      if (f.ratio) { ctx.strokeStyle = `rgba(255,255,255,${st.step >= N ? .5 : .18})`; ctx.lineWidth = 1; ctx.strokeRect(fr.x + .5, fr.y + .5, fr.w - 1, fr.h - 1); ctx.fillStyle = "rgba(255,255,255,.6)"; ctx.font = '500 10px "Geist Mono",ui-monospace,Menlo,monospace'; ctx.textAlign = "right"; ctx.fillText(f.id, fr.x + fr.w - 8, fr.y + fr.h - 8); }
    }
    function updHud() {
      const t = st.step / N, sigma = Math.pow(1 - t, 1.5);
      const state = st.status === "loading" ? `<span class="vit">campionamento in corso…</span>` : st.status === "error" ? `<span class="vit">${esc(st.msg)}</span>` : st.step >= N ? `<span class="vit">immagine generata · ${esc(st.model || "modello")}</span>` : st.img ? `<span class="vit">campione pronto · continua a cliccare</span>` : `<span class="vit">nomina un oggetto</span>`;
      hud.innerHTML = `${state}<span><b>DENOISE</b> ${st.subject ? "· «" + esc(st.subject) + "»" : ""}</span><span>passo <b>${st.step}</b>/${N}</span><span>σ <b>${sigma.toFixed(2)}</b></span><span>seed <b>${st.seed}</b></span>`;
      hint.textContent = st.status === "idle" && !st.subject ? "Scrivi un oggetto (o scegline uno), poi clicca qui: ogni clic è un passo di denoising" : st.status === "loading" ? (st.step < 3 ? "Clicca: intanto il rumore comincia a organizzarsi" : "Il modello sta ancora campionando: un attimo") : st.status === "error" ? "Riprova con un altro oggetto" : st.step >= N ? "Pronto. Clicca ancora per un nuovo seed, o adattalo ai formati qui sotto" : `Clicca: ${N - st.step} ${N - st.step === 1 ? "passo" : "passi"} al risultato`;
    }
    function reseed() { st.seed = 1000 + Math.floor(Math.random() * 9000); st.tick++; }
    function stepClick() {
      if (!st.subject) { input.focus(); st.tick++; draw(); return; }
      if (st.status === "loading" && st.step >= 3) { reseed(); st.lat = latent(st.subject, accent(), st.tick); updHud(); draw(); return; }
      if (st.status === "error") { input.focus(); return; }
      if (st.step >= N) { st.step = 0; reseed(); st.format = "free"; syncFormats(); updHud(); draw(); return; } // nuovo seed: si riparte dal rumore
      st.step++; reseed(); if (!st.img) st.lat = latent(st.subject, accent(), st.step);
      if (st.step >= N) { fmts.hidden = false; root.classList.add("done"); }
      updHud(); draw();
    }
    function syncFormats() { fmts.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.f === st.format)); }
    async function generate(subject) {
      subject = String(subject || "").trim().slice(0, 60); if (subject.length < 2) { input.focus(); return; }
      st.subject = subject; st.step = 0; st.img = null; st.lat = null; st.status = "loading"; st.msg = ""; st.format = "free"; syncFormats(); fmts.hidden = true; root.classList.remove("done"); reseed(); updHud(); draw(); loop();
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
        st.img = img; st.status = "ready";
      } catch (e) { if (st.subject !== subject) return; st.status = "error"; st.msg = e.message || "Errore"; }
      updHud(); draw();
    }
    // durante il campionamento il rumore vive (pochi frame al secondo, solo se visibile)
    function loop() { cancelAnimationFrame(st.raf); const f = (now) => { if (st.status !== "loading" || !st.visible) return; if (now - st.last > 110) { st.last = now; st.tick++; draw(); } st.raf = requestAnimationFrame(f); }; st.raf = requestAnimationFrame(f); }

    stage.addEventListener("click", stepClick);
    stage.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); stepClick(); } });
    form.addEventListener("submit", e => { e.preventDefault(); generate(input.value); });
    root.querySelector(".dn-chips").addEventListener("click", e => { const b = e.target.closest("[data-s]"); if (!b) return; input.value = b.dataset.s; generate(b.dataset.s); });
    fmts.addEventListener("click", e => { const b = e.target.closest("[data-f]"); if (!b) return; st.format = b.dataset.f; syncFormats(); draw(); });
    document.addEventListener("fw:theme", () => { makeTiles(accent()); st.lat = null; draw(); });
    new ResizeObserver(() => { if (size()) draw(); }).observe(stage);
    new IntersectionObserver(en => en.forEach(x => { st.visible = x.isIntersecting; if (st.visible && st.status === "loading") loop(); }), { threshold: 0.2 }).observe(stage);
    if (size()) draw(); updHud();
  }
  function mountAll() { document.querySelectorAll("[data-diffusion]").forEach(mount); }
  return { mount, mountAll };
})();
