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

// ── EO-aware type classifier ──────────────────────────────────────────────────
// Like classifyType but falls back to "eo-news" instead of "other" — keeps
// editorial EO content distinct from true operational-alert "other" events.
function classifyEoType(title: string, desc: string): string {
  const t = (title + " " + desc).toLowerCase();
  if (t.includes("earthquake") || t.includes("seismic")) return "earthquake";
  if (t.includes("flood") || t.includes("flooding")) return "flood";
  if (t.includes("storm") || t.includes("cyclone") || t.includes("typhoon") || t.includes("hurricane")) return "storm";
  if (t.includes("volcano") || t.includes("volcanic")) return "volcano";
  if (t.includes("drought")) return "drought";
  if (t.includes("wildfire") || (t.includes("fire") && t.includes("forest"))) return "wildfire";
  if (t.includes("tsunami")) return "tsunami";
  if (t.includes("epidemic") || t.includes("outbreak") || t.includes("disease")) return "epidemic";
  return "eo-news";
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
//
// Icebergs (category "seaLakeIce") are long-lived but eventually get marked
// closed once they drift/melt/get archived — without a dedicated closed-events
// call, an iceberg disappears from the feed the moment EONET closes it, even
// though it's still a real, recent event worth surfacing (mirrors how floods
// and severeStorms already get their own closed-events call on the PHP side).
async function fetchEonet(): Promise<unknown[]> {
  const [openResp, closedIceResp] = await Promise.all([
    fetch(`https://eonet.gsfc.nasa.gov/api/v3/events?days=30&limit=50`, {
      signal: withTimeout(FETCH_TIMEOUT_MS),
      headers: { Accept: "application/json", "User-Agent": "SuiKa-App/1.0 (burnout-recovery-companion)" },
    }),
    fetch(
      `https://eonet.gsfc.nasa.gov/api/v3/events?category=seaLakeIce&status=closed&days=360&limit=15`,
      {
        signal: withTimeout(FETCH_TIMEOUT_MS),
        headers: { Accept: "application/json", "User-Agent": "SuiKa-App/1.0 (burnout-recovery-companion)" },
      },
    ),
  ]);
  if (!openResp.ok) throw new Error(`EONET HTTP ${openResp.status}`);
  const openJson = await openResp.json() as { events?: EonetEvent[] };
  const events = [...(openJson.events ?? [])];
  if (closedIceResp.ok) {
    const closedIceJson = await closedIceResp.json() as { events?: EonetEvent[] };
    events.push(...(closedIceJson.events ?? []));
  }
  return events.map(mapEonetEvent);
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

// ── ESA / Copernicus / NASA EO news feeds ─────────────────────────────────────
function extractRssImageUrl(content: string): string | null {
  // media:thumbnail url="..." (ESA, NASA EO feeds)
  const thumbMatch = /media:thumbnail[^>]+url=["']([^"']+)["']/i.exec(content);
  if (thumbMatch) return thumbMatch[1];
  // media:content url="..." medium="image" (some Copernicus feeds)
  const mediaContent = /media:content[^>]+url=["']([^"']+)["'][^>]+medium=["']image["']/i.exec(content)
    ?? /media:content[^>]+medium=["']image["'][^>]+url=["']([^"']+)["']/i.exec(content);
  if (mediaContent) return mediaContent[1];
  // <enclosure url="..." type="image/..."/>
  const enclosure = /enclosure[^>]+url=["']([^"']+)["'][^>]+type=["']image\//i.exec(content)
    ?? /enclosure[^>]+type=["']image\/[^"']*["'][^>]+url=["']([^"']+)["']/i.exec(content);
  if (enclosure) return enclosure[1];
  return null;
}

function parseEoRss(xml: string, sourceName: string): unknown[] {
  const items: unknown[] = [];
  const seen = new Set<string>();
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  const get = (content: string, tag: string): string | null => {
    const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(content);
    if (!m) return null;
    return m[1].replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, "").trim() || null;
  };
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const content = m[1];
    const title   = get(content, "title") ?? "EO News";
    const link    = get(content, "link") ?? get(content, "guid") ?? null;
    const pubDate = get(content, "pubDate") ?? null;
    const desc    = get(content, "description") ?? null;
    const key = link ?? title;
    if (seen.has(key)) continue;
    seen.add(key);
    const type = classifyEoType(title, desc ?? "");
    const shortDesc = desc ? desc.slice(0, 200) : null;
    const imageUrl = extractRssImageUrl(content);
    items.push({
      id:          `eo-${createHash("md5").update(key).digest("hex").slice(0, 10)}`,
      title,
      type,
      severity:    type !== "eo-news" ? "medium" : "low",
      source:      sourceName,
      publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      description: shortDesc,
      countries:   [],
      url:         link,
      imageUrl:    imageUrl ?? null,
    });
  }
  return items;
}

// Returns a fetcher function for a single EO RSS feed — one per source so each
// gets its own SourceStatus entry and stale-cache slot independently.
function makeEoFetcher(url: string, sourceName: string): () => Promise<unknown[]> {
  return async () => {
    const resp = await fetchRetry(
      url,
      {
        signal:  withTimeout(FETCH_TIMEOUT_MS),
        headers: { Accept: "application/rss+xml, application/xml, text/xml", "User-Agent": "SuiKa-App/1.0 (burnout-recovery-companion)" },
      },
      1,
    );
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return parseEoRss(await resp.text(), sourceName);
  };
}

// ── Route ─────────────────────────────────────────────────────────────────────
router.get("/earth-feeds", async (req, res): Promise<void> => {
  const now = Date.now();
  if (aggregateCache && now - aggregateCache.fetchedAt < CACHE_TTL_MS) {
    res.json(aggregateCache);
    return;
  }

  // All sources in parallel — EONET is now a single request (was 3; multiple concurrent caused 503 rate-limiting).
  // EO news feeds use makeEoFetcher so each has an independent SourceStatus and stale-cache slot.
  const [usgsR, nwsFloodsR, nwsStormsR, nwsTsunamiR, whoR, eonetR, copernicusR, eoEsaR, eoCopernicusR, eoNasaR, eoNasaHazardsR] = await Promise.all([
    fetchWithFallback("USGS", fetchUsgs),
    fetchWithFallback("NWS Floods", fetchNwsFloods),
    fetchWithFallback("NWS Storms", fetchNwsStorms),
    fetchWithFallback("NWS Tsunami", fetchTsunami),
    fetchWithFallback("WHO", fetchWho),
    fetchWithFallback("NASA EONET", fetchEonet),
    fetchWithFallback("Copernicus EMS", fetchCopernicusEms),
    fetchWithFallback("ESA", makeEoFetcher("https://www.esa.int/rssfeed/Our_Activities/Observing_the_Earth", "ESA")),
    fetchWithFallback("Copernicus News", makeEoFetcher("https://www.copernicus.eu/en/rss.xml", "Copernicus")),
    fetchWithFallback("NASA EO", makeEoFetcher("https://earthobservatory.nasa.gov/feeds/earth-observatory.rss", "NASA EO")),
    fetchWithFallback("NASA Hazards", makeEoFetcher("https://earthobservatory.nasa.gov/feeds/natural-hazards.rss", "NASA EO")),
  ]);

  const results = [usgsR, nwsFloodsR, nwsStormsR, nwsTsunamiR, whoR, eonetR, copernicusR, eoEsaR, eoCopernicusR, eoNasaR, eoNasaHazardsR];

  // Fix EO source counts: classifyEoType() promotes some articles to crisis types (flood,
  // wildfire, …). The source pill's count should reflect only items that stayed as "eo-news"
  // so it matches what the user sees when they click the EO News filter pill.
  for (const r of [eoEsaR, eoCopernicusR, eoNasaR, eoNasaHazardsR]) {
    if (r.status.status === "ok" || r.status.status === "stale") {
      r.status.count = r.items.filter(
        (e) => (e as { type: string }).type === "eo-news",
      ).length;
    }
  }

  // Deduplicate events by ID — NASA EO and NASA Hazards feeds can return overlapping articles
  const seen = new Set<string>();
  const events = results
    .flatMap((r) => r.items)
    .filter((e) => {
      const id = (e as { id: string }).id;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
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
