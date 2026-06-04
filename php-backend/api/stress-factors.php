<?php
require_once __DIR__ . '/bootstrap.php';

$userId = require_auth();
$method = $_SERVER['REQUEST_METHOD'];

function fmt_sf(array $row): array {
    return [
        'id'        => $row['id'],
        'userId'    => $row['user_id'],
        'label'     => $row['label'],
        'category'  => $row['category'],
        'sortOrder' => (int)$row['sort_order'],
        'isDefault' => fmt_bool($row['is_default']),
    ];
}

if ($method === 'GET') {
    $stmt = db()->prepare('SELECT * FROM stress_factors WHERE user_id = ? ORDER BY sort_order ASC, created_at ASC');
    $stmt->execute([$userId]);
    ok(array_map('fmt_sf', $stmt->fetchAll()));
}

if ($method === 'POST') {
    $b = json_body();
    if (empty($b['label']) || empty($b['category'])) err('label and category are required');

    $id  = uuid();
    $now = gmdate('Y-m-d H:i:s');

    $maxStmt = db()->prepare('SELECT COALESCE(MAX(sort_order),0)+1 FROM stress_factors WHERE user_id = ?');
    $maxStmt->execute([$userId]);
    $order = (int)$maxStmt->fetchColumn();

    db()->prepare('INSERT INTO stress_factors (id, user_id, label, category, sort_order, is_default, created_at) VALUES (?,?,?,?,?,0,?)')
        ->execute([$id, $userId, $b['label'], $b['category'], $order, $now]);

    $stmt = db()->prepare('SELECT * FROM stress_factors WHERE id = ?');
    $stmt->execute([$id]);
    ok(fmt_sf($stmt->fetch()), 201);
}

err('Method not allowed', 405);
