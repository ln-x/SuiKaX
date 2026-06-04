<?php
require_once __DIR__ . '/bootstrap.php';

$userId = require_auth();
$id     = $_GET['id'] ?? '';
if ($id === '') err('Missing id', 400);

if ($_SERVER['REQUEST_METHOD'] !== 'PATCH') err('Method not allowed', 405);

$b = json_body();

$stmt = db()->prepare('SELECT * FROM timer_sessions WHERE id = ? AND user_id = ?');
$stmt->execute([$id, $userId]);
$row = $stmt->fetch();
if (!$row) err('Not found', 404);

db()->prepare('UPDATE timer_sessions SET connection_reflection = ? WHERE id = ?')
    ->execute([$b['connectionReflection'] ?? null, $id]);

$stmt = db()->prepare('SELECT * FROM timer_sessions WHERE id = ?');
$stmt->execute([$id]);
$row = $stmt->fetch();

ok([
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
]);
