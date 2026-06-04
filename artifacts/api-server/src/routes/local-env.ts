import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router = Router();

const DEFAULT_LAT = 48.2082;
const DEFAULT_LON = 16.3738;
const FETCH_MS = 12_000;
const WX_TTL = 15 * 60 * 1000;
const POWER_TTL = 6 * 60 * 60 * 1000;

interface Meta { source: string; grid: string; lat: number; lon: number; elevation?: number }

interface WxData {
  daylight: { daylightSec: number; sunshineSec: number; sunshinePercent: number; description: string; meta: Meta };
  windChill: { feelsLike: number; actualTemp: number; windSpeed: number; description: string; meta: Meta };
  sultriness: { feelsLike: number; actualTemp: number; humidity: number; level: string; description: string; meta: Meta };
  pressure: { hPa: number; level: string; description: string; meta: Meta };
  airQuality: { aqi: number; aqiLabel: string; pm25: number; pm10: number; no2: number; o3: number; so2: number; description: string; meta: Meta };
  pollen: { dominant: string; grains: number; severity: string; description: string; meta: Meta } | null;
}

interface PowerData {
  temperature: { monthly30dMean: number; anomaly: number; description: string; meta: Meta };
  precipitation: { monthly30dSum: number; pctVsAvg: number; description: string; meta: Meta };
}

interface CacheEntry<T> { data: T; fetchedAt: number }
const wxCache = new Map<string, CacheEntry<WxData>>();
const powerCache = new Map<string, CacheEntry<PowerData>>();

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number, d = 0) { return parseFloat(n.toFixed(d)); }

function daylight_desc(pct: number): string {
  if (pct > 80) return "Clear skies with abundant sunshine. Excellent conditions for outdoor activity and natural light exposure.";
  if (pct > 60) return "Mostly sunny with some cloud cover. Good natural light for mood and energy.";
  if (pct > 40) return "Partly cloudy. Moderate light exposure — consider outdoor breaks during clear spells.";
  return "Overcast conditions. Limited natural light may affect mood and energy levels.";
}

function windchill_desc(diff: number): string {
  if (diff > 5) return "Strong wind chill. Dress warmer than the actual temperature suggests.";
  if (diff > 2) return "Moderate wind chill. The wind makes it feel noticeably cooler.";
  if (diff > -1) return "Mild wind chill. A slight cooling effect from the wind, but nothing uncomfortable.";
  return "No wind chill effect. The air feels warmer than the thermometer reads.";
}

function sultriness_level(humidity: number, feelsLike: number): string {
  if (humidity > 75) return "Very Sultry";
  if (humidity > 60 && feelsLike > 22) return "Sultry";
  if (humidity > 40 && feelsLike > 22) return "Slightly Sultry";
  return "Comfortable";
}

function sultriness_desc(humidity: number, feelsLike: number): string {
  if (humidity > 75) return "Very sultry. High humidity significantly increases heat stress. Stay hydrated.";
  if (humidity > 60 && feelsLike > 22) return "Sultry conditions. The combination of heat and humidity adds heat stress.";
  if (humidity > 40 && feelsLike > 22) return "Moderate sultriness. Some heat-humidity discomfort may occur during activity.";
  return "Not sultry. Humidity levels are comfortable and not adding to heat stress.";
}

function pressure_level(hPa: number): string {
  if (hPa < 1000) return "Low";
  if (hPa > 1020) return "High";
  return "Normal";
}

function pressure_desc(hPa: number): string {
  if (hPa < 1000) return "Low pressure system. Some people experience headaches, fatigue, or joint discomfort during low pressure conditions.";
  if (hPa > 1020) return "High pressure system. Clear, stable conditions often associated with good weather and easy breathing.";
  return "Normal atmospheric pressure. Comfortable for most people. No significant pressure-related effects expected.";
}

function aqi_label(aqi: number): string {
  if (aqi <= 20) return "Good";
  if (aqi <= 40) return "Fair";
  if (aqi <= 60) return "Moderate";
  if (aqi <= 80) return "Poor";
  if (aqi <= 100) return "Very Poor";
  return "Extremely Poor";
}

