/* =========================================================
   REEL — i video tematici (Vimeo) del carosello "Organismi in movimento", fra l'organismo e i lavori.
   Stanno nel setting "reels": [{ id, title, theme, url, cover, sort }]. Si gestiscono da /admin/reel.
   Al primo avvio si popola con quattro temi e, come segnaposto, i loop di alcune case: da sostituire
   con i reel veri dal backoffice.
   ========================================================= */
const store = require("./db");

const slug = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || ("reel-" + Date.now().toString(36));
const vimeo = (u) => { const m = /vimeo\.com\/(?:video\/)?(\d+)(?:\/([a-z0-9]+))?/i.exec(u || ""); return m ? { id: m[1], h: m[2] || "" } : null; };

// i tre reel tematici di Frameworks (cartella Vimeo FBF_Websites → Frameworks → Reel); finché un reel non è su Vimeo, il segnaposto usa il loop di una case
const DEFAULTS = [
  { id: "cultura", title: "Cultura e musei", theme: "Cultura", from: "troia", url: "https://vimeo.com/1227780840/65a298e9c7" },
  { id: "spazio", title: "Aerospazio", theme: "Spazio", from: "esa-space-rider" },
  { id: "gaming", title: "Gaming", theme: "Gaming", from: "geely" }
];

function seedIfMissing() {
  const existing = store.getSetting("reels", null);
  const make = (d, i) => { const w = store.getWork(d.from) || {}; return { id: d.id, title: d.title, theme: d.theme, url: d.url || w.video_url || "", cover: w.image || "", sort: i + 1, placeholder: !d.url }; };
  if (existing == null) { store.setSetting("reels", DEFAULTS.map(make)); return; }
  // allineamento: i reel veri sostituiscono i segnaposto (mai una voce modificata a mano), i temi previsti mancanti si aggiungono, i vecchi segnaposto fuori tema spariscono
  let changed = false; let reels = existing.slice();
  DEFAULTS.forEach((d, i) => {
    const r = reels.find(x => x.id === d.id);
    if (!r) { reels.push(make(d, reels.length)); changed = true; }
    else if (r.placeholder && d.url && r.url !== d.url) { Object.assign(r, { url: d.url, title: r.title || d.title, placeholder: false }); changed = true; }
  });
  const before = reels.length; reels = reels.filter(r => !(r.placeholder && !DEFAULTS.some(d => d.id === r.id))); if (reels.length !== before) changed = true;
  if (changed) { reels.forEach((r, i) => r.sort = i + 1); store.setSetting("reels", reels); }
}
function list() { return (store.getSetting("reels", []) || []).slice().sort((a, b) => (a.sort || 0) - (b.sort || 0)).map(r => ({ ...r, vimeo: vimeo(r.url) })); }
function upsert(b) {
  const reels = store.getSetting("reels", []) || []; const id = slug(b.id || b.title);
  const r = { id, title: String(b.title || "").trim().slice(0, 80), theme: String(b.theme || "").trim().slice(0, 40), url: String(b.url || "").trim().slice(0, 200), cover: String(b.cover || "").trim().slice(0, 300), sort: +b.sort || reels.length + 1, priority: Math.min(3, Math.max(1, parseInt(b.priority, 10) || 1)), placeholder: false };
  const i = reels.findIndex(x => x.id === id); if (i >= 0) reels[i] = { ...reels[i], ...r }; else reels.push(r);
  store.setSetting("reels", reels); return r;
}
function remove(id) { store.setSetting("reels", (store.getSetting("reels", []) || []).filter(r => r.id !== id)); }
function move(id, dir) {
  const reels = list().map(({ vimeo, ...r }) => r); const i = reels.findIndex(r => r.id === id); const j = i + dir; if (i < 0 || j < 0 || j >= reels.length) return;
  [reels[i], reels[j]] = [reels[j], reels[i]]; reels.forEach((r, k) => r.sort = k + 1); store.setSetting("reels", reels);
}
module.exports = { seedIfMissing, list, upsert, remove, move, vimeo };
