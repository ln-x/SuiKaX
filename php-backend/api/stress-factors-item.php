<?php
require_once __DIR__ . '/bootstrap.php';

$userId = require_auth();
$id     = $_GET['id'] ?? '';
if ($id === '') err('Missing id', 400);

if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') err('Method not allowed', 405);

$stmt = db()->prepare('SELECT id FROM stress_factors WHERE id = ? AND user_id = ?');
$stmt->execute([$id, $userId]);
if (!$stmt->fetch()) err('Not found', 404);

db()->prepare('DELETE FROM stress_factors WHERE id = ?')->execute([$id]);

http_response_code(204);
exit;
