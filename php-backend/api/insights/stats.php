<?php
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') err('Method not allowed', 405);

$userId = require_auth();
$pdo    = db();

// ── Sessions ──────────────────────────────────────────────────────────────────
$stmt = $pdo->prepare('SELECT duration, completed_at FROM timer_sessions WHERE user_id = ?');
$stmt->execute([$userId]);
$sessions = $stmt->fetchAll();

$totalSessions    = count($sessions);
$totalTimeSeconds = 0;
$longestSession   = 0;
$sessionDates     = [];

foreach ($sessions as $s) {
    $dur               = (int)$s['duration'];
    $totalTimeSeconds += $dur;
    if ($dur > $longestSession) $longestSession = $dur;
    $date = substr($s['completed_at'], 0, 10);
    $sessionDates[$date] = true;
}

// Streak
$currentStreak = 0;
if (!empty($sessionDates)) {
    ksort($sessionDates);
    $dates     = array_keys($sessionDates);
    $today     = gmdate('Y-m-d');
    $checkDate = $today;

    for ($i = count($dates) - 1; $i >= 0; $i--) {
        if ($dates[$i] === $checkDate) {
            $currentStreak++;
            $checkDate = gmdate('Y-m-d', strtotime($checkDate . ' -1 day'));
        } else {
            break;
        }
    }
}

// ── Health logs ───────────────────────────────────────────────────────────────
$stmt = $pdo->prepare('SELECT body_entries, stress_entries, regulation_entries FROM health_logs WHERE user_id = ?');
$stmt->execute([$userId]);
$logs = $stmt->fetchAll();

$regionCounts   = [];
$stressCounts   = [];
$strategyCounts = [];

foreach ($logs as $log) {
    // Body regions
    $bodyEntries = parse_json_col($log['body_entries']);
    foreach ($bodyEntries as $e) {
        $rid = $e['regionId'] ?? '';
        if ($rid === '') continue;
        if (!isset($regionCounts[$rid])) $regionCounts[$rid] = ['label' => $rid, 'score' => 0];
        $regionCounts[$rid]['score'] += (int)($e['intensity'] ?? 1);
    }

    // Stressors
    $stressEntries = parse_json_col($log['stress_entries']);
    foreach ($stressEntries as $label) {
        $stressCounts[$label] = ($stressCounts[$label] ?? 0) + 1;
    }

    // Strategies
    $regulationEntries = parse_json_col($log['regulation_entries']);
    foreach ($regulationEntries as $label) {
        $strategyCounts[$label] = ($strategyCounts[$label] ?? 0) + 1;
    }
}

// Top body regions
usort($regionCounts, fn($a, $b) => $b['score'] <=> $a['score']);
$topBodyRegions = array_slice(
    array_map(fn($k, $v) => ['regionId' => $k, 'label' => $v['label'], 'score' => $v['score']], array_keys($regionCounts), $regionCounts),
    0, 5
);

// Top stressors
arsort($stressCounts);
$topStressors = array_slice(
    array_map(fn($label, $count) => ['label' => $label, 'count' => $count], array_keys($stressCounts), $stressCounts),
    0, 5
);

// Top strategies
arsort($strategyCounts);
$topStrategies = array_slice(
    array_map(fn($label, $count) => ['label' => $label, 'count' => $count], array_keys($strategyCounts), $strategyCounts),
    0, 5
);

ok([
    'totalSessions'    => $totalSessions,
    'totalTimeSeconds' => $totalTimeSeconds,
    'longestSession'   => $longestSession,
    'currentStreak'    => $currentStreak,
    'topBodyRegions'   => array_values($topBodyRegions),
    'topStressors'     => array_values($topStressors),
    'topStrategies'    => array_values($topStrategies),
]);
