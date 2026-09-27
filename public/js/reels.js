/* =========================================================
   REEL — caroselli dei video tematici (Vimeo). Ogni reel gira muto in loop quando entra in vista
   (player in modalità background); "Guarda con audio" lo sostituisce col player completo, uno alla volta.
   Frecce (se ci sono) e scorrimento con snap; su trackpad e touch si scorre direttamente.
   Uso: window.Reels.mount(track) su un elemento .reels-track (o [data-reels-track]); mountAll() li monta tutti.
   Il carosello desktop (#reels-track) si monta da solo; quello dell'app mobile lo monta site.js quando lo disegna.
   ========================================================= */
(() => {
  "use strict";
  function mount(track) {
    if (!track || track.dataset.mounted) return; track.dataset.mounted = "1";
    const reels = [...track.querySelectorAll("[data-reel]")]; if (!reels.length) return;
    const src = (el, full) => { const id = el.dataset.vimeo, h = el.dataset.h; if (!id) return ""; const base = `https://player.vimeo.com/video/${id}?${h ? "h=" + h + "&" : ""}dnt=1&playsinline=1&`; return full ? base + "autoplay=1&muted=0&controls=1&title=0&byline=0&portrait=0" : base + "background=1&autoplay=1&loop=1&muted=1&autopause=0"; };
    const frame = (el, full) => {
      const media = el.querySelector(".reel-media"); const old = media.querySelector("iframe"); if (old) old.remove();
      const s = src(el, full); if (!s) return;
      const f = document.createElement("iframe"); f.src = s; f.loading = "lazy"; f.title = full ? "Reel" : "Anteprima del reel"; f.allow = "autoplay; fullscreen; picture-in-picture"; if (full) f.allowFullscreen = true; else { f.inert = true; f.tabIndex = -1; } // l'anteprima muta non prende clic né fuoco
      media.appendChild(f); el.classList.toggle("playing", full);
      const b = el.querySelector("[data-reel-play]"); if (b) b.textContent = full ? "Torna al loop" : "Guarda con audio";
    };
    const quiet = (except) => reels.forEach(r => { if (r !== except && r.classList.contains("playing")) frame(r, false); });
    // anteprima muta quando il reel è in vista; se stava suonando ed esce, torna al loop
    const io = new IntersectionObserver(es => es.forEach(e => {
      const el = e.target;
      if (e.isIntersecting) { if (!el.querySelector("iframe")) frame(el, false); }
      else if (el.classList.contains("playing")) frame(el, false);
    }), { root: null, rootMargin: "0px 200px", threshold: .25 });
    reels.forEach(r => io.observe(r));
    track.addEventListener("click", e => {
      const b = e.target.closest("[data-reel-play]"); if (!b) return; const el = b.closest("[data-reel]");
      if (el.classList.contains("playing")) { frame(el, false); return; }
      quiet(el); frame(el, true); el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    });
    // frecce (nel contenitore .reels-wrap, se c'è)
    const wrap = track.closest(".reels-wrap") || track.parentElement;
    const step = (dir) => { const w = reels[0] ? reels[0].getBoundingClientRect().width + 20 : track.clientWidth * .6; track.scrollBy({ left: dir * w, behavior: "smooth" }); };
    const prev = wrap && wrap.querySelector('[data-reels-nav="-1"]'), next = wrap && wrap.querySelector('[data-reels-nav="1"]');
    if (prev) prev.addEventListener("click", () => step(-1)); if (next) next.addEventListener("click", () => step(1));
    const arrows = () => { if (!prev || !next) return; prev.disabled = track.scrollLeft < 10; next.disabled = track.scrollLeft > track.scrollWidth - track.clientWidth - 10; };
    track.addEventListener("scroll", arrows, { passive: true }); window.addEventListener("resize", arrows); arrows();
    // i player in background non si mettono in pausa da soli quando la scheda è nascosta: si tolgono e si rimettono
    document.addEventListener("visibilitychange", () => { if (document.hidden) reels.forEach(r => { const f = r.querySelector("iframe"); if (f && !r.classList.contains("playing")) f.remove(); }); else reels.forEach(r => { const rect = r.getBoundingClientRect(); if (rect.bottom > 0 && rect.top < innerHeight && rect.width && !r.querySelector("iframe")) frame(r, false); }); });
  }
  window.Reels = { mount, mountAll: (sel) => document.querySelectorAll(sel || ".reels-track, [data-reels-track]").forEach(mount) };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => window.Reels.mountAll()); else window.Reels.mountAll();
})();
