// "In concreto": tecnologie, formati e casi d'uso di ogni area, più i testi concreti del sito.
// Vivono nelle impostazioni (chiave caps_concrete) e si modificano dal backoffice (Aree → Casi d'uso / Tecnologie),
// senza toccare lo schema del database. Al primo avvio i valori di default sostituiscono i testi astratti delle aree.
// il database si carica solo quando serve, così l'anteprima statica (scripts/build-preview.js) può usare i default senza aprirlo
let _store = null; const db = () => _store || (_store = require("./db"));

const CAPS = {
  "content-system": {
    short: "CGI, motion e video per ogni canale: film di prodotto, Reels e TikTok, feed, YouTube, CTV, banner e asset modulari che si declinano in tutti i formati.",
    body: "Il contenuto non è un file finito: è un sistema di componenti, regole e varianti. Produciamo CGI e 3D fotorealistico, motion design, video e contenuti social, giochi e asset modulari. Una volta progettati, si declinano in ogni formato (16:9, 9:16, 1:1, 4:5), lingua e durata, mantenendo coerenza mentre i canali cambiano.",
    tags: ["CGI", "motion", "social content", "video", "giochi", "asset modulari"],
    uses: [
      "Film di prodotto in CGI con varianti per mercato, lingua e stagione",
      "Kit social completi: Reels, TikTok, Shorts e Stories in 9:16, feed 1:1 e 4:5, caroselli",
      "Campagne video per YouTube, CTV e display, declinate in tutte le durate (6\", 15\", 30\")",
      "Librerie di asset 3D riutilizzabili: prodotti, ambienti, packaging, personaggi",
      "Giochi e contenuti interattivi per lanci, engagement e formazione"
    ],
    tech: ["CGI / 3D fotorealistico", "Motion design", "Reels · TikTok · Shorts 9:16", "Feed 1:1 · 4:5", "YouTube · CTV 16:9", "Display · banner HTML5", "Asset modulari", "Giochi"]
  },
  "activation-system": {
    short: "Rollout di campagne su DOOH, retail, eventi e piattaforme: dagli schermi LED urbani ai totem in store, con refresh programmati e varianti per luogo, orario e pubblico.",
    body: "L'attivazione è un processo continuo, non un lancio. Progettiamo ambienti di campagna distribuiti su più touchpoint e ne curiamo la vita nel tempo: release progressive, refresh programmati, adattamenti guidati dai dati (meteo, orario, luogo, stock). Dal DOOH ai punti vendita, dagli eventi ai dealer, con i formati e le specifiche tecniche di ogni circuito già risolti in fase di progetto.",
    tags: ["rollout", "DOOH / FOOH", "retail", "programmatic", "campaign environments", "refresh"],
    uses: [
      "Campagne DOOH su circuiti urbani, stazioni, aeroporti e centri commerciali: LED wall, totem verticali, pensiline, maxi-schermi",
      "Programmatic DOOH: creatività che cambia con meteo, orario, traffico o dati di vendita",
      "FOOH (fake out-of-home): CGI ambientata in città reali, pensata per i social",
      "Retail: vetrine digitali, totem, videowall in store, shelf screen e retail media",
      "Eventi, fiere e dealer: contenuti per LED wall di palco e stand, aggiornati nel tempo"
    ],
    tech: ["DOOH · LED urbani", "Totem 9:16 · pensiline", "Maxi-schermi 32:9 · 16:9", "Programmatic DOOH · DCO", "FOOH", "Vetrine e videowall retail", "Retail media", "LED wall eventi e palchi"]
  },
  "spatial-experiences": {
    short: "Esperienze che escono dallo schermo: visori Apple Vision Pro, Meta Quest 3 e Quest Pro, Varjo; proiezioni immersive e interattive; LED wall, pavimenti interattivi e installazioni sensoriali.",
    body: "Il contenuto entra nello spazio. Progettiamo e produciamo esperienze in realtà estesa e ambienti immersivi per musei, fiere, retail, eventi e showroom: contenuti nativi per Apple Vision Pro, Meta Quest 3 e Quest Pro, Varjo XR-4; proiezioni a 360° con proiettori laser e projection mapping; pavimenti interattivi e a specchio, LED wall e LED floor, installazioni che reagiscono al movimento e alla presenza; digital twin di spazi e prodotti. Il visitatore entra nel racconto e ne diventa parte.",
    tags: ["XR", "immersive", "installazioni", "proiezioni", "LED wall", "phygital", "digital twin"],
    uses: [
      "Esperienze XR per visori: Apple Vision Pro, Meta Quest 3 e Quest Pro, Varjo XR-4, Pico",
      "Sale immersive: proiezioni laser a 360°, projection mapping su architetture e oggetti",
      "Installazioni interattive: pavimenti sensibili e a specchio, tracking del corpo, sensori e telecamere di profondità",
      "LED wall e LED floor per showroom, stand, retail e palchi, anche con effetti anamorfici 3D",
      "Digital twin di spazi, prodotti e impianti per showroom virtuali, configuratori e formazione",
      "Musei e mostre: percorsi phygital con realtà aumentata su smartphone e tablet"
    ],
    tech: ["Apple Vision Pro", "Meta Quest 3 · Quest Pro", "Varjo XR-4", "Proiettori laser · projection mapping", "Pavimenti interattivi e a specchio", "LED wall · LED floor", "AR su smartphone e tablet", "Digital twin", "Unreal Engine · Unity · TouchDesigner"]
  },
  "adaptive-media": {
    short: "Sistemi di produzione con AI: video e immagini generative, avatar e voci sintetiche, doppiaggio in tutte le lingue, centinaia di varianti di un asset per pubblici e contesti diversi.",
    body: "Flussi di lavoro potenziati dall'intelligenza artificiale, sempre con direzione creativa e supervisione umana: generazione di immagini e video, avatar e presentatori digitali, voci sintetiche e doppiaggio multilingua con lip-sync, prototipi rapidi e previsualizzazione, sistemi di variazione che producono centinaia di versioni di un asset per pubblico, lingua, formato e contesto. Special projects quando la tecnologia va inventata.",
    tags: ["AI workflows", "generative", "avatar", "voci sintetiche", "variation systems", "special projects"],
    uses: [
      "Variation systems: da un master a centinaia di versioni per lingua, mercato, formato e stagione",
      "Avatar e presentatori digitali per formazione, retail, eventi e customer care",
      "Doppiaggio e localizzazione video con voci sintetiche e lip-sync in decine di lingue",
      "Previsualizzazione e prototipi rapidi di campagne e ambienti prima della produzione",
      "Creatività dinamica (DCO) per programmatic e social, con asset generati al volo",
      "Special projects: assistenti vocali, esperienze conversazionali, generazione in tempo reale"
    ],
    tech: ["Video e immagini generative", "Avatar digitali", "Voci sintetiche · lip-sync", "Localizzazione multilingua", "Variation systems", "DCO · creatività dinamica", "LLM e agenti", "Previsual con AI"]
  }
};

