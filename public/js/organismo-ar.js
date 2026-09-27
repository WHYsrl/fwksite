/* =========================================================
   L'ORGANISMO NELLA STANZA — realtà aumentata dal telefono.
   Motore: binario 8th Wall (world tracking) + three.js. Stessi dati e stesse regole di posizione
   dell'organismo 2D (settore = angolo, età = raggio), più una profondità dal hash del segnale: la
   colonia diventa volumetrica e galleggia a un metro e mezzo dal telefono. Stessa stanza SSE del desktop:
   un tocco lascia uno stimolo su tutti gli schermi, un nodo toccato apre la sua notizia anche di là,
   e lo sguardo del telefono (dove punta la camera) inclina l'organismo sul desktop.
   ========================================================= */
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.166.1/build/three.module.js";
window.THREE = THREE; // il motore 8th Wall lo cerca come globale

const ORG = window.__ORG__ || {}; const room = ORG.room || "";
const TAU = Math.PI * 2;
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const unit = (h, k) => (((h >>> (k * 8)) & 255) / 255);
const esc = (s) => String(s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const SECTOR = { "content-system": 0, "activation-system": 1, "spatial-experiences": 2, "adaptive-media": 3 };
const SECTOR_NAME = ["Content System", "Activation System", "Spatial Experiences", "Adaptive Media"];
const SECTOR_ANGLE = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
const MOOD = { vivid: { name: "acceso", rgb: [191, 0, 255] }, calm: { name: "notturno", rgb: [138, 124, 255] }, nervous: { name: "quieto", rgb: [95, 191, 165] }, light: { name: "chiaro", rgb: [214, 150, 255] } };
const WEATHER = { sun: 1.05, cloud: .8, rain: .55, storm: 1.35, snow: .45, night: .5, unknown: .8 };
const MAX_NODES = 80, MAX_STIM = 40, R = .62; // raggio in metri (diametro ~1,2 m)
const fmtDate = (iso) => { try { return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" }).format(new Date(iso)); } catch { return ""; } };

// ---------- didascalie (versione breve di quelle della pagina 2D) ----------
const Say = (() => {
  const box = $("vo-say"); const q = []; const shown = new Set(); let showing = false, timer = 0;
  const render = () => { if (!box || showing || !q.length) return; const m = q.shift(); showing = true; box.innerHTML = `<span class="eyebrow"><span class="dot"></span>${m.k}</span>${m.t}<i class="say-bar" style="animation-duration:${m.ms}ms"></i>`; box.classList.add("on"); timer = setTimeout(hide, m.ms); };
  const hide = () => { if (!box) return; box.classList.remove("on"); clearTimeout(timer); setTimeout(() => { showing = false; render(); }, 650); };
  if (box) box.addEventListener("click", hide);
  const push = (k, t, o = {}) => { if (!box) return; if (o.key && q.some(m => m.key === o.key)) return; const m = { k, t, ms: o.ms || 7000, key: o.key }; if (o.front) q.unshift(m); else q.push(m); if (q.length > 3) q.length = 3; render(); };
  return { push, once(key, k, t, o) { if (shown.has(key)) return; shown.add(key); push(k, t, { ...(o || {}), key }); } };
})();

// ---------- texture del punto luminoso ----------
function glowTexture(size = 128, ring = false) {
  const c = document.createElement("canvas"); c.width = c.height = size; const x = c.getContext("2d");
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(.16, "rgba(255,255,255,.95)"); g.addColorStop(.4, "rgba(255,255,255,.2)"); g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  if (ring) { x.strokeStyle = "rgba(255,255,255,.9)"; x.lineWidth = size * .035; x.beginPath(); x.arc(size / 2, size / 2, size * .3, 0, Math.PI * 2); x.stroke(); } // il bordo: un anello netto intorno al nucleo
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ================= l'organismo in tre dimensioni =================
class Organismo3D {
  constructor() {
    this.group = new THREE.Group(); this.nodes = new Map(); this.list = []; this.pulses = []; this.t = 0; this.phase = 0; this.heart = 0;
    this.signals = []; this.stimoli = []; this.umori = []; this.energy = .8; this.color = new THREE.Color(0xbf00ff); this.assimilated = 0; this.yaw = 0; this.yawV = 0;
    this.tex = glowTexture(); this.texRing = glowTexture(128, true);
    this.linkGeo = new THREE.BufferGeometry(); this.linkMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .55, depthWrite: false });
    this.links = new THREE.LineSegments(this.linkGeo, this.linkMat); this.group.add(this.links);
    // il cuore: il cubo del logo, con la sua aura
    this.core = new THREE.Mesh(new THREE.BoxGeometry(.09, .09, .09), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .95 }));
    this.coreEdges = new THREE.LineSegments(new THREE.EdgesGeometry(this.core.geometry), new THREE.LineBasicMaterial({ color: this.color, transparent: true, opacity: .95 })); this.core.add(this.coreEdges);
    // la membrana: una sfera wireframe nel colore del temperamento, che dà corpo e bordo alla colonia
    this.membrane = new THREE.Mesh(new THREE.IcosahedronGeometry(R * 1.04, 2), new THREE.MeshBasicMaterial({ color: this.color, wireframe: true, transparent: true, opacity: .13, depthWrite: false }));
    this.membrane.scale.set(1, .85, 1); this.group.add(this.membrane);
    this.aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, color: this.color, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false })); this.aura.scale.setScalar(.9);
    this.group.add(this.core, this.aura);
    this.pulseMat = new THREE.SpriteMaterial({ map: this.tex, color: 0xffffff, transparent: true, opacity: .95, blending: THREE.AdditiveBlending, depthWrite: false });
    this.pulsePool = [];
  }
  home(n) { const rr = n.r * R; return new THREE.Vector3(Math.cos(n.a) * rr, Math.sin(n.a) * rr * .85, n.z * R); }
  setStato(s) {
    this.signals = s.signals.map(x => ({ ...x, ms: Date.parse(x.t) })).filter(x => x.ms).sort((a, b) => a.ms - b.ms);
    this.stimoli = s.stimoli.map(x => ({ ...x, ms: Date.parse(x.t) })).filter(x => x.ms).sort((a, b) => a.ms - b.ms);
    this.umori = s.umori; this.energy = WEATHER[(s.weather && s.weather.kind) || "unknown"] || .8; this.temperament(); this.rebuild();
  }
  temperament() {
    const cnt = {}; let n = 0; for (const u of this.umori) if (MOOD[u.mood]) { cnt[u.mood] = (cnt[u.mood] || 0) + 1; n++; }
    let rgb = [0, 0, 0]; if (!n) rgb = MOOD.vivid.rgb.slice(); else for (const k in cnt) rgb = rgb.map((v, i) => v + MOOD[k].rgb[i] * cnt[k] / n);
    this.color.setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255); this.aura.material.color.copy(this.color); this.linkMat.color.copy(this.color).lerp(new THREE.Color(1, 1, 1), .35);
    for (const nd of this.list) if (nd.kind === "sig") nd.sprite.material.color.copy(this.color);
    if (this.membrane) this.membrane.material.color.copy(this.color); if (this.coreEdges) this.coreEdges.material.color.copy(this.color);
  }
  addStimolo(e) { const ms = Date.parse(e.t) || Date.now(); const k = { ...e, ms }; this.stimoli.push(k); this.rebuild(); return k; }
  rebuild() {
    const sig = this.signals; this.assimilated = Math.max(0, sig.length - MAX_NODES); const vis = sig.slice(this.assimilated); const want = new Map(); const placed = [];
    const span = .32 + .68 * Math.min(1, vis.length / MAX_NODES);
    vis.forEach((s, i) => {
      const h = hash(s.id); const sec = SECTOR[s.caps[0]] != null ? SECTOR[s.caps[0]] : (h % 4); const free = SECTOR[s.caps[0]] == null;
      const a = SECTOR_ANGLE[sec] + (unit(h, 1) - .5) * (free ? TAU * .45 : TAU * .23);
      const r = Math.min(1.1, (.2 + .78 * (vis.length > 1 ? i / (vis.length - 1) : .5) * (.86 + unit(h, 2) * .28)) * span); const z = (unit(h, 3) - .5) * 1.1;
      let parent = null, best = 1e9; for (const p of placed) { if (p.sec !== sec) continue; const d = Math.hypot(Math.cos(p.a) * p.r - Math.cos(a) * r, Math.sin(p.a) * p.r - Math.sin(a) * r, p.z - z); if (d < best) { best = d; parent = p.id; } }
      const n = { id: "s:" + s.id, kind: "sig", sec, free, a, r, z, size: .022 + (s.score / 100) * .02, parent, sig: s }; want.set(n.id, n); placed.push(n);
    });
    for (const k of this.stimoli.slice(-MAX_STIM)) {
      let parent = null, best = 1e9; for (const p of placed) { const d = Math.hypot(Math.cos(p.a) * p.r - Math.cos(k.a) * k.r, Math.sin(p.a) * p.r - Math.sin(k.a) * k.r, p.z); if (d < best) { best = d; parent = p.id; } }
      const id = "k:" + k.ms + ":" + (+k.a).toFixed(3); want.set(id, { id, kind: "stim", sec: -1, a: k.a, r: k.r, z: 0, size: .018, parent, stim: k });
    }
    for (const [id, w] of want) {
      const ex = this.nodes.get(id); if (ex) { Object.assign(ex, { a: w.a, r: w.r, z: w.z, size: w.size, parent: w.parent, dying: false }); continue; }
      const mat = new THREE.SpriteMaterial({ map: this.texRing, color: w.kind === "stim" ? new THREE.Color(1, 1, 1) : this.color.clone(), transparent: true, opacity: .95, depthWrite: false });
      const sprite = new THREE.Sprite(mat); const pn = w.parent ? this.nodes.get(w.parent) : null; sprite.position.copy(pn ? pn.pos : new THREE.Vector3(0, 0, 0)); sprite.scale.setScalar(0.0001);
      this.group.add(sprite);
      this.nodes.set(id, { ...w, sprite, pos: sprite.position, vel: new THREE.Vector3(), age: 0, scale: 0, flash: 0, ph: Math.random() * TAU, dying: false, children: [] });
    }
    for (const [id, n] of this.nodes) if (!want.has(id)) n.dying = true;
    this.list = [...this.nodes.values()]; for (const n of this.list) n.children.length = 0;
    for (const n of this.list) if (n.parent && this.nodes.has(n.parent)) this.nodes.get(n.parent).children.push(n);
    this.roots = this.list.filter(n => !n.parent && !n.dying);
    const pos = new Float32Array(this.list.length * 6); this.linkGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); this.linkGeo.setDrawRange(0, this.list.length * 2);
  }
  shock(p, k = 1) { for (const n of this.list) { const d = n.pos.clone().sub(p); const L = d.length() || 1; const f = Math.max(0, 1 - L / (.5 * k)) * .06 * k; n.vel.addScaledVector(d.normalize(), f); } this.heartKick = 1; }
  nearest(ray) { let best = null, bd = 1e9; const v = new THREE.Vector3(); for (const n of this.list) { if (n.dying) continue; v.copy(n.pos).applyMatrix4(this.group.matrixWorld); const d = ray.distanceToPoint(v); if (d < .07 && d < bd) { bd = d; best = n; } } return best; }
  update(dt) {
    this.t += dt; const E = this.energy; const bpm = 46 + 34 * E; this.phase += dt * bpm / 60 * TAU; this.heart = Math.pow(Math.max(0, Math.sin(this.phase)), 10);
    const breath = 1 + .012 * Math.sin(this.phase * .5) + .012 * this.heart;
    this.yaw += (this.yawV + .06) * dt; this.yawV *= Math.pow(.9, dt * 60); this.group.rotation.y = this.yaw;
    const tmp = new THREE.Vector3();
    for (const n of this.list) {
      n.age += dt; n.scale = n.dying ? Math.max(0, n.scale - dt * 1.6) : Math.min(1, n.age / 1.3); n.flash = Math.max(0, n.flash - dt * 1.8);
      const h = this.home(n).multiplyScalar(breath); h.x += Math.sin(this.t * 1.1 + n.ph) * .006 * E; h.y += Math.cos(this.t * .9 + n.ph * 1.3) * .006 * E; h.z += Math.sin(this.t * .7 + n.ph * .7) * .005 * E;
      tmp.copy(h).sub(n.pos).multiplyScalar(.05); n.vel.add(tmp); n.vel.multiplyScalar(Math.pow(.86, dt * 60)); n.pos.add(n.vel);
      const s = (n.size * 5.2 + n.flash * .06) * (n.scale || .0001) * (1 + this.heart * .06); n.sprite.scale.setScalar(Math.max(.0001, s));
      n.sprite.material.opacity = Math.min(1, .8 + n.flash * .4) * (n.dying ? n.scale : 1);
    }
    if (this.list.some(n => n.dying && n.scale <= 0)) { for (const [id, n] of this.nodes) if (n.dying && n.scale <= 0) { this.group.remove(n.sprite); n.sprite.material.dispose(); this.nodes.delete(id); } this.rebuild(); }
    // legami
    const pos = this.linkGeo.getAttribute("position"); if (pos) { let i = 0; for (const n of this.list) { const p = n.parent ? this.nodes.get(n.parent) : null; const from = p ? p.pos : this.core.position; const to = n.scale > 0 ? n.pos : from; pos.setXYZ(i++, from.x, from.y, from.z); pos.setXYZ(i++, to.x, to.y, to.z); } pos.needsUpdate = true; }
    // impulsi dal cuore lungo i rami
    if (Math.random() < dt * (0.8 + 1.4 * E) && this.roots.length && this.pulses.length < 30) { const to = this.roots[Math.floor(Math.random() * this.roots.length)]; const sp = this.pulsePool.pop() || new THREE.Sprite(this.pulseMat); sp.scale.setScalar(.035); this.group.add(sp); this.pulses.push({ from: null, to, t: 0, v: 1 + Math.random() * .6 + E * .3, sp }); }
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const p = this.pulses[i]; p.t += dt * p.v; const a = p.from ? p.from.pos : this.core.position; p.sp.position.lerpVectors(a, p.to.pos, Math.min(1, p.t)); if (p.t < 1) continue;
      p.to.flash = 1; const kids = p.to.children.filter(c => !c.dying);
      if (kids.length && Math.random() < .85) { p.from = p.to; p.to = kids[Math.floor(Math.random() * kids.length)]; p.t = 0; } else { this.group.remove(p.sp); this.pulsePool.push(p.sp); this.pulses.splice(i, 1); }
    }
    const cs = 1 + this.heart * .18 + (this.heartKick || 0) * .3; this.heartKick = Math.max(0, (this.heartKick || 0) - dt * 2); this.core.scale.setScalar(cs); this.core.rotation.y += dt * .4; this.core.rotation.x = .615;
    this.aura.scale.setScalar(.8 + .2 * this.heart); this.aura.material.opacity = .35 + .2 * E;
    if (this.membrane) { this.membrane.rotation.y -= dt * .05; this.membrane.rotation.z = Math.sin(this.t * .2) * .1; const ms = 1 + .012 * this.heart; this.membrane.scale.set(ms, .85 * ms, ms); }
  }
}

