/* =========================================================
   REEL — i video tematici (Vimeo) del carosello "Organismi in movimento", fra l'organismo e i lavori.
   Stanno nel setting "reels": [{ id, title, theme, url, cover, sort }]. Si gestiscono da /admin/reel.
   Al primo avvio si popola con quattro temi e, come segnaposto, i loop di alcune case: da sostituire
   con i reel veri dal backoffice.
   ========================================================= */
const store = require("./db");

const slug = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || ("reel-" + Date.now().toString(36));
const vimeo = (u) => { const m = /vimeo\.com\/(?:video\/)?(\d+)(?:\/([a-z0-9]+))?/i.exec(u || ""); return m ? { id: m[1], h: m[2] || "" } : null; };

const DEFAULTS = [
  { id: "cultura", title: "Cultura e musei", theme: "Cultura", from: "troia" },
  { id: "spazio", title: "Spazio", theme: "Spazio", from: "esa-space-rider" },
  { id: "moda", title: "Moda e lusso", theme: "Moda", from: "moka-dg" },
  { id: "corporate", title: "Corporate e brand", theme: "Corporate", from: "we-build-sport" }
];

function seedIfMissing() {
  if (store.getSetting("reels", null) != null) return;
  const reels = DEFAULTS.map((d, i) => { const w = store.getWork(d.from) || {}; return { id: d.id, title: d.title, theme: d.theme, url: w.video_url || "", cover: w.image || "", sort: i + 1, placeholder: true }; });
  store.setSetting("reels", reels);
}
function list() { return (store.getSetting("reels", []) || []).slice().sort((a, b) => (a.sort || 0) - (b.sort || 0)).map(r => ({ ...r, vimeo: vimeo(r.url) })); }
function upsert(b) {
  const reels = store.getSetting("reels", []) || []; const id = slug(b.id || b.title);
  const r = { id, title: String(b.title || "").trim().slice(0, 80), theme: String(b.theme || "").trim().slice(0, 40), url: String(b.url || "").trim().slice(0, 200), cover: String(b.cover || "").trim().slice(0, 300), sort: +b.sort || reels.length + 1, placeholder: false };
  const i = reels.findIndex(x => x.id === id); if (i >= 0) reels[i] = { ...reels[i], ...r }; else reels.push(r);
  store.setSetting("reels", reels); return r;
}
function remove(id) { store.setSetting("reels", (store.getSetting("reels", []) || []).filter(r => r.id !== id)); }
function move(id, dir) {
  const reels = list().map(({ vimeo, ...r }) => r); const i = reels.findIndex(r => r.id === id); const j = i + dir; if (i < 0 || j < 0 || j >= reels.length) return;
  [reels[i], reels[j]] = [reels[j], reels[i]]; reels.forEach((r, k) => r.sort = k + 1); store.setSetting("reels", reels);
}
module.exports = { seedIfMissing, list, upsert, remove, move, vimeo };
