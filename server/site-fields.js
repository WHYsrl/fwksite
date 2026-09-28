// Testi del sito: lo schema dei campi modificabili dal backoffice (pagina Contenuti), sezione per sezione, nell'ordine
// in cui le sezioni compaiono sul sito. Ogni campo ha un'etichetta, una spiegazione e il testo standard (default): un campo
// lasciato vuoto nel backoffice mostra il testo standard, che in inglese arriva dal dizionario dell'interfaccia (public/js/i18n.js);
// un testo scritto dal backoffice, invece, lo traduce l'AI (server/i18n.js). Lo usano il server (index.ejs, /api/content)
// e il backoffice (rotte /admin/contenuti).
//
// Tipi di campo: text · textarea · lines (una voce per riga → array) · pairs (righe con più colonne → array di oggetti)
// · image (URL + scelta dai media) · check. `em: true` → nel testo si può usare <em>parola</em> per il corsivo serif viola.
// `vars` → segnaposto che il sito sostituisce ({n}, {btn}…). `cols[].i18n === false` → colonna non tradotta (latino, nomi propri).
// `fixed: true` (pairs) → posti fissi: ogni cella vuota prende quella standard; altrimenti le righe compilate sostituiscono l'elenco standard.
// `from: "altro_campo"` → se vuoto, il campo vale quanto l'altro (le etichette mobile seguono quelle desktop). `group` con `hint` → titolo di gruppo con spiegazione.

