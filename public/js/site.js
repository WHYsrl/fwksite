/* =========================================================
   FRAMEWORKS · sito — console desktop, feed mobile, modalità
   ambientali, AI (server o capability "sample" nel preview)
   ========================================================= */
(() => {
"use strict";
const DATA = window.__DATA__ || { site: {}, caps: [], works: [], signals: [], features: {} };
const PREVIEW = !!window.__PREVIEW__;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const em = (s) => String(s ?? "").replace(/<em>/g, '<span class="serif">').replace(/<\/em>/g, "</span>");
const isMobile = () => matchMedia("(max-width: 820px)").matches;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
// Lingua: la decide il server (<html lang>); t("testo italiano") restituisce l'inglese dal dizionario di i18n.js, altrimenti il testo com'è
const LANG = String(document.documentElement.lang || "it").toLowerCase().startsWith("en") ? "en" : "it";
const t = window.FW_I18N ? window.FW_I18N.make(LANG) : Object.assign((s, vars) => { let o = String(s); if (vars) Object.keys(vars).forEach(k => { o = o.split("{" + k + "}").join(vars[k]); }); return o; }, { lang: "it" });
const LOCALE = LANG === "en" ? "en-GB" : "it-IT";
const media = (p) => PREVIEW && p && p.startsWith("/media/") ? p.slice(1) : p;
// Video dei lavori: link Vimeo (vimeo.com/ID o vimeo.com/ID/HASH) → player in loop muto; file mp4/webm → <video>; altrimenti immagine.
const vimeoId = (u) => { const m = /vimeo\.com\/(?:video\/)?(\d+)(?:\/([a-z0-9]+))?/i.exec(u || ""); return m ? { id: m[1], h: m[2] } : null; };
function workMedia(item, fallback) {
  const v = (item.video_url || "").trim();
  if (v) {
    const vm = vimeoId(v);
    if (vm) return `<div class="d-img video"><iframe src="https://player.vimeo.com/video/${vm.id}?${vm.h ? "h=" + vm.h + "&" : ""}background=1&autoplay=1&loop=1&muted=1&autopause=0&dnt=1" allow="autoplay; fullscreen; picture-in-picture" loading="lazy" title="${t("Video del progetto")}"></iframe></div>`;
    if (/\.(mp4|webm|mov)(\?|$)/i.test(v)) return `<div class="d-img video"><video src="${esc(v)}" autoplay muted loop playsinline preload="metadata"${item.image ? ` poster="${esc(media(item.image))}"` : ""}></video></div>`;
  }
  return `<div class="d-img"><img src="${media(item.image) || media(fallback)}" alt=""></div>`;
}
const capById = (id) => DATA.caps.find(c => c.id === id);
const capName = (id) => (capById(id) || {}).name || id;
const worksFor = (id) => DATA.works.filter(w => w.caps.includes(id));
const signalsFor = (id) => DATA.signals.filter(s => s.caps.includes(id));
const ALL = () => [{ id: "core", kind: "core" }, ...DATA.caps.map(c => ({ ...c, kind: "cap" })), ...DATA.works.map(w => ({ ...w, kind: "work" })), ...DATA.signals.map(s => ({ ...s, kind: "signal" }))];
const byId = (id) => ALL().find(i => i.id === id);
const html = document.documentElement;
// Palette corrente (cambia con l'umore): i canvas leggono i colori dalle variabili CSS, non da costanti
const Theme = {
  accent: "#BF00FF", accentRgb: "191,0,255", bg: "#050307", paper: "#EEEAF1",
  ink: "#fff", ink2: "#CFC7D8", ink3: "#8B8197", inkRgb: "255,255,255",
  from(el) { const cs = getComputedStyle(el || html); const v = (n, d) => (cs.getPropertyValue(n) || "").trim() || d; const t = { accent: v("--accent", "#BF00FF"), accentRgb: v("--accent-rgb", "191,0,255"), bg: v("--bg", "#050307"), paper: v("--paper", "#EEEAF1"), ink: v("--ink", "#fff"), ink2: v("--ink-2", "#CFC7D8"), ink3: v("--ink-3", "#8B8197"), inkRgb: v("--ink-rgb", "255,255,255") }; t.rgba = (a) => `rgba(${t.accentRgb},${a})`; t.inkA = (a) => `rgba(${t.inkRgb},${a})`; return t; },
  read() { Object.assign(this, this.from(html)); return this; },
  rgba(a) { return `rgba(${this.accentRgb},${a})`; }
};
Theme.read();
// Immagini chiare per il mood "Chiaro": il server elenca in DATA.lightMedia le versioni chiare (public/media/light/*) delle immagini d'ambiente;
// qui si scambia il src delle <img> quando cambia il mood, anche per le parti disegnate dopo (schermate mobile, drawer)
const LightMedia = {
  map: DATA.lightMedia || {}, timer: 0,
  light(src) { const s = String(src || ""); const i = s.lastIndexOf("/media/"); if (i < 0) return null; const k = s.slice(i); return this.map[k] ? media(this.map[k]) : null; },
  apply() {
    if (!Object.keys(this.map).length) return;
    document.body.classList.add("light-media");
    const on = html.dataset.mood === "light";
    $$("img").forEach(img => {
      if (on) { if (img.dataset.dark) return; const l = this.light(img.getAttribute("src")); if (l) { img.dataset.dark = img.getAttribute("src"); img.src = l; } }
      else if (img.dataset.dark) { img.src = img.dataset.dark; delete img.dataset.dark; }
    });
  },
  init() {
    if (!Object.keys(this.map).length) return;
    document.addEventListener("fw:theme", () => this.apply());
    new MutationObserver(() => { clearTimeout(this.timer); this.timer = setTimeout(() => this.apply(), 60); }).observe(document.body, { childList: true, subtree: true });
    this.apply();
  }
};
const hasGsap = typeof window.gsap !== "undefined";
if (hasGsap && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
const fmtDate = (d) => { if (!d) return ""; const [y, m, day] = d.split("-"); const mesi = LANG === "en" ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] : ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"]; return m ? `${+day || ""} ${mesi[(+m) - 1] || ""} ${y}`.trim() : d; };
const domain = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const fmtWhen = (iso) => { try { return new Intl.DateTimeFormat(LOCALE, { timeZone: "Europe/Rome", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)); } catch { return ""; } };

/* =========================================================
   CONTESTO E MODALITÀ AMBIENTALI
   ========================================================= */
const Ctx = {
  weather: null,
  local() {
    const now = new Date(); const h = now.getHours();
    return { time: new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit" }).format(now), day: new Intl.DateTimeFormat(LOCALE, { weekday: "long" }).format(now), slot: h < 6 ? t("notte") : h < 12 ? t("mattina") : h < 18 ? t("pomeriggio") : t("sera"), night: h < 6, hour: h,
      mobile: isMobile(), device: isMobile() ? (matchMedia("(pointer: coarse)").matches ? t("telefono") : t("finestra stretta")) : (matchMedia("(pointer: coarse)").matches ? "tablet" : "desktop"), vw: innerWidth, vh: innerHeight,
      lang: (navigator.language || "it").toLowerCase(), reduced, dark: matchMedia("(prefers-color-scheme: dark)").matches, conn: navigator.connection && navigator.connection.effectiveType || null };
  },
  async fetchWeather() {
    if (PREVIEW) return null;
    try { const r = await fetch("/api/context", { cache: "no-store" }); const j = await r.json(); this.weather = j.weather; return j; } catch { return null; }
  }
};
const Modes = {
  density: (() => { try { return sessionStorage.getItem("fw.density") || "10"; } catch { return "10"; } })(), mood: (() => { try { return sessionStorage.getItem("fw.mood") || "auto"; } catch { return "auto"; } })(),
  apply() {
    html.dataset.density = this.density;
    const w = Ctx.weather; const c = Ctx.local();
    const kind = w ? w.kind : (c.hour < 7 || c.hour >= 21 ? "night" : "unknown");
    html.dataset.weather = kind;
    let energy = this.mood === "nervous" ? "calm" : this.mood === "light" ? "auto" : this.mood; // il mood "chiaro" non forza il ritmo
    if (energy === "auto") energy = (kind === "rain" || kind === "night" || kind === "snow" || c.night) ? "calm" : (kind === "storm" || kind === "sun") ? "vivid" : "auto";
    html.dataset.energy = energy; html.dataset.mood = this.mood;
    Theme.read(); document.dispatchEvent(new CustomEvent("fw:theme")); // i canvas si adeguano alla palette dell'umore
    $$(".seg [data-density]").forEach(b => b.classList.toggle("on", b.dataset.density === this.density));
    const lbl = $(".modes-lbl"); if (lbl) lbl.textContent = isMobile() ? (this.density === "2" ? t("Essenziale") : t("Modalità")) : (this.density === "2" ? t("Essenziale · mostra tutto") : this.density === "all" ? t("Modalità · tutto") : t("Modalità"));
    const mb = $("#modes-btn"); if (mb) mb.classList.toggle("reduced", this.density === "2");
    $$(".seg [data-mood]").forEach(b => b.classList.toggle("on", b.dataset.mood === this.mood));
    const env = $("#modes-env"); if (env) env.textContent = `${t("Roma")} · ${c.day} ${c.slot} · ${w && w.temp != null ? w.temp + "° · " + weatherLabel(w) : t("meteo non disponibile")} · ${t("ritmo")} ${this.mood === "nervous" ? t("essenziale") : energy === "calm" ? t("calmo") : energy === "vivid" ? t("vivace") : t("neutro")}`;
    const sw = $("#status-weather"); if (sw) sw.textContent = w && w.temp != null ? `· ${w.temp}° ${weatherLabel(w)}` : "";
    if (isMobile() && typeof App !== "undefined" && App.applyDensity) App.applyDensity(); // su mobile la densità nasconde/mostra i blocchi subito
    if (window.ScrollTrigger) setTimeout(() => ScrollTrigger.refresh(), 50);
  },
  set(k, v) { this[k] = v; try { sessionStorage.setItem("fw." + k, v); } catch {} this.apply(); }
};
function labelWeather(k) { const s = { sun: "sereno", cloud: "nuvoloso", rain: "pioggia", storm: "temporale", snow: "neve", night: "notte", unknown: "" }[k] || ""; return s ? t(s) : ""; }
// Condizioni dal codice WMO di Open-Meteo: etichetta breve e frase discorsiva (il "kind" serve solo al ritmo del sito, e di notte dice solo "notte")
const WMO = { 0: ["sereno", "il cielo è sereno"], 1: ["quasi sereno", "il cielo è quasi sereno"], 2: ["poco nuvoloso", "il cielo è poco nuvoloso"], 3: ["coperto", "il cielo è coperto"], 45: ["nebbia", "c'è nebbia"], 48: ["nebbia", "c'è nebbia"],
  51: ["pioviggine", "pioviggina"], 53: ["pioviggine", "pioviggina"], 55: ["pioviggine fitta", "pioviggina fitto"], 56: ["pioviggine gelata", "cade pioviggine gelata"], 57: ["pioviggine gelata", "cade pioviggine gelata"],
  61: ["pioggia leggera", "piove leggermente"], 63: ["pioggia", "piove"], 65: ["pioggia forte", "piove forte"], 66: ["pioggia gelata", "cade pioggia gelata"], 67: ["pioggia gelata", "cade pioggia gelata"],
  71: ["neve leggera", "nevica leggermente"], 73: ["neve", "nevica"], 75: ["neve forte", "nevica forte"], 77: ["neve", "nevica"], 80: ["rovesci", "ci sono rovesci"], 81: ["rovesci", "ci sono rovesci"], 82: ["rovesci violenti", "ci sono rovesci violenti"], 85: ["rovesci di neve", "ci sono rovesci di neve"], 86: ["rovesci di neve", "ci sono rovesci di neve"],
  95: ["temporale", "c'è un temporale"], 96: ["temporale con grandine", "c'è un temporale con grandine"], 99: ["temporale con grandine", "c'è un temporale con grandine"] };
function weatherLabel(w) { const e = w && w.code != null && WMO[w.code]; return e ? t(e[0]) : labelWeather(w && w.kind); }
function weatherPhrase(w) { const e = w && w.code != null && WMO[w.code]; return e ? t(e[1]) : ""; }
// La qualità di rete stimata dal browser (Network Information API): "4g" vuol dire solo "veloce", anche su wifi o fibra
function connLabel(c) { const s = { "slow-2g": "lenta", "2g": "lenta", "3g": "media", "4g": "veloce" }[c] || ""; return s ? t(s) : ""; }
(function modesUI() {
  const btn = $("#modes-btn"), panel = $("#modes"); if (!btn || !panel) return;
  if (DATA.site.modes_enabled === false) { btn.hidden = true; return; }
  const open = (o) => { panel.hidden = !o; btn.setAttribute("aria-expanded", String(o)); };
  btn.addEventListener("click", () => { if (Modes.density === "2") { Modes.set("density", "10"); open(false); return; } open(panel.hidden); });
  $("#modes-close").addEventListener("click", () => open(false));
  document.addEventListener("click", e => { if (!panel.hidden && !panel.contains(e.target) && !btn.contains(e.target)) open(false); });
  panel.addEventListener("click", e => {
    const d = e.target.closest(".seg [data-density]"); if (d) { Modes.set("density", d.dataset.density); Prefs.set({ ...(Prefs.get() || {}), time: d.dataset.density }); }
    const m = e.target.closest(".seg [data-mood]"); if (m) { Modes.set("mood", m.dataset.mood); Prefs.set({ ...(Prefs.get() || {}), mood: ["calm", "vivid", "nervous", "light"].includes(m.dataset.mood) ? m.dataset.mood : null }); }
  });
})();

function renderContext() {
  const c = Ctx.local(); const w = Ctx.weather;
  const langName = c.lang.startsWith("it") ? t("italiano") : c.lang.startsWith("en") ? t("inglese") : c.lang.startsWith("fr") ? t("francese") : c.lang.startsWith("de") ? t("tedesco") : c.lang.startsWith("es") ? t("spagnolo") : c.lang;
  const v = (x) => `<span class="v">${x}</span>`;
  const parts = [t("Sono le {time} di {day}{weather}.", { time: v(esc(c.time)), day: v(esc(c.day) + " " + c.slot), weather: w && w.temp != null ? t(" e a Roma ci sono {temp}", { temp: v(w.temp + "°") }) + (weatherPhrase(w) ? t(" e {phrase}", { phrase: v(weatherPhrase(w)) }) : "") : "" }),
    t("Stai leggendo da un {device} di {size} pixel, con il browser in {lang}, con le animazioni {motion}, densità {density}.", { device: v(esc(c.device)), size: v(c.vw + "×" + c.vh), lang: v(esc(langName)), motion: v(c.reduced ? t("ridotte") : t("attive")), density: v(Modes.density === "2" ? t("essenziale") : Modes.density === "10" ? t("media") : t("completa")) }),
    c.mobile ? t("Per questo vedi un feed verticale: su un desktop gli stessi contenuti diventano una console esplorabile.") : t("Per questo vedi la Console: su un telefono gli stessi contenuti diventano un feed verticale."),
    t("Un sistema, tante esperienze: è il principio con cui progettiamo ogni organismo di contenuto.")];
  const kv = [[t("Ora locale"), c.time], [t("Giorno"), `${c.day} · ${c.slot}`], [t("Dispositivo"), c.device], [t("Schermo"), `${c.vw} × ${c.vh}`], [t("Lingua del browser"), langName], [t("Movimento"), c.reduced ? t("ridotto") : t("attivo")], [t("Meteo Roma"), w && w.temp != null ? `${w.temp}° · ${weatherLabel(w)}` : t("n.d.")], [t("Ritmo"), Modes.mood === "nervous" ? t("essenziale") : html.dataset.energy === "calm" ? t("calmo") : html.dataset.energy === "vivid" ? t("vivace") : t("neutro")], [t("Densità"), Modes.density === "all" ? t("tutto") : Modes.density + " min"]];
  if (connLabel(c.conn)) kv.push([t("Connessione"), connLabel(c.conn)]);
  const kvHTML = kv.map(([k, v]) => `<div><small>${esc(k)}</small><b>${esc(v)}</b></div>`).join("");
  const ct = $("#context-text"); if (ct) ct.innerHTML = parts.join(" ");
  const k = $("#context-kv"); if (k) k.innerHTML = kvHTML;
  const sr = $("#status-right"); if (sr) sr.innerHTML = `<b>${DATA.caps.length}</b> ${t("aree")} · <b>${DATA.works.length}</b> ${t("lavori")} · <b>${DATA.signals.length}</b> radar · <b>${esc(c.device)} · ${esc(c.day)} · ${c.slot}</b>`;
  return { c, kvHTML, text: parts.join(" ") };
}
(function clock() { const el = $("#clock"); if (!el) return; const tick = () => el.textContent = new Intl.DateTimeFormat(LOCALE, { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date()); tick(); setInterval(tick, 1000); })();
(function statusWords() { const el = $("#status-words"); if (!el) return; const words = DATA.site.closing && DATA.site.closing.length ? DATA.site.closing : ["On Air", "Live", "Alive"]; let i = 0; setInterval(() => { i = (i + 1) % words.length; el.textContent = words[i]; }, 4000); })();

/* =========================================================
   AI — server (produzione) o capability "sample" (preview)
   ========================================================= */
/* scelte fatte nell'intro (tempo, umore): complementari alla Console, che ne tiene conto nel percorso */
const Prefs = {
  get() { try { return JSON.parse(sessionStorage.getItem("fw.prefs") || "null"); } catch { return null; } },
  set(p) { try { sessionStorage.setItem("fw.prefs", JSON.stringify({ time: p.time || null, mood: p.mood || null })); } catch {} },
  text() { const p = this.get(); if (!p) return ""; const tt = { "2": t("2 minuti"), "10": t("10 minuti"), all: t("tutto il tempo che serve") }[p.time]; const m = { calm: t("mood notturno"), vivid: t("mood acceso"), nervous: t("mood quieto, dritto al punto"), light: t("mood chiaro") }[p.mood]; return [tt, m].filter(Boolean).join(", "); }
};

const AI = {
  available: null,
  async check() {
    if (this.available != null) return this.available;
    if (!PREVIEW) { this.available = !!window.__AI__; return this.available; }
    try { const s = window.claude && await window.claude.use("sample"); this.available = !!s; this.sample = s; } catch { this.available = false; }
    return this.available;
  },
  index() {
    const caps = DATA.caps.map(x => `- [cap:${x.id}] ${x.name}: ${x.short}`).join("\n");
    const works = DATA.works.map(x => `- [work:${x.id}] ${x.client} — ${x.title} (${x.year}) · aree: ${x.caps.join(", ")}: ${x.short}`).join("\n");
    const sig = DATA.signals.slice(0, 20).map(x => `- [signal:${x.id}] ${x.src} (${x.date}): ${x.title} · aree: ${x.caps.join(", ")}`).join("\n");
    return `AREE:\n${caps}\n\nLAVORI:\n${works}\n\nRADAR (notizie esterne, di terzi):\n${sig}`;
  },
  brand: `Sei la Console di Frameworks (Frame by Frame, Roma): Adaptive Content Systems, "organismi di comunicazione sintetici viventi, capaci di adattarsi a ogni contesto". Tono lucido, concreto, elegante, italiano, frasi brevi, niente elenchi. Non inventare lavori o dati; le notizie del Radar sono di terzi.`,
  async console(q, history = []) {
    const prefs = Prefs.get() || {};
    if (!PREVIEW) { const r = await fetch("/api/ai/console", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q, history, prefs, lang: LANG }) }); const j = await r.json(); if (!r.ok) throw new Error(j.error || t("Errore")); return j; }
    const hist = history.length ? `\nCONVERSAZIONE PRECEDENTE:\n${history.map(h => `Visitatore: ${h.q}\nConsole: ${h.a}`).join("\n")}\n` : "";
    const pt = { "2": "2 minuti: solo l'essenziale → al massimo 2 aree e 1 lavoro, niente radar, una frase", "10": "10 minuti → 2-3 aree e 2-3 lavori", all: "tutto il tempo → fino a 6 elementi, radar incluso se pertinente" }[prefs.time];
    const pm = { calm: "notturno: tono disteso", vivid: "acceso: tono energico, puoi includere il radar", nervous: "quieto: asciutto, niente radar", light: "chiaro: tono limpido e leggero" }[prefs.mood];
    const pref = pt || pm ? `\nPREFERENZE GIÀ SCELTE ALL'INGRESSO (rispettale):${pt ? " tempo = " + pt + ";" : ""}${pm ? " umore = " + pm : ""}\n` : "";
    const out = await this.sample.json(`${this.brand}\nRispondi SOLO con JSON: {"answer":"in italiano, senza elenchi: prima la risposta vera, poi cosa proponi di vedere","label":"2-3 parole che riassumono il percorso","highlight":["id"],"sections":["id"],"ask":null,"mode":{"density":null,"energy":null}}\nCOME RISPONDI: domande su Frameworks → fatti dell'indice (tecnologie, formati e casi d'uso compresi), 1-3 frasi; domande generali del nostro campo (comunicazione, media, formati, DOOH, social, retail, CGI, XR, AI creativa, tendenze) → rispondi da esperto in 2-4 frasi specifiche e poi collega a ciò che facciamo; domande fuori campo (ricette, meteo, codice, salute) → una frase gentile e sections sistema, aree. Competente e pertinente, non un assistente universale.\nREGOLE: highlight solo con aree/lavori/segnali davvero legati alla richiesta (id ESATTI, senza prefisso), altrimenti vuoto; sections tra sistema, aree, lavori, metodo, team, radar, contatti (persone → team; chi siamo → sistema; domande generiche → sistema, aree, metodo con label "Scopri Frameworks"); se la richiesta è troppo vaga, highlight e sections vuoti e ask = {"question":"una domanda breve","options":["3-4 opzioni brevi"]}; mode.density "2" solo se nella richiesta il visitatore parla di fretta/poco tempo, "all" se vuole approfondire, altrimenti null (se ha già scelto il tempo, lascia null); mode.energy "calm" o "vivid" solo se lo chiede, altrimenti null.${pref}${hist}\nINDICE:\n${this.index()}\n\nRICHIESTA: ${q}`, { modelTier: "quick" });
    return out;
  },
  async adapt(p) {
    if (!PREVIEW) { const r = await fetch("/api/ai/adapt", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...p, lang: LANG }) }); const j = await r.json(); if (!r.ok) throw new Error(j.error || t("Errore")); return j; }
    const item = byId(p.itemId); const desc = item.client ? `PUNTO DI PARTENZA (lavoro): ${item.client} — ${item.title}. ${item.body}` : `PUNTO DI PARTENZA (area): ${item.name}. ${item.body}`;
    const caps = item.client ? (item.caps || []).map(capById).filter(Boolean) : [item];
    const toolbox = caps.map(x => `${x.name}: ${(x.tech || []).join(", ") || (x.tags || []).join(", ")}; casi d'uso: ${(x.uses || []).join("; ") || x.short}`).join("\n");
    const out = await this.sample.json(`${this.brand}\nSei un creative technologist senior di Frameworks. Rispondi con TRE IDEE CONCRETE per il contesto del visitatore, dritto al punto: niente premesse, niente ripetizione del punto di partenza. Ogni idea dice cosa vede il pubblico, dove (canale e formato precisi), con quale tecnologia o dispositivo (nomi veri) e cosa si adatta nel tempo o per pubblico. Tre idee diverse: una realizzabile subito, una ambiziosa, una che moltiplica le varianti. Niente idee banali. Usa solo la cassetta degli attrezzi:\n${toolbox}\nRispondi SOLO con JSON: {"summary":"1 frase, max 25 parole","ideas":[{"title":"3-6 parole","text":"2-3 frasi","tech":"tecnologie usate, 3-8 parole"}],"next":"1 frase che invita a un brief o brainstorming con il team di Frameworks"}\n${desc}\nCONTESTO — settore: ${p.sector || "n.d."}; canale: ${p.channel || "n.d."}; obiettivo: ${p.goal || "n.d."}`, { modelTier: "quick" });
    const ideas = (out.ideas || []).slice(0, 3);
    return { summary: out.summary || "", ideas, next: out.next || "", text: [out.summary, ...ideas.map(i => `${i.title}. ${i.text}`), out.next].filter(Boolean).join("\n\n") };
  }
};