// ================= regia =================
const org = new Organismo3D(); window.__organismo3d = org;
let me = "", stato = null, xrScene = null, started = false, placed = false;
const post = (path, body) => fetch("/organismo/api/" + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, from: me, room, role: "phone" }), keepalive: true }).then(r => r.json()).catch(() => null);
async function carica() { try { const r = await fetch("/organismo/api/stato", { cache: "no-store" }); stato = await r.json(); org.setStato(stato); } catch (e) { console.warn("Organismo: stato non disponibile", e); } }
carica(); setInterval(carica, 180000);

const presence = (p) => { const box = $("vo-presence"); if (box && p) box.innerHTML = p.desktops ? `<b>Collegato</b> allo schermo principale` : `Schermo principale <b>non trovato</b>: vive lo stesso`; };
const tip = $("vo-tip"); let tipNode = null, tipTimer = 0;
function showTip(n, remote) {
  if (!tip || !n) return; tipNode = n; clearTimeout(tipTimer); n.flash = 1;
  if (n.kind === "sig") { const s = n.sig; tip.innerHTML = `<span class="eyebrow"><span class="dot"></span>${remote ? "Dallo schermo principale · " : ""}Radar${n.free ? "" : " · " + SECTOR_NAME[n.sec]}</span><b>${esc(s.title)}</b><small>${esc(s.src)}${s.date ? " · " + fmtDate(s.date) : ""}</small>`; }
  else tip.innerHTML = `<span class="eyebrow"><span class="dot"></span>${remote ? "Dallo schermo principale · " : ""}Stimolo</span><b>Qualcuno ha toccato qui</b><small>${fmtDate(n.stim.t)}${n.stim.src === "phone" ? " · dal telefono" : ""}</small>`;
  tip.classList.toggle("remote", !!remote); tip.hidden = false; tipTimer = setTimeout(hideTip, remote ? 9000 : 12000);
}
const hideTip = () => { if (tip) tip.hidden = true; tipNode = null; };
function placeTip() {
  if (!tipNode || !tip || tip.hidden || !xrScene) return; if (tipNode.dying) return hideTip();
  const v = tipNode.pos.clone().applyMatrix4(org.group.matrixWorld).project(xrScene.camera); if (v.z > 1) { tip.style.opacity = 0; return; } tip.style.opacity = 1;
  const x = clamp((v.x + 1) / 2 * innerWidth, 150, innerWidth - 150), y = (1 - v.y) / 2 * innerHeight; tip.style.left = x + "px"; tip.style.top = y + "px"; tip.classList.toggle("below", y < 150);
}

