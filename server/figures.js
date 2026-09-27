// Dati del contesto: i numeri che il campo di particelle della sezione "Il contesto" compone sullo schermo.
// Curati a mano con fonte e data (non esiste un feed aperto e affidabile per questi numeri); modificabili dal backoffice (/admin/dati).
// Ogni voce: kind = number (un numero grande) · bars (barre a confronto) · stream (flusso con contatore dal vivo, rate = unità al secondo) · words (parole che si alternano)
let dbMod = null; const db = () => dbMod || (dbMod = require("./db"));

const DEFAULT = [
  { id: "internet", kind: "number", cat: "Il mondo online", label: "persone connesse a internet", display: "6,04 mld", source: "DataReportal · Digital 2026", date: "ott 2025", url: "https://datareportal.com/reports/digital-2026-global-overview-report" },
  { id: "social-users", kind: "number", cat: "Social", label: "identità social nel mondo: sette persone su dieci", display: "5,66 mld", source: "DataReportal · Digital 2026", date: "ott 2025", url: "https://datareportal.com/reports/digital-2026-global-overview-report" },
  { id: "social-platforms", kind: "bars", cat: "Social", label: "utenti mensili delle piattaforme", source: "Meta, Google, DataReportal, Telegram", date: "2025–2026", bars: [
    { name: "Facebook", value: 3.07, display: "3,07 mld" }, { name: "Instagram", value: 3.0, display: "3 mld" }, { name: "WhatsApp", value: 3.0, display: "3 mld" }, { name: "YouTube", value: 2.5, display: "2,5 mld" },
    { name: "TikTok", value: 1.6, display: "1,6 mld" }, { name: "WeChat", value: 1.4, display: "1,4 mld" }, { name: "Telegram", value: 1.0, display: "1 mld" }, { name: "Threads", value: 0.5, display: "500 mln" } ] },
  { id: "meta-dap", kind: "number", cat: "Social", label: "persone che ogni giorno aprono un'app Meta", display: "3,60 mld", source: "Meta · risultati Q2 2026", date: "giu 2026", url: "https://investor.atmeta.com/investor-news/press-release-details/2026/Meta-Reports-Second-Quarter-2026-Results/default.aspx" },
  { id: "ai-assistants", kind: "bars", cat: "Assistenti AI", label: "persone che usano un assistente AI", source: "Alphabet, Meta, OpenAI", date: "2025–2026", bars: [
    { name: "AI Mode · Google", value: 1.0, display: "1 mld / mese" }, { name: "Meta AI", value: 1.0, display: "1 mld / mese" }, { name: "Gemini", value: 0.95, display: "950 mln / mese" }, { name: "ChatGPT", value: 0.9, display: "900 mln / settimana" } ] },
  { id: "chatgpt-messages", kind: "stream", cat: "Assistenti AI", label: "messaggi inviati a ChatGPT ogni giorno", display: "2,5 mld", rate: 2.5e9 / 86400, counter: "messaggi a ChatGPT da quando sei su questa pagina", source: "OpenAI", date: "feb 2026" },
  { id: "google-tokens", kind: "stream", cat: "Token", label: "token elaborati da Google ogni mese, sette volte l'anno prima", display: "3,2 quadrilioni", rate: 3.2e15 / (30 * 86400), counter: "token elaborati da Google da quando sei qui", source: "Sundar Pichai · Google I/O", date: "mag 2026" },
  { id: "hf-models", kind: "words", cat: "Modelli", label: "modelli pubblici su Hugging Face, quasi tremila nuovi al giorno", display: "3 mln", words: ["GPT-5", "Claude", "Gemini", "Llama", "DeepSeek", "Mistral", "Qwen", "Grok", "Veo", "Sora", "Kling", "Seedream", "Flux"], source: "Hugging Face", date: "ago 2026", url: "https://huggingface.co/blog/ivanfioravanti/three-million-models-and-counting" }
];

const KINDS = ["number", "bars", "stream", "words"];
const str = (v, n = 160) => String(v == null ? "" : v).trim().slice(0, n);
// Valida una lista (dal backoffice): scarta le voci senza senso, normalizza i campi
function clean(list) {
  if (!Array.isArray(list)) return null;
  const out = [];
  list.forEach((f, i) => {
    if (!f || typeof f !== "object") return;
    const kind = KINDS.includes(f.kind) ? f.kind : "number";
    const o = { id: str(f.id || "f" + i, 40).replace(/[^a-z0-9-]/gi, "-").toLowerCase(), kind, cat: str(f.cat, 40), label: str(f.label, 140), display: str(f.display, 24), source: str(f.source, 80), date: str(f.date, 24), url: /^https?:\/\//.test(f.url || "") ? str(f.url, 300) : "" };
    if (kind === "bars") { o.bars = (Array.isArray(f.bars) ? f.bars : []).slice(0, 10).map(b => ({ name: str(b.name, 30), value: Math.max(0, +b.value || 0), display: str(b.display, 20) })).filter(b => b.name && b.value > 0); if (!o.bars.length) return; }
    if (kind === "stream") { o.rate = Math.max(0, +f.rate || 0); o.counter = str(f.counter, 90); if (!o.rate) return; }
    if (kind === "words") { o.words = (Array.isArray(f.words) ? f.words : String(f.words || "").split(/[,\n]/)).map(w => str(w, 24)).filter(Boolean).slice(0, 24); if (!o.words.length) return; }
    if (!o.label && !o.display) return;
    out.push(o);
  });
  return out.length ? out : null;
}
function list() { try { const v = db().getSetting("context_figures", null); return clean(v) || DEFAULT; } catch { return DEFAULT; } }
function save(json) { const v = clean(JSON.parse(json)); if (!v) throw new Error("Nessuna voce valida: controlla il JSON"); db().setSetting("context_figures", v); return v; }
function reset() { db().setSetting("context_figures", null); }

module.exports = { DEFAULT, list, save, reset, clean };
