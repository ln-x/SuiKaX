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
- **USGS**: `significant_week.geojson`. Earthquakes only.
- **NASA EONET v3**: `events?status=open&days=30`. Dominated by wildfires
  (often 70+); also severeStorms, volcanoes, seaLakeIce. **Has NO floods or
  drought** even with status=all/long windows. Cap the limit (~30) or wildfires
  swamp the default "all" view.

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
