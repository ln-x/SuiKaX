<?php
require_once __DIR__ . '/bootstrap.php';

$userId = require_auth();
$method = $_SERVER['REQUEST_METHOD'];

function fmt_session(array $row): array {
    return [
        'id'                   => $row['id'],
        'userId'               => $row['user_id'],
        'presetId'             => $row['preset_id'],
        'categoryId'           => $row['category_id'],
        'categoryName'         => $row['category_name'],
        'categoryColor'        => $row['category_color'],
        'duration'             => (int)$row['duration'],
        'completedAt'          => $row['completed_at'],
        'mode'                 => $row['mode'],
        'connectionReflection' => $row['connection_reflection'],
    ];
}

if ($method === 'GET') {
    $stmt = db()->prepare('SELECT * FROM timer_sessions WHERE user_id = ? ORDER BY completed_at DESC');
    $stmt->execute([$userId]);
    ok(array_map('fmt_session', $stmt->fetchAll()));
}

if ($method === 'POST') {
    $b = json_body();
    foreach (['categoryId','categoryName','categoryColor','duration','mode'] as $f) {
        if (!isset($b[$f]) || $b[$f] === '') err("$f is required");
    }

    $id  = uuid();
    $now = gmdate('Y-m-d H:i:s');

    db()->prepare('INSERT INTO timer_sessions
        (id, user_id, preset_id, category_id, category_name, category_color,
         duration, completed_at, mode, connection_reflection)
        VALUES (?,?,?,?,?,?,?,?,?,?)'
    )->execute([
        $id, $userId,
        $b['presetId'] ?? null,
        $b['categoryId'], $b['categoryName'], $b['categoryColor'],
        (int)$b['duration'], $now,
        $b['mode'], $b['connectionReflection'] ?? null,
    ]);

    $stmt = db()->prepare('SELECT * FROM timer_sessions WHERE id = ?');
    $stmt->execute([$id]);
    ok(fmt_session($stmt->fetch()), 201);
}

err('Method not allowed', 405);
