<?php
require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') err('Method not allowed', 405);

$userId = require_auth();
$table  = $_GET['table'] ?? '';
$id     = $_GET['id']    ?? '';

$allowed = [
    'health_logs'           => 'health_logs',
    'timer_sessions'        => 'timer_sessions',
    'environment_snapshots' => 'environment_snapshots',
    'stress_factors'        => 'stress_factors',
];

if (!isset($allowed[$table])) err('Invalid table', 400);
if ($id === '')               err('Missing id', 400);

$tbl  = $allowed[$table];
$stmt = db()->prepare("SELECT id FROM `$tbl` WHERE id = ? AND user_id = ?");
$stmt->execute([$id, $userId]);
if (!$stmt->fetch()) err('Not found', 404);

db()->prepare("DELETE FROM `$tbl` WHERE id = ?")->execute([$id]);

http_response_code(204);
exit;
