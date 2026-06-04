import { Router } from "express";
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

async function fetchReliefWeb(): Promise<unknown[]> {
  try {
    const resp = await fetch(
      "https://api.reliefweb.int/v1/disasters?appname=suika-app&limit=10&fields[include][]=name&fields[include][]=status&fields[include][]=date&fields[include][]=country&fields[include][]=url_alias",
    );
    const json = await resp.json() as { data?: Array<{ id: number; fields: { name?: string; status?: string; date?: { created?: string }; country?: Array<{ name?: string }>; url_alias?: string } }> };
    return (json.data ?? []).map((item) => ({
      id: `rw-${item.id}`,
      title: item.fields.name ?? "Unknown Event",
      type: classifyType(item.fields.name ?? ""),
      severity: item.fields.status === "alert" ? "high" : "medium",
      source: "ReliefWeb",
      publishedAt: item.fields.date?.created ?? new Date().toISOString(),
      description: null,
      countries: (item.fields.country ?? []).map((c) => c.name ?? "").filter(Boolean),
      url: item.fields.url_alias ? `https://reliefweb.int${item.fields.url_alias}` : null,
    }));
  } catch (err) {
    logger.warn({ err }, "Failed to fetch ReliefWeb events");
    return [];
  }
}

async function fetchGdacs(): Promise<unknown[]> {
  try {
    const resp = await fetch("https://www.gdacs.org/xml/rss_7days.xml");
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
        id: `gdacs-${link ?? Math.random()}`,
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
  const [reliefWeb, gdacs, usgs] = await Promise.all([fetchReliefWeb(), fetchGdacs(), fetchUsgs()]);
  const combined = [...gdacs, ...usgs, ...reliefWeb].sort(
    (a, b) =>
      new Date((b as { publishedAt: string }).publishedAt).getTime() -
      new Date((a as { publishedAt: string }).publishedAt).getTime(),
  );
  cache = { data: combined, fetchedAt: now };
  res.json(combined);
});

export default router;
