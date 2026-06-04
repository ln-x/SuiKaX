<?php
require_once __DIR__ . '/bootstrap.php';

$userId = require_auth();
$method = $_SERVER['REQUEST_METHOD'];

function fmt_log(array $row): array {
    return [
        'id'                => $row['id'],
        'userId'            => $row['user_id'],
        'date'              => $row['date'],
        'physicalPain'      => (int)$row['physical_pain'],
        'mentalPain'        => (int)$row['mental_pain'],
        'soulState'         => $row['soul_state'] !== null ? (int)$row['soul_state'] : null,
        'shutdownMeltdown'  => $row['shutdown_meltdown'],
        'bodyEntries'       => parse_json_col($row['body_entries']),
        'stressEntries'     => parse_json_col($row['stress_entries']),
        'regulationEntries' => parse_json_col($row['regulation_entries']),
        'notes'             => $row['notes'],
        'createdAt'         => $row['created_at'],
    ];
}

if ($method === 'GET') {
    $stmt = db()->prepare('SELECT * FROM health_logs WHERE user_id = ? ORDER BY date DESC');
    $stmt->execute([$userId]);
    ok(array_map('fmt_log', $stmt->fetchAll()));
}

if ($method === 'POST') {
    $b = json_body();
    if (!isset($b['physicalPain'], $b['mentalPain'])) err('physicalPain and mentalPain are required');

    $date = today();
    $pdo  = db();

    $existing = $pdo->prepare('SELECT id FROM health_logs WHERE user_id = ? AND date = ?');
    $existing->execute([$userId, $date]);
    $row = $existing->fetch();

    $bodyEntries       = json_encode($b['bodyEntries'] ?? []);
    $stressEntries     = json_encode($b['stressEntries'] ?? []);
    $regulationEntries = json_encode($b['regulationEntries'] ?? []);

    if ($row) {
        $pdo->prepare('UPDATE health_logs SET
            physical_pain=?, mental_pain=?, soul_state=?, shutdown_meltdown=?,
            body_entries=?, stress_entries=?, regulation_entries=?, notes=?
            WHERE user_id=? AND date=?'
        )->execute([
            $b['physicalPain'], $b['mentalPain'],
            $b['soulState'] ?? null, $b['shutdownMeltdown'] ?? null,
            $bodyEntries, $stressEntries, $regulationEntries,
            $b['notes'] ?? null,
            $userId, $date,
        ]);
        $id = $row['id'];
    } else {
        $id  = uuid();
        $now = gmdate('Y-m-d H:i:s');
        $pdo->prepare('INSERT INTO health_logs
            (id, user_id, date, physical_pain, mental_pain, soul_state, shutdown_meltdown,
             body_entries, stress_entries, regulation_entries, notes, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
        )->execute([
            $id, $userId, $date,
            $b['physicalPain'], $b['mentalPain'],
            $b['soulState'] ?? null, $b['shutdownMeltdown'] ?? null,
            $bodyEntries, $stressEntries, $regulationEntries,
            $b['notes'] ?? null, $now,
        ]);
    }

    $stmt = db()->prepare('SELECT * FROM health_logs WHERE id = ?');
    $stmt->execute([$id]);
    ok(fmt_log($stmt->fetch()));
}

err('Method not allowed', 405);
