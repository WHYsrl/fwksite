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
  density: store.get("fw.density") || "10", mood: store.get("fw.mood") || "auto",
  apply() {
    html.dataset.density = this.density;
    const w = Ctx.weather; const c = Ctx.local();
    const kind = w ? w.kind : (c.hour < 7 || c.hour >= 21 ? "night" : "unknown");
    html.dataset.weather = kind;
    let energy = this.mood;
    if (energy === "auto") energy = (kind === "rain" || kind === "night" || kind === "snow" || c.slot === "notte") ? "calm" : (kind === "storm" || kind === "sun") ? "vivid" : "auto";
    html.dataset.energy = energy;
    $$(".seg [data-density]").forEach(b => b.classList.toggle("on", b.dataset.density === this.density));
    $$(".seg [data-mood]").forEach(b => b.classList.toggle("on", b.dataset.mood === this.mood));
    const env = $("#modes-env"); if (env) env.textContent = `Roma · ${c.day} ${c.slot} · ${w && w.temp != null ? w.temp + "° · " + labelWeather(w.kind) : "meteo non disponibile"} · ritmo ${energy === "calm" ? "calmo" : energy === "vivid" ? "vivace" : "neutro"}`;
    const sw = $("#status-weather"); if (sw) sw.textContent = w && w.temp != null ? `· ${w.temp}° ${labelWeather(w.kind)}` : "";
    if (window.ScrollTrigger) setTimeout(() => ScrollTrigger.refresh(), 50);
  },
  set(k, v) { this[k] = v; store.set("fw." + k, v); this.apply(); }
};
function labelWeather(k) { return { sun: "sereno", cloud: "nuvoloso", rain: "pioggia", storm: "temporale", snow: "neve", night: "notte", unknown: "" }[k] || ""; }
(function modesUI() {
  const btn = $("#modes-btn"), panel = $("#modes"); if (!btn || !panel) return;
  if (DATA.site.modes_enabled === false) { btn.hidden = true; return; }
  const open = (o) => { panel.hidden = !o; btn.setAttribute("aria-expanded", String(o)); };
  btn.addEventListener("click", () => open(panel.hidden));
  $("#modes-close").addEventListener("click", () => open(false));
  document.addEventListener("click", e => { if (!panel.hidden && !panel.contains(e.target) && !btn.contains(e.target)) open(false); });
  panel.addEventListener("click", e => { const d = e.target.closest("[data-density]"); if (d) Modes.set("density", d.dataset.density); const m = e.target.closest("[data-mood]"); if (m) Modes.set("mood", m.dataset.mood); });
})();

