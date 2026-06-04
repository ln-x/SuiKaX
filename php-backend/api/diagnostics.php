<?php
// diagnostics.php — lightweight reachability probe for World4You debugging
// No auth, no DB. Safe to access directly: /api/diagnostics
// Do NOT expose on production without IP-restricting or removing this file.

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

// ── System info ───────────────────────────────────────────────────────────────

$curl_available = function_exists('curl_init');

$system = [
    'php_version'    => PHP_VERSION,
    'php_sapi'       => PHP_SAPI,
    'curl_available' => $curl_available,
    'curl_version'   => $curl_available ? (curl_version()['version'] ?? null) : null,
    'timestamp_utc'  => gmdate('c'),
];

// ── HTTP probe ────────────────────────────────────────────────────────────────
// Returns ['reachable' => bool, 'http_status' => int|null, 'latency_ms' => float, 'error' => string|null]

function probe(string $url, int $timeout_sec = 8): array {
    $t0 = microtime(true);

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => $timeout_sec,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS      => 3,
            CURLOPT_NOBODY         => false,
            CURLOPT_USERAGENT      => 'SuiKa-Diagnostics/1.0',
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_RANGE          => '0-0',
        ]);
        $body   = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $errno  = curl_errno($ch);
        $err    = $errno ? curl_strerror($errno) : null;
        curl_close($ch);
        $ms = round((microtime(true) - $t0) * 1000, 1);
        return [
            'reachable'   => ($errno === 0 && $status >= 200 && $status < 400),
            'http_status' => $status ?: null,
            'latency_ms'  => $ms,
            'error'       => $err,
        ];
    }

    // cURL not available — try file_get_contents with a stream context
    $ctx = stream_context_create([
        'http' => [
            'method'          => 'GET',
            'timeout'         => $timeout_sec,
            'follow_location' => true,
            'user_agent'      => 'SuiKa-Diagnostics/1.0',
            'ignore_errors'   => true,
        ],
        'ssl' => [
            'verify_peer'      => true,
            'verify_peer_name' => true,
        ],
    ]);
    $result = @file_get_contents($url, false, $ctx);
    $ms     = round((microtime(true) - $t0) * 1000, 1);

    $status = null;
    if (isset($http_response_header[0])) {
        preg_match('#HTTP/[\d.]+ (\d+)#', $http_response_header[0], $m);
        $status = isset($m[1]) ? (int)$m[1] : null;
    }
    $reachable = ($result !== false && $status !== null && $status >= 200 && $status < 400);
    return [
        'reachable'   => $reachable,
        'http_status' => $status,
        'latency_ms'  => $ms,
        'error'       => $reachable ? null : 'file_get_contents failed or non-2xx response',
    ];
}

// ── External API probes ───────────────────────────────────────────────────────
// Each entry: [label, url, note?]
// Using minimal/public endpoints — no auth required, tiny payloads where possible.

$probes = [
    [
        'name' => 'Open-Meteo',
        'url'  => 'https://api.open-meteo.com/v1/forecast?latitude=48.2082&longitude=16.3738&hourly=temperature_2m&forecast_days=1',
        'note' => 'Weather data used in Local tab',
    ],
    [
        'name' => 'NASA POWER',
        'url'  => 'https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M&community=AG&longitude=16.3738&latitude=48.2082&start=20250601&end=20250601&format=JSON',
        'note' => 'Solar / climate data used in Local tab',
    ],
    [
        'name' => 'USGS Earthquakes',
        'url'  => 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson',
        'note' => 'Earthquake feed used in Earth tab',
    ],
    [
        'name' => 'NASA EONET',
        'url'  => 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=7&limit=1',
        'note' => 'Natural events feed used in Earth tab',
    ],
    [
        'name' => 'NWS Alerts',
        'url'  => 'https://api.weather.gov/alerts/active?limit=1',
        'note' => 'Flood / storm / tsunami alerts used in Earth tab',
    ],
    [
        'name' => 'WHO Disease Outbreaks',
        'url'  => 'https://www.who.int/api/news/diseaseoutbreaknews?$orderby=PublicationDateAndTime%20desc&$top=1',
        'note' => 'Epidemic feed used in Earth tab',
    ],
    [
        'name' => 'Smithsonian GVP',
        'url'  => 'https://volcano.si.edu/news/WeeklyVolcanoRSS.xml',
        'note' => 'Volcanic activity feed used in Earth tab',
    ],
];

$results = [];
foreach ($probes as $p) {
    $r = probe($p['url']);
    $results[] = array_merge(['name' => $p['name'], 'url' => $p['url'], 'note' => $p['note']], $r);
}

// ── Summary ───────────────────────────────────────────────────────────────────

$reachable_count = count(array_filter($results, fn($r) => $r['reachable']));
$total           = count($results);

echo json_encode([
    'system'  => $system,
    'summary' => [
        'apis_reachable' => $reachable_count,
        'apis_total'     => $total,
        'all_ok'         => $reachable_count === $total,
    ],
    'apis'    => $results,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
exit;