const SECTIONS = [
  {
    id: "menu", nav: "Menu e barra", title: "Menu e barra in alto", where: "Desktop: la barra fissa in alto con le voci di menu e il bottone viola. Su mobile la barra mostra solo il logo, Modalità e il bottone.",
    fields: [
      { key: "nav_sistema", label: "Voce di menu · Sistema", hint: "Porta alla sezione Il contesto.", def: "Sistema" },
      { key: "nav_lavori", label: "Voce di menu · Lavori", def: "Lavori" },
      { key: "nav_metodo", label: "Voce di menu · Metodo", def: "Metodo" },
      { key: "nav_team", label: "Voce di menu · Team", def: "Team" },
      { key: "nav_radar", label: "Voce di menu · Radar", def: "Radar" },
      { key: "nav_cta", label: "Bottone viola (porta ai contatti)", def: "Parliamone" },
      { key: "brand", label: "Nome del brand", hint: "Usato nei titoli della pagina e nei testi dell'AI, non nel logo (che è un'immagine).", i18n: false, def: "Frameworks" }
    ]
  },
  {
    id: "intro", nav: "Domande iniziali", title: "Domande iniziali", where: "La schermata che compare una volta per sessione, prima del sito: due domande (tempo e mood). Con «2 minuti» si entra subito, senza scegliere il mood.",
    fields: [
      { key: "intro_eyebrow", label: "Etichetta sopra le domande", hint: "Seguita da «1 di 2» / «2 di 2».", def: "Prima di cominciare" },
      { key: "intro_time_title", label: "Prima domanda (il tempo)", def: "Quanto tempo hai?" },
      { key: "intro_time", label: "Risposte sul tempo", hint: "Tre risposte, nell'ordine: 2 minuti (essenziale), 10 minuti, tutto il tempo. Il titolo è la scelta, il testo la riga sotto.", type: "pairs", cols: [{ k: "k", label: "Titolo" }, { k: "text", label: "Riga sotto" }], count: 3, fixed: true,
        def: [{ k: "2 minuti", text: "Fammi capire cosa fate." }, { k: "10 minuti", text: "Come lavorate e cosa avete fatto." }, { k: "Tutto il tempo che serve", text: "Voglio godermi l'esperienza." }] },
      { key: "intro_mood_title", label: "Seconda domanda (il mood)", def: "Che mood preferisci?" },
      { key: "intro_mood", label: "Risposte sul mood", hint: "Quattro risposte, nell'ordine: Chiaro, Acceso, Notturno, Quieto. I colori restano quelli dei temi.", type: "pairs", cols: [{ k: "k", label: "Titolo" }, { k: "text", label: "Riga sotto" }], count: 4, fixed: true,
        def: [{ k: "Chiaro", text: "Fondo chiaro e viola d'inchiostro, tutto in luce." }, { k: "Acceso", text: "Nero e viola, energia e movimento." }, { k: "Notturno", text: "Blu notte e lavanda, ritmo disteso." }, { k: "Quieto", text: "Verde e menta, dritto al punto, senza rumore." }] },
      { key: "intro_hint", label: "Avviso sotto i mood", hint: "{btn} diventa il tasto «Modalità».", vars: ["btn"], def: "Puoi cambiare scelta in qualsiasi momento premendo il tasto {btn} in alto." }
    ]
  },
  {
    id: "hero", nav: "Hero", title: "Hero — l'apertura", where: "Desktop: la prima schermata, con la mappa interattiva e la Console. Mobile: la card in cima alla Home (titolo e testo sono gli stessi).", anchor: "#top",
    fields: [
      { group: "Desktop e mobile" },
      { key: "claim", label: "Etichetta sopra il titolo", def: "Adaptive Content Systems" },
      { key: "hero_title", label: "Titolo", em: true, def: "Contenuti creati per <em>sopravvivere.</em>" },
      { key: "hero_text", label: "Testo (il manifesto)", type: "textarea", rows: 4, hint: "Su mobile è il sottotitolo della card in cima.", def: "" },
      { key: "tagline", label: "Tagline (una riga)", hint: "Non compare sul sito: la usano l'AI e i motori di ricerca come descrizione.", def: "" },
      { key: "hero_concrete", label: "«In pratica» (una riga concreta)", type: "textarea", rows: 2, hint: "Cosa facciamo, con che tecnologie, dove. La legge la Console; sul sito compare nelle schede.", def: "" },
      { group: "Solo desktop · bottoni e Console" },
      { key: "hero_cta", label: "Bottone bianco (porta ai lavori)", def: "Vedi i lavori" },
      { key: "hero_cta2", label: "Bottone secondario (apre il sistema nella mappa)", def: "Apri il sistema" },
      { key: "console_label", label: "Etichetta del campo Console", def: "Chiedi alla Console" },
      { key: "console_placeholder", label: "Suggerimento nel campo Console", def: "es. cosa fate per il retail? · quali visori usate? · come usate l'AI?" },
      { key: "console_hints", label: "Legenda della mappa (una voce per riga)", type: "lines", hint: "Le tre indicazioni in basso a destra della mappa.", def: ["trascina i nodi", "clic per aprire", "punti chiari = radar, fonti esterne"] },
      { key: "ticker_label", label: "Etichetta della striscia Radar", hint: "La striscia viola che scorre sotto la hero con i titoli del Radar.", def: "Radar · fonti esterne" },
      { group: "Solo mobile", hint: "La card in cima alla Home ha lo stesso titolo e testo del desktop; in più il saluto e, sotto, il bottone della Console." },
      { key: "m_greet", label: "Dopo il saluto", hint: "Il sito scrive «Buongiorno.» / «Buonasera.» seguito da questo.", def: "Siamo Frameworks." },
      { key: "m_ask", label: "Bottone della Console in Home", def: "Chiedi alla Console: cosa fate per…" },
      { key: "m_ask_hint", label: "Esempi sotto il bottone", def: "Per esempio: cosa fate per il retail? · quali visori usate? · come usate l'AI?" },
      { group: "Immagini" },
      { key: "hero_image", label: "Immagine di sfondo (desktop)", type: "image", def: "/media/organism-wide.jpg" },
      { key: "hero_image_mobile", label: "Immagine (mobile, schede)", type: "image", def: "/media/organism-tall.jpg" }
    ]
  },
  {
    id: "reel", nav: "Reel", title: "Reel — Organismi in movimento", where: "Desktop: subito dopo la hero. Mobile: la fila di reel sotto la card in cima alla Home e nella schermata Lavori.", anchor: "#reel",
    manage: [{ label: "I video dei reel", href: "/admin/reel" }],
    fields: [
      { group: "Solo desktop" },
      { key: "reel_label", label: "Etichetta", def: "Reel" },
      { key: "reel_title", label: "Titolo", em: true, def: "Organismi in <em>movimento.</em>" },
      { key: "reel_text", label: "Sottotitolo", def: "Un reel per tema. Scorrono muti: con l'audio, quando vuoi tu." },
      { group: "Desktop e mobile" },
      { key: "reel_play", label: "Bottone su ogni reel", def: "Guarda con audio" },
      { group: "Solo mobile", hint: "La fila dei reel in Home e nella schermata Lavori: solo un titolo e un rimando." },
      { key: "m_reel_title", label: "Titolo della fila", from: "reel_label", hint: "Vuoto = come l'etichetta desktop.", def: "Reel" },
      { key: "m_all_works", label: "Rimando accanto al titolo (porta ai lavori)", def: "Tutti i lavori" }
    ]
  },
  {
    id: "servizi", nav: "Servizi (aree)", title: "Servizi — le aree", where: "Desktop: le quattro card sotto i reel. Mobile: il carosello in Home e l'elenco nella schermata Sistema.", anchor: "#aree",
    manage: [{ label: "Le quattro aree (testi, immagini, tecnologie)", href: "/admin/capacita" }],
    fields: [
      { group: "Desktop e mobile" },
      { key: "areas_label", label: "Voce di menu ed etichetta della sezione", def: "Aree" },
      { key: "area_kicker", label: "Etichetta su ogni card", hint: "Seguita dal numero: «Area 01», «Area 02»…", def: "Area" },
      { key: "area_more", label: "Rimando in fondo a ogni card", def: "Casi d'uso e tecnologie" },
      { group: "Solo desktop" },
      { key: "areas_title", label: "Titolo", em: true, def: "Quattro sistemi, un <em>organismo.</em>" },
      { group: "Solo mobile", hint: "Le aree compaiono due volte: come carosello in Home e come elenco nella schermata Sistema." },
      { key: "areas_home_title", label: "Titolo del carosello in Home", def: "I nostri servizi" },
      { key: "m_all_areas", label: "Rimando accanto al titolo (porta all'elenco)", def: "Tutte" },
      { key: "areas_list_title", label: "Titolo dell'elenco in Sistema", def: "Le aree" },
      { group: "Versione breve" },
      { key: "areas_brief_intro", label: "Testo sopra l'elenco compatto", type: "textarea", rows: 3, hint: "Nella versione breve le 4 aree diventano un blocco unico: nome e sintesi di ciascuna, senza rimandi alle schede. Questo testo, se c'è, sta sopra l'elenco. Si vede al posto della sezione completa quando, nella pagina Fruizione, la sezione è impostata su «Breve» per quel tempo. Vuoto = si vede la versione completa.", def: "" }
    ]
  },
  {
    id: "contesto", nav: "Il contesto", title: "Il contesto", where: "Desktop: il testo accanto al campo di dati particellari. Mobile: nella schermata Sistema.", anchor: "#sistema",
    manage: [{ label: "I dati del contesto (i numeri)", href: "/admin/dati" }],
    fields: [
      { key: "context_label", label: "Etichetta", def: "Il contesto" },
      { key: "context_text", label: "Testo", type: "textarea", rows: 4, def: "" },
      { key: "context_quote", label: "Frase in corsivo sotto il testo", hint: "Una frase breve, da statement.", def: "Non importa quale sia il trend del momento. È già passato." },
      { group: "Versione breve" },
      { key: "context_brief", label: "Testo breve (senza il campo dati)", type: "textarea", rows: 3, hint: "Si vede al posto della sezione completa quando, nella pagina Fruizione, la sezione è impostata su «Breve» per quel tempo. Vuoto = si vede la versione completa.", def: "" }
    ]
  },
  {
    id: "lavori", nav: "Lavori", title: "Lavori — Organismi in azione", where: "Desktop: la griglia dei lavori con i filtri per area. Mobile: la schermata Lavori e la fila in Home.", anchor: "#lavori",
    manage: [{ label: "I lavori (schede, immagini, aree)", href: "/admin/lavori" }],
    fields: [
      { group: "Solo desktop" },
      { key: "works_label", label: "Etichetta", def: "Lavori" },
      { key: "works_text", label: "Sottotitolo", em: true, def: "Una selezione. Ogni scheda si può <em>adattare al tuo contesto</em>: apri un lavoro e prova." },
      { group: "Desktop e mobile" },
      { key: "works_title", label: "Titolo", em: true, hint: "Su mobile è il titolo della schermata Lavori.", def: "Organismi in <em>azione.</em>" },
      { key: "works_all", label: "Filtro «tutti»", def: "Tutti" },
      { group: "Solo mobile", hint: "La fila dei lavori in Home e la nota in fondo alla schermata Lavori." },
      { key: "m_works_title", label: "Titolo della fila in Home", from: "works_label", hint: "Vuoto = come l'etichetta desktop.", def: "Lavori" },
      { key: "m_see_all", label: "Rimando accanto al titolo (porta alla schermata Lavori)", def: "Vedi tutti" },
      { key: "m_works_hint", label: "Nota in fondo alla schermata Lavori", def: "Tocca un lavoro per aprirlo e adattarlo al tuo contesto" }
    ]
  },
  {
    id: "organismo", nav: "L'organismo", title: "L'organismo vivente", where: "Desktop: la sezione con l'organismo che cresce col Radar. Mobile: nella schermata Sistema.", anchor: "#organismo",
    fields: [
      { group: "Desktop e mobile" },
      { key: "organism_label", label: "Etichetta", def: "Adaptive Content Systems" },
      { key: "organism_title", label: "Titolo", em: true, def: "Ogni progetto è concepito come un <em>organismo vivente.</em>" },
      { key: "organism_text", label: "Testo", type: "textarea", rows: 4, def: "" },
      { group: "Solo mobile", hint: "Nella schermata Sistema: la frase di apertura e la didascalia sotto l'organismo interattivo." },
      { key: "m_system_quote", label: "Frase di apertura della schermata Sistema", def: "Ogni progetto è concepito come un organismo vivente." },
      { key: "m_org_title", label: "Didascalia sotto l'organismo · titolo", def: "È vivo." },
      { key: "m_org_text", label: "Didascalia sotto l'organismo · testo", type: "textarea", rows: 3, def: "Uno solo per tutto il sito: lo nutrono il Radar, gli umori dei visitatori e il meteo di Roma. Tocca nel vuoto: reagisce, e resta. Tocca un nodo: ti dice da quale notizia è nato." },
      { group: "Versione breve" },
      { key: "organism_brief", label: "Testo breve (senza l'organismo interattivo)", type: "textarea", rows: 3, hint: "Si vede al posto della sezione completa quando, nella pagina Fruizione, la sezione è impostata su «Breve» per quel tempo. Vuoto = si vede la versione completa.", def: "" }
    ]
  },
  {
    id: "metodo", nav: "Metodo", title: "Metodo — le cinque fasi", where: "Desktop: le fasi accanto al diagramma. Mobile: in Home e nella schermata Sistema.", anchor: "#metodo",
    fields: [
      { key: "method_label", label: "Etichetta", def: "Metodo" },
      { key: "method_title", label: "Titolo", em: true, def: "Cinque fasi, un <em>ciclo.</em>" },
      { key: "method_intro", label: "Introduzione", type: "textarea", rows: 3, def: "" },
      { key: "method", label: "Le fasi", hint: "Cinque fasi, nell'ordine. I nomi compaiono anche nel diagramma.", type: "pairs", cols: [{ k: "k", label: "Fase", i18n: false }, { k: "text", label: "Testo" }], count: 5, def: [] },
      { group: "Versione breve" },
      { key: "method_brief", label: "Testo breve (senza le fasi e il diagramma)", type: "textarea", rows: 3, hint: "Si vede al posto della sezione completa quando, nella pagina Fruizione, la sezione è impostata su «Breve» per quel tempo. Vuoto = si vede la versione completa.", def: "" }
    ]
  },
  {
    id: "team", nav: "Team", title: "Team", where: "Desktop: le persone chiave e l'organico per unit. La sezione compare solo se ci sono persone.", anchor: "#team",
    manage: [{ label: "Le persone", href: "/admin/team" }],
    fields: [
      { key: "team_label", label: "Etichetta", hint: "{n} diventa il numero delle persone.", vars: ["n"], def: "Team · {n} persone" },
      { key: "team_title", label: "Titolo", em: true, def: "Un sistema è fatto di <em>persone.</em>" },
      { key: "team_text", label: "Testo", type: "textarea", rows: 3, def: "" },
      { key: "team_with", label: "«con» (prima dei nomi dei responsabili di unit)", def: "con" },
      { group: "Versione breve" },
      { key: "team_brief", label: "Testo breve (senza le persone)", type: "textarea", rows: 3, hint: "Si vede al posto della sezione completa quando, nella pagina Fruizione, la sezione è impostata su «Breve» per quel tempo. Vuoto = si vede la versione completa.", def: "" }
    ]
  },
  {
    id: "tecnologie", nav: "Tecnologie", title: "Tecnologie in logica selettiva", where: "Desktop: la sezione con le quattro tecnologie (solo con «tutto il tempo»). Mobile: nella schermata Sistema.",
    fields: [
      { key: "tech_title", label: "Titolo", em: true, def: "" },
      { key: "tech", label: "Le tecnologie", type: "pairs", cols: [{ k: "k", label: "Nome" }, { k: "text", label: "Testo" }], count: 4, def: [] },
      { group: "Versione breve" },
      { key: "tech_brief", label: "Testo breve (senza l'elenco)", type: "textarea", rows: 3, hint: "Si vede al posto della sezione completa quando, nella pagina Fruizione, la sezione è impostata su «Breve» per quel tempo. Vuoto = si vede la versione completa.", def: "" }
    ]
  },
  {
    id: "radar", nav: "Radar", title: "Radar — rassegna da fonti esterne", where: "Desktop: la sezione «su carta» con la ricerca dal vivo e i segnali pubblicati. Mobile: la schermata Radar.", anchor: "#radar",
    manage: [{ label: "I segnali (approva, modifica, pubblica)", href: "/admin/radar" }, { label: "Fonti e filtri", href: "/admin/fonti" }],
    fields: [
      { group: "Desktop e mobile" },
      { key: "radar_label", label: "Etichetta", def: "Radar · rassegna da fonti esterne" },
      { key: "radar_title", label: "Titolo", em: true, def: "" },
      { key: "radar_text", label: "Testo", type: "textarea", rows: 3, hint: "Spiega che sono contenuti di terzi.", def: "" },
      { group: "Ricerca dal vivo (desktop e mobile)" },
      { key: "radar_search_title", label: "Titolo della ricerca", def: "Cerca nel mondo, adesso" },
      { key: "radar_search_text", label: "Testo della ricerca", def: "Il Radar cerca in tempo reale tra le notizie degli ultimi 14 giorni. Scrivi un tema, o prova uno di questi." },
      { key: "radar_search_placeholder", label: "Suggerimento nel campo di ricerca", def: "es. retail media, DOOH, AI generativa…" },
      { key: "radar_queries", label: "Ricerche suggerite", hint: "Le capsule sotto il campo: etichetta che si vede e ricerca che parte. Se ne compili anche una sola, valgono solo le tue.", type: "pairs", cols: [{ k: "k", label: "Etichetta" }, { k: "text", label: "Ricerca" }], count: 6,
        def: [{ k: "DOOH", text: "DOOH" }, { k: "Retail media", text: "retail media" }, { k: "AI generativa", text: "AI generativa pubblicità" }, { k: "Virtual production", text: "virtual production" }, { k: "Musei immersivi", text: "musei esperienze immersive" }] },
      { group: "Note" },
      { key: "radar_note", label: "Nota in fondo (paternità dei titoli)", type: "textarea", rows: 2, def: "I titoli e i riassunti appartengono alle rispettive testate. Frameworks li segnala e li commenta; non ne rivendica la paternità." },
      { group: "Solo mobile", hint: "La fila «Radar oggi» in Home e il titolo dell'elenco nella schermata Radar." },
      { key: "m_radar_title", label: "Titolo della fila in Home", def: "Radar oggi" },
      { key: "m_radar_list_title", label: "Titolo dell'elenco nella schermata Radar", def: "Selezione del Radar" },
      { key: "m_radar_all", label: "Rimando accanto al titolo in Home", def: "Tutto il radar" },
      { group: "Versione breve" },
      { key: "radar_brief", label: "Testo breve (senza ricerca e segnali)", type: "textarea", rows: 3, hint: "Si vede al posto della sezione completa quando, nella pagina Fruizione, la sezione è impostata su «Breve» per quel tempo. Vuoto = si vede la versione completa.", def: "" }
    ]
  },
  {
    id: "narrowcasting", nav: "Narrowcasting", title: "Narrowcasting — la pagina composta per te", where: "Desktop: la sezione che riassume come la pagina si è adattata al visitatore (ora, dispositivo, meteo, scelte).",
    fields: [
      { key: "narrow_label", label: "Etichetta", def: "Narrowcasting" },
      { key: "narrow_title", label: "Titolo", em: true, def: "Questa pagina si è composta <em>per te.</em>" }
    ]
  },
  {
    id: "triade", nav: "Triade", title: "Triade — Firmitas · Utilitas · Venustas", where: "Desktop: le tre colonne in fondo, prima della chiusura (solo con «tutto il tempo»). Mobile: nella schermata Sistema.",
    fields: [
      { key: "triad_label", label: "Etichetta", def: "Firmitas · Utilitas · Venustas" },
      { key: "triad", label: "Le tre voci", type: "pairs", cols: [{ k: "la", label: "Latino", i18n: false }, { k: "it", label: "Italiano" }, { k: "text", label: "Testo" }], count: 3, def: [] }
    ]
  },
  {
    id: "chiusura", nav: "Chiusura", title: "Chiusura", where: "Desktop: le parole grandi che scorrono prima dei contatti.",
    fields: [
      { key: "closing", label: "Parole di chiusura (una per riga)", type: "lines", def: [] }
    ]
  },
  {
    id: "contatti", nav: "Contatti e footer", title: "Contatti e footer", where: "Desktop: l'ultima sezione e la riga in fondo. Mobile: il blocco contatti in fondo a ogni schermata.", anchor: "#contatti",
    fields: [
      { key: "contact_label", label: "Etichetta", def: "Contatti" },
      { key: "contact_title", label: "Titolo", em: true, def: "" },
      { key: "contact_email", label: "Email", i18n: false, def: "" },
      { key: "contact_copy", label: "Bottone accanto all'email", def: "Copia" },
      { key: "contact_address", label: "Indirizzo", type: "textarea", rows: 2, def: "" },
      { key: "footer_note", label: "Riga del footer", def: "" }
    ]
  },
  {
    id: "modalita", nav: "Modalità", title: "Modalità — il pannello", where: "Desktop: il pannello che si apre dal tasto Modalità in alto (tempo, mood, ambiente, lingua). Mobile: gli stessi pulsanti stanno dentro la Console.",
    fields: [
      { key: "modes_title", label: "Titolo del pannello", def: "La pagina si adatta a te" },
      { key: "modes_note", label: "Nota in fondo al pannello", type: "textarea", rows: 3, def: "Densità dei contenuti, ritmo delle animazioni e tonalità cambiano in base alle tue risposte, all'ora e al meteo di Roma. Nessun dato viene salvato sui nostri server." },
      { key: "modes_enabled", label: "Modalità ambientali", hint: "Se spente, il sito non cambia densità, ritmo e colori in base a tempo, umore e meteo.", type: "check", on: "Attive (tempo / umore / meteo)", def: true }
    ]
  }
];