/* =========================================================
   DETTAGLIO (drawer desktop / sheet mobile)
   ========================================================= */
function detailHTML(item) {
  const list = (items, label) => items.length ? `<div class="list">${items.map(i => `<button type="button" data-open="${i.id}"><span>${esc(i.kind === "work" ? i.client + " · " + i.title : i.kind === "signal" ? i.title : i.name)}</span><small>${label}</small></button>`).join("")}</div>` : "";
  const adapt = (id) => DATA.features.adapt !== false ? `<div class="adapt" data-adapt="${id}"><div class="eyebrow"><span class="dot"></span>${t("Adatta al tuo contesto")}</div><h4>${t("Tre idee concrete per il vostro brand.")}</h4><p class="adapt-hint">${t("Settore, canale e obiettivo: la Console risponde con proposte specifiche, senza giri di parole.")}</p><div class="grid"><input name="sector" placeholder="${t("Settore (es. automotive, farmaceutico, GDO)")}" maxlength="60"><input name="channel" placeholder="${t("Canale (es. DOOH aeroporti, TikTok, showroom)")}" maxlength="60"></div><input name="goal" placeholder="${t("Obiettivo (es. lancio in 12 paesi, traffico in store, formare la rete vendita)")}" maxlength="100" style="margin-top:8px"><button class="btn primary go" type="button">${t("Dammi tre idee")}</button><div class="adapt-out" hidden></div></div>` : "";
  const concrete = (item) => { const uses = item.uses || [], tech = item.tech || []; if (!uses.length && !tech.length) return `<div class="tags">${(item.tags || []).map(x => `<span class="tag">${esc(x)}</span>`).join("")}</div>`; return `<div class="d-concrete">${uses.length ? `<div><div class="eyebrow"><span class="dot"></span>${t("Casi d'uso")}</div><ul class="uses">${uses.map(u => `<li>${esc(u)}</li>`).join("")}</ul></div>` : ""}${tech.length ? `<div><div class="eyebrow"><span class="dot"></span>${t("Tecnologie, dispositivi e formati")}</div><div class="tags">${tech.map(x => `<span class="tag">${esc(x)}</span>`).join("")}</div></div>` : ""}</div>`; };
  if (item.kind === "core") return `<div class="d-img"><img src="${media(DATA.site.hero_image)}" alt=""></div><div class="d-in"><div class="eyebrow"><span class="dot"></span>${esc(DATA.site.claim)}</div><h2>${em(DATA.site.hero_title)}</h2><p>${esc(DATA.site.tagline)}</p><p>${esc(DATA.site.hero_text)}</p>${list(DATA.caps.map(c => ({ ...c, kind: "cap" })), t("area"))}</div>`;
  if (item.kind === "cap") return `<div class="d-img"><img src="${media(item.image) || media("/media/frames.jpg")}" alt=""></div><div class="d-in"><div class="eyebrow"><span class="dot"></span>${t("Area")}</div><h2>${esc(item.name)}</h2><p>${esc(item.body)}</p>${concrete(item)}${adapt(item.id)}${list(worksFor(item.id).map(w => ({ ...w, kind: "work" })), t("lavoro"))}${list(signalsFor(item.id).map(s => ({ ...s, kind: "signal" })), "radar")}</div>`;
  if (item.kind === "work") return `${workMedia(item, "/media/monolith.jpg")}<div class="d-in"><div class="eyebrow"><span class="dot"></span>${esc(item.client)} · ${esc(item.year)} · <span class="chip ghost">${esc(item.status)}</span></div><h2>${esc(item.title)}</h2><p>${esc(item.body)}</p>${adapt(item.id)}${list(item.caps.map(capById).filter(Boolean).map(c => ({ ...c, kind: "cap" })), t("area"))}</div>`;
  if (item.kind === "signal") return `<div class="d-in"><div class="eyebrow"><span class="chip ext">${t("Fonte esterna")}</span> &nbsp;${esc(item.src)} · ${esc(fmtDate(item.date))}</div><h2 class="serif" style="font-weight:400;font-size:28px">“${esc(item.title)}”</h2><div class="ext-note">${t("Contenuto di terzi: titolo e riassunto appartengono a {src} ({domain}). Frameworks lo segnala e lo commenta.", { src: esc(item.src), domain: esc(domain(item.url)) })}</div>${item.summary ? `<p>${esc(item.summary)}</p>` : ""}<p style="padding-left:16px;border-left:2px solid var(--accent)"><small class="eyebrow" style="display:block;color:var(--accent-ink);margin-bottom:6px">${t("La nostra lettura")}</small>${esc(item.why)}</p><p><a class="btn" href="${esc(item.url)}" target="_blank" rel="noopener nofollow">${t("Leggi la fonte")} ↗</a></p>${list(item.caps.map(capById).filter(Boolean).map(c => ({ ...c, kind: "cap" })), t("area"))}</div>`;
  return "";
}
const drawer = $("#drawer"), scrim = $("#scrim"), sheet = $("#sheet");
function openDetail(item) {
  if (!item) return;
  const h = detailHTML(item); const eyebrow = item.kind === "core" ? "Frameworks" : item.kind === "cap" ? t("Area") : item.kind === "work" ? t("Lavoro") : "Radar";
  if (isMobile()) { $("#sheet-body").innerHTML = h; $("#sheet-eyebrow").textContent = eyebrow; sheet.dataset.state = "open"; }
  else { $("#drawer-body").innerHTML = h; $("#drawer-eyebrow").textContent = eyebrow; drawer.dataset.state = "open"; drawer.querySelector(".drawer-body").scrollTop = 0; $$("#drawer-body iframe").forEach(f => { f.inert = true; f.tabIndex = -1; }); DrawerNav.update(item); } // il loop video non prende il fuoco: ← → restano al drawer
  scrim.dataset.state = "open";
  AI.check().then(ok => { if (!ok) $$(".adapt").forEach(a => a.hidden = true); });
}
function closeDetail() { drawer.dataset.state = "closed"; sheet.dataset.state = "closed"; scrim.dataset.state = "closed"; }
// ---- drawer: avanti/indietro fra le schede dello stesso tipo senza chiudere (anche con ← →), ed "espandi" ----
const DrawerNav = {
  item: null,
  siblings(item) {
    if (!item) return [];
    if (item.kind === "work") { const f = WorksFilter.current; return DATA.works.filter(w => f === "all" || (w.caps || []).includes(f)); }
    if (item.kind === "cap") return DATA.caps;
    if (item.kind === "signal") return DATA.signals;
    return [];
  },
  update(item) { this.item = item; const nav = $("#drawer-nav"); if (!nav) return; const list = this.siblings(item); const i = list.findIndex(x => x.id === item.id); nav.hidden = list.length < 2 || i < 0; const pos = $("#drawer-pos"); if (pos && !nav.hidden) pos.textContent = `${i + 1} / ${list.length}`; drawer.tabIndex = -1; this.openedAt = performance.now(); setTimeout(() => { try { drawer.focus({ preventScroll: true }); } catch {} }, 60); },
  go(dir) {
    const list = this.siblings(this.item); if (list.length < 2) return; const i = list.findIndex(x => x.id === this.item.id); const next = list[(i + dir + list.length) % list.length];
    const body = drawer.querySelector(".drawer-body"); body.classList.add("swap-out"); setTimeout(() => { openDetail(byId(next.id)); body.classList.remove("swap-out"); }, 220);
  },
  expand() { const on = drawer.classList.toggle("wide"); const b = $("#drawer-expand"); if (b) b.textContent = on ? t("Riduci") : t("Espandi"); }
};
// il loop video nella scheda (senza controlli) si prende il fuoco appena carica: lo restituiamo al drawer, così ← → funzionano
window.addEventListener("blur", () => { const a = document.activeElement; if (a && a.tagName === "IFRAME" && drawer.dataset.state === "open" && (drawer.contains(a) || a.inert)) setTimeout(() => { try { drawer.focus({ preventScroll: true }); } catch {} }, 0); });
$("#drawer-prev") && $("#drawer-prev").addEventListener("click", () => DrawerNav.go(-1));
$("#drawer-next") && $("#drawer-next").addEventListener("click", () => DrawerNav.go(1));
$("#drawer-expand") && $("#drawer-expand").addEventListener("click", () => DrawerNav.expand());
document.addEventListener("keydown", e => { if (drawer.dataset.state !== "open" || /input|textarea|select/i.test((e.target && e.target.tagName) || "")) return; if (e.key === "ArrowRight") DrawerNav.go(1); else if (e.key === "ArrowLeft") DrawerNav.go(-1); });
// ---- lavori (desktop): chip filtro per sistema ----
const WorksFilter = {
  current: "all",
  set(id) { this.current = id; $$("[data-wfilter]").forEach(b => b.classList.toggle("on", b.dataset.wfilter === id)); const cards = $$("#lavori .work"); let n = 0; cards.forEach(w => { const on = id === "all" || (w.dataset.caps || "").split(" ").includes(id); w.classList.toggle("is-filtered", !on); if (on) n++; }); const grid = $("#lavori .works"); if (grid) { let e = grid.querySelector(".works-empty"); if (!n) { if (!e) { e = document.createElement("div"); e.className = "works-empty"; e.textContent = t("Nessun lavoro in questa area, per ora."); grid.appendChild(e); } } else if (e) e.remove(); } }
};
document.addEventListener("click", e => { const b = e.target.closest("[data-wfilter]"); if (b) WorksFilter.set(b.dataset.wfilter); });
scrim.addEventListener("click", closeDetail); $("#drawer-close").addEventListener("click", closeDetail); $("#sheet-close").addEventListener("click", closeDetail);
document.addEventListener("keydown", e => { if (e.key === "Escape") { closeDetail(); const p = $("#modes"); if (p && !p.hidden) p.hidden = true; } });
document.addEventListener("click", e => {
  const nav = e.target.closest('.topnav a[href^="#"]'); if (nav && !isMobile()) { const t = $(nav.getAttribute("href")); if (t && getComputedStyle(t).display === "none") { e.preventDefault(); if (Focus.ids) Focus.clear(); else Modes.set("density", "all"); setTimeout(() => t.scrollIntoView({ behavior: reduced ? "auto" : "smooth" }), 60); return; } }
  const b = e.target.closest("[data-open]"); if (b) { openDetail(byId(b.dataset.open)); if (b.dataset.to) { const body = isMobile() ? $("#sheet-body") : drawer.querySelector(".drawer-body"); const t = body && body.querySelector(b.dataset.to); if (t) setTimeout(() => { body.scrollTop = Math.max(0, body.scrollTop + t.getBoundingClientRect().top - body.getBoundingClientRect().top - 14); }, 80); } return; } // data-to: dentro la scheda si va subito a quel blocco (es. casi d'uso), senza rileggere il testo
  const n = e.target.closest("[data-open-node]"); if (n) { openDetail(byId(n.dataset.openNode)); return; }
  const go = e.target.closest(".adapt .go"); if (go) runAdapt(go.closest(".adapt"));
  const ct = e.target.closest("[data-contact]"); if (ct) { if (isMobile()) openContactSheet(); else { closeDetail(); goSection("contatti"); } return; }
  const c = e.target.closest("[data-copy]"); if (c) copyText(c);
  const cta = e.target.closest(".topnav .cta"); if (cta && isMobile()) { e.preventDefault(); openContactSheet(); }
  const lg = e.target.closest(".topbar .logo"); if (lg && isMobile()) { e.preventDefault(); App.show("home"); return; } // su mobile il logo riporta alla Home dell'app
  const tab = e.target.closest("[data-tab]"); if (tab) { if (tab.dataset.tab === "console") ConsoleWin.open(tab.dataset.q || ""); else if (tab.dataset.tab === "contatti") openContactSheet(); else App.show(tab.dataset.tab); return; }
  const sn = e.target.closest("[data-story-next]"); if (sn) { Path.go(1); return; }
  const sp = e.target.closest("[data-story-prev]"); if (sp) { Path.go(-1); return; }
  const chip = e.target.closest("[data-ask]"); if (chip) { ConsoleWin.open(chip.dataset.ask); return; }
  const opt = e.target.closest("[data-opt]"); if (opt) { ConsoleWin.send(opt.dataset.opt); return; }
  const apply = e.target.closest("[data-apply]"); if (apply) { ConsoleWin.apply(apply.dataset.apply); return; }
  const reset = e.target.closest("#focus-reset, [data-focus-reset]"); if (reset) { Focus.clear(); if (ConsoleWin.el && !ConsoleWin.el.hidden) ConsoleWin.close(); return; }
  const disc = e.target.closest("[data-discover]"); if (disc) { Path.discover(); return; }
  const gt = e.target.closest("[data-goto]"); if (gt) { if (ConsoleWin.el && !ConsoleWin.el.hidden) ConsoleWin.close(); goSection(gt.dataset.goto); return; }
  const filt = e.target.closest("[data-filter]"); if (filt) { $$("[data-filter]", filt.parentElement).forEach(b => b.classList.toggle("on", b === filt)); App.filterWorks(filt.dataset.filter); }
});
async function runAdapt(box) {
  const out = $(".adapt-out", box), go = $(".go", box);
  const p = { itemId: box.dataset.adapt, sector: $("[name=sector]", box).value.trim(), channel: $("[name=channel]", box).value.trim(), goal: $("[name=goal]", box).value.trim() };
  if (!p.sector && !p.goal && !p.channel) { $("[name=sector]", box).focus(); return; }
  out.hidden = false; out.classList.remove("rich"); out.innerHTML = `<span class="who">${t("Console · tre idee in arrivo…")}</span>`; go.disabled = true;
  try {
    const r = await AI.adapt(p);
    if (r.ideas && r.ideas.length) {
      out.classList.add("rich");
      out.innerHTML = `<span class="who">${t("Tre idee per {ctx}", { ctx: esc([p.sector, p.channel].filter(Boolean).join(" · ") || t("il vostro contesto")) })}</span>${r.summary ? `<p class="adapt-sum">${esc(r.summary)}</p>` : ""}<ol class="ideas">${r.ideas.map(i => `<li><b>${esc(i.title)}</b><span>${esc(i.text)}</span>${i.tech ? `<small>${esc(i.tech)}</small>` : ""}</li>`).join("")}</ol>${r.next ? `<p class="adapt-next">${esc(r.next)}</p>` : ""}<div class="adapt-cta"><button class="btn primary" type="button" data-contact>${t("Parliamone: brief o brainstorming")}</button></div>`;
    } else out.innerHTML = `<span class="who">${t("Variante per il vostro contesto")}</span>${esc(r.text)}`;
  }
  catch (e) { out.innerHTML = `<span class="who">Console</span>${esc(e.message || t("Non riesco a generare le idee adesso."))}`; }
  go.disabled = false;
}
function copyText(b) {
  const done = () => { b.dataset.done = "true"; b.textContent = t("Copiato"); setTimeout(() => { b.dataset.done = "false"; b.textContent = t("Copia"); }, 1800); };
  const fallback = () => { const code = b.parentElement.querySelector("code"); if (code) { const r = document.createRange(); r.selectNodeContents(code); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } b.textContent = t("Seleziona e copia"); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(b.dataset.copy).then(done).catch(fallback); else fallback();
}

/* =========================================================
   CONSOLE PROMPT
   ========================================================= */
function bindPrompt(form) {
  if (!form) return;
  const input = $("input", form);
  AI.check().then(ok => { if (!ok) form.hidden = true; });
  form.addEventListener("submit", e => { e.preventDefault(); const q = input.value.trim(); input.value = ""; ConsoleWin.open(q); });
}
function flashCards(ids) {
  ids.forEach(id => { const el = $(`.cap[data-open="${id}"], .work[data-open="${id}"], .card[data-id="${id}"]`); if (el && hasGsap && !reduced) gsap.fromTo(el, { boxShadow: `0 0 0 0 ${Theme.rgba(.9)}` }, { boxShadow: `0 0 0 14px ${Theme.rgba(0)}`, duration: 1.4, ease: "power2.out" }); });
}

/* =========================================================
   CONSOLE — mappa a nodi su canvas (desktop)
   ========================================================= */
const Console = (() => {
  const cv = $("#graph"); if (!cv) return null;
  const ctx = cv.getContext("2d");
  // la mappa vive sopra l'immagine dell'hero: legge la palette dal suo contenitore (in "chiaro" resta scura)
  let T = Theme.from(cv.parentElement), PURPLE = T.accent, PAPER = T.paper; document.addEventListener("fw:theme", () => { T = Theme.from(cv.parentElement); PURPLE = T.accent; PAPER = T.paper; });
  const SANS = '"Helvetica Now Display","Helvetica Neue",Helvetica,Arial,sans-serif', MONO = '"Geist Mono",ui-monospace,Menlo,monospace';
  const L_AREA = t("AREA"), L_RADAR = t("RADAR · FONTE ESTERNA"); // etichette dei nodi (dentro draw(t) la t è il tempo)
  let W = 0, H = 0, nodes = [], edges = [], hover = null, drag = null, particles = [], raf = 0, running = false, last = 0, spawnAt = 0, hi = new Set(), hiUntil = 0, fontsReady = false, focusSet = null;
  const deg = (d) => d * Math.PI / 180;
  const amp = () => parseFloat(getComputedStyle(html).getPropertyValue("--amp")) || 1;
  const speed = () => parseFloat(getComputedStyle(html).getPropertyValue("--speed")) || 1;
  // Il grafo vive a destra del testo dell'hero: il lato sinistro del ventaglio viene compresso (kxl) finché
  // nessun nodo, etichette comprese, finisce sotto il testo; se poi sborda a destra, si riduce la scala.
  function make(s, cx, cy, kxl) {
    const R_CAP = 215 * s, R_WORK = 345 * s, R_SIG = 430 * s, ky = Math.min(0.86, (H / 2 - 120) / R_SIG);
    const place = (ang, R) => { const c = Math.cos(ang); return { bx: cx + c * R * (c < 0 ? kxl : 1), by: cy + Math.sin(ang) * R * ky }; };
    nodes = []; edges = [];
    const core = { id: "core", kind: "core", r: 30 * s, bx: cx, by: cy, ox: 0, oy: 0, ph: 0, ang: 0 }; nodes.push(core);
    const n = DATA.caps.length, a0 = -115, a1 = 115, MAXA = deg(138); // il ventaglio non va oltre ±138°: niente nodi dietro il testo
    // ventaglio di figli attorno all'angolo dell'area, tenuto dentro ±MAXA (verso l'alto/basso, non verso sinistra)
    const fan = (center, count, step) => { const w = step * (count - 1); let st = center - w / 2; if (st + w > MAXA) st = MAXA - w; if (st < -MAXA) st = -MAXA; return (k) => st + step * k; };
    DATA.caps.forEach((c, i) => { const ang = deg(n > 1 ? a0 + (a1 - a0) * i / (n - 1) : 0); const nd = { ...c, kind: "cap", r: 14 * s, ang, ...place(ang, R_CAP), ox: 0, oy: 0, ph: i * 1.7 }; nodes.push(nd); edges.push({ a: core, b: nd, alpha: .18 }); });
    const capNode = (id) => nodes.find(x => x.id === id && x.kind === "cap") || nodes[1];
    // nella mappa entrano al massimo 5 lavori e 4 segnali per area (gli altri restano nelle sezioni): il ventaglio resta leggibile.
    // Ogni lavoro va all'area, tra le sue, che ha meno lavori: la mappa resta bilanciata anche se i casi si concentrano su un'area.
    const capIds = DATA.caps.map(c => c.id), perCap = {}, works = []; capIds.forEach(id => perCap[id] = []);
    const mentions = {}; DATA.works.forEach(w => w.caps.forEach(id => mentions[id] = (mentions[id] || 0) + 1));
    DATA.works.forEach(w => { const opts = w.caps.filter(id => perCap[id] && perCap[id].length < 5); if (!opts.length) return; const home = opts.reduce((a, b) => (perCap[b].length < perCap[a].length || (perCap[b].length === perCap[a].length && mentions[b] < mentions[a])) ? b : a); perCap[home].push(w); works.push({ w, home }); });
    works.forEach(({ w, home }, i) => { const cn = capNode(home); const sib = perCap[home]; const k = sib.indexOf(w); const ang = fan(cn.ang + deg(6), sib.length, deg(13))(k); const near = Math.abs(ang - cn.ang) < deg(9); const rf = sib.length > 3 ? (near ? 1.22 : ((k + capIds.indexOf(home)) % 2 ? 1.14 : 0.9)) : (near ? 1.1 : 1); const nd = { ...w, kind: "work", r: 6 * s, ang, parent: cn.id, ...place(ang, R_WORK * rf), ox: 0, oy: 0, ph: 10 + i * 1.3 }; nodes.push(nd); [home, ...w.caps.filter(id => id !== home)].forEach((cid, j) => { const c = capNode(cid); if (c) edges.push({ a: c, b: nd, alpha: j === 0 ? .12 : .06 }); }); });
    // i segnali senza area (fonti in tempo reale non ancora classificate) si distribuiscono a turno tra le aree
    const perCapS = {}, sigs = []; capIds.forEach(id => perCapS[id] = []); let rr = 0;
    DATA.signals.forEach(sg => { if (sigs.length >= 14) return; let home = sg.caps.find(id => perCapS[id] && perCapS[id].length < 4); if (!home) { for (let t = 0; t < capIds.length && !home; t++) { const id = capIds[(rr + t) % capIds.length]; if (perCapS[id].length < 4) home = id; } rr++; } if (!home) return; perCapS[home].push(sg); sigs.push({ sg, home }); });
    sigs.forEach(({ sg, home }, i) => { const cn = capNode(home); const sib = perCapS[home]; const k = sib.indexOf(sg); const ang = fan(cn.ang - deg(12), sib.length, deg(9))(k); const nd = { ...sg, kind: "signal", r: 3.4 * s, ang, parent: cn.id, ...place(ang, R_SIG), ox: 0, oy: 0, ph: 30 + i * 2.1 }; nodes.push(nd); edges.push({ a: nd, b: cn, alpha: .07, dash: true, signal: true }); });
    particles = [];
  }
  // estensione orizzontale del grafo, etichette comprese (i segnali mostrano l'etichetta solo al passaggio: contano solo i punti)
  function extents() {
    let minX = 1e9, maxX = -1e9;
    nodes.forEach(nd => {
      let lw = 0, off = 0;
      if (nd.kind === "cap") { ctx.font = `600 14px ${SANS}`; lw = ctx.measureText(nd.name).width; off = nd.r + 12; }
      else if (nd.kind === "work") { ctx.font = `500 12px ${SANS}`; lw = ctx.measureText(nd.label || nd.client).width; off = nd.r + 9; }
      const right = nd.kind === "core" ? null : Math.cos(nd.ang) >= -0.15;
      const lo = right === null ? nd.bx - 100 : right ? nd.bx - nd.r : nd.bx - off - lw;
      const hi = right === null ? nd.bx + 100 : right ? nd.bx + off + lw : nd.bx + nd.r;
      minX = Math.min(minX, lo); maxX = Math.max(maxX, hi);
    });
    return { minX, maxX };
  }
  function build() {
    const hc = $(".hero-copy"), cr = cv.getBoundingClientRect();
    const L = (hc ? hc.getBoundingClientRect().right - cr.left : W * 0.44) + 28, R = W - 28; // spazio disponibile
    let s = Math.max(0.68, Math.min(1.25, Math.min(W, H) / 900)), cx = W * 0.64, cy = H * 0.5, kxl = 1;
    make(s, cx, cy, kxl); let e = extents();
    if (e.minX < L) { kxl = Math.max(0.3, (cx - L) / (cx - e.minX)); make(s, cx, cy, kxl); e = extents(); }
    if (e.maxX > R) { s *= Math.max(0.55, (R - cx) / (e.maxX - cx)); make(s, cx, cy, kxl); e = extents(); }
    if (e.minX < L) { const dx = Math.min(L - e.minX, Math.max(0, R - e.maxX)); if (dx > 0) nodes.forEach(nd => nd.bx += dx); }
  }
  // trascinando un'area si porta dietro lavori e segnali derivati; trascinando il cubo si muove tutto l'organismo
  function group(nd) { if (nd.kind === "core") return nodes.filter(x => x !== nd); if (nd.kind === "cap") return nodes.filter(x => x.parent === nd.id); return []; }
  function resize() { const dpr = Math.min(2, window.devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); build(); if (!running) draw(performance.now()); }
  function pos(nd, t) { const a = reduced ? 0 : (nd.kind === "core" ? 3 : nd.kind === "cap" ? 7 : 9) * amp(); return { x: nd.bx + nd.ox + Math.sin(t * 0.00035 * speed() + nd.ph) * a, y: nd.by + nd.oy + Math.cos(t * 0.00028 * speed() + nd.ph * 1.3) * a }; }
  function related(nd) { if (!nd) return new Set(); const set = new Set([nd.id]); edges.forEach(e => { if (e.a.id === nd.id) set.add(e.b.id); if (e.b.id === nd.id) set.add(e.a.id); }); return set; }
  // il nodo centrale è il cubo del logo (stesse tre facce del file ufficiale, box 51.09×59)
  const CUBE = [[51.09, 14.75, 25.55, 59, 51.09, 44.25], [25.55, 29.5, 0, 14.75, 25.55, 0, 51.09, 14.75], [25.55, 29.5, 25.55, 59, 0, 44.25]];
  function cube(x, y, h) { const k = h / 59; ctx.save(); ctx.translate(x - 25.55 * k, y - 29.5 * k); ctx.scale(k, k); CUBE.forEach(pl => { ctx.beginPath(); for (let i = 0; i < pl.length; i += 2) i ? ctx.lineTo(pl[i], pl[i + 1]) : ctx.moveTo(pl[i], pl[i + 1]); ctx.closePath(); ctx.fill(); }); ctx.restore(); }
  function label(p, nd, main, eyebrow, font, color, off) { const right = Math.cos(nd.ang) >= -0.15; const x = right ? p.x + off : p.x - off; ctx.textAlign = right ? "left" : "right"; ctx.textBaseline = "middle"; if (eyebrow) { ctx.font = `500 9px ${MONO}`; ctx.fillStyle = T.ink3; ctx.letterSpacing = "1.2px"; ctx.fillText(eyebrow, x, p.y - 9); ctx.letterSpacing = "0px"; } ctx.font = font; ctx.fillStyle = color; ctx.fillText(main, x, eyebrow ? p.y + 5 : p.y); }
  function draw(t) {
    ctx.clearRect(0, 0, W, H); if (!nodes.length || !W) return;
    // i nodi trascinati "a gruppo" inseguono con un leggero ritardo
    nodes.forEach(nd => { if (nd.tox != null) { nd.ox += (nd.tox - nd.ox) * .22; nd.oy += (nd.toy - nd.oy) * .22; if (Math.abs(nd.tox - nd.ox) < .3 && Math.abs(nd.toy - nd.oy) < .3) { nd.ox = nd.tox; nd.oy = nd.toy; nd.tox = nd.toy = null; } } });
    const P = {}; nodes.forEach(nd => P[nd.id] = pos(nd, t));
    const active = hover || null; const rel = related(active); const hiOn = hi.size && t < hiUntil; if (!hiOn && hi.size) hi.clear();
    edges.forEach(e => { const a = P[e.a.id], b = P[e.b.id]; const hot = (active && rel.has(e.a.id) && rel.has(e.b.id)) || (hiOn && (hi.has(e.a.id) || hi.has(e.b.id))); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.setLineDash(e.dash ? [2, 7] : []); ctx.lineWidth = hot ? 1.5 : 1; ctx.strokeStyle = hot ? T.rgba(.9) : T.inkA(active || hiOn ? e.alpha * .5 : e.alpha); ctx.stroke(); });
    ctx.setLineDash([]);
    if (!reduced) {
      if (t > spawnAt && particles.length < 9 * amp()) { const sEdges = edges.filter(e => e.signal); if (sEdges.length) { const e = sEdges[Math.floor(Math.random() * sEdges.length)]; const next = edges.find(x => x.b.id === e.b.id && x.a.kind === "core"); particles.push({ segs: [[e.a.id, e.b.id], next ? [e.b.id, next.a.id] : null].filter(Boolean), i: 0, p: 0, v: (0.00065 + Math.random() * 0.0004) * speed() }); } spawnAt = t + (700 + Math.random() * 900) / speed(); }
      const dt = last ? Math.min(50, t - last) : 16;
      particles = particles.filter(pt => { pt.p += pt.v * dt; if (pt.p >= 1) { pt.i++; pt.p = 0; if (pt.i >= pt.segs.length) return false; } const [ia, ib] = pt.segs[pt.i]; const a = P[ia], b = P[ib]; if (!a || !b) return false; const x = a.x + (b.x - a.x) * pt.p, y = a.y + (b.y - a.y) * pt.p; const q = Math.max(0, pt.p - 0.12); const tx = a.x + (b.x - a.x) * q, ty = a.y + (b.y - a.y) * q; const g = ctx.createLinearGradient(tx, ty, x, y); g.addColorStop(0, T.inkA(0)); g.addColorStop(1, T.inkA(.9)); ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke(); ctx.fillStyle = pt.i === 0 ? PAPER : PURPLE; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fill(); return true; });
    }
    nodes.forEach(nd => {
      const p = P[nd.id]; const isHover = active && active.id === nd.id; const isHi = hiOn && hi.has(nd.id); const inRel = (!active || rel.has(nd.id)) && (!hiOn || hi.has(nd.id) || nd.kind === "core"); const inFocus = !focusSet || focusSet.has(nd.id) || nd.kind === "core"; const dim = inRel ? (inFocus ? 1 : .22) : .3;
      ctx.save(); ctx.globalAlpha = dim;
      if (nd.kind === "core") { const r = nd.r; ctx.fillStyle = isHover ? PURPLE : T.ink; cube(p.x, p.y, r * 2.1); ctx.fillStyle = T.inkA(.9); ctx.font = `500 10.5px ${MONO}`; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.letterSpacing = "1.5px"; ctx.fillText((DATA.site.claim || "").toUpperCase(), p.x, p.y + r + 12); ctx.letterSpacing = "0px"; }
      else if (nd.kind === "cap") { ctx.beginPath(); ctx.arc(p.x, p.y, nd.r + (isHi ? 3 : 0), 0, Math.PI * 2); ctx.fillStyle = isHover || isHi ? PURPLE : T.bg; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = isHover || isHi ? PURPLE : T.ink; ctx.stroke(); label(p, nd, nd.name, L_AREA, `600 14px ${SANS}`, T.ink, nd.r + 12); }
      else if (nd.kind === "work") { ctx.beginPath(); ctx.arc(p.x, p.y, isHover || isHi ? nd.r + 2 : nd.r, 0, Math.PI * 2); ctx.fillStyle = isHover || isHi ? PURPLE : T.ink2; ctx.fill(); label(p, nd, nd.label || nd.client, isHover ? nd.title.toUpperCase() : "", `500 12px ${SANS}`, isHover || isHi ? T.ink : T.ink2, nd.r + 9); }
      else if (nd.kind === "signal") { ctx.globalAlpha = inRel ? .95 : .3; ctx.beginPath(); ctx.arc(p.x, p.y, isHover || isHi ? nd.r + 2.5 : nd.r, 0, Math.PI * 2); ctx.fillStyle = PAPER; ctx.fill(); if (isHover || isHi || (active && active.kind === "cap" && rel.has(nd.id))) label(p, nd, nd.src, L_RADAR, `400 11px ${MONO}`, PAPER, nd.r + 8); }
      ctx.restore();
    });
    last = t;
  }
  function loop(t) { draw(t); raf = requestAnimationFrame(loop); }
  function start() { if (running) return; running = true; last = 0; raf = requestAnimationFrame(loop); }
  function stop() { running = false; cancelAnimationFrame(raf); }
  function hit(x, y) { const t = performance.now(); let best = null, bd = 1e9; nodes.forEach(nd => { const p = pos(nd, t); const d = Math.hypot(p.x - x, p.y - y); const R = Math.max(nd.r + 10, 14); if (d < R && d < bd) { bd = d; best = nd; } }); return best; }
  const xy = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  cv.addEventListener("pointermove", e => { const { x, y } = xy(e); if (drag) { const dx = x - drag.x0, dy = y - drag.y0; drag.nd.ox = drag.ox0 + dx; drag.nd.oy = drag.oy0 + dy; drag.group.forEach(g => { g.nd.tox = g.ox0 + dx; g.nd.toy = g.oy0 + dy; if (reduced) { g.nd.ox = g.nd.tox; g.nd.oy = g.nd.toy; g.nd.tox = g.nd.toy = null; } }); drag.moved = Math.max(drag.moved, Math.hypot(dx, dy)); if (reduced) draw(performance.now()); return; } const h = hit(x, y); if (h !== hover) { hover = h; cv.style.cursor = h ? "pointer" : "default"; if (reduced) draw(performance.now()); } });
  cv.addEventListener("pointerdown", e => { const { x, y } = xy(e); const h = hit(x, y); if (h) { drag = { nd: h, x0: x, y0: y, ox0: h.ox, oy0: h.oy, moved: 0, group: group(h).map(nd => ({ nd, ox0: nd.ox, oy0: nd.oy })) }; cv.setPointerCapture(e.pointerId); cv.style.cursor = "grabbing"; } });
  cv.addEventListener("pointerup", () => { if (drag) { const nd = drag.nd, moved = drag.moved; drag = null; cv.style.cursor = "pointer"; if (moved < 5) openDetail(byId(nd.id)); } });
  cv.addEventListener("pointerleave", () => { if (!drag) { hover = null; if (reduced) draw(performance.now()); } });
  new IntersectionObserver(en => en.forEach(x => { if (x.isIntersecting && !isMobile()) start(); else stop(); }), { threshold: 0.05 }).observe(cv);
  // finché l'hero è sotto la barra, il logo resta bianco anche nel mood chiaro
  new IntersectionObserver(en => en.forEach(x => document.body.classList.toggle("over-hero", x.isIntersecting)), { rootMargin: "-60px 0px -100% 0px", threshold: 0 }).observe(cv);
  window.addEventListener("resize", () => { if (!isMobile()) resize(); });
  if (!isMobile()) resize();
  const ready = () => { if (fontsReady) return; fontsReady = true; if (!isMobile()) { resize(); start(); } };
  if (document.fonts && document.fonts.ready) { document.fonts.ready.then(ready); setTimeout(ready, 1500); } else ready();
  return { start, stop, resize, highlight(ids) { hi = new Set(ids); hiUntil = performance.now() + 6000; if (reduced) draw(performance.now()); }, setFocus(ids) { focusSet = ids ? new Set(ids) : null; if (reduced) draw(performance.now()); }, _nodes: () => nodes.map(nd => ({ id: nd.id, kind: nd.kind, parent: nd.parent || null, ...pos(nd, performance.now()) })) };
})();
window.__graph = Console; // posizioni dei nodi in sola lettura (test)

/* =========================================================
   TICKER
   ========================================================= */
(function ticker() { const row = $("#ticker-row"); if (!row) return; const items = DATA.signals.slice(0, 12); if (!items.length) { row.parentElement.parentElement.hidden = true; return; } row.innerHTML = [...items, ...items].map(s => `<span class="item"><span class="src">${esc(s.src)} · ${esc(fmtDate(s.date))}</span><span>${esc(s.title)}</span></span>`).join(""); })();

/* =========================================================
   ANIMAZIONI (GSAP) — desktop
   ========================================================= */
function animateDesktop() {
  if (!hasGsap || reduced || isMobile()) return;
  // titolo hero: parole che entrano
  const h1 = $(".hero-copy h1.split");
  if (h1 && !h1.dataset.done) { h1.dataset.done = "1"; h1.innerHTML = h1.innerHTML.replace(/(<span class="serif">[\s\S]*?<\/span>|[^\s<]+)/g, m => `<span class="w" style="display:inline-block">${m}</span>`); gsap.from($$(".w", h1), { yPercent: 110, opacity: 0, duration: 1.1, ease: "power4.out", stagger: 0.06, delay: 0.15 }); }
  gsap.from(".hero-copy .eyebrow, .hero-copy .lead, .hero-actions, .prompt", { y: 24, opacity: 0, duration: 1, ease: "power3.out", stagger: 0.08, delay: 0.5 });
  gsap.from(".console-bg img", { scale: 1.12, opacity: 0, duration: 2.2, ease: "power2.out" });
  gsap.from("#graph", { opacity: 0, duration: 1.6, delay: 0.4 });
  // reveal
  // batchMax: con un salto lungo (voce di menu, ancora) entrano decine di elementi insieme e lo stagger li farebbe aspettare secondi
  ScrollTrigger.batch(".rv", { start: "top 88%", batchMax: 8, onEnter: b => gsap.fromTo(b, { y: 36, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: "power3.out", stagger: 0.09, overwrite: true }), once: true });
  // parallasse immagini
  $$("[data-parallax]").forEach(el => { const f = parseFloat(el.dataset.parallax) || 0.1; gsap.to(el, { yPercent: -f * 60, ease: "none", scrollTrigger: { trigger: el.closest("figure, .console-bg") || el, start: "top bottom", end: "bottom top", scrub: true } }); });
  // statement: scorre in orizzontale con lo scroll
  $$(".drift").forEach(el => { const d = parseFloat(el.dataset.drift) || 0.2; gsap.fromTo(el, { xPercent: d * 40 }, { xPercent: -d * 40, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } }); });
  // venn: il ciclo segue le cinque fasi scritte (stesso ordine dell'elenco): il cerchio di una fase si disegna
  // mentre la sua etichetta e la sua riga si accendono; poi un giro del cursore, poi tutto si cancella e ricomincia
  const vcs = $$("#venn .vc");
  if (vcs.length) {
    const phases = [0, 1, 2, 3, 4];
    const circ = (ph) => $(`#venn .vc[data-phase="${ph}"]`), els = (ph) => [circ(ph), $(`#venn text[data-phase="${ph}"]`), $$("#metodo .method-list li")[ph]].filter(Boolean);
    const setOn = (cur) => phases.forEach(ph => els(ph).forEach(el => el.classList.toggle("on", ph === cur)));
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.2, paused: true });
    const STEP = 0.9, T1 = phases.length * STEP + 0.5;
    phases.forEach((ph, i) => { tl.call(setOn, [ph], i * STEP); tl.fromTo(circ(ph), { strokeDashoffset: 600 }, { strokeDashoffset: 0, duration: 1.3, ease: "power2.out" }, i * STEP); });
    phases.forEach((ph, i) => tl.call(setOn, [ph], T1 + i * 0.7));           // secondo giro: solo il cursore
    const T2 = T1 + phases.length * 0.7 + 0.4;
    tl.call(setOn, [-1], T2);
    phases.forEach((ph, i) => tl.to(circ(ph), { strokeDashoffset: -600, duration: 1, ease: "power2.in" }, T2 + 0.2 + i * 0.28));
    ScrollTrigger.create({ trigger: "#venn", start: "top 85%", end: "bottom 15%", onEnter: () => tl.play(), onEnterBack: () => tl.play(), onLeave: () => tl.pause(), onLeaveBack: () => tl.pause() });
  }
  // frame morph: un asset, tutti i formati
  const mf = $("#morph .morph-frame"); if (mf) { const lab = $(".morph-label", mf); const formats = [["16:9", 180, 101], ["9:16", 72, 128], ["1:1", 110, 110], ["4:5", 96, 120], ["32:9", 200, 56]]; let i = 0; const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.2 }); formats.forEach(([n, w, h]) => tl.to(mf, { width: w, height: h, duration: 0.9, ease: "power3.inOut", onStart: () => lab.textContent = n }, "+=1.2")); }
  // chiusura: On Air · Live · Alive
  const cw = $$("#closing span"); if (cw.length) { ScrollTrigger.create({ trigger: "#closing", start: "top 75%", onEnter: () => { const tl = gsap.timeline({ repeat: -1, repeatDelay: .6 }); cw.forEach((s, i) => tl.call(() => { cw.forEach((x, j) => x.classList.toggle("on", j <= i)); }, null, i * 0.9)); tl.call(() => cw.forEach(x => x.classList.remove("on")), null, cw.length * 0.9 + 1.5); } }); }
  // tilt sulle card
  $$("[data-tilt]").forEach(el => { el.addEventListener("pointermove", e => { const r = el.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5; gsap.to(el, { rotateY: px * 6 * amp(), rotateX: -py * 6 * amp(), transformPerspective: 900, duration: .5, ease: "power2.out" }); }); el.addEventListener("pointerleave", () => gsap.to(el, { rotateY: 0, rotateX: 0, duration: .8, ease: "power3.out" })); });
  function amp() { return parseFloat(getComputedStyle(html).getPropertyValue("--amp")) || 1; }
  // alone del cursore
  const glow = $("#glow"); if (glow && matchMedia("(pointer: fine)").matches) { document.body.classList.add("has-mouse"); const qx = gsap.quickTo(glow, "x", { duration: .9, ease: "power3" }), qy = gsap.quickTo(glow, "y", { duration: .9, ease: "power3" }); window.addEventListener("pointermove", e => { qx(e.clientX); qy(e.clientY); }); }
}

