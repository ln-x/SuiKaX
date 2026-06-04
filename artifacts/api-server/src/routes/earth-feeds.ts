import { Router } from "express";
import { requireAuth } from "../lib/auth";
import { logger } from "../lib/logger";

const router = Router();

let cache: { data: unknown[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function classifyReliefWebType(title: string): string {
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
    const items = json.data ?? [];
    return items.map((item) => ({
      id: `rw-${item.id}`,
      title: item.fields.name ?? "Unknown Event",
      type: classifyReliefWebType(item.fields.name ?? ""),
      severity: item.fields.status === "alert" ? "high" : "medium",
      source: "ReliefWeb",
      publishedAt: item.fields.date?.created ?? new Date().toISOString(),
      description: null,
      countries: (item.fields.country ?? []).map((c: { name?: string }) => c.name ?? "").filter(Boolean),
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
      const description = get("description");
      const pubDate = get("pubDate");
      const link = get("link");
      const alertLevel = get("gdacs:alertlevel")?.toLowerCase() ?? "";
      let severity = "medium";
      if (alertLevel.includes("red") || alertLevel.includes("orange")) severity = "high";
      else if (alertLevel.includes("green")) severity = "low";

      let type = "other";
      const t = title.toLowerCase();
      if (t.includes("earthquake")) type = "earthquake";
      else if (t.includes("flood")) type = "flood";
      else if (t.includes("storm") || t.includes("cyclone") || t.includes("typhoon")) type = "storm";
      else if (t.includes("volcano")) type = "volcano";
      else if (t.includes("drought")) type = "drought";
      else if (t.includes("wildfire") || t.includes("fire")) type = "wildfire";
      else if (t.includes("tsunami")) type = "tsunami";

      items.push({
        id: `gdacs-${link ?? Math.random()}`,
        title,
        type,
        severity,
        source: "GDACS",
        publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        description,
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

router.get("/earth-feeds", requireAuth, async (req, res): Promise<void> => {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    res.json(cache.data);
    return;
  }

  const [reliefWeb, gdacs] = await Promise.all([fetchReliefWeb(), fetchGdacs()]);
  const combined = [...gdacs, ...reliefWeb];
  cache = { data: combined, fetchedAt: now };
  res.json(combined);
});

export default router;
