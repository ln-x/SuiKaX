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

// ── NWS Flood Alerts ──────────────────────────────────────────────────────────
function fetch_nws_floods(): array {
    $raw = http_get('https://api.weather.gov/alerts/active?event=Flood%20Warning,Flash%20Flood%20Warning,Flood%20Watch');
    if (!$raw) return [];
    $data = json_decode($raw, true);
    $out  = [];
    foreach ($data['features'] ?? [] as $f) {
        $p = $f['properties'] ?? [];
        $sev = strtolower($p['severity'] ?? '');
        $severity = ($sev === 'extreme' || $sev === 'severe') ? 'high' : 'medium';
        $title = ($p['headline'] ?? '') ?: (($p['event'] ?? '') ?: 'Flood Alert');
        $out[] = [
            'id'          => 'nws-flood-' . ($f['id'] ?? md5($title . ($p['sent'] ?? ''))),
            'title'       => $title,
            'type'        => 'flood',
            'severity'    => $severity,
            'source'      => 'NWS',
            'publishedAt' => $p['sent'] ?? gmdate('c'),
            'description' => $p['description'] ?? null,
            'countries'   => isset($p['areaDesc']) ? [$p['areaDesc']] : [],
            'url'         => 'https://www.weather.gov/alerts',
        ];
    }
    return $out;
}

// ── NWS Severe Weather Alerts ─────────────────────────────────────────────────
function fetch_nws_storms(): array {
    $raw = http_get('https://api.weather.gov/alerts/active?event=Severe%20Thunderstorm%20Warning,Severe%20Thunderstorm%20Watch,Tornado%20Warning,Tornado%20Watch');
    if (!$raw) return [];
    $data = json_decode($raw, true);
    $out  = [];
    foreach ($data['features'] ?? [] as $f) {
        $p = $f['properties'] ?? [];
        $sev = strtolower($p['severity'] ?? '');
        $severity = ($sev === 'extreme' || $sev === 'severe') ? 'high' : 'medium';
        $title = ($p['headline'] ?? '') ?: (($p['event'] ?? '') ?: 'Severe Weather Alert');
        $out[] = [
            'id'          => 'nws-storm-' . ($f['id'] ?? md5($title . ($p['sent'] ?? ''))),
            'title'       => $title,
            'type'        => 'storm',
            'severity'    => $severity,
            'source'      => 'NWS',
            'publishedAt' => $p['sent'] ?? gmdate('c'),
            'description' => $p['description'] ?? null,
            'countries'   => isset($p['areaDesc']) ? [$p['areaDesc']] : [],
            'url'         => 'https://www.weather.gov/alerts',
        ];
    }
    return $out;
}

