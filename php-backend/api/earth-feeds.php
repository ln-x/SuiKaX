<?php
// Temporary diagnostic: surface any fatal error as JSON instead of a silent
// empty response, so we can see exactly what's failing on this host. Safe to
// keep — it never exposes anything beyond what error_get_last() reports, and
// only fires when the script would otherwise have produced zero output.
register_shutdown_function(function () {
    $error = error_get_last();
    if ($error && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        if (!headers_sent()) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
        }
        echo json_encode([
            'fatal_error' => true,
            'message'     => $error['message'],
            'file'        => $error['file'],
            'line'        => $error['line'],
        ]);
    }
});

require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') err('Method not allowed', 405);

// Public endpoint — Earth feeds are global data, not tied to a user account.
// Guests must be able to load this tab, same as local-env.php.

$cacheFile = sys_get_temp_dir() . '/suika_earth_feeds.json';
$cacheTtl  = 1800;

// Only trust the cache if it actually decodes to a non-empty JSON array —
// a stale/empty file (e.g. written during an earlier failure, such as the
// now-removed auth requirement blocking every fetch) must never be served
// blindly for up to 30 minutes just because it's "fresh" by mtime.
if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < $cacheTtl) {
    $cached = file_get_contents($cacheFile);
    $decoded = $cached !== false ? json_decode($cached, true) : null;
    if (is_array($decoded) && count($decoded) > 0) {
        header('Content-Type: application/json; charset=utf-8');
        echo $cached;
        exit;
    }
}

