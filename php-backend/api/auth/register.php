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

$_SESSION['user_id'] = $id;

ok([
    'id'                  => $id,
    'username'            => $username,
    'displayName'         => null,
    'defaultLat'          => null,
    'defaultLon'          => null,
    'defaultLocationName' => null,
], 201);
