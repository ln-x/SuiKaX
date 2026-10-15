<div align="center">

<img src="web/public/icon-192.png" alt="SuiKa logo" width="96" />

# SuiKa

**A minimalist burnout recovery companion — connecting personal health with planetary health.**

[Live app](https://suika.ybermorgen.org) · [Deployment guide](DEPLOYMENT.md) · [Database schema](schema.sql)

![React](https://img.shields.io/badge/React-19-000000?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7-000000?logo=vite&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-000000?logo=typescript&logoColor=white)
![PHP](https://img.shields.io/badge/PHP-API-000000?logo=php&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-database-000000?logo=mysql&logoColor=white)

</div>

---

## About

SuiKa helps people recovering from burnout to track restorative practice, log how body and mind feel, and discover patterns over time. What makes it different: personal well‑being is read **in context** — alongside local environmental conditions (air quality, pollen, pressure, daylight, temperature) and global indicators of planetary health such as NASA EPIC imagery of the Earth.

The interface follows a deliberately **"brutally minimal" dark aesthetic** to keep cognitive load as low as possible for people who are already depleted. The underlying philosophy treats well‑being as physical, emotional, mental and spiritual — and acknowledges the Earth as a living system we are part of.

## Features

The app is organised into five tabs:

| Tab | Purpose |
|---|---|
| 🌍 **Earth** | Planetary health & ecosystem voices — daily NASA EPIC images, NASA GIBS satellite layers and global indicators (e.g. armed‑conflict deaths, land sealing). |
| 🌳 **Local** | Your environment right now — air quality (European AQI), pollen, apparent temperature / wind chill, humidity ("sultriness"), daylight hours and atmospheric pressure for your location. |
| ▶️ **Action** | Timer & stopwatch for meditation, tai chi, cardio, rest and voice + sound. Custom activity categories with colour picker, presets and session history with reflection notes. |
| ❤️ **Health** | Daily check‑in: interactive **TCM body map** for physical pain, mental strain, a **"Soul" slider** (contracted / fear ↔ expanded / love), stress‑factor chips and regulation strategies grouped by sensory channel. |
| 📊 **Insights** | Correlations between health and environment, trend detection, top stressors and body patterns, a multi‑factor **timeline** (exportable as PNG) and an interactive **Systems Map** with feedback loops. |

**Further highlights**

- **Environment strain score** — a composite 0–10 score combining a rolling 7‑day deviation model with fixed thresholds for universally stressful conditions (see `web/src/lib/envStrain.ts`).
- **Automatic environment snapshots** — each health log stores the current local conditions for later correlation.
- **Environment alerts** — colour‑coded banners on the home screen (e.g. poor air quality).
- **Robust timer** — timestamp‑based, so it keeps correct time through tab throttling, screen lock and app switching.
- **Evidence‑informed explanations** — collapsible sections referencing Polyvagal Theory, IFS, HeartMath, Focusing / Felt Sense, Somatic Experiencing, Gate Control Theory and systems thinking (Meadows, McEwen et al.).
- **Data ownership** — "My Account" lets users browse, inspect and delete individual entries, or delete their account with all associated data.
- **Installable web app** — PWA manifest and icons included.

## Tech stack

| Layer | Technology |
|---|---|
| Web frontend | React 19, Vite 7, TypeScript, `lucide-react`, plain CSS with CSS variables |
| Backend / API | PHP REST endpoints (`api/`), session‑based authentication |
| Database | MySQL (schema in `schema.sql`) |
| Hosting | World4You shared hosting (Apache, `mod_rewrite`) |
| External data | NASA EPIC & GIBS, Open‑Meteo (forecast + air quality / CAMS), OpenStreetMap Nominatim, UCDP, EEA/Copernicus |
| Legacy (Replit) | Expo / React Native mobile client (`client/`), Express + Drizzle ORM + PostgreSQL server (`server/`, `shared/`) |

> Environmental data is fetched **directly from the browser** — no API proxy is required on the server.

## Project structure

```text
.
├── web/                  # Web app (React + Vite) — the production frontend
│   ├── src/
│   │   ├── tabs/         # EarthTab, LocalTab, ActionTab, HealthTab, InsightsTab
│   │   ├── components/   # BodyMap, SystemsMap
│   │   └── lib/          # api.ts, envClient.ts, envStrain.ts, storage.ts, staticData.ts
│   ├── public/           # Icons, body outline, PWA manifest
│   └── vite.config.ts
├── api/                  # PHP REST API (auth, sessions, health logs, snapshots, …)
├── schema.sql            # MySQL schema
├── migrate/              # One‑off migration Replit/PostgreSQL → MySQL
├── client/               # Legacy Expo / React Native app
├── server/ · shared/     # Legacy Express server and Drizzle schema
├── DEPLOYMENT.md         # Step‑by‑step hosting guide
└── .env.example          # Environment variables template
```

## Getting started

### Prerequisites

- Node.js 20+ and npm
- PHP 8+ with PDO MySQL
- MySQL / MariaDB
- For clean API URLs (e.g. `/api/presets/123`): Apache with `mod_rewrite` (e.g. MAMP / XAMPP) or an equivalent setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure the environment

```bash
cp .env.example .env
```

Set the database credentials (`DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS`), `ADMIN_USERNAMES` and `CORS_ORIGINS`. In development `VITE_API_URL` points to the local PHP backend (default `http://localhost:5001/api`).

### 3. Create the database

```bash
mysql -u root -e "CREATE DATABASE suika CHARACTER SET utf8mb4"
mysql -u root suika < schema.sql
```

### 4. Run locally

Serve the project root with PHP/Apache on port **5001**, then start the frontend:

```bash
npx vite --config web/vite.config.ts
```

The app runs at <http://localhost:5000>; requests to `/api/*` are proxied to port 5001.

### 5. Build for production

```bash
npx vite build --config web/vite.config.ts
```

The production bundle is written to `web/dist/`.

## Deployment

SuiKa runs on shared hosting without a Node.js runtime:

1. Upload the contents of `web/dist/` to the web root.
2. Upload the `api/` folder to `www/api/`.
3. Create `api/db_config.php` with the database credentials (**never commit this file**).
4. Add the `.htaccess` rewrite rules for client‑side routing.

Full instructions, including data migration from PostgreSQL, are in **[DEPLOYMENT.md](DEPLOYMENT.md)**.

## Security & privacy

- Passwords are stored as bcrypt hashes; authentication is session‑based.
- All records are scoped to the logged‑in user (`user_id`).
- Users can view and delete their own data at any time, including full account deletion.
- Credentials live only in `api/db_config.php` / `.env` on the server — not in the repository.
- After a migration, delete `migrate/import-to-mysql.php` and any backup JSON from the server immediately.

## Data sources & acknowledgements

- [NASA EPIC](https://epic.gsfc.nasa.gov/) and [NASA GIBS](https://earthdata.nasa.gov/gibs) — Earth imagery
- [Open‑Meteo](https://open-meteo.com/) — weather, pollen and air quality (Copernicus CAMS)
- [OpenStreetMap Nominatim](https://nominatim.openstreetmap.org/) — reverse geocoding
- [UCDP](https://ucdp.uu.se/) — Uppsala Conflict Data Program
- [EEA / Copernicus Land Monitoring](https://land.copernicus.eu/) — sealed surfaces

## Disclaimer

SuiKa is a self‑reflection tool and **not a medical device**. It does not provide diagnoses or replace professional medical or psychological care.

## License

© 2026 SuiKa. All rights reserved. <!-- Replace with your chosen license, e.g. MIT -->
