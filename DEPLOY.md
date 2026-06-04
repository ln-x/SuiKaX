# SuiKa — World4You Deployment

Quick reference for building and deploying SuiKa to World4You shared hosting.

---

## First-time setup (do this once)

### 1. Create a MySQL database on World4You

In the World4You control panel → **Databases → MySQL**, create a new database.
Note down:
- Host (usually `localhost`)
- Database name (e.g. `w4y12345_suika`)
- Username
- Password

### 2. Import the schema

Open **phpMyAdmin** → select your database → **Import** → choose `php-backend/schema.sql` → click **Go**.

This creates all the tables. Only needed once (or when a new table is added).

### 3. Fill in your credentials

Open `php-backend/api/config.php` and replace the placeholders:

```php
define('DB_HOST', 'localhost');
define('DB_NAME', 'w4y12345_suika');
define('DB_PASS', 'your-password-here');
define('SESSION_SECRET', 'any-long-random-string-32-chars-min');
define('CORS_ORIGIN', 'https://yourdomain.com');
```

> ⚠️ Don't commit `config.php` to version control after adding real credentials.

---

## Build & package

Run this one command from the Replit shell:

```bash
bash scripts/build-deploy.sh
```

This builds the React app and packages everything into **`suika-deploy.zip`** at the repo root.

The ZIP is ready to upload — it contains:

```
.htaccess
index.html
assets/
api/
  config.php     ← edit this before uploading
  bootstrap.php
  healthz.php
  health-logs.php
  sessions.php
  presets.php
  categories.php
  stress-factors.php
  regulation-strategies.php
  regulation-log.php
  environment-snapshots.php
  earth-feeds.php
  my-data.php
  my-data-item.php
  sessions-item.php
  presets-item.php
  categories-item.php
  stress-factors-item.php
  regulation-strategies-item.php
  auth/
    register.php  login.php  logout.php  me.php  account.php
  user/
    location.php
  insights/
    stats.php
```

---

## Upload to World4You (via FTP)

Use FileZilla (or the World4You file manager) to connect to your server.

Unzip `suika-deploy.zip` and upload all contents into your domain's web root folder (usually `public_html/` or the folder assigned to your subdomain).

The result on the server should look like:

```
public_html/
├── .htaccess
├── index.html
├── assets/
└── api/
    ├── config.php
    └── ...
```

---

## Verify it's working

| URL | Expected |
|-----|----------|
| `https://yourdomain.com/` | React app loads |
| `https://yourdomain.com/api/healthz` | `{"status":"ok"}` |
| `https://yourdomain.com/api/auth/me` | `{"error":"Not authenticated"}` |

---

## Updating the app

| What changed | What to do |
|---|---|
| PHP file only | Re-upload just that one `.php` file via FTP — no rebuild needed |
| React frontend (any `src/` file) | Re-run `bash scripts/build-deploy.sh`, re-upload `index.html` + `assets/` |
| New database table | Run the new `ALTER TABLE` or `CREATE TABLE` SQL in phpMyAdmin |

---

## Troubleshooting

**Blank page or 404 on the React app**
Make sure `.htaccess` uploaded correctly and `mod_rewrite` is enabled (it is by default on World4You).

**PHP error on `/api/` routes**
Check that PHP 8.1+ is selected in the control panel and that `config.php` credentials are correct.

**Session lost on refresh (keeps logging out)**
The site must use HTTPS. The session cookie is marked `secure` and won't work over plain HTTP.

**Earth feeds return empty**
PHP needs `allow_url_fopen = On` to call external APIs — this is enabled by default on World4You.

---

*Full deployment notes: `php-backend/README-deploy.md`*