// ── Smithsonian GVP Weekly Volcanic Activity Report ───────────────────────────
function fetch_gvp(): array {
    $xml = http_get('https://volcano.si.edu/news/WeeklyVolcanoRSS.xml');
    if (!$xml) return [];
    $out = [];
    preg_match_all('/<item>([\s\S]*?)<\/item>/', $xml, $matches);
    foreach ($matches[1] as $content) {
        $get = function(string $tag) use ($content): ?string {
            if (!preg_match('/<' . preg_quote($tag, '/') . '[^>]*>([\s\S]*?)<\/' . preg_quote($tag, '/') . '>/', $content, $m)) return null;
            return trim(preg_replace('/<!\[CDATA\[|\]\]>/', '', $m[1]));
        };
        $title   = $get('title') ?? 'Unknown Volcano Activity';
        $link    = $get('link');
        $pubDate = $get('pubDate');
        $out[] = [
            'id'          => 'gvp-' . md5($link ?? $title),
            'title'       => $title,
            'type'        => 'volcano',
            'severity'    => 'high',
            'source'      => 'Smithsonian GVP',
            'publishedAt' => $pubDate ? gmdate('c', strtotime($pubDate)) : gmdate('c'),
            'description' => $get('description') ?: null,
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

function _eonet_map(array $e): array {
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
    $catId  = $e['categories'][0]['id'] ?? '';
    $type   = $catMap[$catId] ?? classify_type($e['title'] ?? '');
    $geos   = $e['geometry'] ?? [];
    $latest = !empty($geos) ? end($geos) : null;
    $url    = $e['sources'][0]['url'] ?? ($e['link'] ?? null);
    $catTitles = array_map(fn($c) => $c['title'] ?? '', $e['categories'] ?? []);
    $severity = in_array($type, ['wildfire', 'storm', 'volcano'], true) ? 'high' : 'medium';
    return [
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

// ── NASA EONET open events ────────────────────────────────────────────────────
function fetch_eonet_open(int $days, int $limit): array {
    $raw = http_get("https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days={$days}&limit={$limit}");
    if (!$raw) return [];
    $data = json_decode($raw, true);
    $out = [];
    foreach ($data['events'] ?? [] as $e) {
        $out[] = _eonet_map($e);
    }
    return $out;
}

// ── NASA EONET closed events by category ─────────────────────────────────────
function fetch_eonet_closed(string $category, int $days, int $limit): array {
    $raw = http_get("https://eonet.gsfc.nasa.gov/api/v3/events?category={$category}&status=closed&days={$days}&limit={$limit}");
    if (!$raw) return [];
    $data = json_decode($raw, true);
    $out = [];
    foreach ($data['events'] ?? [] as $e) {
        $out[] = _eonet_map($e);
    }
    return $out;
}

// ── WHO Disease Outbreak News ─────────────────────────────────────────────────
function fetch_who(): array {
    $raw = http_get('https://www.who.int/api/news/diseaseoutbreaknews?$orderby=PublicationDateAndTime%20desc&$top=10');
    if (!$raw) return [];
    $data = json_decode($raw, true);
    $out  = [];
    foreach ($data['value'] ?? [] as $d) {
        $url = isset($d['ItemDefaultUrl'])
            ? 'https://www.who.int/emergencies/disease-outbreak-news/item' . $d['ItemDefaultUrl']
            : null;
        $out[] = [
            'id'          => 'who-' . ($d['Id'] ?? md5($d['Title'] ?? '')),
            'title'       => $d['Title'] ?? 'Disease Outbreak News',
            'type'        => 'epidemic',
            'severity'    => 'medium',
            'source'      => 'WHO',
            'publishedAt' => $d['PublicationDateAndTime'] ?? gmdate('c'),
            'description' => null,
            'countries'   => [],
            'url'         => $url,
        ];
    }
    return $out;
}

// ── NWS active tsunami alerts (Warning / Watch / Advisory) ─────────────────────
function fetch_tsunami(): array {
    $raw = http_get('https://api.weather.gov/alerts/active?code=TSW,TSA,TSY');
    if (!$raw) return [];
    $data = json_decode($raw, true);
    $out  = [];
    foreach ($data['features'] ?? [] as $f) {
        $p   = $f['properties'] ?? [];
        $sev = strtolower($p['severity'] ?? '');
        $severity = ($sev === 'extreme' || $sev === 'severe') ? 'high' : 'medium';
        $title = ($p['headline'] ?? '') ?: (($p['event'] ?? '') ?: 'Tsunami Alert');
        $out[] = [
            'id'          => 'nws-' . ($f['id'] ?? md5(($p['headline'] ?? '') . ($p['sent'] ?? ''))),
            'title'       => $title,
            'type'        => 'tsunami',
            'severity'    => $severity,
            'source'      => 'NWS',
            'publishedAt' => $p['sent'] ?? gmdate('c'),
            'description' => $p['description'] ?? null,
            'countries'   => isset($p['areaDesc']) ? [$p['areaDesc']] : [],
            'url'         => 'https://www.tsunami.gov/',
        ];
    }
    return $out;
}

$usgs         = fetch_usgs();
$nws_floods   = fetch_nws_floods();
$nws_storms   = fetch_nws_storms();
$gvp          = fetch_gvp();
$eonet_open   = fetch_eonet_open(30, 30);
$eonet_closed = array_merge(
    fetch_eonet_closed('floods', 730, 20),
    fetch_eonet_closed('severeStorms', 360, 15),
);
$who          = fetch_who();
$tsunami      = fetch_tsunami();

$combined = array_merge($usgs, $nws_floods, $nws_storms, $gvp, $eonet_open, $eonet_closed, $who, $tsunami);
usort($combined, fn($a, $b) => strtotime($b['publishedAt']) - strtotime($a['publishedAt']));

$json = json_encode($combined, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
@file_put_contents($cacheFile, $json);

echo $json;
exit;
