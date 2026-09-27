// Adapter AI: Anthropic (Messages API) o OpenAI (Chat Completions), scelto dalle impostazioni.
// Le chiavi si leggono prima dalle variabili d'ambiente, poi dalle impostazioni salvate nel backoffice.
const crypto = require("crypto");
const store = require("./db");

function config() {
  const ai = store.getSetting("ai", {});
  const provider = (process.env.AI_PROVIDER || ai.provider || "anthropic").toLowerCase();
  const anthropicKey = process.env.ANTHROPIC_API_KEY || ai.anthropic_key || "";
  const openaiKey = process.env.OPENAI_API_KEY || ai.openai_key || "";
  return {
    provider,
    key: provider === "openai" ? openaiKey : anthropicKey,
    model: provider === "openai" ? (process.env.OPENAI_MODEL || ai.openai_model || "gpt-4.1-mini") : (process.env.ANTHROPIC_MODEL || ai.anthropic_model || "claude-sonnet-4-5"),
    dailyLimit: +ai.daily_call_limit || 400,
    features: { console: !!ai.console_enabled, adapt: !!ai.adapt_enabled, radar: !!ai.radar_enabled },
    hasAnthropic: !!anthropicKey, hasOpenai: !!openaiKey
  };
}
const isConfigured = () => !!config().key;

