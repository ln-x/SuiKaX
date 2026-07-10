import { Router } from "express";
import { createHash } from "node:crypto";
import { requireAuth } from "../lib/auth";
import { logger } from "../lib/logger";

const router = Router();

// ── Cache ─────────────────────────────────────────────────────────────────────
interface SourceResult {
  items: unknown[];
  fetchedAt: number;
}
interface SourceStatus {
  name: string;
  status: "ok" | "empty" | "error" | "stale";
  count: number;
  error: string | null;
}

const CACHE_TTL_MS = 30 * 60 * 1000;
const STALE_TTL_MS = 4 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 12_000;

let aggregateCache: { events: unknown[]; sources: SourceStatus[]; fetchedAt: number } | null = null;
const staleCache = new Map<string, SourceResult>();

// ── Helpers ───────────────────────────────────────────────────────────────────
function withTimeout(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchRetry(url: string, opts: RequestInit, retries = 1): Promise<Response> {
  const resp = await fetch(url, opts);
  if (!resp.ok && retries > 0) {
    await sleep(800);
    return fetchRetry(url, opts, retries - 1);
  }
  return resp;
}

// ── Type helpers ──────────────────────────────────────────────────────────────
function classifyType(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("earthquake") || t.includes("seismic")) return "earthquake";
  if (t.includes("flood") || t.includes("flooding")) return "flood";
  if (t.includes("storm") || t.includes("cyclone") || t.includes("typhoon") || t.includes("hurricane")) return "storm";
  if (t.includes("volcano") || t.includes("volcanic")) return "volcano";
  if (t.includes("drought")) return "drought";
  if (t.includes("wildfire") || t.includes("fire")) return "wildfire";
  if (t.includes("tsunami")) return "tsunami";
  if (t.includes("epidemic") || t.includes("outbreak") || t.includes("disease")) return "epidemic";
  return "other";
}

