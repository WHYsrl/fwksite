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
function contentIndex() {
  const c = store.getContent();
  const caps = c.caps.map(x => `- [cap:${x.id}] ${x.name}: ${x.short}`).join("\n");
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
Non inventare lavori, clienti o dati: usa solo l'indice fornito. Le notizie del Radar sono contenuti di terzi: citale come tali, mai come lavori nostri.`;

// Console prompt: linguaggio naturale → percorso proposto (aree/lavori/segnali) + risposta breve + eventuale domanda
// Le preferenze scelte nell'intro (tempo e umore) sono complementari alla richiesta: il percorso ne tiene conto.
const PREF_TIME = { "2": "2 minuti: vuole solo l'essenziale → proponi al massimo 2 aree e 1 lavoro, niente radar, risposta in una frase", "10": "10 minuti: vuole capire come lavoriamo e cosa abbiamo fatto → 2-3 aree e 2-3 lavori", all: "tutto il tempo che serve: vuole l'esperienza completa → fino a 6 elementi, radar incluso se pertinente" };
const PREF_MOOD = { calm: "calmo: tono disteso", vivid: "entusiasta: tono più acceso, puoi includere il radar", nervous: "nervoso: dritto al punto, risposta asciutta, niente radar" };
function prefsText(prefs) {
  if (!prefs) return "";
  const t = PREF_TIME[prefs.time], m = PREF_MOOD[prefs.mood];
  if (!t && !m) return "";
  return `PREFERENZE GIÀ SCELTE DAL VISITATORE ALL'INGRESSO (rispettale, sono complementari alla richiesta):${t ? `\n- tempo: ${t}` : ""}${m ? `\n- umore: ${m}` : ""}\n\n`;
}

async function consoleQuery(q, history = [], prefs = null) {
  const { text } = contentIndex(); const ctx = contextText();
  const system = BRAND_SYSTEM + (ctx ? `\n\nCONTESTO AZIENDALE (usalo per rispondere a domande su Frameworks, il gruppo, le persone, la storia; non citarlo come "contesto", parla in prima persona plurale):\n${ctx}` : "") + `\n\nRicevi una richiesta del visitatore (con l'eventuale conversazione precedente e le preferenze scelte all'ingresso) e l'indice dei contenuti del sito. Rispondi alla domanda e proponi la navigazione più sensata. Rispondi SOLO con JSON:
{"answer": "1-3 frasi in italiano, senza elenchi: prima la risposta vera alla domanda, poi (se ha senso) cosa proponi di vedere", "label": "2-3 parole che riassumono il percorso (es. Retail veloce, Le persone, Scopri Frameworks)", "highlight": ["id","id"], "sections": ["id"], "open": "id o null", "ask": null, "mode": {"density": null, "energy": null}}
REGOLE:
- highlight: SOLO aree, lavori e al massimo un segnale del radar davvero legati alla richiesta (id ESATTI dall'indice, senza prefisso). Se nessuno c'entra, lascia highlight VUOTO: non proporre aree o lavori a caso.
- sections: le sezioni del sito pertinenti (id ESATTI: sistema, aree, lavori, metodo, team, radar, contatti). Domande su chi siamo, la società, il gruppo, la storia → "sistema"; su persone, ruoli, chi guida → "team"; su come lavoriamo → "metodo"; su notizie e tendenze → "radar"; per contattarci, preventivi, incontri → "contatti".
- Se la domanda è generica su Frameworks ("cosa fate", "chi siete", "parlami di voi") o non trova niente di specifico, proponi una navigazione per scoprire Frameworks: sections ["sistema","aree","metodo"] con label "Scopri Frameworks".
- Se la richiesta è troppo vaga per capire cosa cerca (un saluto, una parola senza senso), highlight e sections vuoti e ask = {"question": "una domanda breve per capire cosa cerca", "options": ["3-4 opzioni brevi tra cui scegliere"]}. Altrimenti ask = null.
- open: l'id più pertinente tra aree e lavori, oppure null.
- mode.density: "2" SOLO se nella RICHIESTA il visitatore parla di fretta, poco tempo o dell'essenziale; "all" se chiede di approfondire o dice di avere tempo; altrimenti null. Se ha già scelto il tempo all'ingresso, lascia null a meno che la richiesta non chieda esplicitamente di cambiare.
- mode.energy: "calm" o "vivid" SOLO se il visitatore chiede esplicitamente calma o energia; altrimenti null.
- Se la richiesta non c'entra con Frameworks né con la comunicazione, rispondi con garbo in una frase e proponi sections ["sistema","aree"].
- Non inventare: se il contesto non dice qualcosa (una data, un numero, un nome), dillo e proponi la sezione o i contatti.`;
  const hist = (history || []).slice(-3).map(h => `Visitatore: ${String(h.q || "").slice(0, 300)}\nConsole: ${String(h.a || "").slice(0, 400)}`).join("\n");
  const user = `INDICE:\n${text}\n\n${prefsText(prefs)}${hist ? "CONVERSAZIONE PRECEDENTE:\n" + hist + "\n\n" : ""}RICHIESTA: ${q}`;
  const out = await complete({ system, user, json: true, maxTokens: 500, kind: "console", cacheMinutes: 60 * 24 });
  const idx = contentIndex().c;
  const valid = new Set([...idx.caps.map(x => x.id), ...idx.works.map(x => x.id), ...idx.signals.map(x => x.id)]);
  const all = [...idx.caps, ...idx.works, ...idx.signals];
  const norm = (v) => String(v || "").trim().toLowerCase().replace(/^(cap|work|signal|area|lavoro|radar)\s*[:\-]\s*/, "");
  let ids = [];
  (out.highlight || []).forEach(raw => { const id = norm(raw); const hit = all.find(x => x.id.toLowerCase() === id) || all.find(x => [x.name, x.title, x.client, x.label].filter(Boolean).some(n => n.toLowerCase() === id)); if (hit && !ids.includes(hit.id)) ids.push(hit.id); });
  out.highlight = ids.slice(0, 6);
  const secIds = SECTIONS.map(x => x.id); const normSec = (v) => String(v || "").trim().toLowerCase().replace(/^sec(tion)?\s*[:\-]\s*/, "");
  out.sections = [...new Set((out.sections || []).map(normSec).filter(v => secIds.includes(v)))].slice(0, 4);
  if (!out.highlight.length && !out.sections.length && !(out.ask && out.ask.question)) { out.sections = ["sistema", "aree", "metodo"]; out.label = out.label || "Scopri Frameworks"; }
  out.open = valid.has(out.open) ? out.open : null;
  out.label = String(out.label || "").slice(0, 40);
  out.ask = out.ask && out.ask.question ? { question: String(out.ask.question).slice(0, 160), options: (out.ask.options || []).map(String).slice(0, 4) } : null;
  out.mode = { density: ["2", "10", "all"].includes(String(out.mode && out.mode.density)) ? String(out.mode.density) : null, energy: ["calm", "vivid"].includes(out.mode && out.mode.energy) ? out.mode.energy : null };
  return out;
}

// Adatta al contesto: riscrive un lavoro o un'area per settore/obiettivo/canale del visitatore
async function adapt({ itemId, sector, goal, channel }) {
  const { c } = contentIndex();
  const item = c.works.find(w => w.id === itemId) || c.caps.find(x => x.id === itemId);
  if (!item) { const e = new Error("Elemento non trovato"); e.code = "not_found"; throw e; }
  const desc = item.client ? `LAVORO: ${item.client} — ${item.title}. ${item.body}` : `AREA: ${item.name}. ${item.body}`;
  const system = BRAND_SYSTEM + `\nIl visitatore vuole vedere come questo contenuto si riconfigurerebbe nel suo contesto. Scrivi in italiano, 90-130 parole, in prosa (niente elenchi, niente titoli), in seconda persona plurale ("il vostro brand"). Struttura: 1) cosa resta del sistema originale, 2) cosa cambia per il suo contesto, 3) un esempio concreto di variante. Chiudi con una frase di sintesi. Non promettere risultati numerici.`;
  const user = `${desc}\n\nCONTESTO DEL VISITATORE — settore: ${sector || "non indicato"}; obiettivo: ${goal || "non indicato"}; canale principale: ${channel || "non indicato"}.`;
  const textOut = await complete({ system, user, maxTokens: 450, kind: "adapt", cacheMinutes: 60 * 24 * 7 });
  return { text: String(textOut).trim(), item: { id: item.id, name: item.name || `${item.client} — ${item.title}` } };
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
