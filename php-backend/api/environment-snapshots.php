<?php
require_once __DIR__ . '/bootstrap.php';

$userId = require_auth();
$method = $_SERVER['REQUEST_METHOD'];

function fmt_snap(array $row): array {
    return [
        'id'              => $row['id'],
        'userId'          => $row['user_id'],
        'date'            => $row['date'],
        'pollenLevel'     => $row['pollen_level'],
        'aqi'             => $row['aqi']              !== null ? (float)$row['aqi']              : null,
        'pressure'        => $row['pressure']         !== null ? (float)$row['pressure']         : null,
        'daylightMinutes' => $row['daylight_minutes'] !== null ? (int)$row['daylight_minutes']   : null,
        'feelsLikeTemp'   => $row['feels_like_temp']  !== null ? (float)$row['feels_like_temp']  : null,
        'humidity'        => $row['humidity']         !== null ? (float)$row['humidity']         : null,
    ];
}

if ($method === 'GET') {
    $stmt = db()->prepare('SELECT * FROM environment_snapshots WHERE user_id = ? ORDER BY date DESC');
    $stmt->execute([$userId]);
    ok(array_map('fmt_snap', $stmt->fetchAll()));
}

if ($method === 'POST') {
    $b    = json_body();
    $date = today();
    $pdo  = db();

    $existing = $pdo->prepare('SELECT id FROM environment_snapshots WHERE user_id = ? AND date = ?');
    $existing->execute([$userId, $date]);
    $row = $existing->fetch();

    if ($row) {
        $pdo->prepare('UPDATE environment_snapshots SET
            pollen_level=?, aqi=?, pressure=?, daylight_minutes=?, feels_like_temp=?, humidity=?
            WHERE user_id=? AND date=?'
        )->execute([
            $b['pollenLevel'] ?? null,
            isset($b['aqi'])             ? (float)$b['aqi']             : null,
            isset($b['pressure'])        ? (float)$b['pressure']        : null,
            isset($b['daylightMinutes']) ? (int)$b['daylightMinutes']   : null,
            isset($b['feelsLikeTemp'])   ? (float)$b['feelsLikeTemp']   : null,
            isset($b['humidity'])        ? (float)$b['humidity']        : null,
            $userId, $date,
        ]);
        $id = $row['id'];
    } else {
        $id  = uuid();
        $now = gmdate('Y-m-d H:i:s');
        $pdo->prepare('INSERT INTO environment_snapshots
            (id, user_id, date, pollen_level, aqi, pressure, daylight_minutes, feels_like_temp, humidity, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?)'
        )->execute([
            $id, $userId, $date,
            $b['pollenLevel'] ?? null,
            isset($b['aqi'])             ? (float)$b['aqi']             : null,
            isset($b['pressure'])        ? (float)$b['pressure']        : null,
            isset($b['daylightMinutes']) ? (int)$b['daylightMinutes']   : null,
            isset($b['feelsLikeTemp'])   ? (float)$b['feelsLikeTemp']   : null,
            isset($b['humidity'])        ? (float)$b['humidity']        : null,
            $now,
        ]);
    }

    $stmt = db()->prepare('SELECT * FROM environment_snapshots WHERE id = ?');
    $stmt->execute([$id]);
    ok(fmt_snap($stmt->fetch()));
}

err('Method not allowed', 405);