// ---- stanza SSE ----
let es = null;
function connect() {
  if (es) es.close(); es = new EventSource(`/organismo/stream?r=${encodeURIComponent(room)}&role=phone&ar=1`);
  const J = (e) => { try { return JSON.parse(e.data); } catch { return null; } };
  es.addEventListener("ciao", e => { const d = J(e); if (!d) return; me = d.id; presence(d); });
  es.addEventListener("presenza", e => { const d = J(e); if (d) presence(d); });
  es.addEventListener("stimolo", e => { const d = J(e); if (!d || d.from === me) return; org.addStimolo(d); const n = org.nodes.get("k:" + (Date.parse(d.t) || 0) + ":" + (+d.a).toFixed(3)); if (n) org.shock(n.pos, .8); Say.push("Uno stimolo adesso", d.room === room ? "Dallo schermo principale: è arrivato anche qui, nella stanza." : "Qualcuno, da un altro schermo, l'ha appena toccato.", { key: "stim", ms: 5000 }); });
  es.addEventListener("umore", e => { const d = J(e); if (!d) return; org.umori.push({ mood: d.mood }); org.temperament(); });
  es.addEventListener("gesto", e => { const d = J(e); if (!d || d.from === me) return; if (d.kind === "nodo") { const n = org.nodes.get(d.id); if (n && !n.dying) showTip(n, true); } });
}

