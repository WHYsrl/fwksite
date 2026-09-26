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
const media = (p) => PREVIEW && p && p.startsWith("/media/") ? p.slice(1) : p;
const capById = (id) => DATA.caps.find(c => c.id === id);
const capName = (id) => (capById(id) || {}).name || id;
const worksFor = (id) => DATA.works.filter(w => w.caps.includes(id));
const signalsFor = (id) => DATA.signals.filter(s => s.caps.includes(id));
const ALL = () => [{ id: "core", kind: "core" }, ...DATA.caps.map(c => ({ ...c, kind: "cap" })), ...DATA.works.map(w => ({ ...w, kind: "work" })), ...DATA.signals.map(s => ({ ...s, kind: "signal" }))];
const byId = (id) => ALL().find(i => i.id === id);
const html = document.documentElement;
const hasGsap = typeof window.gsap !== "undefined";
if (hasGsap && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
const fmtDate = (d) => { if (!d) return ""; const [y, m, day] = d.split("-"); const mesi = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"]; return m ? `${+day || ""} ${mesi[(+m) - 1] || ""} ${y}`.trim() : d; };
const domain = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const fmtWhen = (iso) => { try { return new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)); } catch { return ""; } };

/* =========================================================
   CONTESTO E MODALITÀ AMBIENTALI
   ========================================================= */
const Ctx = {
  weather: null,
  local() {
    const now = new Date(); const h = now.getHours();
    return { time: new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(now), day: new Intl.DateTimeFormat("it-IT", { weekday: "long" }).format(now), slot: h < 6 ? "notte" : h < 12 ? "mattina" : h < 18 ? "pomeriggio" : "sera", hour: h,
      mobile: isMobile(), device: isMobile() ? (matchMedia("(pointer: coarse)").matches ? "telefono" : "finestra stretta") : (matchMedia("(pointer: coarse)").matches ? "tablet" : "desktop"), vw: innerWidth, vh: innerHeight,
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
    let energy = this.mood === "nervous" ? "calm" : this.mood;
    if (energy === "auto") energy = (kind === "rain" || kind === "night" || kind === "snow" || c.slot === "notte") ? "calm" : (kind === "storm" || kind === "sun") ? "vivid" : "auto";
    html.dataset.energy = energy; html.dataset.mood = this.mood;
    $$(".seg [data-density]").forEach(b => b.classList.toggle("on", b.dataset.density === this.density));
    const lbl = $(".modes-lbl"); if (lbl) lbl.textContent = isMobile() ? (this.density === "2" ? "Essenziale" : "Modalità") : (this.density === "2" ? "Essenziale · mostra tutto" : this.density === "all" ? "Modalità · tutto" : "Modalità");
    const mb = $("#modes-btn"); if (mb) mb.classList.toggle("reduced", this.density === "2");
    $$(".seg [data-mood]").forEach(b => b.classList.toggle("on", b.dataset.mood === this.mood));
    const env = $("#modes-env"); if (env) env.textContent = `Roma · ${c.day} ${c.slot} · ${w && w.temp != null ? w.temp + "° · " + labelWeather(w.kind) : "meteo non disponibile"} · ritmo ${this.mood === "nervous" ? "essenziale" : energy === "calm" ? "calmo" : energy === "vivid" ? "vivace" : "neutro"}`;
    const sw = $("#status-weather"); if (sw) sw.textContent = w && w.temp != null ? `· ${w.temp}° ${labelWeather(w.kind)}` : "";
    if (window.ScrollTrigger) setTimeout(() => ScrollTrigger.refresh(), 50);
  },
  set(k, v) { this[k] = v; try { sessionStorage.setItem("fw." + k, v); } catch {} this.apply(); }
};
function labelWeather(k) { return { sun: "sereno", cloud: "nuvoloso", rain: "pioggia", storm: "temporale", snow: "neve", night: "notte", unknown: "" }[k] || ""; }
(function modesUI() {
  const btn = $("#modes-btn"), panel = $("#modes"); if (!btn || !panel) return;
  if (DATA.site.modes_enabled === false) { btn.hidden = true; return; }
  const open = (o) => { panel.hidden = !o; btn.setAttribute("aria-expanded", String(o)); };
  btn.addEventListener("click", () => { if (Modes.density === "2") { Modes.set("density", "10"); open(false); return; } open(panel.hidden); });
  $("#modes-close").addEventListener("click", () => open(false));
  document.addEventListener("click", e => { if (!panel.hidden && !panel.contains(e.target) && !btn.contains(e.target)) open(false); });
  panel.addEventListener("click", e => {
    const d = e.target.closest(".seg [data-density]"); if (d) { Modes.set("density", d.dataset.density); Prefs.set({ ...(Prefs.get() || {}), time: d.dataset.density }); }
    const m = e.target.closest(".seg [data-mood]"); if (m) { Modes.set("mood", m.dataset.mood); Prefs.set({ ...(Prefs.get() || {}), mood: ["calm", "vivid", "nervous"].includes(m.dataset.mood) ? m.dataset.mood : null }); }
  });
})();

function renderContext() {
  const c = Ctx.local(); const w = Ctx.weather;
  const langName = c.lang.startsWith("it") ? "italiano" : c.lang.startsWith("en") ? "inglese" : c.lang.startsWith("fr") ? "francese" : c.lang.startsWith("de") ? "tedesco" : c.lang.startsWith("es") ? "spagnolo" : c.lang;
  const parts = [`Sono le <span class="v">${esc(c.time)}</span> di <span class="v">${esc(c.day)} ${c.slot}</span>${w && w.temp != null ? ` e a Roma ci sono <span class="v">${w.temp}°</span>, ${labelWeather(w.kind)}` : ""}.`,
    `Stai leggendo da un <span class="v">${esc(c.device)}</span> di <span class="v">${c.vw}×${c.vh}</span> pixel, in <span class="v">${esc(langName)}</span>, con le animazioni <span class="v">${c.reduced ? "ridotte" : "attive"}</span>, densità <span class="v">${Modes.density === "2" ? "essenziale" : Modes.density === "10" ? "media" : "completa"}</span>.`,
    c.mobile ? `Per questo vedi un feed verticale: su un desktop gli stessi contenuti diventano una console esplorabile.` : `Per questo vedi la Console: su un telefono gli stessi contenuti diventano un feed verticale.`,
    `Un sistema, tante esperienze: è il principio con cui progettiamo ogni organismo di contenuto.`];
  const kv = [["Ora locale", c.time], ["Giorno", `${c.day} · ${c.slot}`], ["Dispositivo", c.device], ["Schermo", `${c.vw} × ${c.vh}`], ["Lingua", langName], ["Movimento", c.reduced ? "ridotto" : "attivo"], ["Meteo Roma", w && w.temp != null ? `${w.temp}° · ${labelWeather(w.kind)}` : "n.d."], ["Ritmo", Modes.mood === "nervous" ? "essenziale" : html.dataset.energy === "calm" ? "calmo" : html.dataset.energy === "vivid" ? "vivace" : "neutro"], ["Densità", Modes.density === "all" ? "tutto" : Modes.density + " min"]];
  if (c.conn) kv.push(["Connessione", c.conn]);
  const kvHTML = kv.map(([k, v]) => `<div><small>${esc(k)}</small><b>${esc(v)}</b></div>`).join("");
  const t = $("#context-text"); if (t) t.innerHTML = parts.join(" ");
  const k = $("#context-kv"); if (k) k.innerHTML = kvHTML;
  const sr = $("#status-right"); if (sr) sr.innerHTML = `<b>${DATA.caps.length}</b> aree · <b>${DATA.works.length}</b> lavori · <b>${DATA.signals.length}</b> radar · <b>${esc(c.device)} · ${esc(c.day)} · ${c.slot}</b>`;
  return { c, kvHTML, text: parts.join(" ") };
}
(function clock() { const el = $("#clock"); if (!el) return; const t = () => el.textContent = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date()); t(); setInterval(t, 1000); })();
(function statusWords() { const el = $("#status-words"); if (!el) return; const words = DATA.site.closing && DATA.site.closing.length ? DATA.site.closing : ["On Air", "Live", "Alive"]; let i = 0; setInterval(() => { i = (i + 1) % words.length; el.textContent = words[i]; }, 4000); })();

/* =========================================================
   AI — server (produzione) o capability "sample" (preview)
   ========================================================= */
