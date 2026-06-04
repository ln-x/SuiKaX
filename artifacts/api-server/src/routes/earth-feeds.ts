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

async function fetchGdacs(): Promise<unknown[]> {
  try {
    const resp = await fetch("https://www.gdacs.org/xml/rss.xml", {
      headers: { "User-Agent": "SuiKa-App/1.0 (burnout-recovery-companion)" },
    });
    const text = await resp.text();
    const items: unknown[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(text)) !== null) {
      const content = match[1];
      const get = (tag: string) => {
        const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`).exec(content);
        return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : null;
      };
      const title = get("title") ?? "Unknown Event";
      const pubDate = get("pubDate");
      const link = get("link");
      const alertLevel = get("gdacs:alertlevel")?.toLowerCase() ?? "";
      let severity = "medium";
      if (alertLevel.includes("red") || alertLevel.includes("orange")) severity = "high";
      else if (alertLevel.includes("green")) severity = "low";
      items.push({
        id: `gdacs-${createHash("md5").update(link ?? title).digest("hex")}`,
        title,
        type: classifyType(title),
        severity,
        source: "GDACS",
        publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        description: get("description"),
        countries: [],
        url: link,
      });
    }
    return items;
  } catch (err) {
    logger.warn({ err }, "Failed to fetch GDACS feed");
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

async function fetchEonet(): Promise<unknown[]> {
  try {
    const resp = await fetch(
      "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=360&limit=30",
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
    logger.warn({ err }, "Failed to fetch NASA EONET events");
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

router.get("/earth-feeds", requireAuth, async (req, res): Promise<void> => {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    res.json(cache.data);
    return;
  }
  const [gdacs, usgs, eonet] = await Promise.all([
    fetchGdacs(),
    fetchUsgs(),
    fetchEonet(),
  ]);
  const combined = [...gdacs, ...usgs, ...eonet].sort(
    (a, b) =>
      new Date((b as { publishedAt: string }).publishedAt).getTime() -
      new Date((a as { publishedAt: string }).publishedAt).getTime(),
  );
  cache = { data: combined, fetchedAt: now };
  res.json(combined);
});

export default router;