/* =========================================================
   APP MOBILE — tab bar, schermate, sheet. Stessi contenuti,
   esperienza diversa dal desktop.
   ========================================================= */
const ICONS = {
  home: '<svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-6H9v6H5a2 2 0 0 1-2-2z"/></svg>',
  sistema: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="12" cy="12" r="3"/><path d="M12 4v5M12 15v5M4 12h5M15 12h5"/></svg>',
  console: '<svg viewBox="0 0 24 24"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 17l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/></svg>',
  lavori: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M9 5v14"/></svg>',
  radar: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v9l6 4"/></svg>',
  percorso: '<svg viewBox="0 0 24 24"><path d="M4 6h6M4 12h10M4 18h14"/><circle cx="19" cy="6" r="2"/></svg>',
  contatti: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 8l9 6 9-6"/></svg>'
};
const initials = (n) => String(n || "").split(/\s+/).filter(Boolean).map(w => w[0]).join("").slice(0, 3).toUpperCase();
function teamHTML() {
  const team = DATA.team || []; if (!team.length) return "";
  const site = DATA.site; const key = team.filter(m => m.is_key); const units = [...new Set(team.map(m => m.unit).filter(Boolean))];
  const face = (m) => m.photo ? `<img class="face" src="${media(m.photo)}" alt="" loading="lazy">` : `<span class="face gram" aria-hidden="true">${esc(initials(m.name))}</span>`;
  return `<div class="m-text team-m" data-m-tier="10"><div class="eyebrow"><span class="dot"></span>${t("Team · {n} persone", { n: team.length })}</div><h2 style="margin-top:8px">${em(site.team_title || t("Un sistema è fatto di <em>persone.</em>"))}</h2><p>${esc(site.team_text || "")}</p>
    <div class="people-m">${key.map(m => `<div class="pm">${face(m)}<div><b>${esc(m.name)}</b><small>${esc(m.role)}</small></div></div>`).join("")}</div>
    <details class="roster-m"><summary>${t("Tutto il team")} · ${team.length}</summary>${units.map(u => { const l = team.filter(m => m.unit === u && !m.is_key); return l.length ? `<div class="eyebrow"><span class="dot"></span>${esc(u)}</div><ul>${l.map(m => `<li><b>${esc(m.name)}</b><span>${esc(m.role)}</span></li>`).join("")}</ul>` : ""; }).join("")}</details></div>`;
}
const greet = () => { const h = new Date().getHours(); return h < 6 ? t("Buonanotte.") : h < 12 ? t("Buongiorno.") : h < 18 ? t("Buon pomeriggio.") : t("Buonasera."); };
const App = {
  current: "home", filter: "all",
  render() {
    const app = $("#app"); if (!app) return; const site = DATA.site; const w = Ctx.weather;
    // .mk: in modalità Chiaro porta l'evidenziatore viola riga per riga (negli altri umori non fa nulla)
    const tile = (i) => `<button class="tile" type="button" data-open="${i.id}"><img src="${media(i.image) || media("/media/frames.jpg")}" alt="" loading="lazy"><div class="eyebrow"><span class="dot"></span>${t("Area")}</div><h3><span class="mk">${i.accent && i.name.includes(i.accent) ? esc(i.name).replace(esc(i.accent), '<span class="serif">' + esc(i.accent) + '</span>') : esc(i.name)}</span></h3><p><span class="mk">${esc(i.short)}</span></p></button>`;
    const wtile = (x) => `<button class="tile work" type="button" data-open="${x.id}"><img src="${media(x.image) || media("/media/monolith.jpg")}" alt="" loading="lazy"><div class="eyebrow"><span class="dot"></span>${esc(x.client)}</div><h3>${esc(x.title)}</h3></button>`;
    const news = (sg, mini) => `<button class="nc ${mini ? "mini" : ""}" type="button" data-open="${sg.id}"><div class="src"><span class="chip ext">${t("Fonte esterna")}</span><b>${esc(sg.src)}</b><span>${esc(fmtDate(sg.date))}</span></div><h3>“${esc(sg.title)}”</h3>${mini ? "" : `<p>${esc(sg.why)}</p>`}</button>`;
    // le case come post: intestazione col cliente, immagine quadrata, titolo, riga di testo e hashtag dei sistemi
    const gc = (x) => `<button class="gc" type="button" data-open="${x.id}" data-caps="${x.caps.join(" ")}"><div class="post-head"><i>${esc(initials(x.client))}</i><div><b>${esc(x.client)}</b><small>${esc(x.year || "")}</small></div><span class="chip ghost">${esc(x.status)}</span></div><img src="${media(x.image) || media("/media/monolith.jpg")}" alt="" loading="lazy"><div class="post-body"><h3>${esc(x.title)}</h3><p>${esc(x.short)}</p><div class="hashtags">${x.caps.map(id => "#" + (capById(id) ? capById(id).name.replace(/[^A-Za-z0-9]+/g, "") : id)).join(" ")}</div><span class="post-more">${t("Apri la scheda")} →</span></div></button>`;
    const reelsM = (DATA.reels || []).filter(r => r.vimeo || r.cover);
    const reelsBlock = (title, btn) => reelsM.length ? `<div class="reels-m"><div class="row-head"><h2>${title}</h2>${btn || ""}</div><div class="reels-track reels-track-m" data-reels-track>${reelsM.map(r => `<article class="reel" data-reel data-vimeo="${r.vimeo ? esc(r.vimeo.id) : ""}" data-h="${r.vimeo ? esc(r.vimeo.h || "") : ""}" data-title="${esc(r.title)}"><div class="reel-media">${r.cover ? `<img src="${esc(media(r.cover) || r.cover)}" alt="" loading="lazy">` : ""}</div><div class="reel-meta"><div><div class="eyebrow"><span class="dot"></span>${esc(r.theme || "Reel")}${r.placeholder ? " · " + t("anteprima") : ""}</div><h3>${esc(r.title)}</h3></div>${r.vimeo ? `<button type="button" class="reel-play" data-reel-play>${t("Guarda con audio")}</button>` : ""}</div></article>`).join("")}</div></div>` : "";
    const askBox = `<button class="ask" type="button" data-tab="console"><b>✦</b><span>${t("Chiedi alla Console: cosa fate per…")}</span></button>`;
    const home = `<section class="screen on" data-screen="home">
      <div class="cover cover-field"><div class="cover-df df" data-datafield data-df-mode="hero"></div><span class="status" id="m-status">On Air${w && w.temp != null ? " · " + t("Roma") + " " + w.temp + "° " + weatherLabel(w) : ""}</span><div class="cover-text"><div class="greet">${greet()} ${t("Siamo Frameworks.")}</div><h1>${em(site.hero_title)}</h1><p>${esc(site.hero_text || site.tagline)}</p></div></div>
      ${reelsBlock("Reel", `<button type="button" data-tab="lavori">${t("Tutti i lavori")}</button>`)}
      <div data-m-tier="2">${askBox}<p class="ask-hint">${t("Per esempio: cosa fate per il retail? · quali visori usate? · come usate l'AI?")}</p></div>
      <div ${Focus.list(DATA.caps).length ? "" : "hidden"}><div class="row-head"><h2>${Focus.ids ? t("Le aree del tuo percorso") : esc(site.areas_home_title || t("I nostri servizi"))}</h2><button type="button" data-tab="sistema">${t("Tutte")}</button></div><div class="carousel">${Focus.list(DATA.caps).map(tile).join("")}</div></div>
      <div data-m-tier="10" ${Focus.list(DATA.works).length ? "" : "hidden"}><div class="row-head"><h2>${t("Lavori")}</h2><button type="button" data-tab="lavori">${t("Vedi tutti")}</button></div><div class="carousel">${Focus.list(DATA.works).slice(0, 6).map(wtile).join("")}</div></div>
      <div data-m-tier="${Focus.ids && Focus.list(DATA.signals).length ? "2" : "10"}" ${Focus.list(DATA.signals).length ? "" : "hidden"}><div class="row-head"><h2>${t("Radar oggi")}</h2><button type="button" data-tab="radar">${t("Tutto il radar")}</button></div><div class="news">${Focus.list(DATA.signals).slice(0, 3).map(sg => news(sg, true)).join("")}</div></div>
      <div class="m-text" data-m-tier="10"><div class="eyebrow"><span class="dot"></span>${t("Metodo")}</div><h2 style="margin-top:8px">${t("Cinque fasi, un <span class=\"serif\">ciclo.</span>")}</h2><ol class="steps">${(site.method || []).map((m, i) => `<li><i>${String(i + 1).padStart(2, "0")}</i><span><b>${esc(m.k)}</b>${esc(m.text)}</span></li>`).join("")}</ol></div>
      ${contactHTML()}
      <p class="app-foot">${esc(site.footer_note)}</p>
    </section>`;
    const sistema = `<section class="screen" data-screen="sistema">
      <div class="m-statement"><h2>${esc((site.statements || [])[2] || t("Ogni progetto è concepito come un organismo vivente."))}</h2></div>
      <div class="m-text"><div class="eyebrow"><span class="dot"></span>${esc(site.claim)}</div><h2 style="margin-top:8px">${em(site.organism_title)}</h2><p>${esc(site.organism_text)}</p></div>
      <div class="m-context" data-m-tier="2"><div class="eyebrow"><span class="dot"></span>${t("Il contesto")}</div><div class="ph df" data-datafield></div><p>${esc(site.context_text)}</p></div>
      <div data-m-tier="10"><div class="vo-root vo-mobile" data-organismo="mobile" data-room=""><div class="vo-stage" aria-label="${t("L'organismo: uno solo per tutto il sito")}"><canvas class="vo-glow" aria-hidden="true"></canvas><canvas class="vo-cv"></canvas><div class="vo-tip" hidden></div><div class="vo-flash" aria-hidden="true"></div></div><div class="vo-say" role="status" aria-live="polite"></div><div class="vo-m-top"><span class="eyebrow"><span class="dot"></span>${t("L'organismo")} · <span class="vo-lead-m">${t("vivo da")} —</span></span></div><div class="vo-bottom vo-bottom-phone"><div class="vo-presence"></div><div class="vo-ar-tools"><a class="vo-ar-link" href="/organismo/ar">${t("Portalo nella stanza (AR)")}</a></div><div class="vo-hint">${t("Tocca · trascina · inclina il telefono")}</div></div></div><p class="org-caption"><b>${t("È vivo.")}</b> ${t("Uno solo per tutto il sito: lo nutrono il Radar, gli umori dei visitatori e il meteo di Roma. Tocca nel vuoto: reagisce, e resta. Tocca un nodo: ti dice da quale notizia è nato.")}</p></div>
      <div><div class="row-head"><h2>${esc(site.areas_list_title || t("Le aree"))}</h2></div><div class="list-cards">${Focus.list(DATA.caps).map(c => `<button class="area-card" type="button" data-open="${c.id}"><img src="${media(c.image) || media("/media/frames.jpg")}" alt="" loading="lazy"><div><div class="eyebrow"><span class="dot"></span>${t("Area")}</div><h3 style="margin-top:6px">${c.accent && c.name.includes(c.accent) ? esc(c.name).replace(esc(c.accent), '<span class="serif">' + esc(c.accent) + '</span>') : esc(c.name)}</h3><p>${esc(c.short)}</p><div class="tags">${((c.tech && c.tech.length) ? c.tech.slice(0, 5) : c.tags.slice(0, 4)).map(x => `<span class="tag">${esc(x)}</span>`).join("")}</div><span class="card-more">${t("Casi d'uso e tecnologie")} →</span></div></button>`).join("")}</div></div>
      ${teamHTML()}
      <div class="m-text" data-m-tier="10"><h2>${em(site.tech_title)}</h2><ol class="steps" style="margin-top:14px">${(site.tech || []).map(x => `<li><i>·</i><span><b>${esc(x.k)}</b>${esc(x.text)}</span></li>`).join("")}</ol></div>
      <div class="m-text metodo-m" data-m-tier="10"><div class="eyebrow"><span class="dot"></span>${t("Metodo")}</div><p>${esc(site.method_intro)}</p><ol class="steps">${(site.method || []).map((m, i) => `<li><i>${String(i + 1).padStart(2, "0")}</i><span><b>${esc(m.k)}</b>${esc(m.text)}</span></li>`).join("")}</ol></div>
      <div class="triad-m" data-m-tier="10">${(site.triad || []).map(x => `<div><h3>${esc(x.la)}</h3><small>${esc(x.it)}</small><p>${esc(x.text)}</p></div>`).join("")}</div>
      ${contactHTML()}
    </section>`;
    // i reel tematici (stessi del desktop, da /admin/reel): carosello a scorrimento sopra le case
    const lavori = `<section class="screen" data-screen="lavori">
      ${reelsBlock("Reel")}
      <div><h2>${t("Organismi in <span class=\"serif\">azione.</span>")}</h2><div class="chips"><button type="button" class="on" data-filter="all">${t("Tutti")}</button>${DATA.caps.map(c => `<button type="button" data-filter="${c.id}">${esc(c.name)}</button>`).join("")}</div></div>
      <div class="grid2m feed" id="works-grid">${Focus.list(DATA.works).map(gc).join("")}</div>
      <p class="app-foot">${t("Tocca un lavoro per aprirlo e adattarlo al tuo contesto")}</p>
      ${contactHTML()}
    </section>`;
    const radar = `<section class="screen paper-screen" data-screen="radar">
      <div><div class="eyebrow"><span class="dot"></span>${t("Radar · fonti esterne")}${DATA.radar_at ? ` · ${fmtWhen(DATA.radar_at)}` : ""}</div><h2 style="margin-top:8px">${em(site.radar_title)}</h2><p class="radar-intro" style="margin-top:8px">${esc(site.radar_text)}</p></div>
      <div class="radar-live"><div class="eyebrow"><span class="dot"></span>${t("Cerca nel mondo, adesso")}</div><form class="radar-form" data-radar-search autocomplete="off"><input type="search" name="q" placeholder="${t("Un tema: DOOH, retail media…")}" maxlength="80" aria-label="${t("Cerca nel radar")}" enterkeyhint="search"><button type="submit">${t("Cerca")}</button></form><div class="chips radar-chips"><button type="button" data-live-q="DOOH">DOOH</button><button type="button" data-live-q="retail media">Retail media</button><button type="button" data-live-q="${t("AI generativa pubblicità")}">${t("AI generativa")}</button><button type="button" data-live-q="virtual production">Virtual production</button></div><div class="radar-results" data-radar-results hidden></div></div>
      <div class="row-head" style="margin-top:22px"><h2>${t("Selezione del Radar")}</h2></div>
      <div class="news">${Focus.list(DATA.signals).map(sg => news(sg, false)).join("")}</div>
      <p class="paper-note">${t("I titoli appartengono alle rispettive testate. Frameworks li segnala e li commenta.")}</p>
    </section>`;
    const story = Focus.ids ? Path.renderStory() : "";
    app.innerHTML = story + home + sistema + lavori + radar;
    if (story) Path.bindStory();
    // in modalità percorso la tab bar si riduce a Percorso · Console · Contatti
    const tabs = Focus.ids ? [["percorso", t("Percorso")], ["console", "Console"], ["contatti", t("Contatti")]] : [["home", "Home"], ["sistema", t("Sistema")], ["console", "Console"], ["lavori", t("Lavori")], ["radar", "Radar"]];
    const bar = $("#tabbar");
    bar.innerHTML = tabs.map(([k, l]) => k === "console" ? `<button type="button" class="fab" data-tab="console" id="tab-console"><i>${ICONS.console}</i><span>${l}</span></button>` : `<button type="button" data-tab="${k}" class="${k === this.current ? "on" : ""}">${ICONS[k]}<span>${l}</span></button>`).join("");
    const cols = () => { bar.style.gridTemplateColumns = `repeat(${$$("button", bar).length},1fr)`; }; cols();
    AI.check().then(ok => { if (!ok) { $$("[data-tab=console]").forEach(el => el.remove()); cols(); } });
    this.applyDensity(); this.show(this.current, true);
    if (window.Diffusion) Diffusion.mountAll(); // il Denoise nella schermata Sistema
    if (window.Organismo) Organismo.mountAll(); // l'organismo nella schermata Sistema
    if (window.Reels) Reels.mountAll(); // i reel nella schermata Lavori
    if (window.DataField) DataField.mountAll(); // il campo dati del contesto nella schermata Sistema
  },
  show(name, silent) {
    if (!$(`.screen[data-screen="${name}"]`)) name = "home";
    this.current = name;
    $$(".screen").forEach(s => s.classList.toggle("on", s.dataset.screen === name));
    $$("#tabbar [data-tab]").forEach(b => b.classList.toggle("on", b.dataset.tab === name));
    document.body.classList.toggle("story-on", name === "percorso");
    closeDetail(); window.scrollTo({ top: 0, behavior: "auto" }); checkPaper();
    if (name === "sistema" && window.Organismo) Organismo.mountAll(); // l'organismo si monta quando la schermata è visibile
    if (!silent) try { history.replaceState(null, "", "#" + name); } catch {}
  },
  filterWorks(id) { this.filter = id; $$("#works-grid .gc").forEach(g => g.hidden = !(id === "all" || g.dataset.caps.split(" ").includes(id))); },
  applyDensity() { const d = Modes.density; $$("[data-m-tier]").forEach(el => { const t = el.dataset.mTier; el.hidden = (d === "2" && t !== "2"); }); }
};
function contactHTML() { const site = DATA.site; return `<div class="contact-m" data-m-tier="2"><div class="eyebrow"><span class="dot"></span>${t("Contatti")}</div><h2 style="margin-top:8px">${em(site.contact_title)}</h2><code>${esc(site.contact_email)}</code><button class="copy" type="button" data-copy="${esc(site.contact_email)}">${t("Copia")}</button><p class="addr">${esc(site.contact_address).replace(/\n/g, "<br>")}</p></div>`; }
function openSheet(html, eyebrow) { $("#sheet-body").innerHTML = html; $("#sheet-eyebrow").textContent = eyebrow; sheet.dataset.state = "open"; scrim.dataset.state = "open"; $("#sheet-body").scrollTop = 0; }
function openContactSheet() { openSheet(`<div class="d-in">${contactHTML().replace('class="contact-m"', 'class="contact-m" style="border:0;padding:0;background:none"')}</div>`, t("Contatti")); }
function renderApp() { if (isMobile()) App.render(); }
function initialTab() { const h = (location.hash || "").replace("#", ""); const map = { home: "home", sistema: "sistema", aree: "sistema", lavori: "lavori", radar: "radar", metodo: "sistema", contatti: "home", console: "home" }; if (map[h]) App.current = map[h]; if (Focus.ids) App.current = "percorso"; if (h === "contatti") setTimeout(openContactSheet, 400); }


