<?php
require_once __DIR__ . '/bootstrap.php';

$userId = require_auth();
$method = $_SERVER['REQUEST_METHOD'];

function fmt_preset(array $row): array {
    return [
        'id'         => $row['id'],
        'userId'     => $row['user_id'],
        'name'       => $row['name'],
        'duration'   => (int)$row['duration'],
        'categoryId' => $row['category_id'],
    ];
}

if ($method === 'GET') {
    $stmt = db()->prepare('SELECT * FROM presets WHERE user_id = ? ORDER BY created_at ASC');
    $stmt->execute([$userId]);
    ok(array_map('fmt_preset', $stmt->fetchAll()));
}

if ($method === 'POST') {
    $b = json_body();
    foreach (['name','duration','categoryId'] as $f) {
        if (!isset($b[$f]) || $b[$f] === '') err("$f is required");
    }

    $id  = uuid();
    $now = gmdate('Y-m-d H:i:s');

    db()->prepare('INSERT INTO presets (id, user_id, name, duration, category_id, created_at) VALUES (?,?,?,?,?,?)')
        ->execute([$id, $userId, $b['name'], (int)$b['duration'], $b['categoryId'], $now]);

    $stmt = db()->prepare('SELECT * FROM presets WHERE id = ?');
    $stmt->execute([$id]);
    ok(fmt_preset($stmt->fetch()), 201);
}

err('Method not allowed', 405);
