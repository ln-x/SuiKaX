<?php
// ============================================================
// SuiKa — Database Configuration
// Fill in your World4You MySQL credentials and uncomment.
// ============================================================

define('DB_HOST', 'localhost');
define('DB_NAME', 'your_database_name');   // e.g. w4y12345_suika
define('DB_USER', 'your_database_user');   // e.g. w4y12345
define('DB_PASS', 'your_database_password');
define('DB_CHARSET', 'utf8mb4');

// Session secret — set to any long random string (min 32 chars)
define('SESSION_SECRET', 'change-this-to-a-long-random-secret-string-32chars+');

// Allowed origin for CORS (your frontend domain, e.g. https://yourdomain.com)
// Set to '*' only for local testing — never in production.
define('CORS_ORIGIN', 'https://yourdomain.com');