const ALL = SECTIONS.flatMap(s => s.fields.filter(f => f.key));
const byId = (id) => SECTIONS.find(s => s.id === id) || null;
const isEmpty = (v) => v == null || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && !v.length);

// Il sito com'è da mostrare: i campi vuoti prendono il testo standard (tradotto con T, il dizionario dell'interfaccia).
// I testi scritti dal backoffice arrivano già tradotti da i18n.apply, quindi qui non si toccano.
function view(site, T) {
  const src = site || {}; const s = { ...src };
  const tr = (v) => (typeof T === "function" && typeof v === "string") ? T(v) : v;
  for (const f of ALL) {
    const v = src[f.key];
    if (f.type === "check") { if (v == null) s[f.key] = !!f.def; continue; }
    if (f.type === "lines") { if (isEmpty(v)) s[f.key] = (f.def || []).map(tr); continue; }
    if (f.type === "pairs") {
      const def = (f.def || []).map(row => Object.fromEntries(Object.entries(row).map(([k, x]) => [k, tr(x)])));
      const rows = Array.isArray(v) ? v : [];
      const filled = rows.filter(r => r && !isEmpty(r[f.cols[0].k]));
      if (!f.fixed) { s[f.key] = filled.length ? filled : def; continue; } // elenco libero (ricerche del Radar, metodo…): le righe compilate, o tutte quelle standard
      // elenco a posti fissi (risposte dell'intro): riga per riga, ogni cella vuota prende quella standard
      const n = Math.max(def.length, rows.length);
      s[f.key] = Array.from({ length: n }, (_, i) => Object.fromEntries(f.cols.map(c => [c.k, !isEmpty(rows[i] && rows[i][c.k]) ? rows[i][c.k] : ((def[i] || {})[c.k] || "")]))).filter(r => !isEmpty(r[f.cols[0].k]));
      continue;
    }
    if (isEmpty(v)) s[f.key] = isEmpty(f.def) ? "" : tr(f.def);
  }
  // campi "come un altro" (from): vuoti, seguono il campo desktop corrispondente (es. il titolo della fila dei reel segue l'etichetta Reel)
  for (const f of ALL) if (f.from && isEmpty(src[f.key])) s[f.key] = s[f.from];
  // compatibilità con i vecchi "statement" (elenco): la seconda riga stava sotto il contesto, la terza apriva Sistema su mobile
  const st = Array.isArray(src.statements) ? src.statements : [];
  if (isEmpty(src.context_quote) && st[1]) s.context_quote = st[1];
  if (isEmpty(src.m_system_quote) && st[2]) s.m_system_quote = st[2];
  return s;
}