/* scelte fatte nell'intro (tempo, umore): complementari alla Console, che ne tiene conto nel percorso */
const Prefs = {
  get() { try { return JSON.parse(sessionStorage.getItem("fw.prefs") || "null"); } catch { return null; } },
  set(p) { try { sessionStorage.setItem("fw.prefs", JSON.stringify({ time: p.time || null, mood: p.mood || null })); } catch {} },
  text() { const p = this.get(); if (!p) return ""; const t = { "2": "2 minuti", "10": "10 minuti", all: "tutto il tempo che serve" }[p.time]; const m = { calm: "ritmo calmo", vivid: "ritmo entusiasta", nervous: "dritto al punto" }[p.mood]; return [t, m].filter(Boolean).join(", "); }
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
    if (!PREVIEW) { const r = await fetch("/api/ai/console", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q, history, prefs }) }); const j = await r.json(); if (!r.ok) throw new Error(j.error || "Errore"); return j; }
    const hist = history.length ? `\nCONVERSAZIONE PRECEDENTE:\n${history.map(h => `Visitatore: ${h.q}\nConsole: ${h.a}`).join("\n")}\n` : "";
    const pt = { "2": "2 minuti: solo l'essenziale → al massimo 2 aree e 1 lavoro, niente radar, una frase", "10": "10 minuti → 2-3 aree e 2-3 lavori", all: "tutto il tempo → fino a 6 elementi, radar incluso se pertinente" }[prefs.time];
    const pm = { calm: "calmo: tono disteso", vivid: "entusiasta: tono acceso, puoi includere il radar", nervous: "nervoso: asciutto, niente radar" }[prefs.mood];
    const pref = pt || pm ? `\nPREFERENZE GIÀ SCELTE ALL'INGRESSO (rispettale):${pt ? " tempo = " + pt + ";" : ""}${pm ? " umore = " + pm : ""}\n` : "";
    const out = await this.sample.json(`${this.brand}\nRispondi SOLO con JSON: {"answer":"1-3 frasi in italiano: prima la risposta, poi cosa proponi di vedere","label":"2-3 parole che riassumono il percorso","highlight":["id"],"sections":["id"],"ask":null,"mode":{"density":null,"energy":null}}\nREGOLE: highlight solo con aree/lavori/segnali davvero legati alla richiesta (id ESATTI, senza prefisso), altrimenti vuoto; sections tra sistema, aree, lavori, metodo, team, radar, contatti (persone → team; chi siamo → sistema; domande generiche → sistema, aree, metodo con label "Scopri Frameworks"); se la richiesta è troppo vaga, highlight e sections vuoti e ask = {"question":"una domanda breve","options":["3-4 opzioni brevi"]}; mode.density "2" solo se nella richiesta il visitatore parla di fretta/poco tempo, "all" se vuole approfondire, altrimenti null (se ha già scelto il tempo, lascia null); mode.energy "calm" o "vivid" solo se lo chiede, altrimenti null.${pref}${hist}\nINDICE:\n${this.index()}\n\nRICHIESTA: ${q}`, { modelTier: "quick" });
    return out;
  },
  async adapt(p) {
    if (!PREVIEW) { const r = await fetch("/api/ai/adapt", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(p) }); const j = await r.json(); if (!r.ok) throw new Error(j.error || "Errore"); return j; }
    const item = byId(p.itemId); const desc = item.client ? `LAVORO: ${item.client} — ${item.title}. ${item.body}` : `AREA: ${item.name}. ${item.body}`;
    const r = await this.sample(`${this.brand}\nRiscrivi in 90-130 parole, prosa, seconda persona plurale ("il vostro brand"): cosa resta del sistema, cosa cambia per il contesto, un esempio di variante, una frase di sintesi.\n${desc}\nCONTESTO — settore: ${p.sector || "n.d."}; obiettivo: ${p.goal || "n.d."}; canale: ${p.channel || "n.d."}`, { modelTier: "quick" });
    return { text: r.text };
  }
};

/* =========================================================
   DETTAGLIO (drawer desktop / sheet mobile)
   ========================================================= */
