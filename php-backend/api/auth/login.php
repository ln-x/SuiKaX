<?php
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') err('Method not allowed', 405);

$body = json_body();
$username = trim($body['username'] ?? '');
$password = $body['password'] ?? '';

if ($username === '' || $password === '') err('Username and password are required');

$stmt = db()->prepare('SELECT * FROM users WHERE username = ?');
$stmt->execute([$username]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password'])) {
    err('Invalid credentials', 401);
}

$_SESSION['user_id'] = $user['id'];

ok([
    'id'                  => $user['id'],
    'username'            => $user['username'],
    'displayName'         => $user['display_name'],
    'defaultLat'          => $user['default_lat'] !== null ? (float)$user['default_lat'] : null,
    'defaultLon'          => $user['default_lon'] !== null ? (float)$user['default_lon'] : null,
    'defaultLocationName' => $user['default_location_name'],
]);