// Legge il form di una sezione e restituisce il sito aggiornato (vuoto = testo standard)
function parse(sectionId, body, site) {
  const sec = byId(sectionId); if (!sec) return site;
  const b = body || {}; const out = { ...(site || {}) };
  const str = (v) => String(v == null ? "" : v).trim();
  const rows = (v) => { if (Array.isArray(v)) return v; if (v && typeof v === "object") return Object.keys(v).sort((a, c) => +a - +c).map(k => v[k]); return []; };
  for (const f of sec.fields) {
    if (!f.key) continue;
    if (f.type === "check") { out[f.key] = !!b[f.key]; continue; }
    if (f.type === "lines") { out[f.key] = str(b[f.key]).split(/\r?\n/).map(x => x.trim()).filter(Boolean); continue; }
    if (f.type === "pairs") {
      const first = f.cols[0].k; const all = rows(b[f.key]).map(r => Object.fromEntries(f.cols.map(c => [c.k, str(r && r[c.k])])));
      if (!f.fixed) { out[f.key] = all.filter(r => r[first]); continue; }
      while (all.length && f.cols.every(c => !all[all.length - 1][c.k])) all.pop(); // posti fissi: le righe vuote in coda vanno via, quelle in mezzo restano (= standard)
      out[f.key] = all; continue;
    }
    out[f.key] = str(b[f.key]);
  }
  return out;
}

// I percorsi dei testi scritti dal backoffice che vanno tradotti (server/i18n.js)
const I18N_PATHS = ALL.flatMap(f => {
  if (f.type === "check" || f.type === "image" || f.i18n === false) return [];
  if (f.type === "lines") return [`site.${f.key}[]`];
  if (f.type === "pairs") return f.cols.filter(c => c.i18n !== false).map(c => `site.${f.key}[].${c.k}`);
  return [`site.${f.key}`];
});

module.exports = { SECTIONS, ALL, byId, view, parse, I18N_PATHS };
