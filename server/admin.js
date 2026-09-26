// Backoffice: /admin — login, contenuti, radar, fonti, AI, media, export/import.
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const multer = require("multer");
const store = require("./db");
const ai = require("./ai");
const feeds = require("./feeds");

const router = express.Router();
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "frameworks";

const upload = multer({
  storage: multer.diskStorage({
    destination: store.UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, Date.now().toString(36) + "-" + file.originalname.toLowerCase().replace(/[^a-z0-9.]+/g, "-"))
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^(image\/(jpeg|png|webp|gif|avif)|video\/mp4|video\/webm|application\/json)$/.test(file.mimetype))
});

function safeEq(a, b) { const A = Buffer.from(String(a)), B = Buffer.from(String(b)); return A.length === B.length && crypto.timingSafeEqual(A, B); }
function requireAdmin(req, res, next) { if (req.session && req.session.admin) return next(); res.redirect("/admin/login?next=" + encodeURIComponent(req.originalUrl)); }
const flash = (req, msg, kind = "ok") => { req.session.flash = { msg, kind }; };
router.use((req, res, next) => { res.locals.flash = req.session.flash || null; req.session.flash = null; res.locals.path = req.path; res.locals.aiOn = ai.isConfigured(); next(); });

// ---------- login ----------
router.get("/login", (req, res) => res.render("admin/login", { next: req.query.next || "/admin", error: null }));
router.post("/login", (req, res) => {
  const { user, password } = req.body;
  if (safeEq(user, ADMIN_USER) && safeEq(password, ADMIN_PASSWORD)) { req.session.admin = true; return res.redirect(req.body.next && req.body.next.startsWith("/admin") ? req.body.next : "/admin"); }
  res.status(401).render("admin/login", { next: req.body.next || "/admin", error: "Credenziali non valide" });
});
router.post("/logout", (req, res) => { req.session = null; res.redirect("/admin/login"); });
router.use(requireAdmin);

// ---------- dashboard ----------
router.get("/", (req, res) => {
  res.render("admin/dashboard", { counts: { caps: store.listCaps(true).length, works: store.listWorks(true).length, team: store.listTeam(true).length, signals: store.countSignals(), sources: store.listSources().length }, radar: feeds.lastRun(), ai: ai.config(), aiStats: store.aiStats(), aiToday: store.aiCallsToday() });
});

// ---------- testi ----------
const lines = (s) => String(s || "").split(/\r?\n/).map(x => x.trim()).filter(Boolean);
const arr = (v) => Array.isArray(v) ? v : (v && typeof v === "object" ? Object.values(v) : []);
router.get("/testi", (req, res) => res.render("admin/testi", { site: store.getSetting("site", {}) }));
router.post("/testi", (req, res) => {
  const b = req.body; const site = store.getSetting("site", {});
  const s = { ...site,
    brand: b.brand, claim: b.claim, tagline: b.tagline, hero_title: b.hero_title, hero_text: b.hero_text, hero_cta: b.hero_cta, hero_image: b.hero_image, hero_image_mobile: b.hero_image_mobile,
    context_text: b.context_text, organism_title: b.organism_title, organism_text: b.organism_text, tech_title: b.tech_title, method_intro: b.method_intro, team_title: b.team_title, team_text: b.team_text,
    contact_title: b.contact_title, contact_email: b.contact_email, contact_address: b.contact_address, footer_note: b.footer_note, radar_title: b.radar_title, radar_text: b.radar_text,
    statements: lines(b.statements), closing: lines(b.closing),
    triad: arr(b.triad).filter(t => t.la || t.it).map(t => ({ la: t.la, it: t.it, text: t.text })),
    tech: arr(b.tech).filter(t => t.k).map(t => ({ k: t.k, text: t.text })),
    method: arr(b.method).filter(t => t.k).map(t => ({ k: t.k, text: t.text })),
    modes_enabled: !!b.modes_enabled };
  store.setSetting("site", s); flash(req, "Testi salvati"); res.redirect("/admin/testi");
});

// ---------- capacità ----------
router.get("/capacita", (req, res) => res.render("admin/caps", { caps: store.listCaps(true) }));
router.get("/capacita/new", (req, res) => res.render("admin/cap-form", { cap: { id: "", sort: store.listCaps(true).length + 1, name: "", accent: "", short: "", body: "", tags: [], image: "", published: true }, media: store.listMedia(), isNew: true }));
router.get("/capacita/:id", (req, res) => { const cap = store.getCap(req.params.id); if (!cap) return res.redirect("/admin/capacita"); res.render("admin/cap-form", { cap, media: store.listMedia(), isNew: false }); });
router.post("/capacita/:id", upload.single("image_file"), (req, res) => {
  const b = req.body; const image = req.file ? registerUpload(req.file) : b.image;
  const id = store.upsertCap({ id: req.params.id === "new" ? (b.id || undefined) : req.params.id, sort: b.sort, name: b.name, accent: b.accent, short: b.short, body: b.body, tags: b.tags, image, published: !!b.published });
  flash(req, "Capacità salvata"); res.redirect("/admin/capacita/" + id);
});
router.post("/capacita/:id/delete", (req, res) => { store.deleteCap(req.params.id); flash(req, "Capacità eliminata"); res.redirect("/admin/capacita"); });

