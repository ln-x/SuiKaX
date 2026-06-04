<?php
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') err('Method not allowed', 405);

$userId = require_auth();

$stmt = db()->prepare('SELECT * FROM users WHERE id = ?');
$stmt->execute([$userId]);
$user = $stmt->fetch();
if (!$user) { session_destroy(); err('Not authenticated', 401); }

ok([
    'id'                  => $user['id'],
    'username'            => $user['username'],
    'displayName'         => $user['display_name'],
    'defaultLat'          => $user['default_lat'] !== null ? (float)$user['default_lat'] : null,
    'defaultLon'          => $user['default_lon'] !== null ? (float)$user['default_lon'] : null,
    'defaultLocationName' => $user['default_location_name'],
]);