/* =========================================================
   FOCUS — il percorso configurato dalla Console
   (mostra solo aree, lavori e segnali proposti finché non si resetta)
   ========================================================= */
const Focus = {
  ids: null, label: "", text: "", q: "", sections: [],
  load() { try { const j = JSON.parse(sessionStorage.getItem("fw.focus") || "null"); if (j && Array.isArray(j.ids) && j.ids.length) { this.ids = new Set(j.ids); this.label = j.label || ""; this.text = j.text || ""; this.q = j.q || ""; this.sections = j.sections || []; } } catch {} },
  save() { try { if (this.ids) sessionStorage.setItem("fw.focus", JSON.stringify({ ids: [...this.ids], label: this.label, text: this.text, q: this.q, sections: this.sections })); else sessionStorage.removeItem("fw.focus"); } catch {} },
  has(id) { return !this.ids || this.ids.has(id); },
  list(items) { return this.ids ? items.filter(i => this.ids.has(i.id)) : items; },
  // gli elementi del percorso nell'ordine aree → lavori → radar (dentro ogni gruppo, l'ordine proposto dalla Console)
  items() { if (!this.ids) return []; const rank = { cap: 0, work: 1, signal: 2 }; return [...this.ids].map(byId).filter(i => i && i.kind !== "core").map((i, k) => ({ i, k })).sort((a, b) => (rank[a.i.kind] - rank[b.i.kind]) || (a.k - b.k)).map(x => x.i); },
  set(ids, label, text, q, sections) { this.ids = new Set(ids); this.label = label || ""; this.text = text || ""; this.q = q || ""; this.sections = (sections || []).filter(x => SECTIONS[x]); this.save(); this.apply(); },
  clear() { this.ids = null; this.label = ""; this.text = ""; this.q = ""; this.sections = []; this.save(); if (Modes.density === "2") Modes.set("density", "10"); this.apply(); if (!isMobile()) window.scrollTo({ top: 0, behavior: "instant" }); },
  apply() {
    const on = !!this.ids;
    document.body.classList.toggle("has-focus", on);
    if (!isMobile()) Path.renderDesktop();
    // desktop: nasconde gli elementi fuori percorso e le sezioni rimaste vuote
    $$(".cap[data-open], .work[data-open]").forEach(el => el.hidden = on && !this.ids.has(el.dataset.open));
    $$(".signal[data-id]").forEach(el => el.hidden = on ? !this.ids.has(el.dataset.id) : (el.classList.contains("more") && !el.dataset.shown)); // fuori dal percorso, le notizie oltre le prime 5 restano dietro "Leggi ancora"
    [["#aree", ".cap"], ["#lavori", ".work"], ["#radar", ".signal"]].forEach(([sec, item]) => { const el = $(sec); if (el) el.dataset.focusEmpty = on && !$$(item, el).some(x => !x.hidden) ? "1" : ""; });
    const radar = $("#radar"); if (radar) radar.dataset.tier = on && this.list(DATA.signals).length ? "2" : "10"; // il Radar resta visibile se fa parte del percorso
    if (Console) Console.setFocus(this.ids);
    // barra
    const bar = $("#focusbar"); if (bar) {
      if (on) { const n = this.items().length; $("#focus-text", bar).innerHTML = `<b>${esc(this.label || t("Percorso"))}</b> · ${n} ${n === 1 ? t("tappa") : t("tappe")}`; bar.hidden = false; }
      else bar.hidden = true;
    }
    if (isMobile()) { const cur = App.current; App.render(); App.show(on ? "percorso" : (cur === "percorso" ? "home" : cur), true); }
    if (window.ScrollTrigger) setTimeout(() => ScrollTrigger.refresh(), 80);
  }
};

