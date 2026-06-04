<?php
require_once __DIR__ . '/bootstrap.php';

$userId = require_auth();
$method = $_SERVER['REQUEST_METHOD'];

function fmt_cat(array $row): array {
    return [
        'id'        => $row['id'],
        'userId'    => $row['user_id'],
        'name'      => $row['name'],
        'color'     => $row['color'],
        'createdAt' => $row['created_at'],
    ];
}

if ($method === 'GET') {
    $stmt = db()->prepare('SELECT * FROM custom_categories WHERE user_id = ? ORDER BY created_at ASC');
    $stmt->execute([$userId]);
    ok(array_map('fmt_cat', $stmt->fetchAll()));
}

if ($method === 'POST') {
    $b = json_body();
    if (empty($b['name']) || empty($b['color'])) err('name and color are required');

    $id  = uuid();
    $now = gmdate('Y-m-d H:i:s');

    db()->prepare('INSERT INTO custom_categories (id, user_id, name, color, created_at) VALUES (?,?,?,?,?)')
        ->execute([$id, $userId, $b['name'], $b['color'], $now]);

    $stmt = db()->prepare('SELECT * FROM custom_categories WHERE id = ?');
    $stmt->execute([$id]);
    ok(fmt_cat($stmt->fetch()), 201);
}

err('Method not allowed', 405);