// ── HTTP helpers ────────────────────────────────────────────────────────────
// This endpoint aggregates up to 9 independent upstream feeds (USGS, NWS x3,
// GVP, EONET x3, WHO). Fetching them one-by-one with curl_get() could take up
// to 9 × 12s ≈ 108s in the worst case (e.g. when GVP or EONET are slow or
// unreachable), which exceeds the default PHP max_execution_time on most
// shared hosts (commonly 30s) — causing the *whole* endpoint to fatal out
// with no output, even though most feeds succeeded. curl_multi fetches all
// URLs concurrently so the worst case is ~one timeout (12s) instead of N.
function http_get_multi(array $urls): array {
    $count = count($urls);
    $results = array_fill(0, $count, false);
    if (!function_exists('curl_multi_init')) {
        foreach ($urls as $i => $url) {
            $results[$i] = @file_get_contents($url);
        }
        return $results;
    }

    $mh = curl_multi_init();
    $handles = [];
    foreach ($urls as $i => $url) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 12,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_USERAGENT      => 'SuiKa-App/1.0 (burnout-recovery-companion)',
            CURLOPT_SSL_VERIFYPEER => true,
        ]);
        curl_multi_add_handle($mh, $ch);
        $handles[$i] = $ch;
    }

    $running = null;
    do {
        $status = curl_multi_exec($mh, $running);
        if ($running) curl_multi_select($mh, 1.0);
    } while ($running && $status === CURLM_OK);

    foreach ($handles as $i => $ch) {
        $body = curl_multi_getcontent($ch);
        $results[$i] = ($body !== false && $body !== '') ? $body : false;
        curl_multi_remove_handle($mh, $ch);
        curl_close($ch);
    }
    curl_multi_close($mh);

    return $results;
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
function parse_nws_floods(string|false $raw): array {
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
function parse_nws_storms(string|false $raw): array {
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
function parse_gvp(string|false $xml): array {
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
function parse_usgs(string|false $raw): array {
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

// ── NASA EONET open/closed events ──────────────────────────────────────────────
function parse_eonet(string|false $raw): array {
    if (!$raw) return [];
    $data = json_decode($raw, true);
    $out = [];
    foreach ($data['events'] ?? [] as $e) {
        $out[] = _eonet_map($e);
    }
    return $out;
}

// ── WHO Disease Outbreak News ─────────────────────────────────────────────────
function parse_who(string|false $raw): array {
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
function parse_tsunami(string|false $raw): array {
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

// ── Copernicus EMS Rapid Mapping ────────────────────────────────────────────
function parse_copernicus_ems(string|false $raw): array {
    if (!$raw) return [];
    $data = json_decode($raw, true);
    $catMap = [
        'Wildfire'                              => 'wildfire',
        'Flood'                                  => 'flood',
        'Storm'                                  => 'storm',
        'Tropical Cyclone'                       => 'storm',
        'Earthquake'                              => 'earthquake',
        'Volcano'                                => 'volcano',
        'Drought'                                => 'drought',
        'Man-made accidents'                     => 'other',
        'Man-made accidents technological disasters' => 'other',
    ];
    $out = [];
    foreach ($data['results'] ?? [] as $a) {
        $category = $a['category'] ?? '';
        $type     = $catMap[$category] ?? classify_type($a['name'] ?? $category);
        $closed   = !empty($a['closed']);
        $out[] = [
            'id'          => 'copernicus-ems-' . ($a['code'] ?? md5($a['name'] ?? '')),
            'title'       => $a['name'] ?? ('Copernicus EMS Activation ' . ($a['code'] ?? '')),
            'type'        => $type,
            'severity'    => $closed ? 'low' : 'medium',
            'source'      => 'Copernicus EMS',
            'publishedAt' => $a['activationTime'] ?? ($a['eventTime'] ?? ($a['lastUpdate'] ?? gmdate('c'))),
            'description' => $category ? ($category . ' activation' . ($closed ? ' (closed)' : '')) : null,
            'countries'   => $a['countries'] ?? [],
            'url'         => isset($a['code']) ? ('https://mapping.emergency.copernicus.eu/activations/' . $a['code']) : null,
        ];
    }
    return $out;
}

// Fetch all 10 independent upstream feeds concurrently — see http_get_multi()
// docblock for why this matters (sequential fetching risked exceeding the
// host's max_execution_time and fatal-erroring the whole endpoint).
[
    $usgsRaw,
    $nwsFloodsRaw,
    $nwsStormsRaw,
    $gvpRaw,
    $eonetOpenRaw,
    $eonetClosedFloodsRaw,
    $eonetClosedStormsRaw,
    $whoRaw,
    $tsunamiRaw,
    $copernicusRaw,
] = http_get_multi([
    'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson',
    'https://api.weather.gov/alerts/active?event=Flood%20Warning,Flash%20Flood%20Warning,Flood%20Watch',
    'https://api.weather.gov/alerts/active?event=Severe%20Thunderstorm%20Warning,Severe%20Thunderstorm%20Watch,Tornado%20Warning,Tornado%20Watch',
    'https://volcano.si.edu/news/WeeklyVolcanoRSS.xml',
    'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=30&limit=30',
    'https://eonet.gsfc.nasa.gov/api/v3/events?category=floods&status=closed&days=730&limit=20',
    'https://eonet.gsfc.nasa.gov/api/v3/events?category=severeStorms&status=closed&days=360&limit=15',
    'https://www.who.int/api/news/diseaseoutbreaknews?$orderby=PublicationDateAndTime%20desc&$top=10',
    'https://api.weather.gov/alerts/active?code=TSW,TSA,TSY',
    'https://rapidmapping.emergency.copernicus.eu/backend/dashboard-api/public-activations-info/?limit=30',
]);

$usgs         = parse_usgs($usgsRaw);
$nws_floods   = parse_nws_floods($nwsFloodsRaw);
$nws_storms   = parse_nws_storms($nwsStormsRaw);
$gvp          = parse_gvp($gvpRaw);
$eonet_open   = parse_eonet($eonetOpenRaw);
$eonet_closed = array_merge(
    parse_eonet($eonetClosedFloodsRaw),
    parse_eonet($eonetClosedStormsRaw),
);
$who          = parse_who($whoRaw);
$tsunami      = parse_tsunami($tsunamiRaw);
$copernicus   = parse_copernicus_ems($copernicusRaw);

$combined = array_merge($usgs, $nws_floods, $nws_storms, $gvp, $eonet_open, $eonet_closed, $who, $tsunami, $copernicus);
usort($combined, fn($a, $b) => strtotime($b['publishedAt']) - strtotime($a['publishedAt']));

$json = json_encode($combined, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
// Only persist non-empty results — never let a transient all-feeds-failed
// moment get cached and served as "no events" for a full 30 minutes.
if (count($combined) > 0) {
    @file_put_contents($cacheFile, $json);
}

echo $json;
exit;