const SITE = {
  hero_concrete: "CGI e video per TV, social e DOOH in tutti i formati; esperienze immersive su visori, LED wall e proiezioni; sistemi di produzione con AI che moltiplicano le varianti.",
  tech: [
    { k: "AI", text: "generazione di immagini, video, voci e testi; sistemi di variazione, previsualizzazione, doppiaggio multilingua e automazione della produzione." },
    { k: "CGI e 3D", text: "modellazione, animazione e render fotorealistico di prodotti, ambienti e personaggi; virtual production e contenuti anamorfici per LED wall." },
    { k: "Real-time", text: "Unreal Engine, Unity, TouchDesigner e Notch per ambienti interattivi, installazioni, LED wall, configuratori e avatar dinamici." },
    { k: "XR", text: "Apple Vision Pro, Meta Quest 3 e Quest Pro, Varjo XR-4; realtà aumentata su smartphone e tablet; proiezioni e ambienti immersivi." }
  ]
};

// una voce per riga (dal backoffice) oppure un array
const list = (v) => (Array.isArray(v) ? v : String(v || "").split(/\r?\n/)).map(s => String(s).trim()).filter(Boolean).slice(0, 12);

const all = () => db().getSetting("caps_concrete", {});
function forCap(id) { const c = all()[id] || {}; return { uses: Array.isArray(c.uses) ? c.uses : [], tech: Array.isArray(c.tech) ? c.tech : [] }; }
function setCap(id, { uses, tech }) { const a = all(); a[id] = { uses: list(uses), tech: list(tech) }; db().setSetting("caps_concrete", a); }
function removeCap(id) { const a = all(); if (a[id]) { delete a[id]; db().setSetting("caps_concrete", a); } }

// Aggiunge uses/tech alle aree di un oggetto contenuto (getContent) e il testo "in pratica" al sito
function decorate(content) {
  if (!content) return content;
  const a = all();
  if (Array.isArray(content.caps)) content.caps = content.caps.map(c => ({ ...c, uses: (a[c.id] && a[c.id].uses) || [], tech: (a[c.id] && a[c.id].tech) || [] }));
  if (content.site && !content.site.hero_concrete) content.site = { ...content.site, hero_concrete: SITE.hero_concrete };
  return content;
}
// Per l'anteprima statica (senza database): applica i default al contenuto del seed
function applyDefaults(content) {
  content.caps = (content.caps || []).map(c => CAPS[c.id] ? { ...c, ...CAPS[c.id] } : { ...c, uses: c.uses || [], tech: c.tech || [] });
  content.site = { ...content.site, hero_concrete: content.site.hero_concrete || SITE.hero_concrete, tech: SITE.tech };
  return content;
}
// Una volta sola: testi concreti al posto di quelli astratti, tecnologie e casi d'uso di default, riga "in pratica"
function migrate() {
  if (db().getSetting("concrete_v1", false)) return false;
  Object.entries(CAPS).forEach(([id, d]) => {
    const cap = db().getCap(id);
    if (cap) db().upsertCap({ ...cap, short: d.short, body: d.body, tags: d.tags });
    if (!forCap(id).uses.length) setCap(id, { uses: d.uses, tech: d.tech });
  });
  const site = db().getSetting("site", {});
  db().setSetting("site", { ...site, hero_concrete: site.hero_concrete || SITE.hero_concrete, tech: SITE.tech });
  db().setSetting("concrete_v1", true);
  return true;
}

module.exports = { CAPS, SITE, forCap, setCap, removeCap, decorate, applyDefaults, migrate, list };