async function complete({ system, user, maxTokens = 700, json = false, kind = "generic", cacheMinutes = 0 }) {
  const cfg = config();
  if (!cfg.key) { const e = new Error("AI non configurata: manca la chiave API"); e.code = "not_configured"; throw e; }
  if (store.aiCallsToday() >= cfg.dailyLimit) { const e = new Error("Limite giornaliero di chiamate AI raggiunto"); e.code = "rate_limited"; throw e; }
  const cacheKey = cacheMinutes ? crypto.createHash("sha1").update([cfg.provider, cfg.model, system, user, json ? "j" : "t"].join("|")).digest("hex") : null;
  if (cacheKey) { const hit = store.cacheGet(cacheKey, cacheMinutes); if (hit) return hit; }

  let text = "", tokens = 0;
  if (cfg.provider === "openai") {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${cfg.key}` },
      body: JSON.stringify({ model: cfg.model, max_tokens: maxTokens, temperature: 0.6,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        ...(json ? { response_format: { type: "json_object" } } : {}) })
    });
    const data = await r.json();
    if (!r.ok) { const e = new Error(data.error?.message || "Errore OpenAI"); e.code = "provider_error"; throw e; }
    text = data.choices?.[0]?.message?.content || ""; tokens = data.usage?.total_tokens || 0;
  } else {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: { "content-type": "application/json", "x-api-key": cfg.key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: cfg.model, max_tokens: maxTokens, system: system + (json ? "\nRispondi SOLO con un oggetto JSON valido, senza testo prima o dopo." : ""),
        messages: [{ role: "user", content: user }] })
    });
    const data = await r.json();
    if (!r.ok) { const e = new Error(data.error?.message || "Errore Anthropic"); e.code = "provider_error"; throw e; }
    text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join(""); tokens = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);
  }
  store.logAi(kind, tokens);
  let out = text;
  if (json) {
    const m = text.match(/\{[\s\S]*\}/); // tollera testo attorno al JSON
    try { out = JSON.parse(m ? m[0] : text); } catch { const e = new Error("Risposta AI non in formato JSON"); e.code = "bad_json"; e.raw = text; throw e; }
  }
  if (cacheKey) store.cacheSet(cacheKey, out);
  return out;
}

// ---------- prompt: indice dei contenuti da dare al modello ----------
function contentIndex(lang = "it") {
  let c = require("./concrete").decorate(store.getContent());
  if (lang && lang !== "it") { try { c = require("./i18n").apply(c, lang); } catch (e) { /* senza traduzioni si usa l'italiano */ } } // in inglese il modello vede i titoli come li vede il visitatore
  const caps = c.caps.map(x => `- [cap:${x.id}] ${x.name}: ${x.short}${x.tech && x.tech.length ? `\n  tecnologie e formati: ${x.tech.join(", ")}` : ""}${x.uses && x.uses.length ? `\n  casi d'uso: ${x.uses.join("; ")}` : ""}`).join("\n");
  const works = c.works.map(x => `- [work:${x.id}] ${x.client} — ${x.title} (${x.year}) · aree: ${x.caps.join(", ")}: ${x.short}`).join("\n");
  const sig = c.signals.slice(0, 20).map(x => `- [signal:${x.id}] ${x.src} (${x.date}): ${x.title} · aree: ${x.caps.join(", ")}`).join("\n");
  const team = (c.team || []).map(m => `- ${m.name}: ${m.role}${m.unit ? " (" + m.unit + ")" : ""}${m.is_key ? " · persona chiave" : ""}`).join("\n");
  const sections = SECTIONS.map(x => `- [sec:${x.id}] ${x.name}: ${x.desc}`).join("\n");
  return { c, text: `AREE (capacità):\n${caps}\n\nLAVORI:\n${works}\n\nRADAR (notizie esterne, di terzi, non nostre):\n${sig}\n\nSEZIONI DEL SITO (si propongono con "sections"):\n${sections}${team ? `\n\nTEAM (persone; non sono id da proporre: per le persone proponi la sezione team):\n${team}` : ""}` };
}
// Le sezioni del sito che la Console può proporre come navigazione
const SECTIONS = [
  { id: "sistema", name: "Sistema", desc: "chi siamo, il contesto che cambia, l'organismo vivente (Adaptive Content Systems)" },
  { id: "aree", name: "Aree", desc: "le quattro capacità" },
  { id: "lavori", name: "Lavori", desc: "i casi" },
  { id: "metodo", name: "Metodo", desc: "le cinque fasi del ciclo: mapping, tailoring, production, deployment, iteration" },
  { id: "team", name: "Team", desc: "le persone: chi guida l'unit e i reparti" },
  { id: "radar", name: "Radar", desc: "rassegna di notizie esterne in tempo reale" },
  { id: "contatti", name: "Contatti", desc: "come parlarci" }
];
// Contesto aziendale nascosto (backoffice → Contesto Console): cos'è Frameworks, il gruppo, i rapporti con Why e FRY…
function contextText() { const t = String(store.getSetting("console_context", "") || "").trim(); return t ? t.slice(0, 7000) : ""; }

const BRAND_SYSTEM = `Sei la Console di Frameworks, l'unit di Frame by Frame S.p.A. (Roma) che progetta Adaptive Content Systems:
"organismi di comunicazione sintetici viventi, capaci di adattarsi a ogni contesto". Contenuti creati per sopravvivere: asset progettati per estendersi, aggiornarsi e riconfigurarsi.
Tono: lucido, concreto, elegante, italiano. Frasi brevi. Niente entusiasmo di plastica, niente elenchi puntati nelle risposte al visitatore.
Non inventare lavori, clienti o dati su Frameworks: per questi usa solo l'indice fornito. Sulle conoscenze generali del mestiere (formati, canali, dispositivi, tecnologie, tendenze) rispondi con la competenza di un professionista senior. Le notizie del Radar sono contenuti di terzi: citale come tali, mai come lavori nostri.`;

// Console prompt: linguaggio naturale → percorso proposto (aree/lavori/segnali) + risposta breve + eventuale domanda
// Le preferenze scelte nell'intro (tempo e umore) sono complementari alla richiesta: il percorso ne tiene conto.
const PREF_TIME = { "2": "2 minuti: vuole solo l'essenziale → proponi al massimo 2 aree e 1 lavoro, niente radar, risposta in 1-2 frasi", "10": "10 minuti: vuole capire come lavoriamo e cosa abbiamo fatto → 2-3 aree e 2-3 lavori", all: "tutto il tempo che serve: vuole l'esperienza completa → fino a 6 elementi, radar incluso se pertinente" };
const PREF_MOOD = { calm: "notturno: tono disteso", vivid: "acceso: tono più energico, puoi includere il radar", nervous: "quieto: dritto al punto, risposta asciutta, niente radar", light: "chiaro: tono limpido e leggero" };
function prefsText(prefs) {
  if (!prefs) return "";
  const t = PREF_TIME[prefs.time], m = PREF_MOOD[prefs.mood];
  if (!t && !m) return "";
  return `PREFERENZE GIÀ SCELTE DAL VISITATORE ALL'INGRESSO (rispettale, sono complementari alla richiesta):${t ? `\n- tempo: ${t}` : ""}${m ? `\n- mood: ${m}` : ""}\n\n`;
}

// Lingua: in inglese risposta, etichetta e domanda arrivano in inglese (l'indice è quello tradotto)
const LANG_RULE = { en: "\n\nLINGUA: il visitatore usa la versione inglese del sito. Scrivi answer, label, ask.question e ask.options in inglese (British/international), con lo stesso tono. Gli id restano quelli dell'indice." };
async function consoleQuery(q, history = [], prefs = null, lang = "it") {
  const { text } = contentIndex(lang); const ctx = contextText();
  const system = BRAND_SYSTEM + (ctx ? `\n\nCONTESTO AZIENDALE (usalo per rispondere a domande su Frameworks, il gruppo, le persone, la storia; non citarlo come "contesto", parla in prima persona plurale):\n${ctx}` : "") + `\n\nRicevi una richiesta del visitatore (con l'eventuale conversazione precedente e le preferenze scelte all'ingresso) e l'indice dei contenuti del sito. Rispondi alla domanda e proponi la navigazione più sensata. Rispondi SOLO con JSON:
{"answer": "in italiano, senza elenchi: prima la risposta vera alla domanda, poi (se ha senso) cosa proponi di vedere", "label": "2-3 parole che riassumono il percorso (es. Retail veloce, Le persone, Scopri Frameworks)", "highlight": ["id","id"], "sections": ["id"], "open": "id o null", "ask": null, "mode": {"density": null, "energy": null}}
COME RISPONDI (in ordine di priorità):
1. Domande su Frameworks, sulle aree, sui lavori, sulle persone, sul metodo → rispondi con i fatti dell'indice e del contesto (tecnologie, dispositivi, formati, casi d'uso compresi: se chiedono quali visori, quali formati, quali schermi, nominali). 1-3 frasi.
2. Domande generali del nostro campo (comunicazione, marketing, media, formati e canali, DOOH, social, retail, eventi, CGI, real-time, XR, AI creativa, produzione video, tendenze) → sei un esperto: rispondi davvero, in 2-4 frasi utili e specifiche (nomi, misure, esempi, come si fa), come farebbe un professionista senior che conosce la materia. Poi, in una frase, collega la risposta a ciò che facciamo e proponi le aree o sezioni pertinenti. Non rispondere "non è nel sito": se lo sai, dillo.
3. Domande di cultura generale o tecniche vicine al nostro lavoro (come funziona un LED wall, cos'è il programmatic, che differenza c'è tra AR e VR, quanto dura un Reel) → rispondi in 2-3 frasi con competenza, poi aggancia a Frameworks solo se il legame è naturale.
4. Richieste chiaramente fuori dal nostro campo (ricette, meteo, compiti, codice, salute, consigli personali, testi generici da scrivere) → una frase gentile e leggera: non è il nostro mestiere, e riporta a ciò che possiamo fare; sections ["sistema","aree"].
Non sei un assistente universale, ma non sei nemmeno un menu: la misura giusta è "competente e pertinente".
REGOLE:
- highlight: SOLO aree, lavori e al massimo un segnale del radar davvero legati alla richiesta (id ESATTI dall'indice, senza prefisso). Se nessuno c'entra, lascia highlight VUOTO: non proporre aree o lavori a caso.
- sections: le sezioni del sito pertinenti (id ESATTI: sistema, aree, lavori, metodo, team, radar, contatti). Domande su chi siamo, la società, il gruppo, la storia → "sistema"; su persone, ruoli, chi guida → "team"; su come lavoriamo → "metodo"; su notizie e tendenze → "radar"; per contattarci, preventivi, incontri → "contatti".
- Se la domanda è generica su Frameworks ("cosa fate", "chi siete", "parlami di voi") o non trova niente di specifico, proponi una navigazione per scoprire Frameworks: sections ["sistema","aree","metodo"] con label "Scopri Frameworks".
- Se la richiesta è troppo vaga per capire cosa cerca (un saluto, una parola senza senso), highlight e sections vuoti e ask = {"question": "una domanda breve per capire cosa cerca", "options": ["3-4 opzioni brevi tra cui scegliere"]}. Altrimenti ask = null.
- open: l'id più pertinente tra aree e lavori, oppure null.
- mode.density: "2" SOLO se nella RICHIESTA il visitatore parla di fretta, poco tempo o dell'essenziale; "all" se chiede di approfondire o dice di avere tempo; altrimenti null. Se ha già scelto il tempo all'ingresso, lascia null a meno che la richiesta non chieda esplicitamente di cambiare.
- mode.energy: "calm" o "vivid" SOLO se il visitatore chiede esplicitamente calma o energia; altrimenti null.
- Non inventare fatti su Frameworks: se il contesto non dice qualcosa (una data, un numero, un nome, un cliente), dillo e proponi la sezione o i contatti. Le conoscenze generali del mestiere invece le puoi usare liberamente.
- Se il visitatore ha scelto "2 minuti" o il mood quieto, anche la risposta esperta resta corta (2 frasi).` + (LANG_RULE[lang] || "");
  const hist = (history || []).slice(-3).map(h => `Visitatore: ${String(h.q || "").slice(0, 300)}\nConsole: ${String(h.a || "").slice(0, 400)}`).join("\n");
  const user = `INDICE:\n${text}\n\n${prefsText(prefs)}${hist ? "CONVERSAZIONE PRECEDENTE:\n" + hist + "\n\n" : ""}RICHIESTA: ${q}`;
  const out = await complete({ system, user, json: true, maxTokens: 700, kind: "console", cacheMinutes: 60 * 24 });
  const idx = contentIndex(lang).c;
  const valid = new Set([...idx.caps.map(x => x.id), ...idx.works.map(x => x.id), ...idx.signals.map(x => x.id)]);
  const all = [...idx.caps, ...idx.works, ...idx.signals];
  const norm = (v) => String(v || "").trim().toLowerCase().replace(/^(cap|work|signal|area|lavoro|radar)\s*[:\-]\s*/, "");
  let ids = [];
  (out.highlight || []).forEach(raw => { const id = norm(raw); const hit = all.find(x => x.id.toLowerCase() === id) || all.find(x => [x.name, x.title, x.client, x.label].filter(Boolean).some(n => n.toLowerCase() === id)); if (hit && !ids.includes(hit.id)) ids.push(hit.id); });
  out.highlight = ids.slice(0, 6);
  const secIds = SECTIONS.map(x => x.id); const normSec = (v) => String(v || "").trim().toLowerCase().replace(/^sec(tion)?\s*[:\-]\s*/, "");
  out.sections = [...new Set((out.sections || []).map(normSec).filter(v => secIds.includes(v)))].slice(0, 4);
  if (!out.highlight.length && !out.sections.length && !(out.ask && out.ask.question)) { out.sections = ["sistema", "aree", "metodo"]; out.label = out.label || (lang === "en" ? "Discover Frameworks" : "Scopri Frameworks"); }
  out.open = valid.has(out.open) ? out.open : null;
  out.label = String(out.label || "").slice(0, 40);
  out.ask = out.ask && out.ask.question ? { question: String(out.ask.question).slice(0, 160), options: (out.ask.options || []).map(String).slice(0, 4) } : null;
  out.mode = { density: ["2", "10", "all"].includes(String(out.mode && out.mode.density)) ? String(out.mode.density) : null, energy: ["calm", "vivid"].includes(out.mode && out.mode.energy) ? out.mode.energy : null };
  return out;
}

// Adatta al contesto: tre idee concrete (non una riscrittura) per settore/canale/obiettivo del visitatore,
// ancorate a un'area o a un lavoro, più l'invito a un brief con il team.
const ADAPT_NEXT = "Sono punti di partenza: le idee migliori nascono da un brief o da un brainstorming con il team di Frameworks. Scriveteci e ci mettiamo attorno a un tavolo.";
const ADAPT_NEXT_EN = "These are starting points: the best ideas come out of a brief or a brainstorming session with the Frameworks team. Write to us and we will sit around a table.";
async function adapt({ itemId, sector, goal, channel, lang = "it" }) {
  const { c } = contentIndex(lang);
  const item = c.works.find(w => w.id === itemId) || c.caps.find(x => x.id === itemId);
  if (!item) { const e = new Error("Elemento non trovato"); e.code = "not_found"; throw e; }
  const cap = item.client ? null : item;
  const capsOf = item.client ? (item.caps || []).map(id => c.caps.find(x => x.id === id)).filter(Boolean) : [item];
  const toolbox = capsOf.map(x => `${x.name}: tecnologie e formati → ${(x.tech || []).join(", ") || x.tags.join(", ")}; casi d'uso → ${(x.uses || []).join("; ") || x.short}`).join("\n");
  const desc = item.client ? `PUNTO DI PARTENZA (lavoro): ${item.client} — ${item.title}. ${item.body}` : `PUNTO DI PARTENZA (area): ${item.name}. ${item.body}`;
  const system = BRAND_SYSTEM + `\nSei un creative technologist senior di Frameworks. Il visitatore ti ha detto settore, canale e obiettivo: rispondi con TRE IDEE CONCRETE, non con una descrizione di noi. Dritto al punto: niente premesse, niente "immaginate", niente ripetizione del punto di partenza, niente aggettivi vuoti.
Ogni idea: cosa vede/fa il pubblico, dove (canale, luogo, formato preciso), con quale tecnologia o dispositivo (nomi veri: Apple Vision Pro, LED wall 32:9, Reels 9:16, programmatic DOOH, avatar con lip-sync…), e cosa cambia nel tempo o per pubblico (l'adattamento è il nostro tratto distintivo). Le tre idee devono essere diverse tra loro: una realizzabile subito con quello che il brand ha già, una più ambiziosa, una che moltiplica le varianti (lingue, città, orari, segmenti). Evita le idee banali (il "video emozionale", il "post social", il "QR code sul cartellone"): ogni idea deve essere specifica per QUEL settore e QUEL canale. Usa solo le tecnologie della cassetta degli attrezzi qui sotto, o strettamente affini. Non promettere numeri o risultati. Seconda persona plurale ("il vostro brand").
CASSETTA DEGLI ATTREZZI:\n${toolbox}
Rispondi SOLO con JSON: {"summary":"1 frase (max 25 parole) che dice cosa faremmo: settore + canale + obiettivo, senza giri di parole","ideas":[{"title":"3-6 parole, concreto","text":"2-3 frasi: cosa vede il pubblico, dove, come funziona, cosa si adatta","tech":"tecnologie, dispositivi o formati usati (3-8 parole)"}],"next":"1 frase che invita a un brief o a un brainstorming con il team di Frameworks per far nascere l'idea giusta"}` + (lang === "en" ? "\nLINGUA: il visitatore usa la versione inglese del sito: scrivi summary, ideas (title, text, tech) e next in inglese (British/international), seconda persona plurale (\"your brand\")." : "");
  const user = `${desc}\n\nCONTESTO DEL VISITATORE — settore: ${sector || "non indicato"}; canale principale: ${channel || "non indicato"}; obiettivo: ${goal || "non indicato"}.`;
  const out = await complete({ system, user, json: true, maxTokens: 900, kind: "adapt", cacheMinutes: 60 * 24 * 7 });
  const ideas = (Array.isArray(out.ideas) ? out.ideas : []).filter(i => i && (i.text || i.title)).slice(0, 3).map(i => ({ title: String(i.title || "").slice(0, 80), text: String(i.text || "").slice(0, 600), tech: String(i.tech || "").slice(0, 120) }));
  if (!ideas.length) { const e = new Error("Risposta AI non in formato atteso"); e.code = "bad_json"; throw e; }
  const nextDef = lang === "en" ? ADAPT_NEXT_EN : ADAPT_NEXT;
  return { summary: String(out.summary || "").slice(0, 300), ideas, next: String(out.next || nextDef).slice(0, 300), text: [out.summary, ...ideas.map(i => `${i.title}. ${i.text}`), out.next || nextDef].filter(Boolean).join("\n\n"), item: { id: item.id, name: item.name || `${item.client} — ${item.title}`, cap: cap ? cap.id : null } };
}

// Radar: classificazione in batch delle notizie candidate
async function classifySignals(items, caps) {
  const capList = caps.map(x => `${x.id}: ${x.name} — ${x.short}`).join("\n");
  const system = BRAND_SYSTEM + `\nSei il Radar: valuti notizie ESTERNE per la rassegna del sito. Per ogni notizia decidi se è rilevante per Frameworks (media, comunicazione, AI creativa, DOOH, immersive, brand content, produzione video) e scrivi una lettura di 1-2 frasi ("perché ci riguarda") in italiano, mai appropriandoti del contenuto: la notizia è di terzi.
Rispondi con JSON: {"items":[{"i":0,"relevant":true,"score":0-100,"caps":["id"],"summary_it":"riassunto neutro in 1 frase","why":"la nostra lettura in 1-2 frasi"}]}\nAREE:\n${capList}`;
  const user = items.map((it, i) => `[${i}] ${it.src} · ${it.date}\nTITOLO: ${it.title}\nTESTO: ${(it.summary || "").slice(0, 600)}`).join("\n\n");
  const out = await complete({ system, user, json: true, maxTokens: 2500, kind: "radar" });
  return out.items || [];
}

module.exports = { config, isConfigured, complete, consoleQuery, adapt, classifySignals, SECTIONS };