function aqi_desc(aqi: number): string {
  if (aqi <= 20) return "Air quality is excellent. No health concerns for any group.";
  if (aqi <= 40) return "Air quality is fair. Outdoor activities are fine for most people.";
  if (aqi <= 60) return "Moderate air quality. Sensitive individuals may want to limit prolonged outdoor exertion.";
  if (aqi <= 80) return "Poor air quality. Sensitive groups should limit outdoor activities.";
  return "Very poor air quality. Most people should reduce outdoor activities.";
}

function pollen_severity(grains: number): string {
  if (grains <= 10) return "Low";
  if (grains <= 30) return "Moderate";
  if (grains <= 60) return "High";
  return "Very High";
}

function pollen_desc(type: string, severity: string): string {
  if (severity === "Low") return `Low pollen levels from ${type}. Minimal impact for most people.`;
  if (severity === "Moderate") return `Moderate pollen from ${type}. If you're sensitive, consider timing outdoor activities for early morning or after rain.`;
  if (severity === "High") return `High pollen from ${type}. Allergy sufferers should consider medication and limit time outdoors.`;
  return `Very high pollen from ${type}. Strongly consider staying indoors and taking allergy medication.`;
}

function temp_desc(anomaly: number): string {
  if (anomaly > 3) return "Significantly warmer than usual. Heat may add to stress load on the nervous system.";
  if (anomaly > 1) return "Above-average temperatures. Comfortable but warmer than the seasonal norm.";
  if (anomaly > -1) return "Temperatures are close to the local average. Comfortable conditions for activity and recovery.";
  if (anomaly > -3) return "Slightly below average temperatures. Cooler than the seasonal norm.";
  return "Significantly cooler than usual for this time of year.";
}

function prec_desc(pct: number): string {
  if (pct > 30) return "Well above-normal precipitation. Wet conditions may limit outdoor activities.";
  if (pct > 10) return "Slightly above normal precipitation for this period.";
  if (pct > -10) return "Precipitation is near normal levels for this area.";
  if (pct > -30) return "Drier than usual. Lower precipitation than typical for this time of year.";
  return "Significantly drier than normal. Drought conditions may be developing.";
}

