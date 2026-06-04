<?php
require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') err('Method not allowed', 405);

$userId = require_auth();
$pdo    = db();

// Health logs
$stmt = $pdo->prepare('SELECT * FROM health_logs WHERE user_id = ? ORDER BY date DESC');
$stmt->execute([$userId]);
$healthLogs = array_map(function($row) {
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
}, $stmt->fetchAll());

// Timer sessions
$stmt = $pdo->prepare('SELECT * FROM timer_sessions WHERE user_id = ? ORDER BY completed_at DESC');
$stmt->execute([$userId]);
$timerSessions = array_map(function($row) {
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
}, $stmt->fetchAll());

// Environment snapshots
$stmt = $pdo->prepare('SELECT * FROM environment_snapshots WHERE user_id = ? ORDER BY date DESC');
$stmt->execute([$userId]);
$environmentSnapshots = array_map(function($row) {
    return [
        'id'              => $row['id'],
        'userId'          => $row['user_id'],
        'date'            => $row['date'],
        'pollenLevel'     => $row['pollen_level'],
        'aqi'             => $row['aqi']              !== null ? (float)$row['aqi']             : null,
        'pressure'        => $row['pressure']         !== null ? (float)$row['pressure']        : null,
        'daylightMinutes' => $row['daylight_minutes'] !== null ? (int)$row['daylight_minutes']  : null,
        'feelsLikeTemp'   => $row['feels_like_temp']  !== null ? (float)$row['feels_like_temp'] : null,
        'humidity'        => $row['humidity']         !== null ? (float)$row['humidity']        : null,
    ];
}, $stmt->fetchAll());

// Stress factors
$stmt = $pdo->prepare('SELECT * FROM stress_factors WHERE user_id = ? ORDER BY sort_order ASC');
$stmt->execute([$userId]);
$stressFactors = array_map(function($row) {
    return [
        'id'        => $row['id'],
        'userId'    => $row['user_id'],
        'label'     => $row['label'],
        'category'  => $row['category'],
        'sortOrder' => (int)$row['sort_order'],
        'isDefault' => fmt_bool($row['is_default']),
    ];
}, $stmt->fetchAll());

ok([
    'healthLogs'           => $healthLogs,
    'timerSessions'        => $timerSessions,
    'environmentSnapshots' => $environmentSnapshots,
    'stressFactors'        => $stressFactors,
]);