function detailHTML(item) {
  const list = (items, label) => items.length ? `<div class="list">${items.map(i => `<button type="button" data-open="${i.id}"><span>${esc(i.kind === "work" ? i.client + " · " + i.title : i.kind === "signal" ? i.title : i.name)}</span><small>${label}</small></button>`).join("")}</div>` : "";
  const adapt = (id) => DATA.features.adapt !== false ? `<div class="adapt" data-adapt="${id}"><div class="eyebrow"><span class="dot"></span>Adatta al tuo contesto</div><h4>Come si riconfigurerebbe per il vostro brand?</h4><div class="grid"><input name="sector" placeholder="Settore (es. moda, energia, cultura)" maxlength="60"><input name="channel" placeholder="Canale principale (es. retail, social, evento)" maxlength="60"></div><input name="goal" placeholder="Obiettivo (es. lancio prodotto, employer branding)" maxlength="100" style="margin-top:8px"><button class="btn primary go" type="button">Genera la variante</button><div class="adapt-out" hidden></div></div>` : "";
  if (item.kind === "core") return `<div class="d-img"><img src="${media(DATA.site.hero_image)}" alt=""></div><div class="d-in"><div class="eyebrow"><span class="dot"></span>${esc(DATA.site.claim)}</div><h2>${em(DATA.site.hero_title)}</h2><p>${esc(DATA.site.tagline)}</p><p>${esc(DATA.site.hero_text)}</p>${list(DATA.caps.map(c => ({ ...c, kind: "cap" })), "area")}</div>`;
  if (item.kind === "cap") return `<div class="d-img"><img src="${media(item.image) || media("/media/frames.jpg")}" alt=""></div><div class="d-in"><div class="eyebrow"><span class="dot"></span>Area</div><h2>${esc(item.name)}</h2><p>${esc(item.body)}</p><div class="tags">${item.tags.map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div>${adapt(item.id)}${list(worksFor(item.id).map(w => ({ ...w, kind: "work" })), "lavoro")}${list(signalsFor(item.id).map(s => ({ ...s, kind: "signal" })), "radar")}</div>`;
  if (item.kind === "work") return `<div class="d-img"><img src="${media(item.image) || media("/media/monolith.jpg")}" alt=""></div><div class="d-in"><div class="eyebrow"><span class="dot"></span>${esc(item.client)} · ${esc(item.year)} · <span class="chip ghost">${esc(item.status)}</span></div><h2>${esc(item.title)}</h2><p>${esc(item.body)}</p>${adapt(item.id)}${list(item.caps.map(capById).filter(Boolean).map(c => ({ ...c, kind: "cap" })), "area")}</div>`;
  if (item.kind === "signal") return `<div class="d-in"><div class="eyebrow"><span class="chip ext">Fonte esterna</span> &nbsp;${esc(item.src)} · ${esc(fmtDate(item.date))}</div><h2 class="serif" style="font-weight:400;font-size:28px">“${esc(item.title)}”</h2><div class="ext-note">Contenuto di terzi: titolo e riassunto appartengono a ${esc(item.src)} (${esc(domain(item.url))}). Frameworks lo segnala e lo commenta.</div>${item.summary ? `<p>${esc(item.summary)}</p>` : ""}<p style="padding-left:16px;border-left:2px solid var(--accent)"><small class="eyebrow" style="display:block;color:var(--accent-ink);margin-bottom:6px">La nostra lettura</small>${esc(item.why)}</p><p><a class="btn" href="${esc(item.url)}" target="_blank" rel="noopener nofollow">Leggi la fonte ↗</a></p>${list(item.caps.map(capById).filter(Boolean).map(c => ({ ...c, kind: "cap" })), "area")}</div>`;
  return "";
}
const drawer = $("#drawer"), scrim = $("#scrim"), sheet = $("#sheet");
function openDetail(item) {
  if (!item) return;
  const h = detailHTML(item); const eyebrow = item.kind === "core" ? "Frameworks" : item.kind === "cap" ? "Area" : item.kind === "work" ? "Lavoro" : "Radar";
  if (isMobile()) { $("#sheet-body").innerHTML = h; $("#sheet-eyebrow").textContent = eyebrow; sheet.dataset.state = "open"; }
  else { $("#drawer-body").innerHTML = h; $("#drawer-eyebrow").textContent = eyebrow; drawer.dataset.state = "open"; drawer.querySelector(".drawer-body").scrollTop = 0; }
  scrim.dataset.state = "open";
  AI.check().then(ok => { if (!ok) $$(".adapt").forEach(a => a.hidden = true); });
}
function closeDetail() { drawer.dataset.state = "closed"; sheet.dataset.state = "closed"; scrim.dataset.state = "closed"; }
scrim.addEventListener("click", closeDetail); $("#drawer-close").addEventListener("click", closeDetail); $("#sheet-close").addEventListener("click", closeDetail);
document.addEventListener("keydown", e => { if (e.key === "Escape") { closeDetail(); const p = $("#modes"); if (p && !p.hidden) p.hidden = true; } });
document.addEventListener("click", e => {
  const nav = e.target.closest('.topnav a[href^="#"]'); if (nav && !isMobile()) { const t = $(nav.getAttribute("href")); if (t && getComputedStyle(t).display === "none") { e.preventDefault(); if (Focus.ids) Focus.clear(); else Modes.set("density", "all"); setTimeout(() => t.scrollIntoView({ behavior: reduced ? "auto" : "smooth" }), 60); return; } }
  const b = e.target.closest("[data-open]"); if (b) { openDetail(byId(b.dataset.open)); return; }
  const n = e.target.closest("[data-open-node]"); if (n) { openDetail(byId(n.dataset.openNode)); return; }
  const go = e.target.closest(".adapt .go"); if (go) runAdapt(go.closest(".adapt"));
  const c = e.target.closest("[data-copy]"); if (c) copyText(c);
  const cta = e.target.closest(".topnav .cta"); if (cta && isMobile()) { e.preventDefault(); openContactSheet(); }
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
  out.hidden = false; out.innerHTML = `<span class="who">Console · sto riconfigurando…</span>`; go.disabled = true;
  try { const r = await AI.adapt(p); out.innerHTML = `<span class="who">Variante per il vostro contesto</span>${esc(r.text)}`; }
  catch (e) { out.innerHTML = `<span class="who">Console</span>${esc(e.message || "Non riesco a generare la variante adesso.")}`; }
  go.disabled = false;
}
function copyText(b) {
  const done = () => { b.dataset.done = "true"; b.textContent = "Copiato"; setTimeout(() => { b.dataset.done = "false"; b.textContent = "Copia"; }, 1800); };
  const fallback = () => { const code = b.parentElement.querySelector("code"); if (code) { const r = document.createRange(); r.selectNodeContents(code); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } b.textContent = "Seleziona e copia"; };
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
  ids.forEach(id => { const el = $(`.cap[data-open="${id}"], .work[data-open="${id}"], .card[data-id="${id}"]`); if (el && hasGsap && !reduced) gsap.fromTo(el, { boxShadow: "0 0 0 0 rgba(191,0,255,.9)" }, { boxShadow: "0 0 0 14px rgba(191,0,255,0)", duration: 1.4, ease: "power2.out" }); });
}

/* =========================================================
   CONSOLE — mappa a nodi su canvas (desktop)
   ========================================================= */
const Console = (() => {
  const cv = $("#graph"); if (!cv) return null;
  const ctx = cv.getContext("2d");
  const PURPLE = "#BF00FF", PAPER = "#EEEAF1";
  const SANS = '"Helvetica Now Display","Helvetica Neue",Helvetica,Arial,sans-serif', MONO = '"Geist Mono",ui-monospace,Menlo,monospace';
  let W = 0, H = 0, nodes = [], edges = [], hover = null, drag = null, particles = [], raf = 0, running = false, last = 0, spawnAt = 0, hi = new Set(), hiUntil = 0, fontsReady = false, focusSet = null;
  const deg = (d) => d * Math.PI / 180;
  const amp = () => parseFloat(getComputedStyle(html).getPropertyValue("--amp")) || 1;
  const speed = () => parseFloat(getComputedStyle(html).getPropertyValue("--speed")) || 1;
  function build() {
    const cx = W * 0.64, cy = H * 0.5, s = Math.max(0.68, Math.min(1.25, Math.min(W, H) / 900));
    const R_CAP = 215 * s, R_WORK = 345 * s, R_SIG = 430 * s, ky = Math.min(0.86, (H / 2 - 120) / R_SIG);
    const place = (ang, R) => ({ bx: cx + Math.cos(ang) * R, by: cy + Math.sin(ang) * R * ky });
    nodes = []; edges = [];
    const core = { id: "core", kind: "core", r: 30 * s, bx: cx, by: cy, ox: 0, oy: 0, ph: 0, ang: 0 }; nodes.push(core);
    const n = DATA.caps.length, a0 = -125, a1 = 125;
    DATA.caps.forEach((c, i) => { const ang = deg(n > 1 ? a0 + (a1 - a0) * i / (n - 1) : 0); const nd = { ...c, kind: "cap", r: 14 * s, ang, ...place(ang, R_CAP), ox: 0, oy: 0, ph: i * 1.7 }; nodes.push(nd); edges.push({ a: core, b: nd, alpha: .18 }); });
    const capNode = (id) => nodes.find(x => x.id === id && x.kind === "cap") || nodes[1];
    const perCap = {}; DATA.works.forEach(w => (perCap[w.caps[0]] = perCap[w.caps[0]] || []).push(w));
    DATA.works.forEach((w, i) => { const cn = capNode(w.caps[0]); const sib = perCap[w.caps[0]] || [w]; const k = sib.indexOf(w); const ang = cn.ang + deg((k - (sib.length - 1) / 2) * 16 + 20); const nd = { ...w, kind: "work", r: 6 * s, ang, ...place(ang, R_WORK), ox: 0, oy: 0, ph: 10 + i * 1.3 }; nodes.push(nd); w.caps.forEach((cid, j) => { const c = capNode(cid); if (c) edges.push({ a: c, b: nd, alpha: j === 0 ? .12 : .06 }); }); });
    const perCapS = {}; DATA.signals.slice(0, 14).forEach(sg => (perCapS[sg.caps[0]] = perCapS[sg.caps[0]] || []).push(sg));
    DATA.signals.slice(0, 14).forEach((sg, i) => { const cn = capNode(sg.caps[0]); const sib = perCapS[sg.caps[0]] || [sg]; const k = sib.indexOf(sg); const ang = cn.ang + deg((k - (sib.length - 1) / 2) * 11 - 14); const nd = { ...sg, kind: "signal", r: 3.4 * s, ang, ...place(ang, R_SIG), ox: 0, oy: 0, ph: 30 + i * 2.1 }; nodes.push(nd); edges.push({ a: nd, b: cn, alpha: .07, dash: true, signal: true }); });
    particles = [];
  }
  function resize() { const dpr = Math.min(2, window.devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); build(); if (!running) draw(performance.now()); }
  function pos(nd, t) { const a = reduced ? 0 : (nd.kind === "core" ? 3 : nd.kind === "cap" ? 7 : 9) * amp(); return { x: nd.bx + nd.ox + Math.sin(t * 0.00035 * speed() + nd.ph) * a, y: nd.by + nd.oy + Math.cos(t * 0.00028 * speed() + nd.ph * 1.3) * a }; }
  function related(nd) { if (!nd) return new Set(); const set = new Set([nd.id]); edges.forEach(e => { if (e.a.id === nd.id) set.add(e.b.id); if (e.b.id === nd.id) set.add(e.a.id); }); return set; }
  // il nodo centrale è il cubo del logo (stesse tre facce del file ufficiale, box 51.09×59)
  const CUBE = [[51.09, 14.75, 25.55, 59, 51.09, 44.25], [25.55, 29.5, 0, 14.75, 25.55, 0, 51.09, 14.75], [25.55, 29.5, 25.55, 59, 0, 44.25]];
  function cube(x, y, h) { const k = h / 59; ctx.save(); ctx.translate(x - 25.55 * k, y - 29.5 * k); ctx.scale(k, k); CUBE.forEach(pl => { ctx.beginPath(); for (let i = 0; i < pl.length; i += 2) i ? ctx.lineTo(pl[i], pl[i + 1]) : ctx.moveTo(pl[i], pl[i + 1]); ctx.closePath(); ctx.fill(); }); ctx.restore(); }
  function label(p, nd, main, eyebrow, font, color, off) { const right = Math.cos(nd.ang) >= -0.15; const x = right ? p.x + off : p.x - off; ctx.textAlign = right ? "left" : "right"; ctx.textBaseline = "middle"; if (eyebrow) { ctx.font = `500 9px ${MONO}`; ctx.fillStyle = "rgba(139,129,151,1)"; ctx.letterSpacing = "1.2px"; ctx.fillText(eyebrow, x, p.y - 9); ctx.letterSpacing = "0px"; } ctx.font = font; ctx.fillStyle = color; ctx.fillText(main, x, eyebrow ? p.y + 5 : p.y); }
  function draw(t) {
    ctx.clearRect(0, 0, W, H); if (!nodes.length || !W) return;
    const P = {}; nodes.forEach(nd => P[nd.id] = pos(nd, t));
    const active = hover || null; const rel = related(active); const hiOn = hi.size && t < hiUntil; if (!hiOn && hi.size) hi.clear();
    edges.forEach(e => { const a = P[e.a.id], b = P[e.b.id]; const hot = (active && rel.has(e.a.id) && rel.has(e.b.id)) || (hiOn && (hi.has(e.a.id) || hi.has(e.b.id))); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.setLineDash(e.dash ? [2, 7] : []); ctx.lineWidth = hot ? 1.5 : 1; ctx.strokeStyle = hot ? "rgba(191,0,255,.9)" : `rgba(255,255,255,${active || hiOn ? e.alpha * .5 : e.alpha})`; ctx.stroke(); });
    ctx.setLineDash([]);
    if (!reduced) {
      if (t > spawnAt && particles.length < 9 * amp()) { const sEdges = edges.filter(e => e.signal); if (sEdges.length) { const e = sEdges[Math.floor(Math.random() * sEdges.length)]; const next = edges.find(x => x.b.id === e.b.id && x.a.kind === "core"); particles.push({ segs: [[e.a.id, e.b.id], next ? [e.b.id, next.a.id] : null].filter(Boolean), i: 0, p: 0, v: (0.00065 + Math.random() * 0.0004) * speed() }); } spawnAt = t + (700 + Math.random() * 900) / speed(); }
      const dt = last ? Math.min(50, t - last) : 16;
      particles = particles.filter(pt => { pt.p += pt.v * dt; if (pt.p >= 1) { pt.i++; pt.p = 0; if (pt.i >= pt.segs.length) return false; } const [ia, ib] = pt.segs[pt.i]; const a = P[ia], b = P[ib]; if (!a || !b) return false; const x = a.x + (b.x - a.x) * pt.p, y = a.y + (b.y - a.y) * pt.p; const q = Math.max(0, pt.p - 0.12); const tx = a.x + (b.x - a.x) * q, ty = a.y + (b.y - a.y) * q; const g = ctx.createLinearGradient(tx, ty, x, y); g.addColorStop(0, "rgba(238,234,241,0)"); g.addColorStop(1, "rgba(238,234,241,.9)"); ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke(); ctx.fillStyle = pt.i === 0 ? PAPER : PURPLE; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fill(); return true; });
    }
    nodes.forEach(nd => {
      const p = P[nd.id]; const isHover = active && active.id === nd.id; const isHi = hiOn && hi.has(nd.id); const inRel = (!active || rel.has(nd.id)) && (!hiOn || hi.has(nd.id) || nd.kind === "core"); const inFocus = !focusSet || focusSet.has(nd.id) || nd.kind === "core"; const dim = inRel ? (inFocus ? 1 : .22) : .3;
      ctx.save(); ctx.globalAlpha = dim;
      if (nd.kind === "core") { const r = nd.r; ctx.fillStyle = isHover ? PURPLE : "#fff"; cube(p.x, p.y, r * 2.1); ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.font = `500 10.5px ${MONO}`; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.letterSpacing = "1.5px"; ctx.fillText((DATA.site.claim || "").toUpperCase(), p.x, p.y + r + 12); ctx.letterSpacing = "0px"; }
      else if (nd.kind === "cap") { ctx.beginPath(); ctx.arc(p.x, p.y, nd.r + (isHi ? 3 : 0), 0, Math.PI * 2); ctx.fillStyle = isHover || isHi ? PURPLE : "#050307"; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = isHover || isHi ? PURPLE : "#fff"; ctx.stroke(); label(p, nd, nd.name, "AREA", `600 14px ${SANS}`, "#fff", nd.r + 12); }
      else if (nd.kind === "work") { ctx.beginPath(); ctx.arc(p.x, p.y, isHover || isHi ? nd.r + 2 : nd.r, 0, Math.PI * 2); ctx.fillStyle = isHover || isHi ? PURPLE : "#CFC7D8"; ctx.fill(); label(p, nd, nd.label || nd.client, isHover ? nd.title.toUpperCase() : "", `500 12px ${SANS}`, isHover || isHi ? "#fff" : "#CFC7D8", nd.r + 9); }
      else if (nd.kind === "signal") { ctx.globalAlpha = inRel ? .95 : .3; ctx.beginPath(); ctx.arc(p.x, p.y, isHover || isHi ? nd.r + 2.5 : nd.r, 0, Math.PI * 2); ctx.fillStyle = PAPER; ctx.fill(); if (isHover || isHi || (active && active.kind === "cap" && rel.has(nd.id))) label(p, nd, nd.src, "RADAR · FONTE ESTERNA", `400 11px ${MONO}`, PAPER, nd.r + 8); }
      ctx.restore();
    });
    last = t;
  }
  function loop(t) { draw(t); raf = requestAnimationFrame(loop); }
  function start() { if (running) return; running = true; last = 0; raf = requestAnimationFrame(loop); }
  function stop() { running = false; cancelAnimationFrame(raf); }
  function hit(x, y) { const t = performance.now(); let best = null, bd = 1e9; nodes.forEach(nd => { const p = pos(nd, t); const d = Math.hypot(p.x - x, p.y - y); const R = Math.max(nd.r + 10, 14); if (d < R && d < bd) { bd = d; best = nd; } }); return best; }
  const xy = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  cv.addEventListener("pointermove", e => { const { x, y } = xy(e); if (drag) { drag.nd.ox = drag.ox0 + (x - drag.x0); drag.nd.oy = drag.oy0 + (y - drag.y0); drag.moved = Math.max(drag.moved, Math.hypot(x - drag.x0, y - drag.y0)); if (reduced) draw(performance.now()); return; } const h = hit(x, y); if (h !== hover) { hover = h; cv.style.cursor = h ? "pointer" : "default"; if (reduced) draw(performance.now()); } });
  cv.addEventListener("pointerdown", e => { const { x, y } = xy(e); const h = hit(x, y); if (h) { drag = { nd: h, x0: x, y0: y, ox0: h.ox, oy0: h.oy, moved: 0 }; cv.setPointerCapture(e.pointerId); cv.style.cursor = "grabbing"; } });
  cv.addEventListener("pointerup", () => { if (drag) { const nd = drag.nd, moved = drag.moved; drag = null; cv.style.cursor = "pointer"; if (moved < 5) openDetail(byId(nd.id)); } });
  cv.addEventListener("pointerleave", () => { if (!drag) { hover = null; if (reduced) draw(performance.now()); } });
  new IntersectionObserver(en => en.forEach(x => { if (x.isIntersecting && !isMobile()) start(); else stop(); }), { threshold: 0.05 }).observe(cv);
  window.addEventListener("resize", () => { if (!isMobile()) resize(); });
  if (!isMobile()) resize();
  const ready = () => { if (fontsReady) return; fontsReady = true; if (!isMobile()) { resize(); start(); } };
  if (document.fonts && document.fonts.ready) { document.fonts.ready.then(ready); setTimeout(ready, 1500); } else ready();
  return { start, stop, resize, highlight(ids) { hi = new Set(ids); hiUntil = performance.now() + 6000; if (reduced) draw(performance.now()); }, setFocus(ids) { focusSet = ids ? new Set(ids) : null; if (reduced) draw(performance.now()); } };
})();

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
  return `<div class="m-text team-m" data-m-tier="10"><div class="eyebrow"><span class="dot"></span>Team · ${team.length} persone</div><h2 style="margin-top:8px">${em(site.team_title || "Un sistema è fatto di <em>persone.</em>")}</h2><p>${esc(site.team_text || "")}</p>
    <div class="people-m">${key.map(m => `<div class="pm">${face(m)}<div><b>${esc(m.name)}</b><small>${esc(m.role)}</small></div></div>`).join("")}</div>
    <details class="roster-m"><summary>Tutto il team · ${team.length}</summary>${units.map(u => { const l = team.filter(m => m.unit === u && !m.is_key); return l.length ? `<div class="eyebrow"><span class="dot"></span>${esc(u)}</div><ul>${l.map(m => `<li><b>${esc(m.name)}</b><span>${esc(m.role)}</span></li>`).join("")}</ul>` : ""; }).join("")}</details></div>`;
}
const greet = () => { const h = new Date().getHours(); return h < 6 ? "Buonanotte." : h < 12 ? "Buongiorno." : h < 18 ? "Buon pomeriggio." : "Buonasera."; };
const App = {
  current: "home", filter: "all",
  render() {
    const app = $("#app"); if (!app) return; const site = DATA.site; const w = Ctx.weather;
    const tile = (i) => `<button class="tile" type="button" data-open="${i.id}"><img src="${media(i.image) || media("/media/frames.jpg")}" alt="" loading="lazy"><div class="eyebrow"><span class="dot"></span>Area</div><h3>${i.accent && i.name.includes(i.accent) ? esc(i.name).replace(esc(i.accent), '<span class="serif">' + esc(i.accent) + '</span>') : esc(i.name)}</h3><p>${esc(i.short)}</p></button>`;
    const wtile = (x) => `<button class="tile work" type="button" data-open="${x.id}"><img src="${media(x.image) || media("/media/monolith.jpg")}" alt="" loading="lazy"><div class="eyebrow"><span class="dot"></span>${esc(x.client)}</div><h3>${esc(x.title)}</h3></button>`;
    const news = (sg, mini) => `<button class="nc ${mini ? "mini" : ""}" type="button" data-open="${sg.id}"><div class="src"><span class="chip ext">Fonte esterna</span><b>${esc(sg.src)}</b><span>${esc(fmtDate(sg.date))}</span></div><h3>“${esc(sg.title)}”</h3>${mini ? "" : `<p>${esc(sg.why)}</p>`}</button>`;
    const gc = (x) => `<button class="gc" type="button" data-open="${x.id}" data-caps="${x.caps.join(" ")}"><img src="${media(x.image) || media("/media/monolith.jpg")}" alt="" loading="lazy"><div><small>${esc(x.client)}</small><h3>${esc(x.title)}</h3></div></button>`;
    const askBox = `<button class="ask" type="button" data-tab="console"><b>✦</b><span>Chiedi alla Console: cosa fate per…</span></button>`;
    const home = `<section class="screen on" data-screen="home">
      <div class="cover"><img src="${media(site.hero_image_mobile || site.hero_image)}" alt=""><span class="status" id="m-status">On Air${w && w.temp != null ? " · Roma " + w.temp + "° " + labelWeather(w.kind) : ""}</span><div class="greet">${greet()} Siamo Frameworks.</div><h1>${em(site.hero_title)}</h1><p>${esc(site.tagline)}</p></div>
      <div data-m-tier="2">${askBox}<div class="chips"><button type="button" data-tab="console" data-q="Cosa fate per il retail?">Cosa fate per il retail?</button><button type="button" data-tab="console" data-q="Mostrami le esperienze immersive">Esperienze immersive</button><button type="button" data-tab="console" data-q="Ho fretta: l'essenziale">Ho fretta</button><button type="button" data-tab="console" data-q="Come usate l'AI?">Come usate l'AI?</button></div></div>
      <div ${Focus.list(DATA.caps).length ? "" : "hidden"}><div class="row-head"><h2>${Focus.ids ? "Le aree del tuo percorso" : "Le quattro aree"}</h2><button type="button" data-tab="sistema">Tutte</button></div><div class="carousel">${Focus.list(DATA.caps).map(tile).join("")}</div></div>
      <div ${Focus.list(DATA.works).length ? "" : "hidden"}><div class="row-head"><h2>Lavori</h2><button type="button" data-tab="lavori">Vedi tutti</button></div><div class="carousel">${Focus.list(DATA.works).slice(0, 6).map(wtile).join("")}</div></div>
      <div class="m-statement" data-m-tier="10"><h2>${esc((site.statements || [])[0] || "")}</h2></div>
      <div data-m-tier="${Focus.ids && Focus.list(DATA.signals).length ? "2" : "10"}" ${Focus.list(DATA.signals).length ? "" : "hidden"}><div class="row-head"><h2>Radar oggi</h2><button type="button" data-tab="radar">Tutto il radar</button></div><div class="news">${Focus.list(DATA.signals).slice(0, 3).map(sg => news(sg, true)).join("")}</div></div>
      <div class="m-text" data-m-tier="10"><div class="eyebrow"><span class="dot"></span>Metodo</div><h2 style="margin-top:8px">Cinque fasi, un <span class="serif">ciclo.</span></h2><ol class="steps">${(site.method || []).map((m, i) => `<li><i>${String(i + 1).padStart(2, "0")}</i><span><b>${esc(m.k)}</b>${esc(m.text)}</span></li>`).join("")}</ol></div>
      ${contactHTML()}
      <p class="app-foot">${esc(site.footer_note)}</p>
    </section>`;
    const sistema = `<section class="screen" data-screen="sistema">
      <div class="m-statement"><h2>${esc((site.statements || [])[2] || "Ogni progetto è concepito come un organismo vivente.")}</h2></div>
      <div class="m-text"><div class="eyebrow"><span class="dot"></span>${esc(site.claim)}</div><h2 style="margin-top:8px">${em(site.organism_title)}</h2><p>${esc(site.organism_text)}</p></div>
      <div data-m-tier="10"><div class="org-lab" data-organism></div><p class="org-caption"><b>Provalo.</b> Scrivi il tuo brand, poi cambia formato: le stesse particelle si riconfigurano per ogni canale. Tocca per farle esplodere: si ricompongono da sole.</p></div>
      <div><div class="row-head"><h2>Le aree</h2></div><div class="list-cards">${Focus.list(DATA.caps).map(c => `<button class="area-card" type="button" data-open="${c.id}"><img src="${media(c.image) || media("/media/frames.jpg")}" alt="" loading="lazy"><div><div class="eyebrow"><span class="dot"></span>Area</div><h3 style="margin-top:6px">${c.accent && c.name.includes(c.accent) ? esc(c.name).replace(esc(c.accent), '<span class="serif">' + esc(c.accent) + '</span>') : esc(c.name)}</h3><p>${esc(c.short)}</p><div class="tags">${c.tags.slice(0, 4).map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div></div></button>`).join("")}</div></div>
      ${teamHTML()}
      <div class="triad-m" data-m-tier="10">${(site.triad || []).map(t => `<div><h3>${esc(t.la)}</h3><small>${esc(t.it)}</small><p>${esc(t.text)}</p></div>`).join("")}</div>
      <div class="m-text" data-m-tier="10"><h2>${em(site.tech_title)}</h2><ol class="steps" style="margin-top:14px">${(site.tech || []).map(t => `<li><i>·</i><span><b>${esc(t.k)}</b>${esc(t.text)}</span></li>`).join("")}</ol></div>
      <div class="m-text metodo-m" data-m-tier="10"><div class="eyebrow"><span class="dot"></span>Metodo</div><p>${esc(site.method_intro)}</p><ol class="steps">${(site.method || []).map((m, i) => `<li><i>${String(i + 1).padStart(2, "0")}</i><span><b>${esc(m.k)}</b>${esc(m.text)}</span></li>`).join("")}</ol></div>
      ${contactHTML()}
    </section>`;
    const lavori = `<section class="screen" data-screen="lavori">
      <div><h2>Organismi in <span class="serif">azione.</span></h2><div class="chips"><button type="button" class="on" data-filter="all">Tutti</button>${DATA.caps.map(c => `<button type="button" data-filter="${c.id}">${esc(c.name)}</button>`).join("")}</div></div>
      <div class="grid2m" id="works-grid">${Focus.list(DATA.works).map(gc).join("")}</div>
      <p class="app-foot">Tocca un lavoro per aprirlo e adattarlo al tuo contesto</p>
      ${contactHTML()}
    </section>`;
    const radar = `<section class="screen paper-screen" data-screen="radar">
      <div><div class="eyebrow"><span class="dot"></span>Radar · fonti esterne${DATA.radar_at ? ` · ${fmtWhen(DATA.radar_at)}` : ""}</div><h2 style="margin-top:8px">${em(site.radar_title)}</h2><p class="radar-intro" style="margin-top:8px">${esc(site.radar_text)}</p></div>
      <div class="radar-live"><div class="eyebrow"><span class="dot"></span>Cerca nel mondo, adesso</div><form class="radar-form" data-radar-search autocomplete="off"><input type="search" name="q" placeholder="Un tema: DOOH, retail media…" maxlength="80" aria-label="Cerca nel radar" enterkeyhint="search"><button type="submit">Cerca</button></form><div class="chips radar-chips"><button type="button" data-live-q="DOOH">DOOH</button><button type="button" data-live-q="retail media">Retail media</button><button type="button" data-live-q="AI generativa pubblicità">AI generativa</button><button type="button" data-live-q="virtual production">Virtual production</button></div><div class="radar-results" data-radar-results hidden></div></div>
      <div class="row-head" style="margin-top:22px"><h2>Selezione del Radar</h2></div>
      <div class="news">${Focus.list(DATA.signals).map(sg => news(sg, false)).join("")}</div>
      <p class="paper-note">I titoli appartengono alle rispettive testate. Frameworks li segnala e li commenta.</p>
    </section>`;
    const story = Focus.ids ? Path.renderStory() : "";
    app.innerHTML = story + home + sistema + lavori + radar;
    if (story) Path.bindStory();
    // in modalità percorso la tab bar si riduce a Percorso · Console · Contatti
    const tabs = Focus.ids ? [["percorso", "Percorso"], ["console", "Console"], ["contatti", "Contatti"]] : [["home", "Home"], ["sistema", "Sistema"], ["console", "Console"], ["lavori", "Lavori"], ["radar", "Radar"]];
    const bar = $("#tabbar");
    bar.innerHTML = tabs.map(([k, l]) => k === "console" ? `<button type="button" class="fab" data-tab="console" id="tab-console"><i>${ICONS.console}</i><span>${l}</span></button>` : `<button type="button" data-tab="${k}" class="${k === this.current ? "on" : ""}">${ICONS[k]}<span>${l}</span></button>`).join("");
    const cols = () => { bar.style.gridTemplateColumns = `repeat(${$$("button", bar).length},1fr)`; }; cols();
    AI.check().then(ok => { if (!ok) { $$("[data-tab=console]").forEach(el => el.remove()); cols(); } });
    this.applyDensity(); this.show(this.current, true);
    if (window.OrganismLab) OrganismLab.mountAll(); // l'organismo interattivo nella schermata Sistema
  },
  show(name, silent) {
    if (!$(`.screen[data-screen="${name}"]`)) name = "home";
    this.current = name;
    $$(".screen").forEach(s => s.classList.toggle("on", s.dataset.screen === name));
    $$("#tabbar [data-tab]").forEach(b => b.classList.toggle("on", b.dataset.tab === name));
    document.body.classList.toggle("story-on", name === "percorso");
    closeDetail(); window.scrollTo({ top: 0, behavior: "auto" }); checkPaper();
    if (!silent) try { history.replaceState(null, "", "#" + name); } catch {}
  },
  filterWorks(id) { this.filter = id; $$("#works-grid .gc").forEach(g => g.hidden = !(id === "all" || g.dataset.caps.split(" ").includes(id))); },
  applyDensity() { const d = Modes.density; $$("[data-m-tier]").forEach(el => { const t = el.dataset.mTier; el.hidden = (d === "2" && t !== "2"); }); }
};
function contactHTML() { const site = DATA.site; return `<div class="contact-m" data-m-tier="2"><div class="eyebrow"><span class="dot"></span>Contatti</div><h2 style="margin-top:8px">${em(site.contact_title)}</h2><code>${esc(site.contact_email)}</code><button class="copy" type="button" data-copy="${esc(site.contact_email)}">Copia</button><p class="addr">${esc(site.contact_address).replace(/\n/g, "<br>")}</p></div>`; }
function openSheet(html, eyebrow) { $("#sheet-body").innerHTML = html; $("#sheet-eyebrow").textContent = eyebrow; sheet.dataset.state = "open"; scrim.dataset.state = "open"; $("#sheet-body").scrollTop = 0; }
function openContactSheet() { openSheet(`<div class="d-in">${contactHTML().replace('class="contact-m"', 'class="contact-m" style="border:0;padding:0;background:none"')}</div>`, "Contatti"); }
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
      if (on) { const n = this.items().length; $("#focus-text", bar).innerHTML = `<b>${esc(this.label || "Percorso")}</b> · ${n} ${n === 1 ? "tappa" : "tappe"}`; bar.hidden = false; }
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
  metaText() { const c = this.counts(); const pl = (n, s, p) => `${n} ${n === 1 ? s : p}`; return `${pl(c.items.length, "tappa", "tappe")} · ${pl(c.caps, "area", "aree")} · ${pl(c.works, "lavoro", "lavori")}${c.sigs ? ` · ${pl(c.sigs, "segnale radar", "segnali radar")}` : ""}`; },
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
        <div class="eyebrow"><span class="dot"></span>Percorso della Console${Focus.label ? ` · ${esc(Focus.label)}` : ""}</div>
        ${Focus.q ? `<p class="path-q">Hai chiesto: “${esc(Focus.q)}”</p>` : ""}
        <h2 class="serif">${esc(Focus.text || "Ecco il percorso che ti propongo.")}</h2>
        <p class="path-meta">${this.metaText()}</p>
        ${Focus.sections.length ? `<div class="path-also"><span>Vedi anche</span>${Focus.sections.map(x => `<button type="button" class="btn ghost" data-goto="${x}">${esc(SECTIONS[x].name)} →</button>`).join("")}</div>` : ""}
      </div>
      ${caps.length ? step("Aree", `${caps.length} ${caps.length === 1 ? "area" : "aree"}`) + `<div class="caps path-caps">${caps.map(x => clone(`#aree .cap[data-open="${x.id}"]`)).join("")}</div>` : ""}
      ${works.length ? step("Lavori", `${works.length} ${works.length === 1 ? "lavoro" : "lavori"}`) + `<div class="works path-works">${works.map(x => clone(`#lavori .work[data-open="${x.id}"]`)).join("")}</div>` : ""}
      ${sigs.length ? step("Radar · fonti esterne", `${sigs.length} ${sigs.length === 1 ? "segnale" : "segnali"}`) + `<div class="paper path-paper"><div class="signals">${sigs.map(x => clone(`#radar .signal[data-id="${x.id}"]`)).join("")}</div><p class="note">I titoli e i riassunti appartengono alle rispettive testate. Frameworks li segnala e li commenta; non ne rivendica la paternità.</p></div>` : ""}
      <div class="path-end">
        <div><h3 class="serif">Questo era il percorso su misura per te.</h3><p>Frameworks è un sistema più grande: il contesto, il metodo, il radar, l'organismo intero.</p></div>
        <div class="path-actions"><button class="btn accent" type="button" data-discover>Scopri tutta Frameworks <span>→</span></button><a class="btn primary" href="#contatti">Parliamone</a><button class="btn ghost" type="button" data-tab="console">Chiedi ancora alla Console</button></div>
      </div>`;
    sec.hidden = false;
  },
  // MOBILE: le tappe
  renderStory() {
    const c = this.counts(); if (!c.items.length) return "";
    const site = DATA.site; const total = c.items.length + 2; const label = Focus.label ? ` · ${esc(Focus.label)}` : "";
    const next = (lab) => `<button type="button" class="story-next" data-story-next>${lab} <span>→</span></button>`;
    const zones = `<div class="tapzones" aria-hidden="true"><span data-story-prev></span><span data-story-next></span></div>`;
    const tappa = (i, k) => `<div class="eyebrow"><span class="dot"></span>Tappa ${String(i).padStart(2, "0")} di ${c.items.length} · ${k}</div>`;
    const img = (src, fallback, i) => `<div class="slide-img"><img src="${media(src) || media(fallback)}" alt="" loading="lazy"><span class="num">${String(i).padStart(2, "0")} / ${c.items.length}</span>${zones}</div>`;
    const intro = `<article class="slide slide-intro"><div class="slide-in"><div class="eyebrow"><span class="dot"></span>Percorso della Console${label}</div>${Focus.q ? `<p class="story-q">Hai chiesto: “${esc(Focus.q)}”</p>` : ""}<h2>${esc(Focus.text || "Ecco il percorso che ti propongo.")}</h2><p class="story-meta">${this.metaText()}</p>${Focus.sections.length ? `<div class="story-also"><span>Vedi anche</span>${Focus.sections.map(x => `<button type="button" class="btn" data-goto="${x}">${esc(SECTIONS[x].name)}</button>`).join("")}</div>` : ""}<div class="slide-actions">${next("Inizia")}</div></div></article>`;
    const body = c.items.map((it, k) => {
      const i = k + 1, last = i === c.items.length, go = next(last ? "Fine" : "Avanti");
      if (it.kind === "cap") return `<article class="slide slide-cap">${img(it.image, "/media/frames.jpg", i)}<div class="slide-in"><div class="eyebrow"><span class="dot"></span>Area</div><h2>${it.accent && it.name.includes(it.accent) ? esc(it.name).replace(esc(it.accent), '<span class="serif">' + esc(it.accent) + '</span>') : esc(it.name)}</h2><p class="short">${esc(it.short)}</p><div class="tags">${(it.tags || []).slice(0, 3).map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div><div class="slide-actions"><button class="btn primary" type="button" data-open="${it.id}">Apri l'area</button>${go}</div></div></article>`;
      if (it.kind === "work") return `<article class="slide slide-work">${img(it.image, "/media/monolith.jpg", i)}<div class="slide-in"><div class="eyebrow"><span class="dot"></span>Lavoro · ${esc(it.client)}</div><h2>${esc(it.title)}</h2><p class="short">${esc(it.short)}</p><div class="tags">${(it.caps || []).slice(0, 2).map(id => `<span class="tag">${esc(capName(id))}</span>`).join("")}<span class="chip ghost">${esc(it.status || "")}</span></div><div class="slide-actions"><button class="btn primary" type="button" data-open="${it.id}">Apri il lavoro</button>${go}</div></div></article>`;
      return `<article class="slide slide-signal"><div class="slide-in">${tappa(i, "Radar · fonte esterna")}<div class="paper-card"><div class="src"><span class="chip ext">Fonte esterna</span><b>${esc(it.src)}</b><span>${esc(fmtDate(it.date))} · ${esc(domain(it.url))}</span></div><h2>“${esc(it.title)}”</h2>${it.summary ? `<p class="sum">${esc(it.summary)}</p>` : ""}<p class="why"><small>La nostra lettura</small>${esc(it.why)}</p><p class="ext">Contenuto di terzi: titolo e riassunto appartengono a ${esc(it.src)}. Frameworks lo segnala e lo commenta.</p></div><div class="slide-actions"><a class="btn src-link" href="${esc(it.url)}" target="_blank" rel="noopener nofollow">Leggi la fonte ↗</a>${go}</div></div></article>`;
    }).join("");
    const end = `<article class="slide slide-end"><div class="slide-in"><div class="eyebrow"><span class="dot"></span>Fine del percorso · Parliamone</div><h2>${em(site.contact_title)}</h2><code>${esc(site.contact_email)}</code><button class="copy" type="button" data-copy="${esc(site.contact_email)}">Copia</button><p class="addr">${esc(site.contact_address).replace(/\n/g, "<br>")}</p><p class="more">Questo era il percorso su misura per te. Frameworks è un sistema più grande.</p><div class="slide-actions col"><button class="btn accent" type="button" data-discover>Scopri tutta Frameworks <span>→</span></button><button class="btn" type="button" data-tab="console">Chiedi ancora alla Console</button></div></div></article>`;
    return `<section class="screen story" data-screen="percorso" aria-label="Percorso">
      <div class="story-head"><div class="story-progress" id="story-progress" aria-hidden="true">${Array.from({ length: total }, (_, i) => `<i class="${i === 0 ? "on" : ""}"></i>`).join("")}</div><div class="story-bar"><span class="story-label">Percorso${label}</span><span class="story-count" id="story-count">1 / ${total}</span><button type="button" class="story-exit" data-focus-reset>Esci ✕</button></div></div>
      <div class="story-track" id="story-track">${intro}${body}${end}</div>
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
  discover() { Focus.clear(); if (ConsoleWin.el && !ConsoleWin.el.hidden) ConsoleWin.close(); if (isMobile()) { App.show("home"); return; } const first = $("main > .statement"); setTimeout(() => { if (first) first.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" }); }, 60); },
  go(delta) { const t = this.track; if (!t || !t.isConnected) return; const k = Math.round(t.scrollLeft / t.clientWidth) + delta; t.scrollTo({ left: Math.max(0, Math.min(t.children.length - 1, k)) * t.clientWidth, behavior: reduced ? "auto" : "smooth" }); }
};

/* Sezioni del sito proponibili dalla Console: nome e destinazione su desktop (ancora) e su mobile (schermata + blocco) */
const SECTIONS = { sistema: { name: "Sistema", m: ["sistema", null] }, aree: { name: "Aree", m: ["sistema", ".list-cards"] }, lavori: { name: "Lavori", m: ["lavori", null] }, metodo: { name: "Metodo", m: ["sistema", ".m-text.metodo-m"] }, team: { name: "Team", m: ["sistema", ".team-m"] }, radar: { name: "Radar", m: ["radar", null] }, contatti: { name: "Contatti", m: ["contatti", null] } };
function goSection(id) {
  const sec = SECTIONS[id]; if (!sec) return;
  if (isMobile()) {
    if (id === "contatti") { openContactSheet(); return; }
    App.show(sec.m[0]); if (sec.m[1]) setTimeout(() => { const el = $(`.screen[data-screen="${sec.m[0]}"] ${sec.m[1]}`); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - 70, behavior: reduced ? "auto" : "smooth" }); }, 80);
    return;
  }
  if (Focus.ids) Focus.clear();
  const t = $("#" + id); if (!t) return;
  if (getComputedStyle(t).display === "none") Modes.set("density", "all");
  setTimeout(() => t.scrollIntoView({ behavior: reduced ? "auto" : "smooth" }), 60);
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
  suggestions: ["Ho fretta: l'essenziale", "Cosa fate per il retail?", "Mostrami le esperienze immersive", "Come usate l'AI?", "Cosa dice il radar sul DOOH?", "Voglio approfondire tutto"],
  open(q) {
    if (!this.el) return;
    this.el.hidden = false; document.body.classList.add("cwin-open");
    if (!this.thread.children.length) { const pt = Prefs.text(); this.thread.innerHTML = `<div class="msg bot"><span class="who">Console</span><p>${pt ? `Hai scelto ${esc(pt)}: ne tengo conto. ` : ""}Dimmi cosa cerchi${pt ? "" : ", o quanto tempo hai"}: ti propongo un percorso e configuro il sito.</p></div>`; }
    $("#cwin-chips").innerHTML = this.suggestions.map(t => `<button type="button" data-ask="${esc(t)}">${esc(t)}</button>`).join("");
    if (q) this.send(q); else setTimeout(() => $("#cwin-q").focus(), 350);
  },
  close() { if (!this.el) return; this.el.hidden = true; document.body.classList.remove("cwin-open"); },
  add(html) { const d = document.createElement("div"); d.innerHTML = html; const node = d.firstElementChild; this.thread.appendChild(node); this.thread.scrollTop = this.thread.scrollHeight; return node; },
  async send(q) {
    q = String(q || "").trim(); if (!q || this.busy) return; this.busy = true;
    this.add(`<div class="msg user"><p>${esc(q)}</p></div>`);
    const think = this.add(`<div class="msg bot thinking"><span class="who">Console</span><p>sto leggendo il sistema…</p></div>`);
    try {
      const r = await AI.console(q, this.history.slice(-3));
      this.history.push({ q, a: r.answer || "" }); this.last = r;
      const items = resolveIds(r.highlight, r.answer).map(byId).filter(Boolean);
      const group = (k, label) => { const l = items.filter(i => i.kind === k); return l.length ? `<div class="prop-group"><small>${label}</small>${l.map(i => `<button type="button" class="prop-item" data-open="${i.id}">${esc(i.kind === "work" ? i.client + " · " + i.title : i.kind === "signal" ? i.src + " · " + i.title : i.name)}</button>`).join("")}</div>` : ""; };
      // pagina 1: la risposta (+ eventuale domanda) · pagina 2: il percorso con Vai / Mostrami tutto
      let pane1 = `<section class="pane"><span class="who">Console</span><p>${esc(r.answer || "")}</p>`;
      if (r.ask && r.ask.question) pane1 += `<div class="ask-q"><p>${esc(r.ask.question)}</p><div class="chips">${(r.ask.options || []).slice(0, 4).map(o => `<button type="button" data-opt="${esc(o)}">${esc(o)}</button>`).join("")}</div></div>`;
      let pane2 = "";
      const secs = (r.sections || []).filter(x => SECTIONS[x]);
      if (items.length || secs.length) {
        const id = "p" + Date.now().toString(36); this.proposals = this.proposals || {}; this.proposals[id] = { ids: items.map(i => i.id), sections: secs, label: r.label || "", answer: r.answer || "", q, density: r.mode && r.mode.density ? String(r.mode.density) : null, energy: r.mode && r.mode.energy ? r.mode.energy : null };
        pane1 += `<button type="button" class="pane-next" data-pane-next>${items.length ? "Vedi il percorso" : "Dove andare"} <span>→</span></button>`;
        const secGroup = secs.length ? `<div class="prop-group"><small>${items.length ? "Vedi anche" : "Sezioni del sito"}</small>${secs.map(x => `<button type="button" class="prop-item sec" data-goto="${x}">${esc(SECTIONS[x].name)}</button>`).join("")}</div>` : "";
        pane2 = `<section class="pane"><div class="proposal"><div class="eyebrow"><span class="dot"></span>${items.length ? "Percorso proposto" : "Navigazione proposta"}${r.label ? ` · ${esc(r.label)}` : ""}</div>${group("cap", "Aree")}${group("work", "Lavori")}${group("signal", "Radar · fonti esterne")}${secGroup}<div class="prop-actions"><button type="button" class="btn primary" data-apply="${id}">${items.length ? "Vai" : "Portami lì"}</button><button type="button" class="btn" data-focus-reset>Mostrami tutto</button></div></div></section>`;
      }
      pane1 += `</section>`;
      const html = `<div class="msg bot${pane2 ? " paged" : ""}"><div class="panes">${pane1}${pane2}</div>${pane2 ? `<div class="pane-dots" aria-hidden="true"><i class="on"></i><i></i></div>` : ""}</div>`;
      const d = document.createElement("div"); d.innerHTML = html; const node = d.firstElementChild; think.replaceWith(node);
      this.bindPanes(node);
      // mostra l'INIZIO della risposta, non la fine
      this.thread.scrollTop = Math.max(0, node.offsetTop - 12);
      if (Console && items.length) Console.highlight(items.map(i => i.id));
    } catch (err) {
      think.className = "msg bot"; think.innerHTML = `<span class="who">Console</span><p>${esc(err.message || "Non riesco a rispondere adesso.")}</p>`;
    }
    this.busy = false;
  },
  bindPanes(node) {
    const panes = $(".panes", node), dots = $$(".pane-dots i", node); if (!panes || !dots.length) return;
    const upd = () => { const k = Math.round(panes.scrollLeft / panes.clientWidth); dots.forEach((d, j) => d.classList.toggle("on", j === k)); };
    panes.addEventListener("scroll", () => requestAnimationFrame(upd), { passive: true });
    const nx = $("[data-pane-next]", node); if (nx) nx.addEventListener("click", () => { if (isMobile()) panes.scrollTo({ left: panes.clientWidth, behavior: reduced ? "auto" : "smooth" }); else $(".proposal", node).scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "nearest" }); });
  },
  apply(id) {
    const p = (this.proposals || {})[id]; if (!p) return;
    if (p.density) Modes.set("density", p.density); else if (Modes.density === "2") Modes.set("density", "10");
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
    box.hidden = false; box.innerHTML = `<p class="live-status">Cerco “${esc(q)}” nelle notizie degli ultimi 14 giorni…</p>`;
    if (PREVIEW) { box.innerHTML = `<p class="live-status">La ricerca dal vivo funziona sul sito pubblicato (qui è solo l'anteprima).</p>`; return; }
    try {
      const r = await fetch(`/api/radar/search?q=${encodeURIComponent(q)}`); const j = await r.json(); if (!r.ok) throw new Error(j.error || "Errore");
      if (!j.items.length) { box.innerHTML = `<p class="live-status">Nessuna notizia recente su “${esc(q)}”. Prova un tema più ampio.</p>`; return; }
      box.innerHTML = `<div class="live-list">${j.items.map(i => `<a class="live-item" href="${esc(i.url)}" target="_blank" rel="noopener nofollow"><span class="src"><span class="chip ext">Fonte esterna</span><b>${esc(i.src)}</b><span>${esc(fmtDate(i.date))}${i.lang === "en" ? " · en" : ""}</span></span><h4>“${esc(i.title)}”</h4></a>`).join("")}</div><p class="live-status">${j.items.length} risultati in tempo reale da Google News · fonti esterne, non curate da Frameworks · ${esc(fmtWhen(j.at))}</p>`;
    } catch (e) { box.innerHTML = `<p class="live-status">${esc(e.message || "Ricerca non disponibile adesso.")}</p>`; }
  }
};
document.addEventListener("click", e => { // Radar desktop: 5 notizie alla volta
  const b = e.target.closest("[data-radar-more]"); if (!b) return;
  const hidden = $$("#radar .signal.more[hidden]"); hidden.slice(0, 5).forEach(el => { el.hidden = false; el.dataset.shown = "1"; if (hasGsap && !reduced) gsap.fromTo(el, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: .7, ease: "power3.out" }); });
  const left = hidden.length - 5; if (left > 0) $("span", b).textContent = `+${Math.min(5, left)} di ${left}`; else b.closest(".radar-more-row").hidden = true;
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
      const t = e.target.closest(".intro-opts [data-time]"); if (t) { this.time = t.dataset.time; $$("[data-time]", this.el).forEach(b => b.classList.toggle("on", b === t)); setTimeout(() => this.step(2), 220); return; }
      const m = e.target.closest(".intro-opts [data-mood]"); if (m) { this.mood = m.dataset.mood; $$("[data-mood]", this.el).forEach(b => b.classList.toggle("on", b === m)); setTimeout(() => this.configure(), 220); return; }
      const a = e.target.closest("[data-intro-ask]"); if (a) { this.console(a.dataset.introAsk); return; }
      if (e.target.closest("#intro-ask")) { this.console(""); return; }
      if (e.target.closest("#intro-skip") || e.target.closest("#intro-go")) this.finish();
    });
    // la Console dentro l'intro (mobile): scorciatoia opzionale alle domande
    const f = $("#intro-form", this.el);
    if (f) f.addEventListener("submit", e => { e.preventDefault(); const i = $("#intro-q", f); const q = i.value.trim(); i.blur(); if (q) this.console(q); });
  },
  // Chiude l'intro con le scelte fatte finora (o i valori di default) e apre la Console con la domanda
  console(q) {
    Prefs.set({ time: this.time, mood: this.mood });
    Modes.set("density", this.time || "10"); Modes.set("mood", this.mood || "auto");
    ConsoleWin.open(String(q || "").trim()); // la finestra sta sotto l'intro (z-index) e appare mentre l'intro sfuma
    this.finish();
  },
  step(n) {
    $$(".intro-step", this.el).forEach(s => s.classList.toggle("on", s.dataset.step === String(n)));
    this.el.dataset.step = String(n);
    const q = $("#intro-q", this.el); if (q && n === 2) q.placeholder = "Cosa cerchi? Terrò conto del tempo scelto";
  },
  configure() {
    Prefs.set({ time: this.time, mood: this.mood });
    Modes.set("density", this.time || "10"); Modes.set("mood", this.mood || "auto");
    const c = Ctx.local(); const w = Ctx.weather;
    const timeTxt = { "2": "ti mostro l'essenziale: cosa facciamo, quattro aree, qualche lavoro e come contattarci", "10": "ti mostro il sistema, le aree, i lavori, il metodo e il radar", all: "apro tutto: l'esperienza completa, con calma" }[this.time] || "";
    const moodTxt = { calm: "con un ritmo disteso", vivid: "con tutta l'energia accesa", nervous: "senza rumore, dritto al punto" }[this.mood] || "";
    $("#intro-msg").textContent = `Va bene: ${timeTxt}, ${moodTxt}.`;
    const log = $("#intro-log"); log.innerHTML = "";
    const lines = [`<b>Densità</b> ${this.time === "2" ? "essenziale" : this.time === "all" ? "completa" : "media"}`, `<b>Ritmo</b> ${this.mood === "nervous" ? "essenziale" : this.mood === "vivid" ? "vivace" : "calmo"}`, `<b>Contesto</b> ${c.day} ${c.slot} · ${c.device}${w && w.temp != null ? ` · Roma ${w.temp}° ${labelWeather(w.kind)}` : ""}`, `<b>Sistema</b> on air`];
    this.step(3);
    lines.forEach((l, i) => { const li = document.createElement("li"); li.innerHTML = l; li.style.animationDelay = (0.35 + i * 0.45) + "s"; log.appendChild(li); });
    clearTimeout(this.timer); this.timer = setTimeout(() => this.finish(), 4200);
  },
  finish(immediate) {
    if (this.done) return; this.done = true; clearTimeout(this.timer);
    try { sessionStorage.setItem("fw.intro", "1"); } catch {}
    if (this.el) { if (immediate) this.el.hidden = true; else { this.el.classList.add("out"); setTimeout(() => { this.el.hidden = true; }, 650); } }
    document.body.style.overflow = ""; window.scrollTo(0, 0);
    if (this.onDone) this.onDone();
  }
};

/* =========================================================
   BOOT
   ========================================================= */
Modes.apply();
Focus.load();
watchPaper();
renderContext();
initialTab();
renderApp();
watchPaper();
bindPrompt($("#prompt"));
Intro.start(() => { renderContext(); if (isMobile()) App.applyDensity(); animateDesktop(); });
if (window.OrganismLab) OrganismLab.mountAll(); // organismo interattivo (desktop: sezione Organismo)
Focus.apply();
Ctx.fetchWeather().then(() => { Modes.apply(); renderContext(); const st = $("#m-status"); const w = Ctx.weather; if (st && w && w.temp != null) st.textContent = `On Air · Roma ${w.temp}° ${labelWeather(w.kind)}`; });
let wasMobile = isMobile();
matchMedia("(max-width: 820px)").addEventListener("change", () => { const m = isMobile(); if (m !== wasMobile) { wasMobile = m; closeDetail(); renderContext(); renderApp(); if (!m && Console) { Console.resize(); Console.start(); } } });
// la densità cambia la composizione del feed
const _set = Modes.set.bind(Modes); Modes.set = (k, v) => { _set(k, v); if (k === "density" && isMobile()) App.applyDensity(); renderContext(); };
})();