// ── Fetch Open-Meteo (current wx + daily) ────────────────────────────────────
async function fetchWeather(lat: number, lon: number): Promise<WxData> {
  const [wxResp, aqResp] = await Promise.all([
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,surface_pressure` +
      `&daily=daylight_duration,sunshine_duration&timezone=auto&forecast_days=1`,
      { signal: AbortSignal.timeout(FETCH_MS) }
    ),
    fetch(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
      `&current=pm2_5,pm10,nitrogen_dioxide,ozone,sulphur_dioxide,european_aqi` +
      `&hourly=grass_pollen,birch_pollen,alder_pollen,mugwort_pollen,ragweed_pollen` +
      `&forecast_days=1&timezone=auto`,
      { signal: AbortSignal.timeout(FETCH_MS) }
    ),
  ]);

  if (!wxResp.ok) throw new Error(`Open-Meteo HTTP ${wxResp.status}`);
  if (!aqResp.ok) throw new Error(`Open-Meteo AQ HTTP ${aqResp.status}`);

  const wx = await wxResp.json() as {
    latitude: number; longitude: number; elevation: number;
    current: {
      temperature_2m: number; apparent_temperature: number;
      relative_humidity_2m: number; wind_speed_10m: number; surface_pressure: number;
    };
    daily: { daylight_duration: number[]; sunshine_duration: number[] };
  };

  const aq = await aqResp.json() as {
    latitude: number; longitude: number;
    current: { pm2_5: number; pm10: number; nitrogen_dioxide: number; ozone: number; sulphur_dioxide: number; european_aqi: number };
    hourly: { time: string[]; grass_pollen: number[]; birch_pollen: number[]; alder_pollen: number[]; mugwort_pollen: number[]; ragweed_pollen: number[] };
  };

  const c = wx.current;
  const wlat = fmt(wx.latitude, 2);
  const wlon = fmt(wx.longitude, 2);
  const qlat = fmt(aq.latitude, 2);
  const qlon = fmt(aq.longitude, 2);

  const daylightSec = wx.daily.daylight_duration[0] ?? 0;
  const sunshineSec = wx.daily.sunshine_duration[0] ?? 0;
  const sunshinePercent = daylightSec > 0 ? Math.round((sunshineSec / daylightSec) * 100) : 0;

  const diff = c.temperature_2m - c.apparent_temperature;
  const sultLevel = sultriness_level(c.relative_humidity_2m, c.apparent_temperature);
  const pHpa = fmt(c.surface_pressure, 0);

  const aqi = Math.round(aq.current.european_aqi);
  const aqiLabel = aqi_label(aqi);

  // Dominant pollen at current hour
  let pollenResult: WxData["pollen"] = null;
  const now = new Date();
  const hourIdx = Math.min(now.getHours(), (aq.hourly.time?.length ?? 0) - 1);
  if (hourIdx >= 0) {
    const candidates: { type: string; grains: number }[] = [
      { type: "Grass", grains: aq.hourly.grass_pollen[hourIdx] ?? 0 },
      { type: "Birch", grains: aq.hourly.birch_pollen[hourIdx] ?? 0 },
      { type: "Alder", grains: aq.hourly.alder_pollen[hourIdx] ?? 0 },
      { type: "Mugwort", grains: aq.hourly.mugwort_pollen[hourIdx] ?? 0 },
      { type: "Ragweed", grains: aq.hourly.ragweed_pollen[hourIdx] ?? 0 },
    ];
    const dominant = candidates.reduce((a, b) => (b.grains > a.grains ? b : a));
    if (dominant.grains > 0) {
      const severity = pollen_severity(dominant.grains);
      pollenResult = {
        dominant: dominant.type,
        grains: fmt(dominant.grains, 0),
        severity,
        description: pollen_desc(dominant.type, severity),
        meta: { source: "Open-Meteo CAMS", grid: "~11 km (CAMS Europe)", lat: qlat, lon: qlon },
      };
    }
  }

  return {
    daylight: {
      daylightSec: Math.round(daylightSec),
      sunshineSec: Math.round(sunshineSec),
      sunshinePercent,
      description: daylight_desc(sunshinePercent),
      meta: { source: "Open-Meteo", grid: "~1 km, interpolated to point", lat: wlat, lon: wlon, elevation: Math.round(wx.elevation) },
    },
    windChill: {
      feelsLike: fmt(c.apparent_temperature, 1),
      actualTemp: fmt(c.temperature_2m, 1),
      windSpeed: fmt(c.wind_speed_10m, 1),
      description: windchill_desc(diff),
      meta: { source: "Open-Meteo", grid: "~1 km, interpolated to point", lat: wlat, lon: wlon },
    },
    sultriness: {
      feelsLike: fmt(c.apparent_temperature, 1),
      actualTemp: fmt(c.temperature_2m, 1),
      humidity: Math.round(c.relative_humidity_2m),
      level: sultLevel,
      description: sultriness_desc(c.relative_humidity_2m, c.apparent_temperature),
      meta: { source: "Open-Meteo", grid: "~1 km, interpolated to point", lat: wlat, lon: wlon },
    },
    pressure: {
      hPa: pHpa,
      level: pressure_level(pHpa),
      description: pressure_desc(pHpa),
      meta: { source: "Open-Meteo", grid: "~1 km, interpolated to point", lat: wlat, lon: wlon, elevation: Math.round(wx.elevation) },
    },
    airQuality: {
      aqi,
      aqiLabel,
      pm25: fmt(aq.current.pm2_5, 0),
      pm10: fmt(aq.current.pm10, 0),
      no2: fmt(aq.current.nitrogen_dioxide, 0),
      o3: fmt(aq.current.ozone, 0),
      so2: fmt(aq.current.sulphur_dioxide, 0),
      description: aqi_desc(aqi),
      meta: { source: "Copernicus CAMS", grid: "~11 km (CAMS Europe)", lat: qlat, lon: qlon },
    },
    pollen: pollenResult,
  };
}

// ── Fetch NASA POWER (30-day mean + historical comparison) ────────────────────
function powerDateStr(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

async function fetchPower(lat: number, lon: number): Promise<PowerData> {
  const today = new Date();
  const d30 = new Date(today); d30.setDate(today.getDate() - 30);
  const hist5yEnd = new Date(today); hist5yEnd.setFullYear(today.getFullYear() - 5);
  const hist5yStart = new Date(d30); hist5yStart.setFullYear(d30.getFullYear() - 5);

  const base = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,PRECTOTCORR&community=AG&longitude=${lon}&latitude=${lat}&format=JSON`;

  const [curResp, histResp] = await Promise.all([
    fetch(`${base}&start=${powerDateStr(d30)}&end=${powerDateStr(today)}`, {
      signal: AbortSignal.timeout(FETCH_MS),
      headers: { "User-Agent": "SuiKa-App/1.0 (burnout-recovery-companion)" },
    }),
    fetch(`${base}&start=${powerDateStr(hist5yStart)}&end=${powerDateStr(hist5yEnd)}`, {
      signal: AbortSignal.timeout(FETCH_MS),
      headers: { "User-Agent": "SuiKa-App/1.0 (burnout-recovery-companion)" },
    }),
  ]);

  if (!curResp.ok) throw new Error(`NASA POWER current HTTP ${curResp.status}`);
  if (!histResp.ok) throw new Error(`NASA POWER historical HTTP ${histResp.status}`);

  const curData = await curResp.json() as { properties: { parameter: { T2M: Record<string, number>; PRECTOTCORR: Record<string, number> } }; geometry: { coordinates: [number, number, number] } };
  const histData = await histResp.json() as { properties: { parameter: { T2M: Record<string, number>; PRECTOTCORR: Record<string, number> } } };

  const validVals = (obj: Record<string, number>) => Object.values(obj).filter(v => v !== -999);
  const mean = (obj: Record<string, number>) => { const v = validVals(obj); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; };
  const sum = (obj: Record<string, number>) => validVals(obj).reduce((a, b) => a + b, 0);

  const curT = mean(curData.properties.parameter.T2M);
  const histT = mean(histData.properties.parameter.T2M);
  const curP = sum(curData.properties.parameter.PRECTOTCORR);
  const histP = sum(histData.properties.parameter.PRECTOTCORR);
  const anomaly = curT - histT;
  const pctVsAvg = histP > 0 ? Math.round(((curP - histP) / histP) * 100) : 0;

  const coords = curData.geometry?.coordinates ?? [lon, lat, 0];
  const plat = fmt(coords[1], 2);
  const plon = fmt(coords[0], 2);
  const meta: Meta = { source: "NASA POWER", grid: "~0.5°×0.5° (~55 km)", lat: plat, lon: plon };

  return {
    temperature: {
      monthly30dMean: fmt(curT, 1),
      anomaly: fmt(anomaly, 1),
      description: temp_desc(anomaly),
      meta,
    },
    precipitation: {
      monthly30dSum: fmt(curP, 0),
      pctVsAvg,
      description: prec_desc(pctVsAvg),
      meta,
    },
  };
}

// ── Route ─────────────────────────────────────────────────────────────────────
router.get("/local-env", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));

  const lat = user?.defaultLat ?? DEFAULT_LAT;
  const lon = user?.defaultLon ?? DEFAULT_LON;
  const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const now = Date.now();

  // Resolve current weather (15-min cache)
  let wx: WxData;
  const wxEntry = wxCache.get(cacheKey);
  if (wxEntry && now - wxEntry.fetchedAt < WX_TTL) {
    wx = wxEntry.data;
  } else {
    wx = await fetchWeather(lat, lon);
    wxCache.set(cacheKey, { data: wx, fetchedAt: now });
  }

  // Resolve NASA POWER (6-hour cache)
  let power: PowerData;
  const powerEntry = powerCache.get(cacheKey);
  if (powerEntry && now - powerEntry.fetchedAt < POWER_TTL) {
    power = powerEntry.data;
  } else {
    power = await fetchPower(lat, lon);
    powerCache.set(cacheKey, { data: power, fetchedAt: now });
  }

  res.json({ ...wx, ...power });
});

export default router;