/* =========================================================
   PERCORSO — il sito configurato dalla Console
   desktop: vista dedicata sotto la mappa (solo gli elementi proposti)
   mobile: una tappa per elemento, scorrimento orizzontale come le storie
   ========================================================= */
const Path = {
  counts() { const it = Focus.items(); const n = (k) => it.filter(i => i.kind === k).length; return { items: it, caps: n("cap"), works: n("work"), sigs: n("signal") }; },
  metaText() { const c = this.counts(); const pl = (n, s, p) => `${n} ${n === 1 ? t(s) : t(p)}`; return `${pl(c.items.length, "tappa", "tappe")} · ${pl(c.caps, "area", "aree")} · ${pl(c.works, "lavoro", "lavori")}${c.sigs ? ` · ${pl(c.sigs, "segnale radar", "segnali radar")}` : ""}`; },
  // DESKTOP: clona le schede già presenti nella pagina (stesso aspetto), nell'ordine del percorso
  renderDesktop() {
    const sec = $("#percorso"); if (!sec) return;
    const c = this.counts();
    if (!c.items.length) { sec.hidden = true; sec.innerHTML = ""; return; }
    const clone = (sel) => { const el = $(sel); if (!el) return ""; const x = el.cloneNode(true); x.hidden = false; x.removeAttribute("style"); x.removeAttribute("data-tilt"); [x, ...$$(".rv", x)].forEach(y => { y.classList.remove("rv"); y.removeAttribute("style"); }); return x.outerHTML; };
    let n = 0; const step = (title, count) => `<div class="path-step"><span class="num">${String(++n).padStart(2, "0")}</span><h3>${title}</h3><span class="count">${count}</span></div>`;
    const caps = c.items.filter(i => i.kind === "cap"), works = c.items.filter(i => i.kind === "work"), sigs = c.items.filter(i => i.kind === "signal");
    sec.innerHTML = `
      <div class="path-head">
        <div class="eyebrow"><span class="dot"></span>${t("Percorso della Console")}${Focus.label ? ` · ${esc(Focus.label)}` : ""}</div>
        ${Focus.q ? `<p class="path-q">${t("Hai chiesto:")} “${esc(Focus.q)}”</p>` : ""}
        <h2 class="serif">${esc(Focus.text || t("Ecco il percorso che ti propongo."))}</h2>
        <p class="path-meta">${this.metaText()}</p>
        ${Focus.sections.length ? `<div class="path-also"><span>${t("Vedi anche")}</span>${Focus.sections.map(x => `<button type="button" class="btn ghost" data-goto="${x}">${esc(SECTIONS[x].name)} →</button>`).join("")}</div>` : ""}
      </div>
      ${caps.length ? step(AREAS_LABEL(), `${caps.length} ${caps.length === 1 ? t("area") : t("aree")}`) + `<div class="caps path-caps">${caps.map(x => clone(`#aree .cap[data-open="${x.id}"]`)).join("")}</div>` : ""}
      ${works.length ? step(t("Lavori"), `${works.length} ${works.length === 1 ? t("lavoro") : t("lavori")}`) + `<div class="works path-works">${works.map(x => clone(`#lavori .work[data-open="${x.id}"]`)).join("")}</div>` : ""}
      ${sigs.length ? step(t("Radar · fonti esterne"), `${sigs.length} ${sigs.length === 1 ? t("segnale") : t("segnali")}`) + `<div class="paper path-paper"><div class="signals">${sigs.map(x => clone(`#radar .signal[data-id="${x.id}"]`)).join("")}</div><p class="note">${t("I titoli e i riassunti appartengono alle rispettive testate. Frameworks li segnala e li commenta; non ne rivendica la paternità.")}</p></div>` : ""}
      <div class="path-end">
        <div><h3 class="serif">${t("Questo era il percorso su misura per te.")}</h3><p>${t("Frameworks è un sistema più grande: il contesto, il metodo, il radar, l'organismo intero.")}</p></div>
        <div class="path-actions"><button class="btn accent" type="button" data-discover>${t("Scopri tutta Frameworks")} <span>→</span></button><a class="btn primary" href="#contatti">${t("Parliamone")}</a><button class="btn ghost" type="button" data-tab="console">${t("Chiedi ancora alla Console")}</button></div>
      </div>`;
    sec.hidden = false;
  },
  // MOBILE: le tappe
  renderStory() {
    const c = this.counts(); if (!c.items.length) return "";
    const site = DATA.site; const total = c.items.length + 1; const label = Focus.label ? ` · ${esc(Focus.label)}` : "";
    const next = (lab) => `<button type="button" class="story-next" data-story-next>${lab} <span>→</span></button>`;
    const zones = `<div class="tapzones" aria-hidden="true"><span data-story-prev></span><span data-story-next></span></div>`;
    const tappa = (i, k) => `<div class="eyebrow"><span class="dot"></span>${t("Tappa {i} di {n}", { i: String(i).padStart(2, "0"), n: c.items.length })} · ${k}</div>`;
    const img = (src, fallback, i) => `<div class="slide-img"><img src="${media(src) || media(fallback)}" alt="" loading="lazy"><span class="num">${String(i).padStart(2, "0")} / ${c.items.length}</span>${zones}</div>`;
    const body = c.items.map((it, k) => {
      const i = k + 1, last = i === c.items.length, go = next(last ? t("Fine") : t("Avanti"));
      // area: il testo intero sta qui, così non serve aprire la scheda per leggerlo; la scheda aggiunge casi d'uso, tecnologie, lavori e "tre idee"
      if (it.kind === "cap") return `<article class="slide slide-cap">${img(it.image, "/media/frames.jpg", i)}<div class="slide-in"><div class="eyebrow"><span class="dot"></span>${t("Area")} · ${t("tappa {i} di {n}", { i, n: c.items.length })}</div><h2>${it.accent && it.name.includes(it.accent) ? esc(it.name).replace(esc(it.accent), '<span class="serif">' + esc(it.accent) + '</span>') : esc(it.name)}</h2><p class="body">${esc(it.body || it.short)}</p><div class="slide-actions">${go}<button class="btn" type="button" data-open="${it.id}" data-to=".d-concrete">${t("Casi d'uso e tecnologie")}</button></div></div></article>`;
      if (it.kind === "work") return `<article class="slide slide-work">${img(it.image, "/media/monolith.jpg", i)}<div class="slide-in"><div class="eyebrow"><span class="dot"></span>${t("Lavoro")} · ${esc(it.client)}</div><h2>${esc(it.title)}</h2><p class="short">${esc(it.short)}</p><div class="tags">${(it.caps || []).slice(0, 2).map(id => `<span class="tag">${esc(capName(id))}</span>`).join("")}<span class="chip ghost">${esc(it.status || "")}</span></div><div class="slide-actions">${go}<button class="btn" type="button" data-open="${it.id}">${t("Apri il lavoro")}</button></div></div></article>`;
      return `<article class="slide slide-signal"><div class="slide-in">${tappa(i, t("Radar · fonte esterna"))}<div class="paper-card"><div class="src"><span class="chip ext">${t("Fonte esterna")}</span><b>${esc(it.src)}</b><span>${esc(fmtDate(it.date))} · ${esc(domain(it.url))}</span></div><h2>“${esc(it.title)}”</h2>${it.summary ? `<p class="sum">${esc(it.summary)}</p>` : ""}<p class="why"><small>${t("La nostra lettura")}</small>${esc(it.why)}</p><p class="ext">${t("Contenuto di terzi: titolo e riassunto appartengono a {src}. Frameworks lo segnala e lo commenta.", { src: esc(it.src) })}</p></div><div class="slide-actions"><a class="btn src-link" href="${esc(it.url)}" target="_blank" rel="noopener nofollow">${t("Leggi la fonte")} ↗</a>${go}</div></div></article>`;
    }).join("");
    const end = `<article class="slide slide-end"><div class="slide-in"><div class="eyebrow"><span class="dot"></span>${t("Fine del percorso · Parliamone")}</div><h2>${em(site.contact_title)}</h2><code>${esc(site.contact_email)}</code><button class="copy" type="button" data-copy="${esc(site.contact_email)}">${t("Copia")}</button><p class="addr">${esc(site.contact_address).replace(/\n/g, "<br>")}</p><p class="more">${t("Questo era il percorso su misura per te. Frameworks è un sistema più grande.")}</p><div class="slide-actions col"><button class="btn accent" type="button" data-discover>${t("Scopri tutta Frameworks")} <span>→</span></button><button class="btn" type="button" data-tab="console">${t("Chiedi ancora alla Console")}</button></div></div></article>`;
    return `<section class="screen story" data-screen="percorso" aria-label="${t("Percorso")}">
      <div class="story-head"><div class="story-progress" id="story-progress" aria-hidden="true">${Array.from({ length: total }, (_, i) => `<i class="${i === 0 ? "on" : ""}"></i>`).join("")}</div><div class="story-bar"><span class="story-label">${t("Percorso")}${label}</span><span class="story-count" id="story-count">1 / ${total}</span><button type="button" class="story-exit" data-focus-reset>${t("Esci")} ✕</button></div></div>
      <div class="story-track" id="story-track">${body}${end}</div>
    </section>`;
  },
  bindStory() {
    const track = $("#story-track"); this.track = track; if (!track) return;
    const dots = $$("#story-progress i"), count = $("#story-count");
    const upd = () => { const k = Math.round(track.scrollLeft / track.clientWidth); dots.forEach((d, j) => d.classList.toggle("on", j <= k)); if (count) count.textContent = `${k + 1} / ${dots.length}`; };
    track.addEventListener("scroll", () => requestAnimationFrame(upd), { passive: true });
  },
  // desktop: porta la pagina all'inizio della sezione Percorso, e lo ripete dopo che layout, font e ScrollTrigger si sono assestati
  scrollToTop() { const go = () => { const sec = $("#percorso"); if (sec && !sec.hidden) window.scrollTo({ top: sec.offsetTop, behavior: "instant" }); }; go(); [120, 450, 900].forEach(t => setTimeout(go, t)); }, // "instant": con "auto" varrebbe lo scroll-behavior smooth del css
  // "Scopri tutta Frameworks": esce dal percorso e porta all'inizio del racconto completo
  discover() { Focus.clear(); if (ConsoleWin.el && !ConsoleWin.el.hidden) ConsoleWin.close(); if (isMobile()) { App.show("home"); return; } const first = ["#reel", "#aree", "#sistema"].map(x => $(x)).find(el => el && el.offsetParent); setTimeout(() => { if (first) first.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" }); }, 60); },
  go(delta) { const t = this.track; if (!t || !t.isConnected) return; const k = Math.round(t.scrollLeft / t.clientWidth) + delta; t.scrollTo({ left: Math.max(0, Math.min(t.children.length - 1, k)) * t.clientWidth, behavior: reduced ? "auto" : "smooth" }); }
};

/* Sezioni del sito proponibili dalla Console: nome e destinazione su desktop (ancora) e su mobile (schermata + blocco) */
const AREAS_LABEL = () => DATA.site.areas_label || t("Aree"); // come si chiamano le aree (backoffice → Testi → Etichette delle aree)
const SECTIONS = { sistema: { name: t("Sistema"), m: ["sistema", null] }, aree: { name: AREAS_LABEL(), m: ["sistema", ".list-cards"] }, lavori: { name: t("Lavori"), m: ["lavori", null] }, metodo: { name: t("Metodo"), m: ["sistema", ".m-text.metodo-m"] }, team: { name: "Team", m: ["sistema", ".team-m"] }, radar: { name: "Radar", m: ["radar", null] }, contatti: { name: t("Contatti"), m: ["contatti", null] } };
// Una sezione chiesta esplicitamente vince sulla densità "2 minuti": se è nascosta, si riapre tutto
function showAll() { if (Modes.density !== "all") { Modes.set("density", "all"); Prefs.set({ ...(Prefs.get() || {}), time: "all" }); } }
function goSection(id) {
  const sec = SECTIONS[id]; if (!sec) return;
  if (isMobile()) {
    if (id === "contatti") { openContactSheet(); return; }
    if (Focus.ids) Focus.clear();
    App.show(sec.m[0]);
    const target = () => sec.m[1] ? $(`.screen[data-screen="${sec.m[0]}"] ${sec.m[1]}`) : null;
    const el = target(); if (el && (el.hidden || el.closest("[hidden]"))) showAll();
    setTimeout(() => { const t = target(); if (t) window.scrollTo({ top: t.getBoundingClientRect().top + scrollY - 70, behavior: reduced ? "auto" : "smooth" }); }, 120);
    return;
  }
  if (Focus.ids) Focus.clear();
  const t = $("#" + id); if (!t) return;
  if (getComputedStyle(t).display === "none") showAll();
  setTimeout(() => t.scrollIntoView({ behavior: reduced ? "auto" : "smooth" }), 120);
}

/* id proposti dall'AI: tollera prefissi, nomi al posto degli id e, in mancanza, cerca i nomi nel testo della risposta */
function resolveIds(list, text) {
  const all = ALL().filter(i => i.kind !== "core"); const out = [];
  const push = (i) => { if (i && !out.includes(i.id)) out.push(i.id); };
  (list || []).forEach(raw => {
    const id = String(raw || "").trim().toLowerCase().replace(/^(cap|work|signal|area|lavoro|radar)\s*[:\-]\s*/, "");
    push(all.find(i => i.id.toLowerCase() === id) || all.find(i => [i.name, i.title, i.client, i.label].filter(Boolean).some(n => n.toLowerCase() === id)));
  });
  if (!out.length && text) { const t = String(text).toLowerCase(); all.forEach(i => { const names = [i.name, i.title, i.client, i.label].filter(Boolean).map(n => n.toLowerCase()); if (names.some(n => n.length > 3 && t.includes(n))) push(i); }); }
  return out.slice(0, 6);
}

/* =========================================================
   CONSOLE WINDOW — la finestra che copre il sito
   ========================================================= */
const ConsoleWin = {
  el: $("#cwin"), thread: $("#cwin-thread"), history: [], last: null, busy: false,
  suggestions: ["Ho fretta: l'essenziale", "Cosa fate per il retail?", "Quali visori usate?", "Quali formati e canali coprite?", "Come usate l'AI?", "Cosa dice il radar oggi?", "Voglio approfondire tutto"].map(s => t(s)),
  open(q) {
    if (!this.el) return;
    this.el.hidden = false; document.body.classList.add("cwin-open");
    if (!this.thread.children.length) { const pt = Prefs.text(); this.thread.innerHTML = `<div class="msg bot"><span class="who">Console</span><p>${pt ? t("Hai scelto {prefs}: ne tengo conto. ", { prefs: esc(pt) }) : ""}${pt ? t("Dimmi cosa cerchi: ti propongo un percorso e configuro il sito.") : t("Dimmi cosa cerchi, o quanto tempo hai: ti propongo un percorso e configuro il sito.")}${isMobile() ? " " + t("Per esempio: cosa fate per il retail, quali visori usate, come usate l'AI.") : ""}</p></div>`; }
    // su mobile niente pillole di suggerimento: vengono scambiate per un menu; gli esempi stanno nel messaggio di benvenuto
    const chips = $("#cwin-chips"); chips.hidden = isMobile(); chips.innerHTML = isMobile() ? "" : this.suggestions.map(t => `<button type="button" data-ask="${esc(t)}">${esc(t)}</button>`).join("");
    if (q) this.send(q); else setTimeout(() => $("#cwin-q").focus(), 350);
  },
  close() { if (!this.el) return; this.el.hidden = true; document.body.classList.remove("cwin-open"); },
  add(html) { const d = document.createElement("div"); d.innerHTML = html; const node = d.firstElementChild; this.thread.appendChild(node); this.thread.scrollTop = this.thread.scrollHeight; return node; },
  async send(q) {
    q = String(q || "").trim(); if (!q || this.busy) return; this.busy = true;
    this.add(`<div class="msg user"><p>${esc(q)}</p></div>`);
    const think = this.add(`<div class="msg bot thinking"><span class="who">Console</span><p>${t("sto leggendo il sistema…")}</p></div>`);
    try {
      const r = await AI.console(q, this.history.slice(-3));
      this.history.push({ q, a: r.answer || "" }); this.last = r;
      const items = resolveIds(r.highlight, r.answer).map(byId).filter(Boolean);
      const group = (k, label) => { const l = items.filter(i => i.kind === k); return l.length ? `<div class="prop-group"><small>${label}</small>${l.map(i => `<button type="button" class="prop-item" data-open="${i.id}">${esc(i.kind === "work" ? i.client + " · " + i.title : i.kind === "signal" ? i.src + " · " + i.title : i.name)}</button>`).join("")}</div>` : ""; };
      // un solo messaggio: la risposta (+ eventuale domanda) e subito sotto il percorso con un'azione sola
      let html = `<div class="msg bot"><span class="who">Console</span><p>${esc(r.answer || "")}</p>`;
      if (r.ask && r.ask.question) html += `<div class="ask-q"><p>${esc(r.ask.question)}</p><div class="chips">${(r.ask.options || []).slice(0, 4).map(o => `<button type="button" data-opt="${esc(o)}">${esc(o)}</button>`).join("")}</div></div>`;
      const secs = (r.sections || []).filter(x => SECTIONS[x]);
      if (items.length || secs.length) {
        const id = "p" + Date.now().toString(36); this.proposals = this.proposals || {}; this.proposals[id] = { ids: items.map(i => i.id), sections: secs, label: r.label || "", answer: r.answer || "", q, density: r.mode && r.mode.density ? String(r.mode.density) : null, energy: r.mode && r.mode.energy ? r.mode.energy : null };
        const secGroup = secs.length ? `<div class="prop-group"><small>${items.length ? t("Vedi anche") : t("Sezioni del sito")}</small>${secs.map(x => `<button type="button" class="prop-item sec" data-goto="${x}">${esc(SECTIONS[x].name)}</button>`).join("")}</div>` : "";
        const n = items.length;
        html += `<div class="proposal"><div class="eyebrow"><span class="dot"></span>${n ? t("Percorso proposto") : t("Navigazione proposta")}${r.label ? ` · ${esc(r.label)}` : ""}</div>${group("cap", AREAS_LABEL())}${group("work", t("Lavori"))}${group("signal", t("Radar · fonti esterne"))}${secGroup}<div class="prop-actions"><button type="button" class="btn primary" data-apply="${id}">${n ? `${t("Apri il percorso")} · ${n} ${n === 1 ? t("tappa") : t("tappe")}` : t("Portami lì")}</button><button type="button" class="btn" data-focus-reset>${t("Mostrami tutto")}</button></div></div>`;
      }
      html += `</div>`;
      const d = document.createElement("div"); d.innerHTML = html; const node = d.firstElementChild; think.replaceWith(node);
      // mostra l'INIZIO della risposta, non la fine
      this.thread.scrollTop = Math.max(0, node.offsetTop - 12);
      if (Console && items.length) Console.highlight(items.map(i => i.id));
    } catch (err) {
      think.className = "msg bot"; think.innerHTML = `<span class="who">Console</span><p>${esc(err.message || t("Non riesco a rispondere adesso."))}</p>`;
    }
    this.busy = false;
  },
  apply(id) {
    const p = (this.proposals || {})[id]; if (!p) return;
    if (p.density) Modes.set("density", p.density); else if (Modes.density === "2") { Modes.set("density", "10"); Prefs.set({ ...(Prefs.get() || {}), time: "10" }); } // un percorso scelto apre più dei "2 minuti"
    if (p.energy) Modes.set("mood", p.energy);
    if (!p.ids.length) { this.close(); closeDetail(); if (p.sections && p.sections.length) goSection(p.sections[0]); return; } // solo sezioni: niente percorso, si va lì
    Focus.set(p.ids, p.label, p.answer, p.q, p.sections || []);
    this.close(); closeDetail();
    if (isMobile()) App.show("percorso"); else Path.scrollToTop();
  }
};
(function consoleWinUI() {
  const f = $("#cwin-form"); if (!f) return;
  f.addEventListener("submit", e => { e.preventDefault(); const i = $("#cwin-q"); const q = i.value.trim(); i.value = ""; if (isMobile()) i.blur(); ConsoleWin.send(q); });
  $("#cwin-close").addEventListener("click", () => ConsoleWin.close());
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !ConsoleWin.el.hidden) ConsoleWin.close(); });
})();

