<?php
// Temporary diagnostic endpoint — dumps the step-by-step log written by
// earth-feeds.php's debug_log() calls. No auth, no DB. Safe: contains only
// timing/progress lines, nothing sensitive. Remove once the World4You
// silent-empty-response issue is resolved.

header('Content-Type: text/plain; charset=utf-8');
header('Cache-Control: no-store');

$file = sys_get_temp_dir() . '/suika_earth_feeds_debug.log';

if (!file_exists($file)) {
    echo "No debug log yet — hit /api/earth-feeds first, then reload this page.\n";
    exit;
}

echo "Log file: {$file}\n";
echo "Last modified: " . gmdate('c', filemtime($file)) . "\n";
echo str_repeat('-', 60) . "\n";
echo file_get_contents($file);
