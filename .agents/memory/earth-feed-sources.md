---
name: SuiKa earth-feed external sources
description: Which disaster/earth-event feeds work, which are broken, and what each covers
---

# SuiKa earth-event feed sources

Used by both `artifacts/api-server/src/routes/earth-feeds.ts` and the mirrored
`php-backend/api/earth-feeds.php`. Keep the two in sync.

## Working sources
- **GDACS**: `https://www.gdacs.org/xml/rss.xml` (RSS). Covers flood, drought,
  earthquake, storm/cyclone, volcano, tsunami. ~30 items. Send a User-Agent.
  Occasionally fails transiently with `ECONNRESET` — the per-source try/catch
  returning `[]` is what keeps the endpoint resilient.
- **USGS**: `significant_week.geojson`. Earthquakes only.
- **NASA EONET v3**: `events?status=open&days=30`. Dominated by wildfires
  (often 70+); also severeStorms, volcanoes, seaLakeIce. **Has NO floods or
  drought** even with status=all/long windows. Cap the limit (~30) or wildfires
  swamp the default "all" view.
- **WHO Disease Outbreak News** (epidemic): `https://www.who.int/api/news/diseaseoutbreaknews`
  OData JSON. Use `?$orderby=PublicationDateAndTime desc&$top=10` (URL-encode the
  space) — the **unsorted** default returns 2006-era items first. Fields: `Id`,
  `Title`, `PublicationDateAndTime`, `ItemDefaultUrl`. Full URL =
  `https://www.who.int/emergencies/disease-outbreak-news/item` + `ItemDefaultUrl`.
  **Force `type:"epidemic"`** — many titles ("Avian influenza – situation in X")
  lack the classifier's epidemic/outbreak/disease keywords. The old RSS
  `feeds/entity/csr/don/.../rss.xml` is dead (404 HTML), and `rss-feeds/news-english.xml`
  carries zero DON items — only the JSON API works.
- **NWS tsunami** (tsunami): `https://api.weather.gov/alerts/active?code=TSW,TSA,TSY`
  (Warning/Watch/Advisory). GeoJSON; **requires a User-Agent** or it 403s.
  US/Pacific-focused and almost always empty (returns clean `features:[]`, HTTP 200) —
  rely on the empty-state UI. Prefer this over tsunami.gov atom feeds, which spam
  non-threat "information statements".
- **Copernicus EMS Rapid Mapping** (wildfire/flood/storm/earthquake/volcano/drought/other):
  `https://rapidmapping.emergency.copernicus.eu/backend/dashboard-api/public-activations-info/?limit=30`
  — public, no auth, paginated JSON (`results[]` with `code`, `name`, `category`,
  `countries`, `activationTime`/`eventTime`/`lastUpdate`, `closed`). No RSS/ArcGIS
  endpoint actually exists publicly despite older docs suggesting otherwise —
  verify any guessed Copernicus URL with a live fetch before trusting it, since
  most guessed paths (`/mapping/...`, `/rss.xml`, ArcGIS MapServer) 404. Activation
  detail page: `https://mapping.emergency.copernicus.eu/activations/{code}`.

## Broken / unusable (do not re-add without fixing)
- GDACS `rss_7days.xml` — dead, now returns an HTML admin page, not RSS.
- ReliefWeb **v1** — decommissioned, HTTP 410.
- ReliefWeb **v2** — requires an *approved* appname (HTTP 403 otherwise);
  arbitrary appnames no longer work. Needs user to register at apidoc.reliefweb.int.

## EONET rate-limiting gotcha
EONET throttles by client IP under rapid/concurrent requests: it returns a
truncated body (no `events` key, HTTP 200) instead of erroring. A single call
works fine; hammering it (repeated curl/node tests + the server's own call)
makes EONET silently return 0 events with no thrown error. In production the
server caches 30 min and calls once, so this is a *testing artifact*, not a bug.
When verifying, do ONE clean call after a cooldown — don't conclude EONET is
broken from back-to-back tests. `json.events ?? []` already degrades gracefully.

## Category coverage strategy
GDACS provides flood/drought/earthquake/storm; EONET provides wildfire; USGS
adds earthquakes. Together every main filter pill (earthquake, flood, drought,
storm, volcano, wildfire) has live events. Epidemic/tsunami are rare and may be
empty — that is expected, not a bug.