function renderContext() {
  const c = Ctx.local(); const w = Ctx.weather;
  const langName = c.lang.startsWith("it") ? "italiano" : c.lang.startsWith("en") ? "inglese" : c.lang.startsWith("fr") ? "francese" : c.lang.startsWith("de") ? "tedesco" : c.lang.startsWith("es") ? "spagnolo" : c.lang;
  const parts = [`Sono le <span class="v">${esc(c.time)}</span> di <span class="v">${esc(c.day)} ${c.slot}</span>${w && w.temp != null ? ` e a Roma ci sono <span class="v">${w.temp}°</span>, ${labelWeather(w.kind)}` : ""}.`,
    `Stai leggendo da un <span class="v">${esc(c.device)}</span> di <span class="v">${c.vw}×${c.vh}</span> pixel, in <span class="v">${esc(langName)}</span>, con le animazioni <span class="v">${c.reduced ? "ridotte" : "attive"}</span>, densità <span class="v">${Modes.density === "2" ? "essenziale" : Modes.density === "10" ? "media" : "completa"}</span>.`,
    c.mobile ? `Per questo vedi un feed verticale: su un desktop gli stessi contenuti diventano una console esplorabile.` : `Per questo vedi la Console: su un telefono gli stessi contenuti diventano un feed verticale.`,
    `Un sistema, tante esperienze: è il principio con cui progettiamo ogni organismo di contenuto.`];
  const kv = [["Ora locale", c.time], ["Giorno", `${c.day} · ${c.slot}`], ["Dispositivo", c.device], ["Schermo", `${c.vw} × ${c.vh}`], ["Lingua", langName], ["Movimento", c.reduced ? "ridotto" : "attivo"], ["Meteo Roma", w && w.temp != null ? `${w.temp}° · ${labelWeather(w.kind)}` : "n.d."], ["Ritmo", html.dataset.energy], ["Densità", Modes.density === "all" ? "tutto" : Modes.density + " min"]];
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
  async console(q) {
    if (!PREVIEW) { const r = await fetch("/api/ai/console", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q }) }); const j = await r.json(); if (!r.ok) throw new Error(j.error || "Errore"); return j; }
    const out = await this.sample.json(`${this.brand}\nRispondi SOLO con JSON: {"answer":"max 2 frasi","highlight":["id"],"open":"id|null","mode":{"density":"2|10|all|null","energy":"calm|vivid|null"}}\nINDICE:\n${this.index()}\n\nRICHIESTA: ${q}`, { modelTier: "quick" });
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
  if (isMobile()) { $("#sheet-body").innerHTML = h; $("#sheet-eyebrow").textContent = eyebrow; sheet.dataset.open = "true"; }
  else { $("#drawer-body").innerHTML = h; $("#drawer-eyebrow").textContent = eyebrow; drawer.dataset.open = "true"; drawer.querySelector(".drawer-body").scrollTop = 0; }
  scrim.dataset.open = "true";
  AI.check().then(ok => { if (!ok) $$(".adapt").forEach(a => a.hidden = true); });
}
function closeDetail() { drawer.dataset.open = "false"; sheet.dataset.open = "false"; scrim.dataset.open = "false"; }
scrim.addEventListener("click", closeDetail); $("#drawer-close").addEventListener("click", closeDetail); $("#sheet-close").addEventListener("click", closeDetail);
document.addEventListener("keydown", e => { if (e.key === "Escape") { closeDetail(); const p = $("#modes"); if (p && !p.hidden) p.hidden = true; } });
document.addEventListener("click", e => {
  const b = e.target.closest("[data-open]"); if (b) { openDetail(byId(b.dataset.open)); return; }
  const n = e.target.closest("[data-open-node]"); if (n) { openDetail(byId(n.dataset.openNode)); return; }
  const go = e.target.closest(".adapt .go"); if (go) runAdapt(go.closest(".adapt"));
  const c = e.target.closest("[data-copy]"); if (c) copyText(c);
  const cta = e.target.closest(".topnav .cta"); if (cta && isMobile()) { const card = $("#feed .kind-contact"); if (card) { e.preventDefault(); card.scrollIntoView({ behavior: reduced ? "auto" : "smooth" }); } }
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
  const input = $("input", form), out = $(".prompt-out", form);
  AI.check().then(ok => { if (!ok) form.hidden = true; });
  form.addEventListener("submit", async e => {
    e.preventDefault(); const q = input.value.trim(); if (!q) return;
    out.hidden = false; out.className = "prompt-out thinking"; out.innerHTML = `<span class="who">Console</span>sto leggendo il sistema…`;
    try {
      const r = await AI.console(q);
      out.className = "prompt-out"; out.innerHTML = `<span class="who">Console</span>${esc(r.answer || "")}`;
      if (r.highlight && r.highlight.length) { if (Console) Console.highlight(r.highlight); flashCards(r.highlight); }
      if (r.mode) { if (r.mode.density && ["2", "10", "all"].includes(String(r.mode.density))) Modes.set("density", String(r.mode.density)); if (r.mode.energy && ["calm", "vivid"].includes(r.mode.energy)) Modes.set("mood", r.mode.energy); }
      if (r.open) setTimeout(() => openDetail(byId(r.open)), 900);
    } catch (err) { out.className = "prompt-out"; out.innerHTML = `<span class="who">Console</span>${esc(err.message || "Non riesco a rispondere adesso.")}`; }
  });
}
function flashCards(ids) {
  ids.forEach(id => { const el = $(`.cap[data-open="${id}"], .work[data-open="${id}"], .card[data-id="${id}"]`); if (el && hasGsap && !reduced) gsap.fromTo(el, { boxShadow: "0 0 0 0 rgba(190,0,255,.9)" }, { boxShadow: "0 0 0 14px rgba(190,0,255,0)", duration: 1.4, ease: "power2.out" }); });
}

/* =========================================================
   CONSOLE — mappa a nodi su canvas (desktop)
   ========================================================= */
const Console = (() => {
  const cv = $("#graph"); if (!cv) return null;
  const ctx = cv.getContext("2d");
  const PURPLE = "#BE00FF", PAPER = "#EEEAF1";
  const SANS = '"Google Sans Flex","Helvetica Neue",Helvetica,Arial,sans-serif', MONO = '"Geist Mono",ui-monospace,Menlo,monospace';
  let W = 0, H = 0, nodes = [], edges = [], hover = null, drag = null, particles = [], raf = 0, running = false, last = 0, spawnAt = 0, hi = new Set(), hiUntil = 0, fontsReady = false;
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
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function label(p, nd, main, eyebrow, font, color, off) { const right = Math.cos(nd.ang) >= -0.15; const x = right ? p.x + off : p.x - off; ctx.textAlign = right ? "left" : "right"; ctx.textBaseline = "middle"; if (eyebrow) { ctx.font = `500 9px ${MONO}`; ctx.fillStyle = "rgba(139,129,151,1)"; ctx.letterSpacing = "1.2px"; ctx.fillText(eyebrow, x, p.y - 9); ctx.letterSpacing = "0px"; } ctx.font = font; ctx.fillStyle = color; ctx.fillText(main, x, eyebrow ? p.y + 5 : p.y); }
  function draw(t) {
    ctx.clearRect(0, 0, W, H); if (!nodes.length || !W) return;
    const P = {}; nodes.forEach(nd => P[nd.id] = pos(nd, t));
    const active = hover || null; const rel = related(active); const hiOn = hi.size && t < hiUntil; if (!hiOn && hi.size) hi.clear();
    edges.forEach(e => { const a = P[e.a.id], b = P[e.b.id]; const hot = (active && rel.has(e.a.id) && rel.has(e.b.id)) || (hiOn && (hi.has(e.a.id) || hi.has(e.b.id))); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.setLineDash(e.dash ? [2, 7] : []); ctx.lineWidth = hot ? 1.5 : 1; ctx.strokeStyle = hot ? "rgba(190,0,255,.9)" : `rgba(255,255,255,${active || hiOn ? e.alpha * .5 : e.alpha})`; ctx.stroke(); });
    ctx.setLineDash([]);
    if (!reduced) {
      if (t > spawnAt && particles.length < 9 * amp()) { const sEdges = edges.filter(e => e.signal); if (sEdges.length) { const e = sEdges[Math.floor(Math.random() * sEdges.length)]; const next = edges.find(x => x.b.id === e.b.id && x.a.kind === "core"); particles.push({ segs: [[e.a.id, e.b.id], next ? [e.b.id, next.a.id] : null].filter(Boolean), i: 0, p: 0, v: (0.00065 + Math.random() * 0.0004) * speed() }); } spawnAt = t + (700 + Math.random() * 900) / speed(); }
      const dt = last ? Math.min(50, t - last) : 16;
      particles = particles.filter(pt => { pt.p += pt.v * dt; if (pt.p >= 1) { pt.i++; pt.p = 0; if (pt.i >= pt.segs.length) return false; } const [ia, ib] = pt.segs[pt.i]; const a = P[ia], b = P[ib]; if (!a || !b) return false; const x = a.x + (b.x - a.x) * pt.p, y = a.y + (b.y - a.y) * pt.p; const q = Math.max(0, pt.p - 0.12); const tx = a.x + (b.x - a.x) * q, ty = a.y + (b.y - a.y) * q; const g = ctx.createLinearGradient(tx, ty, x, y); g.addColorStop(0, "rgba(238,234,241,0)"); g.addColorStop(1, "rgba(238,234,241,.9)"); ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke(); ctx.fillStyle = pt.i === 0 ? PAPER : PURPLE; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fill(); return true; });
    }
    nodes.forEach(nd => {
      const p = P[nd.id]; const isHover = active && active.id === nd.id; const isHi = hiOn && hi.has(nd.id); const inRel = (!active || rel.has(nd.id)) && (!hiOn || hi.has(nd.id) || nd.kind === "core"); const dim = inRel ? 1 : .3;
      ctx.save(); ctx.globalAlpha = dim;
      if (nd.kind === "core") { const r = nd.r; ctx.fillStyle = isHover ? PURPLE : "#fff"; roundRect(p.x - r, p.y - r, r * 2, r * 2, r * .18); ctx.fill(); ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.font = `500 10.5px ${MONO}`; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.letterSpacing = "1.5px"; ctx.fillText((DATA.site.claim || "").toUpperCase(), p.x, p.y + r + 12); ctx.letterSpacing = "0px"; }
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
  return { start, stop, resize, highlight(ids) { hi = new Set(ids); hiUntil = performance.now() + 6000; if (reduced) draw(performance.now()); } };
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
  ScrollTrigger.batch(".rv", { start: "top 88%", onEnter: b => gsap.fromTo(b, { y: 36, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: "power3.out", stagger: 0.09, overwrite: true }), once: true });
  // parallasse immagini
  $$("[data-parallax]").forEach(el => { const f = parseFloat(el.dataset.parallax) || 0.1; gsap.to(el, { yPercent: -f * 60, ease: "none", scrollTrigger: { trigger: el.closest("figure, .console-bg") || el, start: "top bottom", end: "bottom top", scrub: true } }); });
  // statement: scorre in orizzontale con lo scroll
  $$(".drift").forEach(el => { const d = parseFloat(el.dataset.drift) || 0.2; gsap.fromTo(el, { xPercent: d * 40 }, { xPercent: -d * 40, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } }); });
  // venn: cerchi che si disegnano
  $$("#venn .vc").forEach((c, i) => gsap.fromTo(c, { strokeDashoffset: 600 }, { strokeDashoffset: 0, duration: 1.8, ease: "power2.out", delay: i * 0.15, scrollTrigger: { trigger: "#venn", start: "top 80%" } }));
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
   FEED MOBILE — stessi contenuti, composizione diversa
   ========================================================= */
function composeFeed() {
  const c = Ctx.local(); const caps = [...DATA.caps], works = [...DATA.works], sigs = DATA.signals.slice(0, 6);
  const seq = [{ kind: "manifesto" }, { kind: "prompt" }];
  const signalsFirst = c.slot === "mattina" || c.slot === "notte";
  let k = 0;
  while (caps.length || works.length || sigs.length) {
    if (caps.length) seq.push({ kind: "cap", item: caps.shift() });
    const a = signalsFirst ? sigs : works, b = signalsFirst ? works : sigs;
    if (a.length) seq.push({ kind: a === sigs ? "signal" : "work", item: a.shift() });
    if (b.length) seq.push({ kind: b === sigs ? "signal" : "work", item: b.shift() });
    if (k === 0) seq.push({ kind: "statement", i: 0, purple: true }); if (k === 1) seq.push({ kind: "organism" }); if (k === 2) seq.push({ kind: "method" });
    k++;
  }
  seq.push({ kind: "statement", i: 2 }, { kind: "context" }, { kind: "contact" });
  const tier = { manifesto: 2, prompt: 2, cap: 2, work: 2, contact: 2, signal: 10, statement: 10, organism: 10, method: 10, context: "all" };
  return { seq: seq.filter(s => { const t = tier[s.kind]; return Modes.density === "all" || (Modes.density === "10" && t !== "all") || (Modes.density === "2" && t === 2); }), c, signalsFirst };
}
function renderFeed() {
  const feed = $("#feed"); if (!feed) return;
  const { seq, c, signalsFirst } = composeFeed(); const site = DATA.site;
  const card = (kind, id, img, inner, extra = "") => `<section class="card kind-${kind} ${extra}" ${id ? `data-id="${id}"` : ""}><div class="bg">${img ? `<img src="${media(img)}" alt="" loading="lazy">` : ""}</div><div class="fg">${inner}</div></section>`;
  const ey = (l, r) => `<div class="eyebrow"><span><span class="dot"></span>${l}</span><span>${r || ""}</span></div>`;
  let i = 0;
  feed.innerHTML = seq.map(it => {
    i++; const idx = `${String(i).padStart(2, "0")}/${String(seq.length).padStart(2, "0")}`; const x = it.item;
    switch (it.kind) {
      case "manifesto": return card("manifesto", null, site.hero_image_mobile || site.hero_image, `${ey(esc(site.claim), idx)}<h2>${em(site.hero_title)}</h2><p class="body">${esc(site.tagline)}</p><button class="more" type="button" data-open="core">Il sistema</button>`);
      case "prompt": return card("prompt", null, null, `${ey("Console", idx)}<h2>Chiedi alla <span class="serif">Console.</span></h2><p class="body">Scrivi cosa cerchi: la pagina si riconfigura e ti porta ai contenuti giusti.</p><form class="prompt" id="prompt-m" autocomplete="off"><div class="prompt-row"><input name="q" type="text" maxlength="200" placeholder="es. cosa fate per il retail?"><button type="submit" aria-label="Invia">→</button></div><div class="prompt-out" hidden></div></form>`);
      case "cap": return card("cap", x.id, x.image, `${ey("Area", idx)}<h2>${esc(x.name)}</h2><p class="body">${esc(x.short)}</p><button class="more" type="button" data-open="${x.id}">Approfondisci</button>`);
      case "work": return card("work", x.id, x.image, `${ey(esc(x.client), idx)}<h2>${esc(x.title)}</h2><p class="body">${esc(x.short)}</p><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button class="more" type="button" data-open="${x.id}">Il progetto</button><span class="chip ghost">${esc(x.status)}</span></div>`);
      case "signal": return card("signal", x.id, null, `${ey("Radar · fonte esterna", idx)}<div class="src"><span class="chip ext">Fonte esterna</span> <b>${esc(x.src)}</b> · ${esc(fmtDate(x.date))}</div><h2>“${esc(x.title)}”</h2><p class="why"><small>La nostra lettura</small>${esc(x.why)}</p><a class="more" href="${esc(x.url)}" target="_blank" rel="noopener nofollow">Leggi la fonte</a>`);
      case "statement": return card("statement", null, it.purple ? null : "/media/torus.jpg", `<h2>${esc((site.statements || [])[it.i] || "")}</h2>`, it.purple ? "purple" : "");
      case "organism": return card("organism", null, "/media/organism-tall.jpg", `${ey("Adaptive Content Systems", idx)}<h2>${em(site.organism_title)}</h2><p class="body">${esc(site.organism_text)}</p>`);
      case "method": return card("method", null, "/media/particles.jpg", `${ey("Metodo", idx)}<h2>Cinque fasi, un <span class="serif">ciclo.</span></h2><p class="body">${(site.method || []).map(m => `<b style="color:var(--ink);font-weight:500">${esc(m.k)}</b>`).join(" · ")}<br><br>${esc(site.method_intro)}</p>`);
      case "context": { const ctx = renderContext(); return card("context", null, null, `${ey("Narrowcasting", idx)}<h2>Questa pagina si è composta <span class="serif">per te.</span></h2><p class="body">${ctx.text}</p><div class="kv">${ctx.kvHTML}</div>`); }
      case "contact": return card("contact", null, "/media/roma.jpg", `${ey("Contatti", idx)}<h2>${em(site.contact_title)}</h2><code>${esc(site.contact_email)}</code><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button class="copy" type="button" data-copy="${esc(site.contact_email)}">Copia</button></div><p class="body" style="font-size:14px;color:var(--ink-3)">${esc(site.contact_address).replace(/\n/g, "<br>")}<br>${esc(site.footer_note)}</p>`);
    }
    return "";
  }).join("");
  bindPrompt($("#prompt-m"));
  AI.check().then(ok => { if (!ok) { const pc = $("#feed .kind-prompt"); if (pc) { pc.remove(); initRail(); } } });
  function initRail() {
    const rail = $("#rail"); const cards = $$("#feed .card"); rail.innerHTML = cards.map(() => "<i></i>").join(""); const dots = $$("i", rail);
    const io = new IntersectionObserver(en => en.forEach(x => { const k = cards.indexOf(x.target); if (x.isIntersecting && k > -1) dots.forEach((d, j) => { d.classList.toggle("on", j === k); d.classList.toggle("seen", j < k); }); }), { threshold: 0.55 });
    cards.forEach(cd => io.observe(cd));
    cards.forEach((cd, i) => { const n = $(".eyebrow > span:last-child", cd); if (n && /\d+\/\d+/.test(n.textContent)) n.textContent = `${String(i + 1).padStart(2, "0")}/${String(cards.length).padStart(2, "0")}`; });
    $("#compose").textContent = `Composto alle ${c.time} · ${c.day} ${c.slot} · ${c.device} · ${cards.length} schede · ${signalsFirst ? "radar prima dei lavori" : "lavori prima del radar"}`;
    watchPaper();
  }
  initRail();
  // parallasse leggera dentro le schede
  if (!reduced) { const imgs = $$("#feed .bg img"); const onScroll = () => { const vh = innerHeight; imgs.forEach(im => { const r = im.parentElement.getBoundingClientRect(); if (r.bottom < 0 || r.top > vh) return; const p = (r.top + r.height / 2 - vh / 2) / vh; im.style.transform = `translateY(${p * -28}px)`; }); }; addEventListener("scroll", onScroll, { passive: true }); onScroll(); }
}

/* la barra in alto si inverte quando sotto c'è la "carta" del Radar */
let paperEls = [], paperTick = false;
function checkPaper() { paperTick = false; const y = 40; const on = paperEls.some(el => { if (!el.offsetParent) return false; const r = el.getBoundingClientRect(); return r.top <= y && r.bottom >= y; }); document.body.classList.toggle("on-paper", on); }
function watchPaper() { paperEls = $$(".paper, .card.kind-signal"); checkPaper(); }
addEventListener("scroll", () => { if (!paperTick) { paperTick = true; requestAnimationFrame(checkPaper); } }, { passive: true });
addEventListener("resize", () => requestAnimationFrame(checkPaper));

/* =========================================================
   BOOT
   ========================================================= */
Modes.apply();
watchPaper();
renderContext();
renderFeed();
bindPrompt($("#prompt"));
animateDesktop();
Ctx.fetchWeather().then(() => { Modes.apply(); renderContext(); });
let wasMobile = isMobile();
matchMedia("(max-width: 820px)").addEventListener("change", () => { const m = isMobile(); if (m !== wasMobile) { wasMobile = m; closeDetail(); renderContext(); renderFeed(); if (!m && Console) { Console.resize(); Console.start(); } } });
// la densità cambia la composizione del feed
const _set = Modes.set.bind(Modes); Modes.set = (k, v) => { _set(k, v); if (k === "density" && isMobile()) renderFeed(); renderContext(); };
})();
