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
    use_images: ["/media/usi/content-system-1.jpg", "/media/usi/content-system-2.jpg", "/media/usi/content-system-3.jpg", "/media/usi/content-system-4.jpg", "/media/usi/content-system-5.jpg"],
    tech: ["CGI / 3D fotorealistico", "Motion design", "Reels · TikTok · Shorts 9:16", "Feed 1:1 · 4:5", "YouTube · CTV 16:9", "Display · banner HTML5", "Asset modulari", "Giochi"]
  },
  "activation-system": {
    short: "Attivazioni che fanno partecipare le persone: schermi che reagiscono a chi passa, vetrine e totem che cambiano con meteo, orario e pubblico, eventi e installazioni pensati per fermarsi, giocare, condividere.",
    body: "Un'attivazione riesce quando le persone fanno qualcosa: si fermano, interagiscono, fotografano, tornano. Progettiamo campagne per l'engagement, non per la sola visibilità: contenuti che reagiscono al contesto (meteo, orario, luogo, stock, chi c'è davanti), meccaniche di partecipazione, momenti da condividere. Dal DOOH ai punti vendita, dagli eventi ai dealer, con formati e specifiche di ogni circuito già risolti in fase di progetto, e una vita curata nel tempo: release progressive, refresh programmati, varianti che imparano dai dati.",
    tags: ["engagement", "DOOH / FOOH", "retail", "programmatic", "eventi", "interattività"],
    uses: [
      "Campagne DOOH su circuiti urbani, stazioni, aeroporti e centri commerciali: LED wall, totem verticali, pensiline, maxi-schermi",
      "Programmatic DOOH: creatività che cambia con meteo, orario, traffico o dati di vendita",
      "Schermi e vetrine interattive: contenuti che reagiscono al passaggio, al gesto, alla voce; giochi e photo-op da condividere",
      "FOOH (fake out-of-home): CGI ambientata in città reali, pensata per far parlare i social",
      "Retail: vetrine digitali, totem, videowall in store, shelf screen e retail media",
      "Eventi, fiere e dealer: LED wall di palco e stand, attivazioni dal vivo e contenuti aggiornati nel tempo"
    ],
    use_images: ["/media/usi/activation-system-1.jpg", "/media/usi/activation-system-2.jpg", "/media/usi/activation-system-3.jpg", "/media/usi/activation-system-4.jpg", "/media/usi/activation-system-5.jpg", "/media/usi/activation-system-6.jpg"],
    tech: ["DOOH · LED urbani", "Totem 9:16 · pensiline", "Maxi-schermi 32:9 · 16:9", "Programmatic DOOH · DCO", "Interattività · sensori e camere", "FOOH", "Vetrine e videowall retail", "LED wall eventi e palchi"]
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
    use_images: ["/media/usi/spatial-experiences-1.jpg", "/media/usi/spatial-experiences-2.jpg", "/media/usi/spatial-experiences-3.jpg", "/media/usi/spatial-experiences-4.jpg", "/media/usi/spatial-experiences-5.jpg", "/media/usi/spatial-experiences-6.jpg"],
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
    use_images: ["/media/usi/adaptive-media-1.jpg", "/media/usi/adaptive-media-2.jpg", "/media/usi/adaptive-media-3.jpg", "/media/usi/adaptive-media-4.jpg", "/media/usi/adaptive-media-5.jpg", "/media/usi/adaptive-media-6.jpg"],
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
// i casi d'uso hanno, facoltativamente, un'immagine ciascuno (use_images, allineato per indice a uses): con le immagini
// la scheda dell'area e la versione breve li mostrano come card a carosello (visual + didascalia), senza restano un elenco puntato
const images = (imgs, n) => { const a = Array.isArray(imgs) ? imgs : (imgs && typeof imgs === "object") ? Object.keys(imgs).sort((x, y) => +x - +y).map(k => imgs[k]) : []; return Array.from({ length: n }, (_, i) => String(a[i] || "").trim()); };
// dal backoffice: uses può arrivare come elenco di righe (uses[0], uses[1]…) con use_images allineato, oppure come testo (una voce per riga)
const rows = (uses, imgs) => {
  const u = (uses && typeof uses === "object" && !Array.isArray(uses)) ? Object.keys(uses).sort((x, y) => +x - +y).map(k => uses[k]) : uses;
  const texts = Array.isArray(u) ? u.map(x => String(x || "").trim()) : list(u);
  const im = images(imgs, texts.length);
  const out = { uses: [], use_images: [] };
  texts.forEach((t, i) => { if (t) { out.uses.push(t); out.use_images.push(im[i] || ""); } });
  out.uses = out.uses.slice(0, 12); out.use_images = out.use_images.slice(0, 12);
  if (!out.use_images.some(Boolean)) out.use_images = [];
  return out;
};
function forCap(id) { const c = all()[id] || {}; const uses = Array.isArray(c.uses) ? c.uses : []; return { uses, tech: Array.isArray(c.tech) ? c.tech : [], use_images: Array.isArray(c.use_images) && c.use_images.some(Boolean) ? images(c.use_images, uses.length) : [] }; }
function setCap(id, { uses, tech, use_images }) { const a = all(); const r = rows(uses, use_images); a[id] = { uses: r.uses, tech: list(tech), use_images: r.use_images }; db().setSetting("caps_concrete", a); }
function removeCap(id) { const a = all(); if (a[id]) { delete a[id]; db().setSetting("caps_concrete", a); } }

// Aggiunge uses/tech alle aree di un oggetto contenuto (getContent) e il testo "in pratica" al sito
function decorate(content) {
  if (!content) return content;
  const a = all();
  if (Array.isArray(content.caps)) content.caps = content.caps.map(c => ({ ...c, ...forCap(c.id) }));
  if (content.site && !content.site.hero_concrete) content.site = { ...content.site, hero_concrete: SITE.hero_concrete };
  content.menu = require("./menu").get(); // le voci del menu (desktop e mobile), per la traduzione e il sito
  return require("./gallery").decorate(content); // e la galleria (foto/video) di ogni lavoro, anche lei in un setting
}
// Per l'anteprima statica (senza database): applica i default al contenuto del seed
function applyDefaults(content) {
  content.caps = (content.caps || []).map(c => CAPS[c.id] ? { ...c, ...CAPS[c.id] } : { ...c, uses: c.uses || [], tech: c.tech || [], use_images: c.use_images || [] });
  content.site = { ...content.site, hero_concrete: content.site.hero_concrete || SITE.hero_concrete, tech: SITE.tech };
  content.works = (content.works || []).map(w => ({ ...w, gallery: w.gallery || [] }));
  content.menu = require("./menu").defaultsAll();
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
// v2: Activation System riscritta intorno all'engagement; si applica solo se i testi sono ancora quelli della v1 (non modificati dal backoffice)
const V1 = { "activation-system": { short: "Rollout di campagne su DOOH, retail, eventi e piattaforme: dagli schermi LED urbani ai totem in store, con refresh programmati e varianti per luogo, orario e pubblico.", uses0: "Campagne DOOH su circuiti urbani, stazioni, aeroporti e centri commerciali: LED wall, totem verticali, pensiline, maxi-schermi", usesN: 5 } };
function migrateV2() {
  if (db().getSetting("concrete_v2", false)) return false;
  Object.entries(V1).forEach(([id, v]) => {
    const d = CAPS[id]; const cap = db().getCap(id);
    if (cap && cap.short === v.short) db().upsertCap({ ...cap, short: d.short, body: d.body, tags: d.tags });
    const cur = forCap(id); if (cur.uses.length === v.usesN && cur.uses[0] === v.uses0) setCap(id, { uses: d.uses, tech: d.tech });
  });
  db().setSetting("concrete_v2", true);
  return true;
}

// v3 (visual dei casi d'uso): alle aree senza immagini si assegnano quelle standard, nell'ordine dell'elenco (dal backoffice si cambiano riga per riga)
function migrateUsi() {
  if (db().getSetting("usi_v1", false)) return false;
  const a = all();
  Object.entries(CAPS).forEach(([id, d]) => {
    const c = a[id]; if (!c || !Array.isArray(c.uses) || !c.uses.length) return;
    if (Array.isArray(c.use_images) && c.use_images.some(Boolean)) return;
    a[id] = { ...c, use_images: images(d.use_images, c.uses.length) };
  });
  db().setSetting("caps_concrete", a); db().setSetting("usi_v1", true);
  return true;
}

module.exports = { CAPS, SITE, forCap, setCap, removeCap, decorate, applyDefaults, migrate, migrateV2, migrateUsi, list };