// ---- lo sguardo del telefono → inclinazione sul desktop ----
let lastTilt = 0, yaw0 = null;
function look(camera) {
  const e = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ"); if (yaw0 == null) yaw0 = e.y;
  let dy = e.y - yaw0; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  const gx = clamp(-dy / .7, -1, 1), gy = clamp(-e.x / .6, -1, 1); const now = performance.now();
  if (now - lastTilt > 120) { lastTilt = now; if (Math.abs(gx) > .04 || Math.abs(gy) > .04 || look.sent) { look.sent = Math.abs(gx) > .04 || Math.abs(gy) > .04; post("tilt", { gx, gy }); } }
}

// ---- modulo pipeline 8th Wall ----
const organismoModule = () => ({
  name: "organismo",
  onStart: ({ canvas }) => {
    xrScene = XR8.Threejs.xrScene(); const { scene, camera, renderer } = xrScene;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    camera.position.set(0, 1.4, 0); XR8.XrController.updateCameraProjectionMatrix({ origin: camera.position, facing: camera.quaternion });
    org.group.position.set(0, 1.25, -1.6); scene.add(org.group); started = true; placed = false; organismoModule.frames = 0;
    $("vo-arrive").classList.add("off"); connect();
    Say.push("È nella stanza", "A un metro e mezzo da te, grande come una persona. Giraci intorno, avvicinati: i nodi sono le notizie del Radar, il cubo è il cuore.", { ms: 7000 });
    Say.push("Tocca", "Un tocco nel vuoto lascia uno stimolo che arriva anche sullo schermo principale; un nodo toccato apre la sua notizia di là. Trascina per girarlo.", { ms: 8000 });
    // tocco / trascinamento
    let press = null; const ray = new THREE.Raycaster();
    const ndc = (ev) => new THREE.Vector2((ev.clientX / innerWidth) * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1);
    canvas.addEventListener("pointerdown", ev => { press = { x: ev.clientX, y: ev.clientY, lx: ev.clientX, moved: false }; });
    canvas.addEventListener("pointermove", ev => { if (!press) return; if (Math.hypot(ev.clientX - press.x, ev.clientY - press.y) > 8) press.moved = true; if (press.moved) { org.yawV = (ev.clientX - press.lx) * .12; press.lx = ev.clientX; } });
    const up = (ev) => {
      if (!press) return; const moved = press.moved; press = null; if (moved) return;
      ray.setFromCamera(ndc(ev), camera); const n = org.nearest(ray.ray);
      if (n) { showTip(n, false); if (room) post("gesto", { kind: "nodo", id: n.id }); return; }
      hideTip();
      // stimolo: dove il raggio incontra il piano dell'organismo (davanti al cuore), in coordinate locali
      const center = org.group.getWorldPosition(new THREE.Vector3()); const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()).negate(), center);
      const hit = ray.ray.intersectPlane(plane, new THREE.Vector3()); if (!hit) return;
      const local = org.group.worldToLocal(hit.clone()); const a = Math.atan2(local.y / .85, local.x), r = clamp(Math.hypot(local.x, local.y / .85) / R, .15, 1.3);
      const m = (() => { try { const v = sessionStorage.getItem("fw.mood"); return MOOD[v] ? v : ""; } catch { return ""; } })();
      const k = org.addStimolo({ a, r, mood: m, src: "phone", t: new Date().toISOString() }); const nn = org.nodes.get("k:" + k.ms + ":" + (+a).toFixed(3)); if (nn) org.shock(nn.pos, 1);
      post("stimolo", { a, r, mood: m }).then(res => { if (res && res.t && nn) { const ms = Date.parse(res.t); org.nodes.delete(nn.id); nn.id = "k:" + ms + ":" + (+a).toFixed(3); k.ms = ms; k.t = res.t; org.nodes.set(nn.id, nn); org.rebuild(); } });
      Say.once("stim-mio", "Il tuo stimolo", "Resta, ed è arrivato anche sullo schermo principale.", { ms: 5000 });
    };
    canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", () => { press = null; });
  },
  onUpdate: ({ processCpuResult }) => {
    const now = performance.now(); const dt = Math.min(.05, (now - (organismoModule.last || now)) / 1000); organismoModule.last = now;
    if (!started) return; org.update(dt); placeTip();
    if (xrScene) {
      organismoModule.frames++;
      if (!placed && organismoModule.frames > 12) { placeAhead(); placed = true; } // appena la camera ha una posa: a un metro davanti a chi guarda
      const rs = processCpuResult && processCpuResult.reality ? processCpuResult.reality.trackingStatus : null;
      if (!rs || rs === "NORMAL") look(xrScene.camera);
    }
  }
});
// mette l'organismo a un metro e mezzo davanti alla camera, all'altezza degli occhi (senza riavviare il tracking)
function placeAhead(flat = true) {
  if (!xrScene) return; const cam = xrScene.camera; const fwd = cam.getWorldDirection(new THREE.Vector3());
  if (flat) { fwd.y = 0; if (fwd.length() < .2) fwd.set(0, 0, -1); fwd.normalize(); }
  org.group.position.copy(cam.position).addScaledVector(fwd, 1.6); if (flat) org.group.position.y = cam.position.y - .1;
  org.yaw = Math.atan2(cam.position.x - org.group.position.x, cam.position.z - org.group.position.z); yaw0 = null;
}
window.__placeAhead = placeAhead;

function avvia() {
  const canvas = $("vo-ar-canvas");
  XR8.XrController.configure({ disableWorldTracking: false });
  XR8.addCameraPipelineModules([
    XR8.GlTextureRenderer.pipelineModule(), XR8.Threejs.pipelineModule(), XR8.XrController.pipelineModule(),
    XRExtras.AlmostThere.pipelineModule(), XRExtras.FullWindowCanvas.pipelineModule(), XRExtras.Loading.pipelineModule(), XRExtras.RuntimeError.pipelineModule(),
    organismoModule()
  ]);
  XR8.run({ canvas, allowedDevices: XR8.XrConfig.device().ANY });
}
$("vo-arrive-btn").addEventListener("click", () => {
  const btn = $("vo-arrive-btn"); btn.disabled = true; btn.textContent = "Apro la fotocamera…";
  if (window.XR8) avvia(); else window.addEventListener("xrloaded", avvia, { once: true });
});
$("vo-ar-recenter").addEventListener("click", () => { if (window.XR8 && started) { placeAhead(); Say.push("Davanti a te", "L'ho rimesso a un metro e mezzo da te, all'altezza degli occhi.", { ms: 4000, front: true }); } });
