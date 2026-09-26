// Genera preview/index.html: versione statica del sito (contenuti dal seed) per l'artifact di anteprima.
const fs = require("fs"), path = require("path"), ejs = require("ejs");
const seed = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "content", "seed.json"), "utf8"));
const content = { site: seed.site, caps: seed.caps.filter(c => c.published), works: seed.works.filter(w => w.published), signals: seed.signals, features: { console: true, adapt: true } };
ejs.renderFile(path.join(__dirname, "..", "views", "index.ejs"), { content, preview: true, aiOn: false }, {}, (err, out) => {
  if (err) throw err;
  let h = out.replace(/^[\s\S]*?<head>/, "").replace(/<\/head>\s*<body>/, "").replace(/<\/body>\s*<\/html>\s*$/, "");
  h = h.replace(/<meta charset="utf-8">\s*<meta name="viewport"[^>]*>/, "");
  h = h.replace(/(src|href|content)="\/media\//g, '$1="media/');
  const dir = path.join(__dirname, "..", "preview"); fs.mkdirSync(path.join(dir, "media"), { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), h);
  fs.copyFileSync(path.join(__dirname, "..", "public", "css", "site.css"), path.join(dir, "site.css"));
  fs.copyFileSync(path.join(__dirname, "..", "public", "js", "site.js"), path.join(dir, "site.js"));
  for (const f of fs.readdirSync(path.join(__dirname, "..", "public", "media"))) fs.copyFileSync(path.join(__dirname, "..", "public", "media", f), path.join(dir, "media", f));
  console.log("preview scritto in", dir, Math.round(h.length / 1024) + "KB");
});
