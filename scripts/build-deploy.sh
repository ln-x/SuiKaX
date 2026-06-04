#!/usr/bin/env bash
# scripts/build-deploy.sh
# Builds the SuiKa frontend and packages everything needed for World4You upload
# into a single suika-deploy.zip.
#
# Usage (from the repo root):
#   bash scripts/build-deploy.sh
#
# The resulting suika-deploy.zip can be unzipped directly into your
# World4You public_html directory.
#
# Before uploading, edit api/config.php inside the ZIP with your
# MySQL credentials and session secret.  See php-backend/README-deploy.md
# for full deployment instructions.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$REPO_ROOT/artifacts/suika/dist/public"
PHP_API_DIR="$REPO_ROOT/php-backend/api"
HTACCESS="$REPO_ROOT/php-backend/.htaccess"
SCHEMA_SQL="$REPO_ROOT/php-backend/schema.sql"
STAGING_DIR="$REPO_ROOT/.deploy-staging"
OUT_ZIP="$REPO_ROOT/suika-deploy.zip"

echo "==> Building SuiKa frontend (production)..."
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/suika run build

echo ""
echo "==> Staging deployment files..."
rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR/api"
mkdir -p "$STAGING_DIR/_setup"

# React app output
cp -r "$DIST_DIR"/. "$STAGING_DIR/"

# PHP backend
cp -r "$PHP_API_DIR"/. "$STAGING_DIR/api/"

# .htaccess (SPA fallback + API routing)
cp "$HTACCESS" "$STAGING_DIR/.htaccess"

# Database schema (web-inaccessible; protected by _setup/.htaccess)
cp "$SCHEMA_SQL" "$STAGING_DIR/_setup/schema.sql"
printf 'Order deny,allow\nDeny from all\n' > "$STAGING_DIR/_setup/.htaccess"

echo ""
echo "==> Creating $OUT_ZIP..."
rm -f "$OUT_ZIP"
python3 - "$STAGING_DIR" "$OUT_ZIP" <<'PYEOF'
import sys, os, zipfile, pathlib

staging = pathlib.Path(sys.argv[1]).resolve()
out_zip = sys.argv[2]

SKIP = {".DS_Store"}

with zipfile.ZipFile(out_zip, "w", compression=zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk(staging):
        dirs[:] = [d for d in dirs if d not in {"__MACOSX"}]
        for fname in files:
            if fname in SKIP:
                continue
            full = pathlib.Path(root) / fname
            arcname = full.relative_to(staging)
            zf.write(full, arcname)
PYEOF

# Clean up staging area
rm -rf "$STAGING_DIR"

echo ""
echo "✓ Done! suika-deploy.zip is ready."
echo ""
echo "Next steps:"
echo "  1. Open suika-deploy.zip and edit api/config.php with your DB credentials."
echo "  2. Import _setup/schema.sql into your MySQL database via phpMyAdmin."
echo "  3. Upload the ZIP contents into your World4You public_html folder via FTP."
echo "  4. Visit https://yourdomain.com/api/healthz to verify the backend is live."
echo ""
echo "Note: _setup/schema.sql is protected by its own .htaccess — it cannot be"
echo "      accessed over HTTP once uploaded."
echo ""
echo "See php-backend/README-deploy.md for the full deployment guide."
