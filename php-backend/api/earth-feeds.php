<?php
require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') err('Method not allowed', 405);

require_auth();

$cacheFile = sys_get_temp_dir() . '/suika_earth_feeds.json';
$cacheTtl  = 1800;

if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < $cacheTtl) {
    $cached = file_get_contents($cacheFile);
    header('Content-Type: application/json; charset=utf-8');
    echo $cached;
    exit;
}

// ── HTTP helper — cURL preferred, file_get_contents fallback ──────────────────
function http_get(string $url): string|false {
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 12,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_USERAGENT      => 'SuiKa-App/1.0 (burnout-recovery-companion)',
            CURLOPT_SSL_VERIFYPEER => true,
        ]);
        $result = curl_exec($ch);
        curl_close($ch);
        return $result;
    }
    return @file_get_contents($url);
}

// ── Shared type classifier ────────────────────────────────────────────────────
function classify_type(string $title): string {
    $t = strtolower($title);
    if (str_contains($t, 'earthquake') || str_contains($t, 'seismic')) return 'earthquake';
    if (str_contains($t, 'flood'))                                       return 'flood';
    if (str_contains($t, 'storm') || str_contains($t, 'cyclone') || str_contains($t, 'typhoon') || str_contains($t, 'hurricane')) return 'storm';
    if (str_contains($t, 'volcano') || str_contains($t, 'volcanic'))    return 'volcano';
    if (str_contains($t, 'drought'))                                     return 'drought';
    if (str_contains($t, 'wildfire') || str_contains($t, 'fire'))       return 'wildfire';
    if (str_contains($t, 'tsunami'))                                     return 'tsunami';
    if (str_contains($t, 'epidemic') || str_contains($t, 'outbreak') || str_contains($t, 'disease')) return 'epidemic';
    return 'other';
}

// ── GDACS ─────────────────────────────────────────────────────────────────────
function fetch_gdacs(): array {
    $xml = http_get('https://www.gdacs.org/xml/rss.xml');
    if (!$xml) return [];
    $out = [];
    preg_match_all('/<item>([\s\S]*?)<\/item>/', $xml, $matches);
    foreach ($matches[1] as $content) {
        $get = function(string $tag) use ($content): ?string {
            if (!preg_match('/<' . preg_quote($tag, '/') . '[^>]*>([\s\S]*?)<\/' . preg_quote($tag, '/') . '>/', $content, $m)) return null;
            return trim(preg_replace('/<!\[CDATA\[|\]\]>/', '', $m[1]));
        };
        $title    = $get('title') ?? 'Unknown Event';
        $link     = $get('link');
        $pubDate  = $get('pubDate');
        $alert    = strtolower($get('gdacs:alertlevel') ?? '');
        $severity = 'medium';
        if (str_contains($alert, 'red') || str_contains($alert, 'orange')) $severity = 'high';
        elseif (str_contains($alert, 'green'))                              $severity = 'low';
        $out[] = [
            'id'          => 'gdacs-' . md5($link ?? $title),
            'title'       => $title,
            'type'        => classify_type($title),
            'severity'    => $severity,
            'source'      => 'GDACS',
            'publishedAt' => $pubDate ? gmdate('c', strtotime($pubDate)) : gmdate('c'),
            'description' => $get('description'),
            'countries'   => [],
            'url'         => $link,
        ];
    }
    return $out;
}

// ── USGS Significant Earthquakes (past week) ──────────────────────────────────
function fetch_usgs(): array {
    $raw = http_get('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson');
    if (!$raw) return [];
    $data = json_decode($raw, true);
    $out  = [];
    foreach ($data['features'] ?? [] as $f) {
        $p        = $f['properties'] ?? [];
        $mag      = $p['mag'] ?? null;
        $place    = $p['place'] ?? 'Unknown location';
        $alert    = strtolower($p['alert'] ?? '');
        $title    = $p['title'] ?? ($mag ? "M {$mag} — {$place}" : $place);
        $severity = 'medium';
        if ($alert === 'red' || $alert === 'orange')  $severity = 'high';
        elseif ($alert === 'green')                    $severity = 'low';
        elseif ($mag !== null && (float)$mag >= 7.0)  $severity = 'high';
        $out[] = [
            'id'          => 'usgs-' . ($f['id'] ?? md5($title)),
            'title'       => $title,
            'type'        => 'earthquake',
            'severity'    => $severity,
            'source'      => 'USGS',
            'publishedAt' => isset($p['time']) ? gmdate('c', intval($p['time'] / 1000)) : gmdate('c'),
            'description' => $mag ? "Magnitude {$mag} — {$place}" : $place,
            'countries'   => [],
            'url'         => $p['url'] ?? null,
        ];
    }
    return $out;
}

// ── NASA EONET (Earth Observatory Natural Event Tracker) ──────────────────────
function fetch_eonet(): array {
    $raw = http_get('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=360&limit=30');
    if (!$raw) return [];
    $data = json_decode($raw, true);
    $catMap = [
        'wildfires'    => 'wildfire',
        'severeStorms' => 'storm',
        'floods'       => 'flood',
        'drought'      => 'drought',
        'volcanoes'    => 'volcano',
        'earthquakes'  => 'earthquake',
        'seaLakeIce'   => 'other',
        'landslides'   => 'other',
        'dustHaze'     => 'other',
        'tempExtremes' => 'other',
        'snow'         => 'other',
    ];
    $out = [];
    foreach ($data['events'] ?? [] as $e) {
        $catId  = $e['categories'][0]['id'] ?? '';
        $type   = $catMap[$catId] ?? classify_type($e['title'] ?? '');
        $geos   = $e['geometry'] ?? [];
        $latest = !empty($geos) ? end($geos) : null;
        $url    = $e['sources'][0]['url'] ?? ($e['link'] ?? null);
        $catTitles = array_map(fn($c) => $c['title'] ?? '', $e['categories'] ?? []);
        $severity = in_array($type, ['wildfire', 'storm', 'volcano'], true) ? 'high' : 'medium';
        $out[] = [
            'id'          => 'eonet-' . ($e['id'] ?? md5($e['title'] ?? '')),
            'title'       => $e['title'] ?? 'Unknown Event',
            'type'        => $type,
            'severity'    => $severity,
            'source'      => 'NASA EONET',
            'publishedAt' => isset($latest['date']) ? gmdate('c', strtotime($latest['date'])) : gmdate('c'),
            'description' => implode(', ', array_filter($catTitles)) ?: null,
            'countries'   => [],
            'url'         => $url,
        ];
    }
    return $out;
}

$gdacs = fetch_gdacs();
$usgs  = fetch_usgs();
$eonet = fetch_eonet();

$combined = array_merge($gdacs, $usgs, $eonet);
usort($combined, fn($a, $b) => strtotime($b['publishedAt']) - strtotime($a['publishedAt']));

$json = json_encode($combined, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
@file_put_contents($cacheFile, $json);

echo $json;
exit;
