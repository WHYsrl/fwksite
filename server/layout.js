// Fruizione: cosa si vede, in che ordine e in che forma, in base al tempo scelto dal visitatore (2 minuti · 10 minuti · tutto il tempo).
// Il registro qui sotto elenca le sezioni del desktop e i blocchi delle schermate mobile (Home e Sistema) con i valori standard,
// cioè il comportamento che il sito ha sempre avuto. Dal backoffice (/admin/fruizione) si cambiano ordine e stato di ogni riga:
//   off   = nascosta
//   brief = versione breve (solo dove esiste: `brief: true`; il testo breve si scrive in Contenuti)
//   full  = completa
// Il tutto sta nel setting "layout": { desktop: [{ id, v: [s2, s10, sAll] }], home: [...], sistema: [...] } (l'ordine degli array è l'ordine sul sito).
const store = () => require("./db"); // caricato al bisogno: così il registro si può usare anche senza database (anteprima statica)

const STATES = ["off", "brief", "full"];
const F = (a, b, c) => [a, b, c];
const DESKTOP = [
  { id: "console", label: "Hero / Console", what: "mappa a nodi, titolo e manifesto, campo Console, striscia Radar", fixed: "first", def: F("full", "full", "full") },
  { id: "reel", label: "Reel", what: "carosello dei reel tematici", def: F("off", "full", "full") },
  { id: "aree", label: "Servizi (aree)", what: "le 4 card · breve: un blocco unico con le 4 aree (sintesi, esempi, tecnologie), senza rimandi alle schede", brief: true, def: F("brief", "full", "full") },
  { id: "sistema", label: "Il contesto", what: "testo + campo dati particellare · breve: solo il testo breve", brief: true, def: F("off", "full", "full") },
  { id: "lavori", label: "Lavori", what: "griglia dei lavori (filtrata dalle priorità)", def: F("full", "full", "full") },
  { id: "organismo", label: "L'organismo", what: "organismo interattivo · breve: solo il testo breve", brief: true, def: F("off", "full", "full") },
  { id: "metodo", label: "Metodo", what: "5 fasi + diagramma · breve: solo il testo breve", brief: true, def: F("off", "full", "full") },
  { id: "team", label: "Team", what: "persone chiave e organico · breve: solo il testo breve", brief: true, def: F("off", "full", "full") },
  { id: "tech", label: "Tecnologie", what: "le 4 tecnologie · breve: solo il testo breve", brief: true, def: F("off", "off", "full") },
  { id: "radar", label: "Radar", what: "ricerca dal vivo + segnali · breve: solo il testo breve", brief: true, def: F("off", "full", "full") },
  { id: "narrow", label: "Narrowcasting", what: "la pagina composta per te", def: F("off", "full", "full") },
  { id: "triad", label: "Triade", what: "Firmitas · Utilitas · Venustas", def: F("off", "off", "full") },
  { id: "closing", label: "Chiusura", what: "parole grandi che scorrono", def: F("off", "full", "full") },
  { id: "contatti", label: "Contatti + footer", what: "", fixed: "last", def: F("full", "full", "full") }
];
const HOME = [
  { id: "cover", label: "Card in cima (hero)", what: "saluto, titolo, manifesto, stato On Air", fixed: "first", def: F("full", "full", "full") },
  { id: "reels", label: "Fila dei Reel", what: "", def: F("full", "full", "full") },
  { id: "ask", label: "Bottone Console + esempi", what: "solo se l'AI è configurata", def: F("full", "full", "full") },
  { id: "aree", label: "Carosello Servizi", what: "breve: elenco compatto delle 4 aree (sintesi, esempi, tecnologie), senza schede", brief: true, def: F("brief", "full", "full") },
  { id: "lavori", label: "Fila Lavori", what: "i primi 6 lavori (filtrati dalle priorità)", def: F("off", "full", "full") },
  { id: "radar", label: "Radar oggi", what: "3 segnali; dentro un percorso della Console compare comunque", def: F("off", "full", "full") },
  { id: "metodo", label: "Metodo", what: "5 fasi · breve: solo il testo breve", brief: true, def: F("off", "full", "full") },
  { id: "contact", label: "Contatti", what: "", fixed: "last", def: F("full", "full", "full") }
];
const SISTEMA = [
  { id: "quote", label: "Blocco viola (frase di apertura)", what: "il testo si cambia in Contenuti → L'organismo → Solo mobile", def: F("full", "full", "full") },
  { id: "organism", label: "Organismo · titolo e testo", what: "breve: il testo breve", brief: true, def: F("full", "full", "full") },
  { id: "contesto", label: "Il contesto", what: "campo dati + testo · breve: solo il testo breve", brief: true, def: F("full", "full", "full") },
  { id: "canvas", label: "L'organismo (interattivo)", what: "", def: F("off", "full", "full") },
  { id: "aree", label: "Elenco delle aree", what: "breve: elenco compatto, senza schede", brief: true, def: F("full", "full", "full") },
  { id: "team", label: "Team", what: "breve: solo il testo breve", brief: true, def: F("off", "full", "full") },
  { id: "tech", label: "Tecnologie", what: "breve: solo il testo breve", brief: true, def: F("off", "full", "full") },
  { id: "metodo", label: "Metodo", what: "breve: solo il testo breve", brief: true, def: F("off", "full", "full") },
  { id: "triad", label: "Triade", what: "", def: F("off", "full", "full") },
  { id: "contact", label: "Contatti", what: "", fixed: "last", def: F("full", "full", "full") }
];
const GROUPS = [
  { key: "desktop", title: "Desktop", note: "Le sezioni della pagina, dall'alto in basso.", reg: DESKTOP },
  { key: "home", title: "Mobile · Home", note: "I blocchi della schermata Home, dall'alto in basso.", reg: HOME },
  { key: "sistema", title: "Mobile · Sistema", note: "I blocchi della schermata Sistema.", reg: SISTEMA }
];
const DENS = ["2", "10", "all"];

