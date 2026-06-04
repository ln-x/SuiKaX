import { Router } from "express";
import { createHash } from "node:crypto";
import { requireAuth } from "../lib/auth";
import { logger } from "../lib/logger";

const router = Router();

let cache: { data: unknown[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000;

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

// ── NWS Flood Alerts ─────────────────────────────────────────────────────────
async function fetchNwsFloods(): Promise<unknown[]> {
  try {
    const resp = await fetch(
      "https://api.weather.gov/alerts/active?event=Flood%20Warning,Flash%20Flood%20Warning,Flood%20Watch",
      {
        headers: {
          Accept: "application/geo+json",
          "User-Agent": "SuiKa-App/1.0 (burnout-recovery-companion)",
        },
      },
    );
    const json = await resp.json() as {
      features?: Array<{
        id: string;
        properties: {
          event?: string;
          headline?: string;
          areaDesc?: string;
          sent?: string;
          severity?: string;
          description?: string;
        };
      }>;
    };
    return (json.features ?? []).map((f) => {
      const p = f.properties;
      const sev = (p.severity ?? "").toLowerCase();
      const severity = sev === "extreme" || sev === "severe" ? "high" : "medium";
      return {
        id: `nws-flood-${f.id}`,
        title: p.headline || p.event || "Flood Alert",
        type: "flood",
        severity,
        source: "NWS",
        publishedAt: p.sent ?? new Date().toISOString(),
        description: p.description ?? null,
        countries: p.areaDesc ? [p.areaDesc] : [],
        url: "https://www.weather.gov/alerts",
      };
    });
  } catch (err) {
    logger.warn({ err }, "Failed to fetch NWS flood alerts");
    return [];
  }
}

// ── NWS Severe Weather Alerts ────────────────────────────────────────────────
async function fetchNwsStorms(): Promise<unknown[]> {
  try {
    const resp = await fetch(
      "https://api.weather.gov/alerts/active?event=Severe%20Thunderstorm%20Warning,Severe%20Thunderstorm%20Watch,Tornado%20Warning,Tornado%20Watch",
      {
        headers: {
          Accept: "application/geo+json",
          "User-Agent": "SuiKa-App/1.0 (burnout-recovery-companion)",
        },
      },
    );
    const json = await resp.json() as {
      features?: Array<{
        id: string;
        properties: {
          event?: string;
          headline?: string;
          areaDesc?: string;
          sent?: string;
          severity?: string;
          description?: string;
        };
      }>;
    };
    return (json.features ?? []).map((f) => {
      const p = f.properties;
      const sev = (p.severity ?? "").toLowerCase();
      const severity = sev === "extreme" || sev === "severe" ? "high" : "medium";
      return {
        id: `nws-storm-${f.id}`,
        title: p.headline || p.event || "Severe Weather Alert",
        type: "storm",
        severity,
        source: "NWS",
        publishedAt: p.sent ?? new Date().toISOString(),
        description: p.description ?? null,
        countries: p.areaDesc ? [p.areaDesc] : [],
        url: "https://www.weather.gov/alerts",
      };
    });
  } catch (err) {
    logger.warn({ err }, "Failed to fetch NWS severe weather alerts");
    return [];
  }
}

// ── Smithsonian GVP Weekly Volcanic Activity Report ─────────────────────────
async function fetchGvpVolcanoes(): Promise<unknown[]> {
  try {
    const resp = await fetch("https://volcano.si.edu/news/WeeklyVolcanoRSS.xml", {
      headers: {
        Accept: "application/rss+xml",
        "User-Agent": "SuiKa-App/1.0 (burnout-recovery-companion)",
      },
    });
    const ab = await resp.arrayBuffer();
    const text = new TextDecoder("latin1").decode(ab);
    const items: unknown[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(text)) !== null) {
      const content = match[1];
      const get = (tag: string) => {
        const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`).exec(content);
        return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : null;
      };
      const title = get("title") ?? "Unknown Volcano Activity";
      const pubDate = get("pubDate");
      const link = get("link");
      items.push({
        id: `gvp-${createHash("md5").update(link ?? title).digest("hex")}`,
        title,
        type: "volcano",
        severity: "high",
        source: "Smithsonian GVP",
        publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        description: get("description") || null,
        countries: [],
        url: link,
      });
    }
    return items;
  } catch (err) {
    logger.warn({ err }, "Failed to fetch GVP volcano report");
    return [];
  }
}

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

async function fetchEonetOpen(days: number, limit: number): Promise<unknown[]> {
  try {
    const resp = await fetch(
      `https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=${days}&limit=${limit}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "SuiKa-App/1.0 (burnout-recovery-companion)",
        },
      },
    );
    const json = await resp.json() as {
      events?: Array<{
        id: string;
        title: string;
        link?: string;
        categories?: Array<{ id: string; title: string }>;
        sources?: Array<{ id: string; url: string }>;
        geometry?: Array<{ date?: string }>;
      }>;
    };
    return (json.events ?? []).map((e) => {
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
    });
  } catch (err) {
    logger.warn({ err }, "Failed to fetch NASA EONET open events");
    return [];
  }
}

