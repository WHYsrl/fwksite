// Meteo di Roma, con cache di 15 minuti. Alimenta il ritmo dell'organismo (kind, temp, wind).
// Prima fonte Open-Meteo (senza chiave); se risponde con un errore (per esempio il limite
// giornaliero per IP, frequente su hosting condiviso) si passa a MET Norway, anch'esso senza
// chiave ma che richiede uno User-Agent identificativo. Se nessuna delle due risponde, il
// giorno/notte viene comunque calcolato dall'ora di Roma, così di giorno l'organismo non si
// spegne come di notte.
let cache = { at: 0, data: null };
const ROME = { lat: 41.9028, lon: 12.4964 };
const USER_AGENT = "frameworks-site/1.0 (https://github.com/WHYsrl/fwksite)";

function classify(code, isDay) {
  // Codici WMO: 0 sereno · 1-3 nuvole · 45-48 nebbia · 51-67 pioggia · 71-77 neve · 80-82 rovesci · 95-99 temporale
  if (!isDay) return "night";
  if (code === 0 || code === 1) return "sun";
  if (code <= 3 || code === 45 || code === 48) return "cloud";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 95) return "storm";
  return "rain";
}

// Giorno a Roma, dall'ora locale (fra le 7 e le 20): usato quando la fonte non lo dice.
function romeIsDay(date = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", hour: "numeric", hour12: false }).format(date));
  return hour >= 7 && hour < 20;
}

async function fromOpenMeteo() {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${ROME.lat}&longitude=${ROME.lon}&current=temperature_2m,weather_code,is_day,wind_speed_10m&timezone=Europe%2FRome`;
  const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
  const j = await r.json();
  const c = j.current;
  if (!r.ok || j.error || !c || typeof c.temperature_2m !== "number") throw new Error(j.reason || `open-meteo ${r.status}`);
  const isDay = !!c.is_day;
  return { city: "Roma", temp: Math.round(c.temperature_2m), code: c.weather_code, isDay, wind: c.wind_speed_10m, kind: classify(c.weather_code, isDay), at: c.time, source: "open-meteo" };
}

// Simboli MET Norway (clearsky_day, partlycloudy_night, rain, heavysnow, lightrainandthunder…) → kind.
function classifySymbol(symbol, isDay) {
  if (!isDay) return "night";
  const s = String(symbol || "");
  if (/thunder/.test(s)) return "storm";
  if (/snow|sleet/.test(s)) return "snow";
  if (/rain/.test(s)) return "rain";
  if (/clearsky|fair/.test(s)) return "sun";
  if (/cloudy|fog/.test(s)) return "cloud";
  return "cloud";
}

async function fromMetNo() {
  const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${ROME.lat}&lon=${ROME.lon}`;
  const r = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error(`met.no ${r.status}`);
  const j = await r.json();
  const now = (j.properties && j.properties.timeseries && j.properties.timeseries[0]) || null;
  const d = now && now.data && now.data.instant && now.data.instant.details;
  if (!d || typeof d.air_temperature !== "number") throw new Error("met.no: no data");
  const symbol = now.data.next_1_hours && now.data.next_1_hours.summary && now.data.next_1_hours.summary.symbol_code;
  const isDay = /_night$/.test(symbol || "") ? false : /_day$/.test(symbol || "") ? true : romeIsDay();
  return { city: "Roma", temp: Math.round(d.air_temperature), code: null, isDay, wind: Math.round(d.wind_speed * 3.6), kind: classifySymbol(symbol, isDay), at: now.time, source: "met.no" };
}

async function getWeather() {
  if (Date.now() - cache.at < 15 * 60 * 1000 && cache.data) return cache.data;
  const errors = [];
  for (const source of [fromOpenMeteo, fromMetNo]) {
    try {
      cache = { at: Date.now(), data: await source() };
      return cache.data;
    } catch (e) {
      errors.push(e.message);
    }
  }
  const isDay = romeIsDay();
  // senza fonti si riprova dopo 5 minuti, non 15
  cache = { at: Date.now() - 10 * 60 * 1000, data: { city: "Roma", temp: null, code: null, isDay, kind: isDay ? "unknown" : "night", error: errors.join(" · ") } };
  return cache.data;
}
module.exports = { getWeather };