// Una lista ordinata e completa: parte da quella salvata, scarta gli id sconosciuti, aggiunge i mancanti, rimette a posto
// i fissi (primo/ultimo) e valida gli stati (breve solo dove esiste).
function merge(reg, saved) {
  const byId = new Map(reg.map(r => [r.id, r]));
  const seen = new Set(); const out = [];
  (Array.isArray(saved) ? saved : []).forEach(s => {
    const r = s && byId.get(s.id); if (!r || seen.has(r.id)) return; seen.add(r.id);
    const v = Array.isArray(s.v) ? s.v : [];
    out.push({ ...r, v: r.def.map((d, i) => { const x = STATES.includes(v[i]) ? v[i] : d; return x === "brief" && !r.brief ? "full" : x; }) });
  });
  reg.forEach(r => { if (!seen.has(r.id)) out.push({ ...r, v: r.def.slice() }); });
  const firsts = out.filter(r => r.fixed === "first"), lasts = out.filter(r => r.fixed === "last"), mid = out.filter(r => !r.fixed);
  return [...firsts, ...mid, ...lasts].map(r => ({ id: r.id, label: r.label, what: r.what || "", brief: !!r.brief, fixed: r.fixed || "", def: r.def, v: r.v, custom: r.v.some((x, i) => x !== r.def[i]) }));
}
function get() {
  const saved = store().getSetting("layout", null) || {};
  const out = {};
  GROUPS.forEach(g => { out[g.key] = merge(g.reg, saved[g.key]); });
  return out;
}
// Versione leggera per il sito: { desktop: [{ id, v: { "2": "full", "10": "full", all: "full" } }], home: [...], sistema: [...] }
function forSite(defaultsOnly) {
  const l = defaultsOnly ? Object.fromEntries(GROUPS.map(g => [g.key, merge(g.reg, null)])) : get(); const out = {};
  GROUPS.forEach(g => { out[g.key] = l[g.key].map(r => ({ id: r.id, v: { "2": r.v[0], "10": r.v[1], all: r.v[2] } })); });
  return out;
}
// Il form del backoffice: per ogni gruppo un campo <key>_order (id separati da virgola) e, per ogni riga, <key>[<id>][0..2]
function parse(body) {
  const b = body || {}; const out = {};
  GROUPS.forEach(g => {
    const order = String(b[g.key + "_order"] || "").split(",").map(x => x.trim()).filter(Boolean);
    const rows = (b[g.key] && typeof b[g.key] === "object") ? b[g.key] : {};
    const ids = order.length ? order : g.reg.map(r => r.id);
    out[g.key] = ids.map(id => { const r = rows[id] || {}; return { id, v: DENS.map((d, i) => String(r[String(i)] || r[d] || "")) }; });
  });
  return out;
}
function save(body) { const parsed = parse(body); store().setSetting("layout", parsed); return get(); }
function reset() { store().setSetting("layout", {}); return get(); }
function isDefault() { const l = get(); return GROUPS.every(g => { const cur = l[g.key]; return !cur.some(r => r.custom) && cur.map(r => r.id).join() === merge(g.reg, null).map(r => r.id).join(); }); }

module.exports = { STATES, DENS, GROUPS, DESKTOP, HOME, SISTEMA, get, forSite, parse, save, reset, isDefault };
