<?php
require_once __DIR__ . '/config.php';

// ── Session ──────────────────────────────────────────────────────────────────
ini_set('session.use_strict_mode', 1);
ini_set('session.cookie_httponly', 1);
ini_set('session.cookie_samesite', 'Lax');

$isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');

session_set_cookie_params([
    'lifetime' => 86400 * 30,
    'path'     => '/',
    'httponly' => true,
    'samesite' => 'Lax',
    'secure'   => $isHttps,
]);

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// ── CORS ─────────────────────────────────────────────────────────────────────
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (CORS_ORIGIN === '*' || $origin === CORS_ORIGIN) {
    header('Access-Control-Allow-Origin: ' . ($origin ?: CORS_ORIGIN));
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Accept, X-Requested-With');
    header('Vary: Origin');
}
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

header('Content-Type: application/json; charset=utf-8');

// ── PDO ──────────────────────────────────────────────────────────────────────
function db(): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;
    $dsn = sprintf('mysql:host=%s;dbname=%s;charset=%s', DB_HOST, DB_NAME, DB_CHARSET);
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
    return $pdo;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function uuid(): string {
    return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
    );
}

function json_body(): array {
    $raw = file_get_contents('php://input');
    if (empty($raw)) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function ok(mixed $data, int $status = 200): never {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function err(string $message, int $status = 400): never {
    http_response_code($status);
    echo json_encode(['error' => $message]);
    exit;
}

function require_auth(): string {
    if (empty($_SESSION['user_id'])) {
        err('Not authenticated', 401);
    }
    return $_SESSION['user_id'];
}

function today(): string {
    return (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d');
}

function parse_json_col(mixed $val): array {
    if (is_array($val)) return $val;
    if (empty($val)) return [];
    $decoded = json_decode($val, true);
    return is_array($decoded) ? $decoded : [];
}

function fmt_bool(mixed $val): bool {
    return (bool)(int)$val;
}
