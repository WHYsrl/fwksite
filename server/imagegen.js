// Denoise: il visitatore nomina un oggetto, il modello di immagini di OpenAI lo genera nello stile del sito.
// Il "denoising" a passi lo fa il browser (public/js/diffusion.js): qui si genera, si modera, si mette in cache e si limita.
const crypto = require("crypto");
const store = require("./db");

const STYLE = {
  vivid: "luce viola e magenta radente, riflessi iridescenti",
  calm: "luce blu notte e lavanda, atmosfera quieta",
  nervous: "luce verde salvia e menta, atmosfera calma e morbida",
  light: "fondo bianco luminoso, luce diffusa, ombre leggere, accenti viola"
};
// parole che non hanno senso in una vetrina di brand (filtro grezzo; poi la moderazione OpenAI)
const BLOCK = /\b(nud[oaie]|nak|sess|sex|porn|xxx|erotic|violen|sangu|blood|arma|weapon|pistol|gun|fucil|bomb|drog|cocain|nazi|hitler|swastik|suicid|stupr|rape|pedo|minorenn|bambin[oaie]\s+nud|gore|tortur|decapit)/i;

function cfg() {
  const a = store.getSetting("ai", {});
  return {
    key: process.env.OPENAI_API_KEY || a.openai_key || "",
    model: process.env.OPENAI_IMAGE_MODEL || a.openai_image_model || "gpt-image-2.5-flare",
    quality: ["low", "medium", "high"].includes(a.image_quality) ? a.image_quality : "medium",
    size: a.image_size || "1024x1024",
    enabled: a.image_enabled == null ? true : !!a.image_enabled, // attivo di default: basta la chiave
    dailyLimit: +a.image_daily_limit || 120
  };
}
const isConfigured = () => !!cfg().key;
function imagesToday() { return store.db.prepare("SELECT COUNT(*) n FROM ai_log WHERE kind='image' AND created_at > datetime('now','-1 day')").get().n; }
const err = (msg, code) => { const e = new Error(msg); e.code = code; return e; };
const clean = (s) => String(s || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);

async function moderate(text, key) {
  try {
    const r = await fetch("https://api.openai.com/v1/moderations", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}` }, body: JSON.stringify({ model: "omni-moderation-latest", input: text }) });
    const d = await r.json(); if (!r.ok) return true; // se la moderazione non risponde, decide il modello
    return !(d.results && d.results[0] && d.results[0].flagged);
  } catch { return true; }
}

function buildPrompt(subject, mood, frame) {
  const style = STYLE[mood] || STYLE.vivid;
  const framing = frame === "landscape" ? " Inquadratura orizzontale ampia: il soggetto al centro, la scena e lo sfondo si estendono ai lati." : frame === "portrait" ? " Inquadratura verticale: il soggetto al centro, la scena e lo sfondo si estendono sopra e sotto." : "";
  return `Fotografia still life di ${subject}: oggetto singolo al centro dell'inquadratura, set da studio, ${style}, superfici lucide e materiali credibili, resa CGI fotorealistica, composizione pulita ed elegante, nessun testo, nessuna scritta, nessuna persona.${framing}`;
}
// Formati che chiedono al modello una ri-inquadratura vera (le dimensioni disponibili sono 3:2 e 2:3)
const FRAMES = { "16:9": { frame: "landscape", size: "1536x1024" }, "32:9": { frame: "landscape", size: "1536x1024" }, "9:16": { frame: "portrait", size: "1024x1536" } };

// Genera (o ripesca dalla cache) l'immagine per un soggetto. Ritorna { image: dataURL, subject, model, cached }.
async function generate({ q, mood, format }) {
  const c = cfg();
  if (!c.enabled) throw err("Funzione disattivata", "disabled");
  if (!c.key) throw err("Generazione immagini non configurata: manca la chiave OpenAI", "not_configured");
  const subject = clean(q);
  if (subject.length < 2) throw err("Nomina un oggetto (almeno due lettere)", "bad_request");
  if (BLOCK.test(subject)) throw err("Proviamo con un altro oggetto", "rejected");
  const m = ["vivid", "calm", "nervous", "light"].includes(mood) ? mood : "vivid";
  const fr = FRAMES[format] || null;
  const prompt = buildPrompt(subject, m, fr && fr.frame);
  const size = fr ? fr.size : c.size;
  const key = "img:" + crypto.createHash("sha1").update([c.model, c.quality, size, prompt].join("|")).digest("hex");
  const hit = store.cacheGet(key, 60 * 24 * 30);
  if (hit && hit.image) return { ...hit, cached: true };
  if (imagesToday() >= c.dailyLimit) throw err("Per oggi il modello ha finito le generazioni: riprova domani", "rate_limited");
  if (!(await moderate(subject, c.key))) throw err("Proviamo con un altro oggetto", "rejected");
  // ri-inquadratura: se c'è già l'immagine base, si passa come riferimento (endpoint edits) così il soggetto resta lo stesso
  const baseKey = fr ? "img:" + crypto.createHash("sha1").update([c.model, c.quality, c.size, buildPrompt(subject, m, null)].join("|")).digest("hex") : null;
  const base = baseKey ? store.cacheGet(baseKey, 60 * 24 * 30) : null;
  let r;
  if (base && base.image) {
    const fd = new FormData();
    fd.append("image", new Blob([Buffer.from(base.image.split(",")[1], "base64")], { type: "image/jpeg" }), "base.jpg");
    fd.append("model", c.model); fd.append("prompt", `Stessa scena e stesso oggetto dell'immagine di riferimento, ri-inquadrati in formato ${fr.frame === "landscape" ? "orizzontale" : "verticale"}: estendi il set e lo sfondo, mantieni luce, materiali e stile. ${prompt}`);
    fd.append("n", "1"); fd.append("size", size); fd.append("quality", c.quality); fd.append("output_format", "jpeg"); fd.append("output_compression", "82");
    r = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { authorization: `Bearer ${c.key}` }, body: fd });
  } else {
    r = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${c.key}` },
      body: JSON.stringify({ model: c.model, prompt, n: 1, size, quality: c.quality, output_format: "jpeg", output_compression: 82 })
    });
  }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (d.error && d.error.message) || "Errore del modello di immagini";
    const code = (d.error && (d.error.code === "moderation_blocked" || d.error.code === "content_policy_violation")) ? "rejected" : "provider_error";
    throw err(code === "rejected" ? "Proviamo con un altro oggetto" : msg, code);
  }
  const b64 = d.data && d.data[0] && d.data[0].b64_json;
  if (!b64) throw err("Il modello non ha restituito un'immagine", "provider_error");
  store.logAi("image", (d.usage && d.usage.total_tokens) || 0);
  const out = { image: "data:image/jpeg;base64," + b64, subject, model: c.model, format: format || null };
  store.cacheSet(key, out);
  return { ...out, cached: false };
}

module.exports = { cfg, isConfigured, generate, imagesToday, buildPrompt };
