<?php
// ============================================================
// SuiKa — Database Configuration
// Fill in your World4You MySQL credentials and uncomment.
// ============================================================

define('DB_HOST', 'mysqlsvr88.world4you.com');
define('DB_NAME', '8699290db2');   // e.g. w4y12345_suika
define('DB_USER', 'sql6815899');   // e.g. w4y12345
define('DB_PASS', 'v5+3tunf');
define('DB_CHARSET', 'utf8mb4');

// Session secret — set to any long random string (min 32 chars)
define('SESSION_SECRET', 'change-this-to-a-long-random-secret-string-32chars+');

// Allowed origin for CORS (your frontend domain, e.g. https://yourdomain.com)
// Set to '*' only for local testing — never in production.
define('CORS_ORIGIN', 'https://suika.ybermorgen.org');
