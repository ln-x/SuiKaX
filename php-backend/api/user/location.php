<?php
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'PATCH') err('Method not allowed', 405);

$userId = require_auth();
$b      = json_body();

db()->prepare('UPDATE users SET default_lat=?, default_lon=?, default_location_name=? WHERE id=?')
    ->execute([
        isset($b['defaultLat'])  ? (float)$b['defaultLat']  : null,
        isset($b['defaultLon'])  ? (float)$b['defaultLon']  : null,
        $b['defaultLocationName'] ?? null,
        $userId,
    ]);

$stmt = db()->prepare('SELECT * FROM users WHERE id = ?');
$stmt->execute([$userId]);
$user = $stmt->fetch();

ok([
    'id'                  => $user['id'],
    'username'            => $user['username'],
    'displayName'         => $user['display_name'],
    'defaultLat'          => $user['default_lat']  !== null ? (float)$user['default_lat']  : null,
    'defaultLon'          => $user['default_lon']  !== null ? (float)$user['default_lon']  : null,
    'defaultLocationName' => $user['default_location_name'],
]);
