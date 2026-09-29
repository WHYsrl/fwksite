// Menu: le voci della barra in alto (desktop) e della barra in basso (mobile), gestite dal backoffice (/admin/menu).
// Ogni voce: { id, target, label, on, cta, blank, url, icon }
//   target  = dove porta: una sezione del sito (desktop) o una schermata/blocco dell'app (mobile); oppure "url" (link esterno),
//             "modes" (bottone Modalità, solo desktop), "lang" (cambio lingua IT/EN, solo desktop)
//   label   = testo della voce; vuoto = quello standard della destinazione (tradotto dal dizionario; i testi scritti si traducono con l'AI)
//   on      = attiva; cta = bottone viola pieno (desktop); blank = link in una nuova scheda (url); icon = icona (mobile)
// Vive nel setting "menu" ({ desktop: [...], mobile: [...] }); senza setting valgono le voci standard, cioè il menu che il sito ha sempre avuto.
const store = () => require("./db");

// Destinazioni desktop: gli id delle sezioni della pagina (views/index.ejs) — l'ancora è href="#id"
const DESKTOP_TARGETS = [
  { id: "console", label: "Inizio pagina (hero / Console)", std: "Inizio" },
  { id: "reel", label: "Reel", std: "Reel" },
  { id: "aree", label: "Servizi (aree)", std: "Aree", areas: true },
  { id: "sistema", label: "Il contesto", std: "Sistema" },
  { id: "lavori", label: "Lavori", std: "Lavori" },
  { id: "organismo", label: "L'organismo", std: "Organismo" },
  { id: "metodo", label: "Metodo", std: "Metodo" },
  { id: "team", label: "Team", std: "Team" },
  { id: "tecnologie", label: "Tecnologie", std: "Tecnologie" },
  { id: "radar", label: "Radar", std: "Radar" },
  { id: "contesto", label: "Narrowcasting (la pagina composta per te)", std: "Narrowcasting" },
  { id: "triade", label: "Triade", std: "Triade" },
  { id: "contatti", label: "Contatti", std: "Contatti" },
  { id: "modes", label: "Bottone Modalità (tempo, mood, meteo, lingua)", std: "Modalità", special: true },
  { id: "lang", label: "Cambio lingua (IT / EN)", std: "", special: true },
  { id: "url", label: "Link esterno (URL)", std: "Link", special: true }
];
// Destinazioni mobile: le schermate dell'app, la Console, la scheda contatti e i blocchi dentro le schermate (kind → cosa fa il tocco)
const MOBILE_TARGETS = [
  { id: "home", label: "Home (schermata)", std: "Home", kind: "screen", icon: "home" },
  { id: "sistema", label: "Sistema (schermata)", std: "Sistema", kind: "screen", icon: "sistema" },
  { id: "lavori", label: "Lavori (schermata)", std: "Lavori", kind: "screen", icon: "lavori" },
  { id: "radar", label: "Radar (schermata)", std: "Radar", kind: "screen", icon: "radar" },
  { id: "console", label: "Console (AI) — si vede solo con l'AI attiva", std: "Console", kind: "console", icon: "console" },
  { id: "contatti", label: "Contatti (scheda)", std: "Contatti", kind: "contatti", icon: "contatti" },
  { id: "reel", label: "Reel · in Home", std: "Reel", kind: "section", icon: "reel" },
  { id: "aree", label: "Servizi · elenco in Sistema", std: "Aree", kind: "section", icon: "aree", areas: true },
  { id: "contesto", label: "Il contesto · in Sistema", std: "Contesto", kind: "section", icon: "contesto" },
  { id: "organismo", label: "L'organismo · in Sistema", std: "Organismo", kind: "section", icon: "organismo" },
  { id: "metodo", label: "Metodo · in Sistema", std: "Metodo", kind: "section", icon: "metodo" },
  { id: "team", label: "Team · in Sistema", std: "Team", kind: "section", icon: "team" },
  { id: "tecnologie", label: "Tecnologie · in Sistema", std: "Tecnologie", kind: "section", icon: "tech" },
  { id: "triade", label: "Triade · in Sistema", std: "Triade", kind: "section", icon: "triade" },
  { id: "url", label: "Link esterno (URL)", std: "Link", kind: "url", icon: "link", special: true }
];
const ICONS = ["home", "sistema", "console", "lavori", "radar", "contatti", "reel", "aree", "contesto", "organismo", "metodo", "team", "tech", "triade", "link", "star", "info"];
const DEFAULTS = {
  desktop: [
    { id: "aree", target: "aree" }, { id: "sistema", target: "sistema" }, { id: "lavori", target: "lavori" }, { id: "metodo", target: "metodo" },
    { id: "team", target: "team" }, { id: "radar", target: "radar" }, { id: "modes", target: "modes" }, { id: "lang", target: "lang" },
    { id: "parliamone", target: "contatti", label: "Parliamone", cta: true }
  ],
  mobile: [{ id: "home", target: "home" }, { id: "sistema", target: "sistema" }, { id: "console", target: "console" }, { id: "lavori", target: "lavori" }, { id: "radar", target: "radar" }]
};
const GROUPS = [
  { key: "desktop", title: "Desktop · barra in alto", note: "Le voci da sinistra a destra, dopo il logo. Il bottone Modalità e il cambio lingua sono voci come le altre: si possono spostare o spegnere.", targets: DESKTOP_TARGETS },
  { key: "mobile", title: "Mobile · barra in basso", note: "I tab da sinistra a destra. Con 4-5 voci si legge bene; la Console compare solo se l'AI è attiva. Ogni voce ha un'icona.", targets: MOBILE_TARGETS }
];

