---
name: Earth feeds network constraints
description: Which external APIs are blocked from the Replit server IP and the workarounds used in earth-feeds.ts
---

## Rule
- **Smithsonian GVP** (`volcano.si.edu`) returns HTTP 403 "Request Rejected" from Replit server IP — WAF block, permanent. Removed from source list entirely.
- **NASA EONET** rate-limits when 3+ concurrent requests hit the same IP within ~10s (returns HTTP 503). A single broader request works reliably.

## How to apply
- Keep EONET as ONE fetch: `GET /api/v3/events?days=30&limit=50` (no status/category filter). Returns wildfires, storms, floods, volcanoes, and other types in one call.
- Do NOT split EONET into parallel or sequential "open", "closed floods", "closed storms" calls — even serialized with 300ms gaps, 6 total requests (3 calls × 2 retries) reliably trigger 503.
- Do NOT add GVP back without testing first from a shell: `curl -I https://volcano.si.edu/news/WeeklyVolcanoRSS.xml`
- `fetchRetry` (1 retry, 800ms delay) is fine for NWS/USGS/WHO but should not be relied upon for EONET since the root cause is rate-limiting not transient failure.

**Why:** Discovered empirically — shell tests (Node.js) work fine, server process gets 503/403. Stale-cache (4hr TTL) handles intermittent failures gracefully after first successful fetch.
