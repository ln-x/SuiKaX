# SuiKa — World4You Deployment Guide

Deploy the full SuiKa app (React frontend + PHP/MySQL backend) to a World4You shared hosting plan.

---

## Prerequisites

- World4You hosting account with:
  - A domain / subdomain
  - FTP/SFTP access or File Manager
  - MySQL database (create one in the World4You control panel)
  - PHP 8.1+

---

## Step 1 — Create the MySQL database

1. Log into your World4You control panel
2. Go to **Databases → MySQL**
3. Create a new database and note:
   - **Host** (usually `localhost`)
   - **Database name** (e.g. `w4y12345_suika`)
   - **Username** (e.g. `w4y12345`)
   - **Password**

---

## Step 2 — Import the schema

1. Open **phpMyAdmin** from the control panel
2. Select your new database
3. Click **Import** → choose `php-backend/schema.sql`
4. Click **Go**

All 9 tables will be created.

---

## Step 3 — Configure the PHP backend

Edit `php-backend/api/config.php` and fill in your credentials:

```php
define('DB_HOST', 'localhost');
define('DB_NAME', 'w4y12345_suika');     // your database name
define('DB_USER', 'w4y12345');           // your database user
define('DB_PASS', 'your-password-here'); // your database password

define('SESSION_SECRET', 'replace-with-a-long-random-string-at-least-32-chars');

define('CORS_ORIGIN', 'https://yourdomain.com'); // your actual domain
```

**Security note:** `config.php` contains credentials — keep it private and never commit it to version control. Add it to `.gitignore`.

---

## Step 4 — Build the frontend

From the Replit workspace, run:

```bash
# Build with your production domain as the API base (same domain = no extra config needed)
pnpm --filter @workspace/suika run build
```

The built files will be at `artifacts/suika/dist/public/`.

If your frontend domain differs from your API domain (unusual), create `artifacts/suika/.env.production`:

```
VITE_API_BASE_URL=https://api.yourdomain.com
```

Then rebuild.

---

## Step 5 — Upload files via FTP

Connect to your World4You server via FTP (FileZilla, Cyberduck, or the control panel file manager).

Upload the following to your **web root** (usually `public_html/` or the folder assigned to your domain):

```
Upload these from php-backend/:
  .htaccess           → /                 (web root)
  api/                → /api/             (entire folder, with all PHP files)

Upload these from artifacts/suika/dist/public/:
  index.html          → /
  assets/             → /assets/
  (any other files)   → /
```

The final structure on the server should look like:

```
public_html/
├── .htaccess
├── index.html
├── assets/
│   ├── index-[hash].js
│   └── index-[hash].css
└── api/
    ├── config.php
    ├── bootstrap.php
    ├── healthz.php
    ├── health-logs.php
    ├── sessions.php
    ├── sessions-item.php
    ├── presets.php
    ├── presets-item.php
    ├── categories.php
    ├── categories-item.php
    ├── stress-factors.php
    ├── stress-factors-item.php
    ├── regulation-strategies.php
    ├── regulation-strategies-item.php
    ├── regulation-log.php
    ├── environment-snapshots.php
    ├── earth-feeds.php
    ├── my-data.php
    ├── my-data-item.php
    ├── auth/
    │   ├── register.php
    │   ├── login.php
    │   ├── logout.php
    │   ├── me.php
    │   └── account.php
    ├── user/
    │   └── location.php
    └── insights/
        └── stats.php
```

---

## Step 6 — Verify the deployment

Open your browser and test:

| URL | Expected response |
|-----|-------------------|
| `https://yourdomain.com/` | React app loads |
| `https://yourdomain.com/api/healthz` | `{"status":"ok"}` |
| `https://yourdomain.com/api/auth/me` | `{"error":"Not authenticated"}` |

If healthz returns a PHP error, check that `config.php` has the correct credentials and that the database tables were imported.

---

## Troubleshooting

**Blank page / 404 on the React app**
- Make sure `.htaccess` is in the web root alongside `index.html`
- Ensure World4You has `mod_rewrite` enabled (it is by default on most plans)

**PHP errors on `/api/` routes**
- Verify PHP 8.1+ is selected in the control panel
- Check `config.php` credentials
- Look at the PHP error log in the control panel

**Session not persisting (login lost on refresh)**
- Ensure cookies are not blocked by the browser
- Verify your domain uses HTTPS (required for `secure` cookie flag)

**Earth feeds returning empty**
- PHP needs `allow_url_fopen = On` to fetch external URLs (enabled by default on World4You)
- Verify the `sys_get_temp_dir()` path is writable (it is on most shared hosting)

**CORS errors in browser console**
- Double-check `CORS_ORIGIN` in `config.php` matches your exact domain (including `https://`)

---

## Updating the app

1. Make changes in Replit
2. Rebuild: `pnpm --filter @workspace/suika run build`
3. FTP-upload only the changed PHP files from `php-backend/api/` and/or the rebuilt `dist/public/` files
4. The database schema only needs to be re-imported if new tables are added