// ---------- lavori ----------
router.get("/lavori", (req, res) => res.render("admin/works", { works: store.listWorks(true), caps: store.listCaps(true) }));
router.get("/lavori/new", (req, res) => res.render("admin/work-form", { work: { id: "", sort: store.listWorks(true).length + 1, client: "", label: "", title: "", year: String(new Date().getFullYear()), caps: [], short: "", body: "", image: "", video_url: "", status: "placeholder", published: true }, caps: store.listCaps(true), media: store.listMedia(), isNew: true }));
router.get("/lavori/:id", (req, res) => { const work = store.getWork(req.params.id); if (!work) return res.redirect("/admin/lavori"); res.render("admin/work-form", { work, caps: store.listCaps(true), media: store.listMedia(), isNew: false }); });
router.post("/lavori/:id", upload.single("image_file"), (req, res) => {
  const b = req.body; const image = req.file ? registerUpload(req.file) : b.image;
  const id = store.upsertWork({ id: req.params.id === "new" ? (b.id || undefined) : req.params.id, sort: b.sort, client: b.client, label: b.label, title: b.title, year: b.year, caps: [].concat(b.caps || []), short: b.short, body: b.body, image, video_url: b.video_url, status: b.status, published: !!b.published });
  flash(req, "Lavoro salvato"); res.redirect("/admin/lavori/" + id);
});
router.post("/lavori/:id/delete", (req, res) => { store.deleteWork(req.params.id); flash(req, "Lavoro eliminato"); res.redirect("/admin/lavori"); });

// ---------- team ----------
const UNITS = ["Direzione e supervisione", "Produzione", "Design, 3D & Motion", "AI & Interactive"];
router.get("/team", (req, res) => res.render("admin/team", { team: store.listTeam(true) }));
router.get("/team/new", (req, res) => res.render("admin/team-form", { m: { id: "", sort: store.listTeam(true).length + 1, name: "", role: "", unit: UNITS[0], bio: "", photo: "", is_key: false, published: true }, units: UNITS, media: store.listMedia(), isNew: true }));
router.get("/team/:id", (req, res) => { const m = store.getMember(req.params.id); if (!m) return res.redirect("/admin/team"); res.render("admin/team-form", { m, units: UNITS, media: store.listMedia(), isNew: false }); });
router.post("/team/:id", upload.single("photo_file"), (req, res) => {
  const b = req.body; const photo = req.file ? registerUpload(req.file) : b.photo;
  const id = store.upsertMember({ id: req.params.id === "new" ? (b.id || undefined) : req.params.id, sort: b.sort, name: b.name, role: b.role, unit: b.unit_custom || b.unit, bio: b.bio, photo, is_key: !!b.is_key, published: !!b.published });
  flash(req, "Persona salvata"); res.redirect("/admin/team/" + id);
});
router.post("/team/:id/delete", (req, res) => { store.deleteMember(req.params.id); flash(req, "Persona eliminata"); res.redirect("/admin/team"); });

// ---------- radar ----------
router.get("/radar", (req, res) => res.render("admin/radar", { pending: store.listSignals("pending", 200), published: store.listSignals("published", 200), rejected: store.listSignals("rejected", 50), caps: store.listCaps(true), radar: store.getSetting("radar", {}), last: feeds.lastRun(), counts: store.countSignals() }));
router.post("/radar/run", async (req, res) => { try { const r = await feeds.runRadar(); flash(req, r.skipped ? "Radar già in esecuzione" : `Radar: ${r.stats.added} nuove notizie in coda (${r.stats.fetched} lette, ${r.stats.filtered} filtrate, ${r.stats.duplicates} già presenti${r.stats.errors.length ? ", errori: " + r.stats.errors.length : ""})`); } catch (e) { flash(req, "Errore radar: " + e.message, "err"); } res.redirect("/admin/radar"); });
router.post("/radar/new", (req, res) => { const b = req.body; try { store.upsertSignal({ src: b.src, url: b.url, title: b.title, summary: b.summary, date: b.date, caps: [].concat(b.caps || []), why: b.why, status: "published" }); flash(req, "Segnale aggiunto"); } catch (e) { flash(req, "Non aggiunto: " + (e.code === "SQLITE_CONSTRAINT_UNIQUE" ? "URL già presente" : e.message), "err"); } res.redirect("/admin/radar"); });
router.post("/radar/:id", (req, res) => {
  const s = store.getSignal(req.params.id); if (!s) return res.redirect("/admin/radar");
  const b = req.body; const action = b.action || "save";
  const status = action === "approve" ? "published" : action === "reject" ? "rejected" : action === "unpublish" ? "pending" : s.status;
  if (action === "delete") { store.deleteSignal(s.id); flash(req, "Segnale eliminato"); return res.redirect("/admin/radar"); }
  store.upsertSignal({ ...s, src: b.src ?? s.src, title: b.title ?? s.title, summary: b.summary ?? s.summary, date: b.date ?? s.date, why: b.why ?? s.why, caps: b.caps != null ? [].concat(b.caps) : s.caps, status });
  flash(req, action === "approve" ? "Pubblicato" : action === "reject" ? "Scartato" : "Salvato"); res.redirect("/admin/radar" + (b.back || ""));
});
router.post("/radar-filtri", (req, res) => {
  const b = req.body; const radar = store.getSetting("radar", {});
  store.setSetting("radar", { ...radar, include: lines(b.include.replace(/,/g, "\n")), exclude: lines(b.exclude.replace(/,/g, "\n")), max_age_days: +b.max_age_days || 21, max_per_run: +b.max_per_run || 30, auto_publish: !!b.auto_publish, ai_classify: !!b.ai_classify, interval_hours: +b.interval_hours || 6 });
  flash(req, "Filtri salvati (l'intervallo si applica al prossimo riavvio)"); res.redirect("/admin/fonti");
});

