// Genera preview/index.html: versione statica del sito (contenuti dal seed) per l'artifact di anteprima.
const fs = require("fs"), path = require("path"), ejs = require("ejs");
const seed = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "content", "seed.json"), "utf8"));
// nell'anteprima le aree usano i testi concreti di default (tecnologie, formati, casi d'uso), come fa il server al primo avvio
const content = require("../server/concrete").applyDefaults({ site: seed.site, caps: seed.caps.filter(c => c.published), works: seed.works.filter(w => w.published), signals: seed.signals, team: (seed.team || []).filter(m => m.published), features: { console: true, adapt: true } });
content.figures = require("../server/figures").DEFAULT; // i numeri del contesto
content.site = require("../server/site-fields").view(content.site); // i testi delle sezioni: quelli del seed, o quelli standard
content.layout = require("../server/layout").forSite(true); // fruizione: ordine e visibilità standard
// versioni chiare delle immagini d'ambiente (mood "Chiaro")
content.lightMedia = (() => { try { const out = {}; fs.readdirSync(path.join(__dirname, "..", "public", "media", "light")).filter(f => /\.(jpe?g|png|webp)$/i.test(f) && !/-sm\./.test(f)).forEach(f => { out["/media/" + f] = "/media/light/" + f; }); return out; } catch { return {}; } })();
ejs.renderFile(path.join(__dirname, "..", "views", "index.ejs"), { content, preview: true, aiOn: false }, {}, (err, out) => {
  if (err) throw err;
  let h = out.replace(/^[\s\S]*?<head>/, "").replace(/<\/head>\s*<body[^>]*>/, "").replace(/<\/body>\s*<\/html>\s*$/, "");
  h = h.replace(/<meta charset="utf-8">\s*<meta name="viewport"[^>]*>/, "");
  h = h.replace(/(src|href|content)="\/media\//g, '$1="media/');
  const dir = path.join(__dirname, "..", "preview"); fs.mkdirSync(path.join(dir, "media"), { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), h);
  fs.writeFileSync(path.join(dir, "site.css"), fs.readFileSync(path.join(__dirname, "..", "public", "css", "site.css"), "utf8").replace(/\/public\/fonts\//g, "fonts/"));
  fs.mkdirSync(path.join(dir, "fonts"), { recursive: true });
  for (const f of fs.readdirSync(path.join(__dirname, "..", "public", "fonts"))) fs.copyFileSync(path.join(__dirname, "..", "public", "fonts", f), path.join(dir, "fonts", f));
  fs.copyFileSync(path.join(__dirname, "..", "public", "js", "site.js"), path.join(dir, "site.js"));
  fs.copyFileSync(path.join(__dirname, "..", "public", "js", "diffusion.js"), path.join(dir, "diffusion.js"));
  fs.copyFileSync(path.join(__dirname, "..", "public", "js", "datafield.js"), path.join(dir, "datafield.js"));
  for (const f of fs.readdirSync(path.join(__dirname, "..", "public", "media"))) { const src = path.join(__dirname, "..", "public", "media", f); if (fs.statSync(src).isFile()) fs.copyFileSync(src, path.join(dir, "media", f)); }
  fs.mkdirSync(path.join(dir, "media", "light"), { recursive: true });
  try { for (const f of fs.readdirSync(path.join(__dirname, "..", "public", "media", "light"))) fs.copyFileSync(path.join(__dirname, "..", "public", "media", "light", f), path.join(dir, "media", "light", f)); } catch {}
  console.log("preview scritto in", dir, Math.round(h.length / 1024) + "KB");
});
