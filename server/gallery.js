// Galleria delle schede dei lavori: foto e video (mp4/webm oppure link Vimeo) con didascalia facoltativa, che nella scheda
// seguono la copertina (immagine o video del lavoro) in un carosello. Vive nel setting "works_gallery"
// ({ [id lavoro]: [{ src, caption }] }), senza toccare lo schema del database; si modifica dal backoffice (Lavori → lavoro).
// il database si carica solo quando serve, così l'anteprima statica può girare senza
let _store = null; const db = () => _store || (_store = require("./db"));

const MAX = 16;
// righe dal backoffice (gallery[0][src], gallery[0][caption]…) o array: restano solo quelle con un media, al massimo MAX
function clean(rows) {
  const list = Array.isArray(rows) ? rows : (rows && typeof rows === "object") ? Object.keys(rows).sort((a, b) => +a - +b).map(k => rows[k]) : [];
  return list.map(r => ({ src: String(r && r.src || "").trim(), caption: String(r && r.caption || "").trim() })).filter(r => r.src).slice(0, MAX);
}
const all = () => db().getSetting("works_gallery", {});
function forWork(id) { return clean(all()[id]); }
function setWork(id, rows) { const a = all(); const c = clean(rows); if (c.length) a[id] = c; else delete a[id]; db().setSetting("works_gallery", a); }
function removeWork(id) { const a = all(); if (a[id]) { delete a[id]; db().setSetting("works_gallery", a); } }
// Aggiunge `gallery` a ogni lavoro di un oggetto contenuto (getContent)
function decorate(content) {
  if (content && Array.isArray(content.works)) { const a = all(); content.works = content.works.map(w => ({ ...w, gallery: clean(a[w.id]) })); }
  return content;
}

module.exports = { MAX, clean, forWork, setWork, removeWork, decorate };
