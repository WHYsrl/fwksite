/* =========================================================
   REEL — carosello dei video tematici (Vimeo). Ogni reel gira muto in loop quando entra in vista
   (player in modalità background); "Guarda con audio" lo sostituisce col player completo, uno alla volta.
   Frecce e scorrimento con snap; su trackpad e touch si scorre direttamente.
   ========================================================= */
(() => {
  "use strict";
  const track = document.getElementById("reels-track"); if (!track) return;
  const reels = [...track.querySelectorAll("[data-reel]")];
  const src = (el, full) => { const id = el.dataset.vimeo, h = el.dataset.h; if (!id) return ""; const base = `https://player.vimeo.com/video/${id}?${h ? "h=" + h + "&" : ""}dnt=1&`; return full ? base + "autoplay=1&muted=0&controls=1&title=0&byline=0&portrait=0" : base + "background=1&autoplay=1&loop=1&muted=1&autopause=0"; };
  const frame = (el, full) => {
    const media = el.querySelector(".reel-media"); const old = media.querySelector("iframe"); if (old) old.remove();
    const s = src(el, full); if (!s) return;
    const f = document.createElement("iframe"); f.src = s; f.loading = "lazy"; f.title = full ? "Reel" : "Anteprima del reel"; f.allow = "autoplay; fullscreen; picture-in-picture"; if (full) f.allowFullscreen = true; else { f.inert = true; f.tabIndex = -1; } // l'anteprima muta non prende clic né fuoco
    media.appendChild(f); el.classList.toggle("playing", full);
  };
  const quiet = (except) => reels.forEach(r => { if (r !== except && r.classList.contains("playing")) frame(r, false); });
  // anteprima muta quando il reel è in vista (e via quando esce da un pezzo)
  const io = new IntersectionObserver(es => es.forEach(e => {
    const el = e.target;
    if (e.isIntersecting) { if (!el.querySelector("iframe")) frame(el, false); }
    else if (el.classList.contains("playing")) frame(el, false);
  }), { root: null, rootMargin: "0px 200px", threshold: .25 });
  reels.forEach(r => io.observe(r));
  track.addEventListener("click", e => {
    const b = e.target.closest("[data-reel-play]"); if (!b) return; const el = b.closest("[data-reel]");
    if (el.classList.contains("playing")) { frame(el, false); b.textContent = "Guarda con audio"; return; }
    quiet(el); reels.forEach(r => { const x = r.querySelector("[data-reel-play]"); if (x) x.textContent = "Guarda con audio"; });
    frame(el, true); b.textContent = "Torna al loop"; el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  });
  // frecce
  const step = (dir) => { const w = reels[0] ? reels[0].getBoundingClientRect().width + 20 : track.clientWidth * .6; track.scrollBy({ left: dir * w, behavior: "smooth" }); };
  document.querySelectorAll("[data-reels-nav]").forEach(b => b.addEventListener("click", () => step(+b.dataset.reelsNav)));
  const arrows = () => { const p = document.querySelector(".reels-arrow.prev"), n = document.querySelector(".reels-arrow.next"); if (!p || !n) return; p.disabled = track.scrollLeft < 10; n.disabled = track.scrollLeft > track.scrollWidth - track.clientWidth - 10; };
  track.addEventListener("scroll", arrows, { passive: true }); window.addEventListener("resize", arrows); arrows();
  // i player in background non si mettono in pausa da soli quando la scheda è nascosta: si tolgono e si rimettono
  document.addEventListener("visibilitychange", () => { if (document.hidden) reels.forEach(r => { const f = r.querySelector("iframe"); if (f && !r.classList.contains("playing")) f.remove(); }); else reels.forEach(r => { const rect = r.getBoundingClientRect(); if (rect.bottom > 0 && rect.top < innerHeight && !r.querySelector("iframe")) frame(r, false); }); });
})();
