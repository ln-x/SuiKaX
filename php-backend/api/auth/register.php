<?php
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') err('Method not allowed', 405);

$body = json_body();
$username = trim($body['username'] ?? '');
$password = $body['password'] ?? '';

if ($username === '' || $password === '') err('Username and password are required');

$pdo = db();
$stmt = $pdo->prepare('SELECT id FROM users WHERE username = ?');
$stmt->execute([$username]);
if ($stmt->fetch()) err('Username already taken', 409);

$id   = uuid();
$hash = password_hash($password, PASSWORD_BCRYPT);
$now  = gmdate('Y-m-d H:i:s');

$pdo->prepare(
    'INSERT INTO users (id, username, password, created_at) VALUES (?, ?, ?, ?)'
)->execute([$id, $username, $hash, $now]);

// ── Seed default stress factors ───────────────────────────────────────────────
$defaultStressFactors = [
    ['label' => 'Work Overload',      'category' => 'work'],
    ['label' => 'Conflict',           'category' => 'social'],
    ['label' => 'Financial Pressure', 'category' => 'work'],
    ['label' => 'Health Concerns',    'category' => 'physical'],
    ['label' => 'Social Isolation',   'category' => 'social'],
    ['label' => 'Sleep Deprivation',  'category' => 'physical'],
    ['label' => 'Uncertainty',        'category' => 'cognitive'],
    ['label' => 'Overstimulation',    'category' => 'environmental'],
];

$sfStmt = $pdo->prepare(
    'INSERT INTO stress_factors (id, user_id, label, category, sort_order, is_default, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)'
);
foreach ($defaultStressFactors as $i => $sf) {
    $sfStmt->execute([uuid(), $id, $sf['label'], $sf['category'], $i, $now]);
}

// ── Seed default regulation strategies ────────────────────────────────────────
$defaultRegulationStrategies = [
    ['label' => 'Box Breathing',        'channel' => 'breath'],
    ['label' => '4-7-8 Breath',         'channel' => 'breath'],
    ['label' => 'Physiological Sigh',   'channel' => 'breath'],
    ['label' => 'Coherent Breathing',   'channel' => 'breath'],
    ['label' => 'Cold Water Face',      'channel' => 'body'],
    ['label' => 'Movement / Walk',      'channel' => 'movement'],
    ['label' => 'Nature Time',          'channel' => 'environment'],
    ['label' => 'Journaling',           'channel' => 'cognitive'],
];

$rsStmt = $pdo->prepare(
    'INSERT INTO regulation_strategies (id, user_id, label, channel, sort_order, is_default, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)'
);
foreach ($defaultRegulationStrategies as $i => $rs) {
    $rsStmt->execute([uuid(), $id, $rs['label'], $rs['channel'], $i, $now]);
}

$_SESSION['user_id'] = $id;

ok([
    'id'                  => $id,
    'username'            => $username,
    'displayName'         => null,
    'defaultLat'          => null,
    'defaultLon'          => null,
    'defaultLocationName' => null,
], 201);