// ---------- fonti ----------
router.get("/fonti", (req, res) => res.render("admin/sources", { sources: store.listSources(), radar: store.getSetting("radar", {}) }));
router.post("/fonti", (req, res) => { const b = req.body; if (b.name && b.url) store.upsertSource({ id: b.id || undefined, name: b.name, url: b.url, enabled: b.enabled !== "0", weight: b.weight }); flash(req, "Fonte salvata"); res.redirect("/admin/fonti"); });
router.post("/fonti/:id/toggle", (req, res) => { const s = store.getSource(req.params.id); if (s) store.upsertSource({ ...s, enabled: !s.enabled }); res.redirect("/admin/fonti"); });
router.post("/fonti/:id/delete", (req, res) => { store.deleteSource(req.params.id); flash(req, "Fonte eliminata"); res.redirect("/admin/fonti"); });

// ---------- AI ----------
router.get("/ai", (req, res) => res.render("admin/ai", { ai: store.getSetting("ai", {}), cfg: ai.config(), env: { anthropic: !!process.env.ANTHROPIC_API_KEY, openai: !!process.env.OPENAI_API_KEY }, stats: store.aiStats(), today: store.aiCallsToday(), test: null }));
router.post("/ai", async (req, res) => {
  const b = req.body; const cur = store.getSetting("ai", {});
  const next = { ...cur, provider: b.provider, anthropic_model: b.anthropic_model, openai_model: b.openai_model, console_enabled: !!b.console_enabled, adapt_enabled: !!b.adapt_enabled, radar_enabled: !!b.radar_enabled, daily_call_limit: +b.daily_call_limit || 400 };
  if (b.anthropic_key && !b.anthropic_key.includes("•")) next.anthropic_key = b.anthropic_key.trim();
  if (b.openai_key && !b.openai_key.includes("•")) next.openai_key = b.openai_key.trim();
  if (b.clear_keys) { next.anthropic_key = ""; next.openai_key = ""; }
  store.setSetting("ai", next);
  if (b.action === "test") {
    try { const out = await ai.complete({ system: "Rispondi in italiano con una sola frase.", user: "Di' che la connessione con Frameworks funziona.", maxTokens: 60, kind: "test" }); flash(req, "Test riuscito: " + out); }
    catch (e) { flash(req, "Test fallito: " + e.message, "err"); }
  } else flash(req, "Impostazioni AI salvate");
  res.redirect("/admin/ai");
});

// ---------- media ----------
function registerUpload(file) {
  const id = path.basename(file.filename, path.extname(file.filename));
  store.addMedia({ id, filename: file.originalname, path: "/media/" + file.filename, mime: file.mimetype, size: file.size });
  return "/media/" + file.filename;
}
router.get("/media", (req, res) => res.render("admin/media", { media: store.listMedia() }));
router.post("/media/upload", upload.array("files", 20), (req, res) => { (req.files || []).forEach(registerUpload); flash(req, `${(req.files || []).length} file caricati`); res.redirect("/admin/media"); });
router.post("/media/:id/delete", (req, res) => { const m = store.getMedia(req.params.id); if (m) { try { fs.unlinkSync(path.join(store.UPLOAD_DIR, path.basename(m.path))); } catch {} store.deleteMedia(m.id); } flash(req, "File eliminato"); res.redirect("/admin/media"); });

// ---------- export / import ----------
router.get("/export.json", (req, res) => { res.setHeader("content-disposition", `attachment; filename="frameworks-contenuti-${new Date().toISOString().slice(0, 10)}.json"`); res.json(store.exportAll()); });
router.post("/import", upload.single("file"), (req, res) => {
  try { const data = JSON.parse(fs.readFileSync(req.file.path, "utf8")); store.importAll(data); flash(req, "Contenuti importati"); } catch (e) { flash(req, "Import fallito: " + e.message, "err"); }
  try { fs.unlinkSync(req.file.path); } catch {}
  res.redirect("/admin");
});

module.exports = router;
