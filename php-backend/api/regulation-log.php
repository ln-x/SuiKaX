<?php
require_once __DIR__ . '/bootstrap.php';

$userId = require_auth();
$method = $_SERVER['REQUEST_METHOD'];
$date   = today();

function fmt_rl(array $row): array {
    return [
        'id'                => $row['id'],
        'userId'            => $row['user_id'],
        'date'              => $row['date'],
        'activeStrategyIds' => parse_json_col($row['active_strategy_ids']),
    ];
}

if ($method === 'GET') {
    $stmt = db()->prepare('SELECT * FROM regulation_logs WHERE user_id = ? AND date = ?');
    $stmt->execute([$userId, $date]);
    $row = $stmt->fetch();
    if (!$row) {
        ok(['id' => '', 'userId' => $userId, 'date' => $date, 'activeStrategyIds' => []]);
    }
    ok(fmt_rl($row));
}

if ($method === 'POST') {
    $b    = json_body();
    $ids  = $b['activeStrategyIds'] ?? [];
    $pdo  = db();

    $existing = $pdo->prepare('SELECT id FROM regulation_logs WHERE user_id = ? AND date = ?');
    $existing->execute([$userId, $date]);
    $row = $existing->fetch();

    if ($row) {
        $pdo->prepare('UPDATE regulation_logs SET active_strategy_ids = ? WHERE user_id = ? AND date = ?')
            ->execute([json_encode($ids), $userId, $date]);
        $id = $row['id'];
    } else {
        $id = uuid();
        $pdo->prepare('INSERT INTO regulation_logs (id, user_id, date, active_strategy_ids) VALUES (?,?,?,?)')
            ->execute([$id, $userId, $date, json_encode($ids)]);
    }

    $stmt = db()->prepare('SELECT * FROM regulation_logs WHERE id = ?');
    $stmt->execute([$id]);
    ok(fmt_rl($stmt->fetch()));
}

err('Method not allowed', 405);
