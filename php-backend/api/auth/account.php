<?php
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') err('Method not allowed', 405);

$userId = require_auth();

db()->prepare('DELETE FROM users WHERE id = ?')->execute([$userId]);

$_SESSION = [];
session_destroy();

ok(['message' => 'Account deleted']);