/* =========================================================
   RADAR LIVE — ricerca in tempo reale per il visitatore (Google News via server)
   ========================================================= */
const RadarLive = {
  async search(form, q) {
    q = String(q || "").trim(); if (q.length < 2) return;
    const box = $("[data-radar-results]", form.parentElement); if (!box) return;
    $$(".radar-chips button", form.parentElement).forEach(b => b.classList.toggle("on", b.dataset.liveQ === q));
    const input = $("input", form); if (input && input.value !== q) input.value = q;
    box.hidden = false; box.innerHTML = `<p class="live-status">${t("Cerco “{q}” nelle notizie degli ultimi 14 giorni…", { q: esc(q) })}</p>`;
    if (PREVIEW) { box.innerHTML = `<p class="live-status">${t("La ricerca dal vivo funziona sul sito pubblicato (qui è solo l'anteprima).")}</p>`; return; }
    try {
      const r = await fetch(`/api/radar/search?q=${encodeURIComponent(q)}`); const j = await r.json(); if (!r.ok) throw new Error(j.error || t("Errore"));
      if (!j.items.length) { box.innerHTML = `<p class="live-status">${t("Nessuna notizia recente su “{q}”. Prova un tema più ampio.", { q: esc(q) })}</p>`; return; }
      box.innerHTML = `<div class="live-list">${j.items.map(i => `<a class="live-item" href="${esc(i.url)}" target="_blank" rel="noopener nofollow"><span class="src"><span class="chip ext">${t("Fonte esterna")}</span><b>${esc(i.src)}</b><span>${esc(fmtDate(i.date))}${i.lang === "en" ? " · en" : (LANG === "en" && i.lang === "it" ? " · it" : "")}</span></span><h4>“${esc(i.title)}”</h4></a>`).join("")}</div><p class="live-status">${t("{n} risultati in tempo reale da Google News · fonti esterne, non curate da Frameworks", { n: j.items.length })} · ${esc(fmtWhen(j.at))}</p>`;
    } catch (e) { box.innerHTML = `<p class="live-status">${esc(e.message || t("Ricerca non disponibile adesso."))}</p>`; }
  }
};
document.addEventListener("click", e => { // Radar desktop: 5 notizie alla volta
  const b = e.target.closest("[data-radar-more]"); if (!b) return;
  const hidden = $$("#radar .signal.more[hidden]"); hidden.slice(0, 5).forEach(el => { el.hidden = false; el.dataset.shown = "1"; if (hasGsap && !reduced) gsap.fromTo(el, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: .7, ease: "power3.out" }); });
  const left = hidden.length - 5; if (left > 0) $("span", b).textContent = `+${Math.min(5, left)} ${t("di")} ${left}`; else b.closest(".radar-more-row").hidden = true;
  if (window.ScrollTrigger) setTimeout(() => ScrollTrigger.refresh(), 100);
});
document.addEventListener("submit", e => { const f = e.target.closest("[data-radar-search]"); if (!f) return; e.preventDefault(); const i = $("input", f); if (isMobile() && i) i.blur(); RadarLive.search(f, i ? i.value : ""); });
document.addEventListener("click", e => { const b = e.target.closest("[data-live-q]"); if (!b) return; const f = b.closest(".radar-live") && $("[data-radar-search]", b.closest(".radar-live")); if (f) RadarLive.search(f, b.dataset.liveQ); });

