// Logo dal sito del visitatore: legge la home page, sceglie l'immagine più probabile (img "logo",
// apple-touch-icon, icona, og:image) e la restituisce come data URL, così il canvas può leggerne i pixel.
const dns = require("dns").promises;
const net = require("net");

const cache = new Map();
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36 FrameworksBrandBot/1.0";

function isPrivate(ip) {
  if (net.isIPv6(ip)) return /^(::1|fc|fd|fe80)/i.test(ip) || ip.startsWith("::ffff:") && isPrivate(ip.replace("::ffff:", ""));
  const p = ip.split(".").map(Number);
  return p[0] === 10 || p[0] === 127 || p[0] === 0 || (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168);
}
async function safeUrl(raw) {
  let u; try { u = new URL(/^https?:\/\//i.test(raw) ? raw : "https://" + raw); } catch { throw new Error("Indirizzo non valido"); }
  if (!/^https?:$/.test(u.protocol)) throw new Error("Solo http/https");
  if (!u.hostname.includes(".") || u.hostname === "localhost") throw new Error("Indirizzo non valido");
  const addrs = await dns.lookup(u.hostname, { all: true }).catch(() => { throw new Error("Sito non raggiungibile"); });
  if (!addrs.length || addrs.some(a => isPrivate(a.address))) throw new Error("Indirizzo non consentito");
  return u;
}
async function get(u, { maxBytes, accept, timeout = 8000 }) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(u, { headers: { "user-agent": UA, accept }, redirect: "follow", signal: ctl.signal });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const len = +r.headers.get("content-length") || 0; if (len > maxBytes) throw new Error("File troppo grande");
    const buf = Buffer.from(await r.arrayBuffer()); if (buf.length > maxBytes) throw new Error("File troppo grande");
    return { buf, type: (r.headers.get("content-type") || "").split(";")[0].trim(), url: r.url };
  } finally { clearTimeout(t); }
}
const attr = (tag, name) => { const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i")); return m ? (m[2] ?? m[3] ?? m[4] ?? "") : ""; };

function candidates(html, base) {
  const out = []; const push = (url, score, why) => { try { const abs = new URL(url, base).href; if (/^https?:/.test(abs)) out.push({ url: abs, score, why }); } catch {} };
  const tags = html.match(/<(img|link|meta)\b[^>]*>/gi) || [];
  for (const t of tags) {
    const tag = t.slice(1, 5).toLowerCase();
    if (tag === "img ") {
      const src = attr(t, "src") || attr(t, "data-src"); if (!src || src.startsWith("data:")) continue;
      const hay = (src + " " + attr(t, "alt") + " " + attr(t, "class") + " " + attr(t, "id")).toLowerCase();
      if (hay.includes("logo")) push(src, /\.svg/i.test(src) ? 100 : 90, "img logo");
    } else if (tag === "link") {
      const rel = attr(t, "rel").toLowerCase(), href = attr(t, "href"); if (!href) continue;
      if (rel.includes("apple-touch-icon")) push(href, 70, "apple-touch-icon");
      else if (rel.includes("icon")) { const sizes = attr(t, "sizes"); const big = /svg/i.test(href) || /(\d+)x/.test(sizes) && +RegExp.$1 >= 96; push(href, big ? 65 : 40, "icon"); }
    } else if (tag === "meta") {
      const prop = (attr(t, "property") || attr(t, "name")).toLowerCase(); const c = attr(t, "content");
      if (prop === "og:logo") push(c, 95, "og:logo"); else if (prop === "og:image") push(c, 50, "og:image");
    }
  }
  // JSON-LD Organization.logo
  const ld = html.match(/"logo"\s*:\s*"(https?:[^"]+)"/i); if (ld) push(ld[1], 92, "json-ld");
  return out.sort((a, b) => b.score - a.score);
}
function siteName(html, host) {
  const og = html.match(/property=["']og:site_name["'][^>]*content=["']([^"']+)/i) || html.match(/content=["']([^"']+)["'][^>]*property=["']og:site_name/i);
  if (og) return og[1].trim().slice(0, 40);
  const t = html.match(/<title[^>]*>([^<]{1,80})/i); if (t) return t[1].split(/[|–—-]/)[0].trim().slice(0, 40);
  return host.replace(/^www\./, "");
}

async function brandFromSite(raw) {
  const u = await safeUrl(raw); const key = u.origin + u.pathname;
  const hit = cache.get(key); if (hit && Date.now() - hit.at < 6 * 3600000) return hit.val;
  const page = await get(u, { maxBytes: 1.5e6, accept: "text/html,*/*;q=0.5" });
  const html = page.buf.toString("utf8"); const list = candidates(html, page.url);
  if (!list.length) throw new Error("Nessun logo trovato nella pagina");
  let last = null;
  for (const c of list.slice(0, 5)) {
    try {
      await safeUrl(c.url);
      const img = await get(c.url, { maxBytes: 3e6, accept: "image/*" });
      if (!/^image\//.test(img.type)) continue;
      const val = { name: siteName(html, u.hostname), image: `data:${img.type};base64,${img.buf.toString("base64")}`, source: c.url, why: c.why };
      cache.set(key, { at: Date.now(), val }); if (cache.size > 300) cache.delete(cache.keys().next().value);
      return val;
    } catch (e) { last = e; }
  }
  throw new Error("Logo non scaricabile" + (last ? ": " + last.message : ""));
}
module.exports = { brandFromSite };