const slug = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
const str = (v) => String(v == null ? "" : v).trim();
const tgt = (key, id) => (key === "desktop" ? DESKTOP_TARGETS : MOBILE_TARGETS).find(x => x.id === id) || null;

// Una voce pulita: destinazione valida, id univoco, campi al posto giusto
function clean(key, raw, used) {
  const r = raw || {}; const t = tgt(key, str(r.target)); if (!t) return null;
  let id = slug(r.id) || slug(r.label) || t.id; let n = 1; const base = id; while (used.has(id)) id = base + "-" + (++n); used.add(id);
  const it = { id, target: t.id, label: str(r.label).slice(0, 40), on: r.on === true || r.on === "1" || r.on === "on" };
  if (key === "desktop") { it.cta = r.cta === true || r.cta === "1" || r.cta === "on"; }
  if (t.id === "url") { it.url = str(r.url).slice(0, 500); it.blank = r.blank === true || r.blank === "1" || r.blank === "on"; }
  if (key === "mobile") { it.icon = ICONS.includes(str(r.icon)) ? str(r.icon) : t.icon; }
  return it;
}
const defaults = (key) => { const used = new Set(); return DEFAULTS[key].map(d => clean(key, { ...d, on: true }, used)); };
const defaultsAll = () => ({ desktop: defaults("desktop"), mobile: defaults("mobile") }); // senza database (anteprima statica)
function get() {
  const saved = store().getSetting("menu", null);
  const out = {};
  GROUPS.forEach(g => { const list = saved && Array.isArray(saved[g.key]) ? saved[g.key] : null; const used = new Set(); out[g.key] = list ? list.map(r => clean(g.key, r, used)).filter(Boolean) : defaults(g.key); });
  return out;
}
// Il form del backoffice: desktop[i][...] e mobile[i][...] (l'ordine delle righe è l'ordine sul sito)
function parse(body) {
  const b = body || {}; const out = {};
  GROUPS.forEach(g => { const rows = b[g.key]; const list = Array.isArray(rows) ? rows : (rows && typeof rows === "object") ? Object.keys(rows).sort((a, c) => +a - +c).map(k => rows[k]) : []; const used = new Set(); out[g.key] = list.map(r => clean(g.key, r, used)).filter(Boolean).slice(0, 12); });
  return out;
}
function save(body) { store().setSetting("menu", parse(body)); return get(); }
function reset() { store().setSetting("menu", null); return get(); }
function isDefault() { return store().getSetting("menu", null) == null; }
// Prima volta: se dal backoffice erano stati cambiati i testi delle voci (nav_*), passano nel menu così non si perdono
function migrate() {
  if (store().getSetting("menu_v1", false)) return false;
  const site = store().getSetting("site", {}); const std = { sistema: "Sistema", lavori: "Lavori", metodo: "Metodo", team: "Team", radar: "Radar" };
  const custom = Object.keys(std).filter(k => str(site["nav_" + k]) && str(site["nav_" + k]) !== std[k]);
  const cta = str(site.nav_cta);
  if (store().getSetting("menu", null) == null && (custom.length || (cta && cta !== "Parliamone"))) {
    const m = { desktop: DEFAULTS.desktop.map(d => ({ ...d, on: true })), mobile: DEFAULTS.mobile.map(d => ({ ...d, on: true })) };
    m.desktop.forEach(d => { if (custom.includes(d.target)) d.label = str(site["nav_" + d.target]); if (d.cta && cta) d.label = cta; });
    store().setSetting("menu", m);
  }
  store().setSetting("menu_v1", true); return true;
}
// Per il sito: solo le voci attive, con l'etichetta risolta (quella scritta, altrimenti la standard tradotta con T) e il tipo di azione
function forSite(menu, site, T) {
  const tr = (v) => (typeof T === "function" && v) ? T(v) : v; const m = menu || get(); const out = {};
  GROUPS.forEach(g => {
    out[g.key] = (m[g.key] || []).filter(it => it.on).map(it => {
      const t = tgt(g.key, it.target); const std = t.areas ? ((site && site.areas_label) || t.std) : t.std;
      const kind = g.key === "desktop" ? (t.special ? t.id : "section") : t.kind;
      return { id: it.id, kind, target: it.target, label: tr(it.label || std), cta: !!it.cta, url: it.url || "", blank: !!it.blank, icon: it.icon || t.icon || "" };
    });
  });
  return out;
}

module.exports = { DESKTOP_TARGETS, MOBILE_TARGETS, ICONS, GROUPS, DEFAULTS, get, defaultsAll, parse, save, reset, isDefault, migrate, forSite };