/* la barra in alto si inverte quando sotto c'è la "carta" del Radar */
let paperEls = [], paperTick = false;
function checkPaper() { paperTick = false; const y = 40; const on = (isMobile() && App.current === "radar") || paperEls.some(el => { if (!el.offsetParent) return false; const r = el.getBoundingClientRect(); return r.top <= y && r.bottom >= y; }); document.body.classList.toggle("on-paper", on); }
function watchPaper() { paperEls = $$(".paper, .paper-screen"); checkPaper(); }
addEventListener("scroll", () => { if (!paperTick) { paperTick = true; requestAnimationFrame(checkPaper); } }, { passive: true });
addEventListener("resize", () => requestAnimationFrame(checkPaper));


/* =========================================================
   INTRO — le domande prima del sito (una volta per sessione)
   ========================================================= */
const Intro = {
  el: $("#intro"), time: null, mood: null, done: false,
  seen() { try { return sessionStorage.getItem("fw.intro") === "1"; } catch { return false; } },
  start(onDone) {
    this.onDone = onDone;
    if (!this.el || this.seen()) { this.finish(true); return; }
    this.el.hidden = false; document.body.style.overflow = "hidden";
    this.el.addEventListener("click", e => {
      // "2 minuti": si entra subito nel sito, tema automatico. "10 minuti" / "tutto il tempo": prima il mood, poi si entra
      const t = e.target.closest(".intro-opts [data-time]"); if (t) { this.time = t.dataset.time; $$("[data-time]", this.el).forEach(b => b.classList.toggle("on", b === t)); if (this.time === "2") setTimeout(() => this.go(), 220); else setTimeout(() => this.step(2), 220); return; }
      const m = e.target.closest(".intro-opts [data-mood]"); if (m) { this.mood = m.dataset.mood; $$("[data-mood]", this.el).forEach(b => b.classList.toggle("on", b === m)); Modes.set("mood", this.mood); /* la palette dell'umore si vede subito */ setTimeout(() => this.go(), 220); return; }
      const a = e.target.closest("[data-intro-ask]"); if (a) { this.console(a.dataset.introAsk); return; }
      if (e.target.closest("#intro-skip")) this.finish();
    });
    // la Console dentro l'intro (mobile): scorciatoia opzionale alle domande
    const f = $("#intro-form", this.el);
    if (f) f.addEventListener("submit", e => { e.preventDefault(); const i = $("#intro-q", f); const q = i.value.trim(); i.blur(); if (q) this.console(q); });
  },
  // Applica le scelte fatte finora (o i valori di default: densità media, tema automatico)
  apply() {
    Prefs.set({ time: this.time, mood: this.mood });
    Modes.set("density", this.time || "10"); Modes.set("mood", this.mood || "auto");
  },
  // Chiude l'intro e apre direttamente il sito (nessuna schermata di "preparazione")
  go() { this.apply(); this.finish(); },
  // Chiude l'intro con le scelte fatte finora e apre la Console con la domanda
  console(q) {
    this.apply();
    ConsoleWin.open(String(q || "").trim()); // la finestra sta sotto l'intro (z-index) e appare mentre l'intro sfuma
    this.finish();
  },
  step(n) {
    $$(".intro-step", this.el).forEach(s => s.classList.toggle("on", s.dataset.step === String(n)));
    this.el.dataset.step = String(n);
    const q = $("#intro-q", this.el); if (q && n === 2) q.placeholder = t("Cosa cerchi? Terrò conto del tempo scelto");
  },
  finish(immediate) {
    if (this.done) return; this.done = true;
    try { sessionStorage.setItem("fw.intro", "1"); } catch {}
    if (this.el) { if (immediate) this.el.hidden = true; else { this.el.classList.add("out"); setTimeout(() => { this.el.hidden = true; }, 650); } }
    document.body.style.overflow = ""; window.scrollTo(0, 0);
    if (this.onDone) this.onDone();
  }
};

