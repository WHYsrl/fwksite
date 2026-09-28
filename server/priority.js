// Priorità dei contenuti (1, 2, 3): decide quali elementi si vedono in base al tempo scelto dal visitatore.
//   1 = sempre · 2 = da 10 minuti in su · 3 = solo con tutto il tempo
// Le priorità dei lavori stanno nel setting "priority" ({ works: { id: n } }, così non si tocca lo schema del database);
// quelle dei reel stanno dentro il reel stesso (setting "reels", campo priority). Sul sito: attributo data-prio sugli
// elementi, nascosti via CSS in base a html[data-density]; su mobile anche in fase di composizione delle file.
const store = require("./db");

const LEVELS = [{ n: 1, label: "1 · sempre" }, { n: 2, label: "2 · da 10 minuti" }, { n: 3, label: "3 · solo con tutto il tempo" }];
const norm = (n) => { const x = parseInt(n, 10); return x >= 1 && x <= 3 ? x : 1; };
const all = () => store.getSetting("priority", {}) || {};

function forWork(id) { const a = all(); return norm(a.works && a.works[id]); }
function setWork(id, n) { const a = all(); a.works = { ...(a.works || {}), [id]: norm(n) }; if (a.works[id] === 1) delete a.works[id]; store.setSetting("priority", a); }
function removeWork(id) { const a = all(); if (a.works && a.works[id] != null) { delete a.works[id]; store.setSetting("priority", a); } }
// Aggiunge priority ai lavori (e normalizza quella dei reel) di un oggetto contenuto
function decorate(content) {
  if (!content) return content;
  const a = all(); const w = a.works || {};
  if (Array.isArray(content.works)) content.works = content.works.map(x => ({ ...x, priority: norm(w[x.id]) }));
  if (Array.isArray(content.reels)) content.reels = content.reels.map(r => ({ ...r, priority: norm(r.priority) }));
  return content;
}
// Il livello massimo visibile per una densità
const maxFor = (density) => ({ "2": 1, "10": 2, all: 3 }[String(density)] || 3);

module.exports = { LEVELS, norm, forWork, setWork, removeWork, decorate, maxFor };
