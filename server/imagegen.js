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

// Ogni formato chiede una composizione che riempia il quadro, non un ritaglio: il soggetto cambia posa o disposizione.
// Il 32:9 nasce su tela 3:2 come fascia centrale con bande nere sopra e sotto (il client le toglie): così il soggetto può davvero occupare tutta la larghezza.
// Area sicura: il soggetto intero, mai a contatto con i bordi. Ogni formato nasce sulla tela 3:2 o 2:3 come riquadro esatto con bande nere
// (letterbox/pillarbox) che il client toglie: così il modello compone davvero nel formato finale e nulla viene ritagliato.
const SAFE = " Il soggetto è intero e interamente visibile, dentro un'area sicura al centro della fotografia: nessuna sua parte tocca o esce dai bordi della fotografia, e intorno resta un margine libero di almeno un decimo. Proporzioni naturali e realistiche del soggetto, mai allungato, schiacciato o deformato per adattarlo al formato: per riempire il quadro si cambia posa, distanza o si estende il set, non le proporzioni.";
const FRAMING = {
  landscape: " La fotografia è in formato 16:9 e occupa la tela per tutta la larghezza, con due sottili bande nere piatte e uniformi sopra e sotto (circa l'8% dell'altezza ciascuna). Composizione orizzontale: il soggetto è ricomposto per sfruttare la larghezza (disteso, coricato, di profilo, o con più elementi affiancati) e la scena si estende ai lati." + SAFE,
  portrait: " La fotografia è in formato verticale 9:16 e occupa la tela per tutta l'altezza, con due sottili bande nere piatte e uniformi a sinistra e a destra (circa l'8% della larghezza ciascuna). Composizione verticale: il soggetto, nelle sue proporzioni naturali, è ripreso da più vicino o in una posa che si sviluppa in altezza (in piedi, eretto), e il set si estende sopra e sotto di lui." + SAFE,
  wide: " Formato ultra-panoramico 32:9 per un maxi-schermo (largo quasi quattro volte l'altezza): la fotografia occupa soltanto una fascia orizzontale al centro della tela, alta circa il 45% e larga quanto tutta la tela; sopra e sotto la fascia ci sono bande nere piatte e uniformi, come un cinemascope. Dentro la fascia il soggetto riempie quasi tutta la larghezza: un animale è sdraiato per lungo, un oggetto è coricato o ripreso di profilo da vicino, altrimenti più esemplari in fila; nulla di importante fuori dalla fascia." + SAFE
};
function buildPrompt(subject, mood, frame) {
  const style = STYLE[mood] || STYLE.vivid;
  return `Fotografia still life di ${subject}: ${FRAMING[frame] ? "" : "oggetto singolo al centro dell'inquadratura, "}set da studio, ${style}, superfici lucide e materiali credibili, resa CGI fotorealistica, composizione pulita ed elegante, nessun testo, nessuna scritta, nessuna persona.${FRAMING[frame] || SAFE}`;
}
// Formati che chiedono al modello una ri-inquadratura vera (le dimensioni disponibili sono 3:2 e 2:3)
const FRAMES = { "16:9": { frame: "landscape", size: "1536x1024" }, "32:9": { frame: "wide", size: "1536x1024" }, "9:16": { frame: "portrait", size: "1024x1536" } };
// Con l'immagine base come riferimento: stesso soggetto, posa nuova
const RECOMPOSE = {
  landscape: "in orizzontale 16:9 (fotografia larga quanto la tela, con sottili bande nere sopra e sotto): lo stesso soggetto in una posa o disposizione che riempie la larghezza (disteso, coricato, di profilo), set esteso ai lati, soggetto intero e lontano dai bordi",
  portrait: "in verticale 9:16 (fotografia alta quanto la tela, con sottili bande nere a sinistra e a destra): lo stesso soggetto nelle sue proporzioni naturali (mai allungato), ripreso da più vicino o in una posa che si sviluppa in altezza (in piedi, eretto), set esteso sopra e sotto, soggetto intero e lontano dai bordi",
  wide: "in ultra-panoramico 32:9: la fotografia occupa una fascia orizzontale al centro della tela, alta circa il 45% e larga quanto tutta la tela, con bande nere piatte sopra e sotto; nella fascia lo stesso soggetto in una posa che riempie quasi tutta la larghezza (un animale sdraiato per lungo, un oggetto coricato o di profilo da vicino), intero e lontano dalle bande e dai bordi"
};

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
    fd.append("model", c.model); fd.append("prompt", `Stesso oggetto e stessa scena dell'immagine di riferimento (identici materiali, colori, luce e stile), ricomposti ${RECOMPOSE[fr.frame]}. ${prompt}`);
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
