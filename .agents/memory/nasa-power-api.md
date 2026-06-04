---
name: NASA POWER API
description: How to correctly call NASA POWER for temperature and precipitation data from the Replit server
---

## Rule
- The monthly endpoint (`/api/temporal/monthly/point`) returns HTTP 422 from the Replit server regardless of date format tried. Do not use it.
- Use the **daily endpoint** (`/api/temporal/daily/point`) with `YYYYMMDD` start/end dates, `community=AG`, `format=JSON`.
- Compute monthly mean (T2M) and monthly sum (PRECTOTCORR) manually from the daily values.
- Filter out fill values (`-999`) before computing mean/sum.
- For anomaly: fetch same date range from 5 years prior in parallel; compute diff.
- The climatology endpoint (`/api/climatology/point`) returns HTML 404 from the server.

**Why:** NASA POWER monthly API consistently returns 422 "incorrect date format" regardless of YYYYMM/YYYYMMDD format tried. Daily endpoint is reliable and returns `geometry.coordinates` for exact grid location.

**How to apply:**
- In `local-env.ts`: `fetchPower()` fetches two 30-day windows (current + 5yr prior) in parallel.
- Cache POWER results for 6 hours (data changes very slowly).
- Example working URL: `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,PRECTOTCORR&community=AG&longitude=X&latitude=Y&start=YYYYMMDD&end=YYYYMMDD&format=JSON`
