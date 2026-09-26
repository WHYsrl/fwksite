// Meteo di Roma da Open-Meteo (senza chiave), con cache di 15 minuti. Alimenta le "modalità ambientali" del sito.
let cache = { at: 0, data: null };
const ROME = { lat: 41.9028, lon: 12.4964 };

function classify(code, isDay) {
  // Codici WMO: 0 sereno · 1-3 nuvole · 45-48 nebbia · 51-67 pioggia · 71-77 neve · 80-82 rovesci · 95-99 temporale
  if (!isDay) return "night";
  if (code === 0 || code === 1) return "sun";
  if (code <= 3 || code === 45 || code === 48) return "cloud";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 95) return "storm";
  return "rain";
}

async function getWeather() {
  if (Date.now() - cache.at < 15 * 60 * 1000 && cache.data) return cache.data;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${ROME.lat}&longitude=${ROME.lon}&current=temperature_2m,weather_code,is_day,wind_speed_10m&timezone=Europe%2FRome`;
    const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
    const j = await r.json();
    const c = j.current || {};
    cache = { at: Date.now(), data: { city: "Roma", temp: Math.round(c.temperature_2m), code: c.weather_code, isDay: !!c.is_day, wind: c.wind_speed_10m, kind: classify(c.weather_code, !!c.is_day), at: c.time } };
  } catch (e) {
    cache = { at: Date.now(), data: { city: "Roma", temp: null, code: null, isDay: true, kind: "unknown", error: e.message } };
  }
  return cache.data;
}
module.exports = { getWeather };