// ── Stale-cache wrapper ───────────────────────────────────────────────────────
async function fetchWithFallback(
  key: string,
  fetcher: () => Promise<unknown[]>,
): Promise<{ items: unknown[]; status: SourceStatus }> {
  const name = key;
  try {
    const items = await fetcher();
    const now = Date.now();
    if (items.length > 0) {
      staleCache.set(key, { items, fetchedAt: now });
      return { items, status: { name, status: "ok", count: items.length, error: null } };
    }
    const stale = staleCache.get(key);
    if (stale && now - stale.fetchedAt < STALE_TTL_MS) {
      return { items: stale.items, status: { name, status: "stale", count: stale.items.length, error: null } };
    }
    return { items: [], status: { name, status: "empty", count: 0, error: null } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stale = staleCache.get(key);
    const now = Date.now();
    if (stale && now - stale.fetchedAt < STALE_TTL_MS) {
      logger.warn({ key, err: msg }, "Feed fetch failed — serving stale data");
      return { items: stale.items, status: { name, status: "stale", count: stale.items.length, error: msg } };
    }
    logger.warn({ key, err: msg }, "Feed fetch failed — no stale fallback");
    return { items: [], status: { name, status: "error", count: 0, error: msg } };
  }
}

// ── NWS Flood Alerts ─────────────────────────────────────────────────────────
async function fetchNwsFloods(): Promise<unknown[]> {
  const resp = await fetch(
    "https://api.weather.gov/alerts/active?event=Flood%20Warning,Flash%20Flood%20Warning,Flood%20Watch",
    {
      signal: withTimeout(FETCH_TIMEOUT_MS),
      headers: { Accept: "application/geo+json", "User-Agent": "SuiKa-App/1.0 (burnout-recovery-companion)" },
    },
  );
  const json = await resp.json() as {
    features?: Array<{
      id: string;
      properties: { event?: string; headline?: string; areaDesc?: string; sent?: string; severity?: string; description?: string };
    }>;
  };
  return (json.features ?? []).map((f) => {
    const p = f.properties;
    const sev = (p.severity ?? "").toLowerCase();
    return {
      id: `nws-flood-${f.id}`,
      title: p.headline || p.event || "Flood Alert",
      type: "flood",
      severity: sev === "extreme" || sev === "severe" ? "high" : "medium",
      source: "NWS",
      publishedAt: p.sent ?? new Date().toISOString(),
      description: p.description ?? null,
      countries: p.areaDesc ? [p.areaDesc] : [],
      url: "https://www.weather.gov/alerts",
    };
  });
}

// ── NWS Severe Weather Alerts ────────────────────────────────────────────────
async function fetchNwsStorms(): Promise<unknown[]> {
  const resp = await fetch(
    "https://api.weather.gov/alerts/active?event=Severe%20Thunderstorm%20Warning,Severe%20Thunderstorm%20Watch,Tornado%20Warning,Tornado%20Watch",
    {
      signal: withTimeout(FETCH_TIMEOUT_MS),
      headers: { Accept: "application/geo+json", "User-Agent": "SuiKa-App/1.0 (burnout-recovery-companion)" },
    },
  );
  const json = await resp.json() as {
    features?: Array<{
      id: string;
      properties: { event?: string; headline?: string; areaDesc?: string; sent?: string; severity?: string; description?: string };
    }>;
  };
  return (json.features ?? []).map((f) => {
    const p = f.properties;
    const sev = (p.severity ?? "").toLowerCase();
    return {
      id: `nws-storm-${f.id}`,
      title: p.headline || p.event || "Severe Weather Alert",
      type: "storm",
      severity: sev === "extreme" || sev === "severe" ? "high" : "medium",
      source: "NWS",
      publishedAt: p.sent ?? new Date().toISOString(),
      description: p.description ?? null,
      countries: p.areaDesc ? [p.areaDesc] : [],
      url: "https://www.weather.gov/alerts",
    };
  });
}

// ── NWS Tsunami Alerts ────────────────────────────────────────────────────────
async function fetchTsunami(): Promise<unknown[]> {
  const resp = await fetch(
    "https://api.weather.gov/alerts/active?code=TSW,TSA,TSY",
    {
      signal: withTimeout(FETCH_TIMEOUT_MS),
      headers: { Accept: "application/geo+json", "User-Agent": "SuiKa-App/1.0 (burnout-recovery-companion)" },
    },
  );
  const json = await resp.json() as {
    features?: Array<{
      id: string;
      properties: { event?: string; headline?: string; areaDesc?: string; sent?: string; severity?: string; description?: string };
    }>;
  };
  return (json.features ?? []).map((f) => {
    const p = f.properties;
    const sev = (p.severity ?? "").toLowerCase();
    return {
      id: `nws-tsunami-${f.id}`,
      title: p.headline || p.event || "Tsunami Alert",
      type: "tsunami",
      severity: sev === "extreme" || sev === "severe" ? "high" : "medium",
      source: "NWS",
      publishedAt: p.sent ?? new Date().toISOString(),
      description: p.description ?? null,
      countries: p.areaDesc ? [p.areaDesc] : [],
      url: "https://www.tsunami.gov/",
    };
  });
}


// ── NASA EONET ────────────────────────────────────────────────────────────────
const EONET_CATEGORY_MAP: Record<string, string> = {
  wildfires: "wildfire",
  severeStorms: "storm",
  floods: "flood",
  drought: "drought",
  volcanoes: "volcano",
  earthquakes: "earthquake",
  seaLakeIce: "other",
  landslides: "other",
  dustHaze: "other",
  tempExtremes: "other",
  snow: "other",
};

type EonetEvent = {
  id: string;
  title: string;
  link?: string;
  categories?: Array<{ id: string; title: string }>;
  sources?: Array<{ id: string; url: string }>;
  geometry?: Array<{ date?: string }>;
};

function mapEonetEvent(e: EonetEvent): unknown {
  const catId = e.categories?.[0]?.id ?? "";
  const type = EONET_CATEGORY_MAP[catId] ?? classifyType(e.title);
  const geos = e.geometry ?? [];
  const latest = geos.length > 0 ? geos[geos.length - 1] : undefined;
  const url = e.sources?.[0]?.url ?? e.link ?? null;
  return {
    id: `eonet-${e.id}`,
    title: e.title,
    type,
    severity: type === "wildfire" || type === "storm" || type === "volcano" ? "high" : "medium",
    source: "NASA EONET",
    publishedAt: latest?.date ?? new Date().toISOString(),
    description: (e.categories ?? []).map((c) => c.title).join(", ") || null,
    countries: [],
    url,
  };
}

// Single request: recent events across all categories, open + recently closed.
// Three separate calls were rate-limited (503) by EONET's per-IP window.
async function fetchEonet(): Promise<unknown[]> {
  const resp = await fetch(
    `https://eonet.gsfc.nasa.gov/api/v3/events?days=30&limit=50`,
    {
      signal: withTimeout(FETCH_TIMEOUT_MS),
      headers: { Accept: "application/json", "User-Agent": "SuiKa-App/1.0 (burnout-recovery-companion)" },
    },
  );
  if (!resp.ok) throw new Error(`EONET HTTP ${resp.status}`);
  const json = await resp.json() as { events?: EonetEvent[] };
  return (json.events ?? []).map(mapEonetEvent);
}

// ── USGS Earthquakes ──────────────────────────────────────────────────────────
async function fetchUsgs(): Promise<unknown[]> {
  const resp = await fetch(
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson",
    { signal: withTimeout(FETCH_TIMEOUT_MS) },
  );
  const json = await resp.json() as {
    features?: Array<{
      id: string;
      properties: { mag?: number; place?: string; time?: number; url?: string; title?: string; alert?: string };
    }>;
  };
  return (json.features ?? []).map((f) => {
    const p = f.properties;
    const mag = p.mag;
    const place = p.place ?? "Unknown location";
    const alert = (p.alert ?? "").toLowerCase();
    let severity = "medium";
    if (alert === "red" || alert === "orange") severity = "high";
    else if (alert === "green") severity = "low";
    else if (mag !== undefined && mag >= 7.0) severity = "high";
    return {
      id: `usgs-${f.id}`,
      title: p.title ?? (mag ? `M ${mag} — ${place}` : place),
      type: "earthquake",
      severity,
      source: "USGS",
      publishedAt: p.time ? new Date(p.time).toISOString() : new Date().toISOString(),
      description: mag ? `Magnitude ${mag} — ${place}` : place,
      countries: [],
      url: p.url ?? null,
    };
  });
}

// ── WHO Disease Outbreaks ─────────────────────────────────────────────────────
async function fetchWho(): Promise<unknown[]> {
  const resp = await fetch(
    "https://www.who.int/api/news/diseaseoutbreaknews?$orderby=PublicationDateAndTime%20desc&$top=10",
    {
      signal: withTimeout(FETCH_TIMEOUT_MS),
      headers: { Accept: "application/json", "User-Agent": "SuiKa-App/1.0 (burnout-recovery-companion)" },
    },
  );
  const json = await resp.json() as {
    value?: Array<{ Id: string; Title?: string; PublicationDateAndTime?: string; ItemDefaultUrl?: string }>;
  };
  return (json.value ?? []).map((d) => ({
    id: `who-${d.Id}`,
    title: d.Title ?? "Disease Outbreak News",
    type: "epidemic",
    severity: "medium",
    source: "WHO",
    publishedAt: d.PublicationDateAndTime ?? new Date().toISOString(),
    description: null,
    countries: [],
    url: d.ItemDefaultUrl
      ? `https://www.who.int/emergencies/disease-outbreak-news/item${d.ItemDefaultUrl}`
      : null,
  }));
}

// ── Copernicus EMS Rapid Mapping ─────────────────────────────────────────────
const COPERNICUS_CATEGORY_MAP: Record<string, string> = {
  Wildfire: "wildfire",
  Flood: "flood",
  Storm: "storm",
  "Tropical Cyclone": "storm",
  Earthquake: "earthquake",
  Volcano: "volcano",
  Drought: "drought",
  "Man-made accidents": "other",
  "Man-made accidents technological disasters": "other",
};

type CopernicusActivation = {
  code: string;
  name: string;
  countries?: string[];
  category?: string;
  eventTime?: string;
  activationTime?: string;
  lastUpdate?: string;
  closed?: boolean;
};

async function fetchCopernicusEms(): Promise<unknown[]> {
  const resp = await fetch(
    "https://rapidmapping.emergency.copernicus.eu/backend/dashboard-api/public-activations-info/?limit=30",
    {
      signal: withTimeout(FETCH_TIMEOUT_MS),
      headers: { Accept: "application/json", "User-Agent": "SuiKa-App/1.0 (burnout-recovery-companion)" },
    },
  );
  if (!resp.ok) throw new Error(`Copernicus EMS HTTP ${resp.status}`);
  const json = await resp.json() as { results?: CopernicusActivation[] };
  return (json.results ?? []).map((a) => {
    const type = COPERNICUS_CATEGORY_MAP[a.category ?? ""] ?? classifyType(a.name ?? a.category ?? "");
    return {
      id: `copernicus-ems-${a.code}`,
      title: a.name || `Copernicus EMS Activation ${a.code}`,
      type,
      severity: a.closed ? "low" : "medium",
      source: "Copernicus EMS",
      publishedAt: a.activationTime ?? a.eventTime ?? a.lastUpdate ?? new Date().toISOString(),
      description: a.category ? `${a.category} activation${a.closed ? " (closed)" : ""}` : null,
      countries: a.countries ?? [],
      url: `https://mapping.emergency.copernicus.eu/activations/${a.code}`,
    };
  });
}

// ── Route ─────────────────────────────────────────────────────────────────────
router.get("/earth-feeds", async (req, res): Promise<void> => {
  const now = Date.now();
  if (aggregateCache && now - aggregateCache.fetchedAt < CACHE_TTL_MS) {
    res.json(aggregateCache);
    return;
  }

  // All sources in parallel — EONET is now a single request (was 3; multiple concurrent caused 503 rate-limiting)
  const [usgsR, nwsFloodsR, nwsStormsR, nwsTsunamiR, whoR, eonetR, copernicusR] = await Promise.all([
    fetchWithFallback("USGS", fetchUsgs),
    fetchWithFallback("NWS Floods", fetchNwsFloods),
    fetchWithFallback("NWS Storms", fetchNwsStorms),
    fetchWithFallback("NWS Tsunami", fetchTsunami),
    fetchWithFallback("WHO", fetchWho),
    fetchWithFallback("NASA EONET", fetchEonet),
    fetchWithFallback("Copernicus EMS", fetchCopernicusEms),
  ]);

  const results = [usgsR, nwsFloodsR, nwsStormsR, nwsTsunamiR, whoR, eonetR, copernicusR];

  const events = results
    .flatMap((r) => r.items)
    .sort(
      (a, b) =>
        new Date((b as { publishedAt: string }).publishedAt).getTime() -
        new Date((a as { publishedAt: string }).publishedAt).getTime(),
    );

  const sources = results.map((r) => r.status);

  aggregateCache = { events, sources, fetchedAt: now };
  res.json(aggregateCache);
});

export default router;
