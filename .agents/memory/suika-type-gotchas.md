---
name: SuiKa generated schema type gotchas
description: Actual generated schema field names differ from intuitive names — always grep api.schemas.ts before using a type
---

Key field names that differ from what you'd expect:

| Type | Wrong assumption | Actual field |
|------|-----------------|--------------|
| User | lat, lon, city, country | defaultLat, defaultLon, defaultLocationName |
| HealthLog | mood, energy | physicalPain, mentalPain, soulState |
| TimerSession | durationSec, completed, startedAt | duration, completedAt (string) |
| EnvironmentSnapshot | tempC, aqiLabel, uvIndex, tcmMeridians | feelsLikeTemp, aqi (number), pollenLevel, humidity |
| StressFactor | name | label |
| RegulationStrategy | name, description, category | label, channel |
| InsightStats | avgMood, avgEnergy, sessionCount | totalSessions, totalTimeSeconds, topBodyRegions[], topStressors[], topStrategies[] |

**Why:** The OpenAPI spec was written with domain-specific naming, not conventional naming.

**How to apply:** Before writing any component that uses generated types, grep `api.schemas.ts` for the actual interface fields. Don't assume field names.
