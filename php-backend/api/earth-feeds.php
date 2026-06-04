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

// ── ReliefWeb ─────────────────────────────────────────────────────────────────
function fetch_reliefweb(): array {
    $url = 'https://api.reliefweb.int/v1/disasters?appname=suika-app&limit=10'
         . '&fields[include][]=name&fields[include][]=status&fields[include][]=date'
         . '&fields[include][]=country&fields[include][]=url_alias';
    $raw = http_get($url);
    if (!$raw) return [];
    $data = json_decode($raw, true);
    $out  = [];
    foreach ($data['data'] ?? [] as $item) {
        $f      = $item['fields'] ?? [];
        $title  = $f['name'] ?? 'Unknown Event';
        $status = $f['status'] ?? '';
        $out[]  = [
            'id'          => 'rw-' . $item['id'],
            'title'       => $title,
            'type'        => classify_type($title),
            'severity'    => $status === 'alert' ? 'high' : 'medium',
            'source'      => 'ReliefWeb',
            'publishedAt' => $f['date']['created'] ?? gmdate('c'),
            'description' => null,
            'countries'   => array_values(array_filter(array_map(fn($c) => $c['name'] ?? '', $f['country'] ?? []))),
            'url'         => isset($f['url_alias']) ? 'https://reliefweb.int' . $f['url_alias'] : null,
        ];
    }
    return $out;
}

// ── GDACS ─────────────────────────────────────────────────────────────────────
function fetch_gdacs(): array {
    $xml = http_get('https://www.gdacs.org/xml/rss_7days.xml');
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

$gdacs     = fetch_gdacs();
$usgs      = fetch_usgs();
$reliefweb = fetch_reliefweb();

$combined = array_merge($gdacs, $usgs, $reliefweb);
usort($combined, fn($a, $b) => strtotime($b['publishedAt']) - strtotime($a['publishedAt']));

$json = json_encode($combined, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
@file_put_contents($cacheFile, $json);

echo $json;
exit;
