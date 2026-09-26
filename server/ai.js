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
  return { c, text: `AREE (capacità):\n${caps}\n\nLAVORI:\n${works}\n\nRADAR (notizie esterne, di terzi, non nostre):\n${sig}` };
}

const BRAND_SYSTEM = `Sei la Console di Frameworks, l'unit di Frame by Frame S.p.A. (Roma) che progetta Adaptive Content Systems:
"organismi di comunicazione sintetici viventi, capaci di adattarsi a ogni contesto". Contenuti creati per sopravvivere: asset progettati per estendersi, aggiornarsi e riconfigurarsi.
Tono: lucido, concreto, elegante, italiano. Frasi brevi. Niente entusiasmo di plastica, niente elenchi puntati nelle risposte al visitatore.
Non inventare lavori, clienti o dati: usa solo l'indice fornito. Le notizie del Radar sono contenuti di terzi: citale come tali, mai come lavori nostri.`;

// Console prompt: linguaggio naturale → nodi da evidenziare + risposta breve
async function consoleQuery(q) {
  const { text } = contentIndex();
  const system = BRAND_SYSTEM + `\nRicevi una richiesta del visitatore e l'indice dei contenuti del sito. Rispondi SOLO con JSON:
{"answer": "risposta in italiano, massimo 2 frasi, senza elenchi, che nomina esplicitamente le aree o i lavori pertinenti", "highlight": ["id","id"], "open": "id o null", "mode": {"density": null, "energy": null}}
REGOLE:
- highlight è OBBLIGATORIO e deve contenere da 2 a 6 id presi ESATTAMENTE dall'indice (senza il prefisso cap:/work:/signal:), scegliendo prima le aree, poi i lavori, poi al massimo un segnale del radar.
- open: l'id più pertinente da aprire (di solito un'area o un lavoro), mai null se esiste qualcosa di pertinente.
- mode.density: SOLO se il visitatore parla esplicitamente di tempo o fretta ("ho fretta", "l'essenziale", "in due minuti" → "2"; "voglio approfondire", "ho tempo" → "all"); in tutti gli altri casi null.
- mode.energy: SOLO se il visitatore chiede esplicitamente calma/meno animazioni ("calm") o più energia ("vivid"); altrimenti null.
- Se la richiesta non c'entra con Frameworks, rispondi con garbo in una frase e proponi un'area; highlight resta pieno.`;
  const user = `INDICE:\n${text}\n\nRICHIESTA: ${q}`;
  const out = await complete({ system, user, json: true, maxTokens: 400, kind: "console", cacheMinutes: 60 * 24 });
  const valid = new Set([...contentIndex().c.caps.map(x => x.id), ...contentIndex().c.works.map(x => x.id), ...contentIndex().c.signals.map(x => x.id)]);
  out.highlight = (out.highlight || []).map(String).filter(id => valid.has(id)).slice(0, 6);
  out.open = valid.has(out.open) ? out.open : null;
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

module.exports = { config, isConfigured, complete, consoleQuery, adapt, classifySignals };