/* =========================================================
   BOOT
   ========================================================= */
LightMedia.init(); // prima di Modes.apply: ascolta fw:theme e scambia le immagini se il mood è "Chiaro"
Modes.apply();
Focus.load();
watchPaper();
renderContext();
initialTab();
renderApp();
watchPaper();
bindPrompt($("#prompt"));
Intro.start(() => { renderContext(); if (isMobile()) App.applyDensity(); animateDesktop(); });
if (window.Diffusion) Diffusion.mountAll(); // Denoise (desktop: sezione Adaptive Content Systems)
if (window.Organismo) Organismo.mountAll(); // L'organismo (desktop: sezione Adaptive Content Systems)
if (window.DataField) DataField.mountAll(); // Il contesto: campo dati (desktop)
Focus.apply();
Ctx.fetchWeather().then(() => { Modes.apply(); renderContext(); const st = $("#m-status"); const w = Ctx.weather; if (st && w && w.temp != null) st.textContent = `On Air · ${t("Roma")} ${w.temp}° ${weatherLabel(w)}`; });
let wasMobile = isMobile();
matchMedia("(max-width: 820px)").addEventListener("change", () => { const m = isMobile(); if (m !== wasMobile) { wasMobile = m; closeDetail(); renderContext(); renderApp(); if (!m && Console) { Console.resize(); Console.start(); } } });
// la densità cambia la composizione del feed
const _set = Modes.set.bind(Modes); Modes.set = (k, v) => { _set(k, v); if (k === "density" && isMobile()) App.applyDensity(); renderContext(); };
})();