async function fetchEonetClosed(category: string, days: number, limit: number): Promise<unknown[]> {
  try {
    const resp = await fetch(
      `https://eonet.gsfc.nasa.gov/api/v3/events?category=${category}&status=closed&days=${days}&limit=${limit}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "SuiKa-App/1.0 (burnout-recovery-companion)",
        },
      },
    );
    const json = await resp.json() as {
      events?: Array<{
        id: string;
        title: string;
        link?: string;
        categories?: Array<{ id: string; title: string }>;
        sources?: Array<{ id: string; url: string }>;
        geometry?: Array<{ date?: string }>;
      }>;
    };
    return (json.events ?? []).map((e) => {
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
    });
  } catch (err) {
    logger.warn({ err }, "Failed to fetch NASA EONET closed events");
    return [];
  }
}

async function fetchUsgs(): Promise<unknown[]> {
  try {
    const resp = await fetch(
      "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson",
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
  } catch (err) {
    logger.warn({ err }, "Failed to fetch USGS earthquakes");
    return [];
  }
}

async function fetchWho(): Promise<unknown[]> {
  try {
    const resp = await fetch(
      "https://www.who.int/api/news/diseaseoutbreaknews?$orderby=PublicationDateAndTime%20desc&$top=10",
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "SuiKa-App/1.0 (burnout-recovery-companion)",
        },
      },
    );
    const json = await resp.json() as {
      value?: Array<{
        Id: string;
        Title?: string;
        PublicationDateAndTime?: string;
        ItemDefaultUrl?: string;
      }>;
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
  } catch (err) {
    logger.warn({ err }, "Failed to fetch WHO disease outbreak news");
    return [];
  }
}

async function fetchTsunami(): Promise<unknown[]> {
  try {
    const resp = await fetch(
      "https://api.weather.gov/alerts/active?code=TSW,TSA,TSY",
      {
        headers: {
          Accept: "application/geo+json",
          "User-Agent": "SuiKa-App/1.0 (burnout-recovery-companion)",
        },
      },
    );
    const json = await resp.json() as {
      features?: Array<{
        id: string;
        properties: {
          event?: string;
          headline?: string;
          areaDesc?: string;
          sent?: string;
          severity?: string;
          description?: string;
        };
      }>;
    };
    return (json.features ?? []).map((f) => {
      const p = f.properties;
      const sev = (p.severity ?? "").toLowerCase();
      const severity = sev === "extreme" || sev === "severe" ? "high" : "medium";
      return {
        id: `nws-${f.id}`,
        title: p.headline || p.event || "Tsunami Alert",
        type: "tsunami",
        severity,
        source: "NWS",
        publishedAt: p.sent ?? new Date().toISOString(),
        description: p.description ?? null,
        countries: p.areaDesc ? [p.areaDesc] : [],
        url: "https://www.tsunami.gov/",
      };
    });
  } catch (err) {
    logger.warn({ err }, "Failed to fetch NWS tsunami alerts");
    return [];
  }
}

router.get("/earth-feeds", requireAuth, async (req, res): Promise<void> => {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    res.json(cache.data);
    return;
  }
  const [usgs, nwsFloods, nwsStorms, gvp, eonetOpen, eonetClosedFloods, eonetClosedStorms, who, tsunami] =
    await Promise.all([
      fetchUsgs(),
      fetchNwsFloods(),
      fetchNwsStorms(),
      fetchGvpVolcanoes(),
      fetchEonetOpen(30, 30),
      fetchEonetClosed("floods", 730, 20),
      fetchEonetClosed("severeStorms", 360, 15),
      fetchWho(),
      fetchTsunami(),
    ]);
  const combined = [
    ...usgs,
    ...nwsFloods,
    ...nwsStorms,
    ...gvp,
    ...eonetOpen,
    ...eonetClosedFloods,
    ...eonetClosedStorms,
    ...who,
    ...tsunami,
  ].sort(
    (a, b) =>
      new Date((b as { publishedAt: string }).publishedAt).getTime() -
      new Date((a as { publishedAt: string }).publishedAt).getTime(),
  );
  cache = { data: combined, fetchedAt: now };
  res.json(combined);
});

export default router;
