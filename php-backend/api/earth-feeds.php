<?php
require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') err('Method not allowed', 405);

require_auth();

$cacheFile = sys_get_temp_dir() . '/suika_earth_feeds.json';
$cacheTtl  = 1800; // 30 minutes

if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < $cacheTtl) {
    $cached = file_get_contents($cacheFile);
    header('Content-Type: application/json; charset=utf-8');
    echo $cached;
    exit;
}

// ── ReliefWeb ─────────────────────────────────────────────────────────────────
function fetch_reliefweb(): array {
    $url  = 'https://api.reliefweb.int/v1/disasters?appname=suika-app&limit=10'
          . '&fields[include][]=name&fields[include][]=status&fields[include][]=date'
          . '&fields[include][]=country&fields[include][]=url_alias';
    $json = @file_get_contents($url);
    if (!$json) return [];

    $data  = json_decode($json, true);
    $items = $data['data'] ?? [];
    $out   = [];

    foreach ($items as $item) {
        $f       = $item['fields'] ?? [];
        $title   = $f['name'] ?? 'Unknown Event';
        $type    = classify_reliefweb($title);
        $status  = $f['status'] ?? '';
        $out[]   = [
            'id'          => 'rw-' . $item['id'],
            'title'       => $title,
            'type'        => $type,
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

function classify_reliefweb(string $title): string {
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
    $xml = @file_get_contents('https://www.gdacs.org/xml/rss_7days.xml');
    if (!$xml) return [];

    $out = [];
    preg_match_all('/<item>([\s\S]*?)<\/item>/', $xml, $matches);

    foreach ($matches[1] as $content) {
        $get = function(string $tag) use ($content): ?string {
            if (!preg_match('/<' . preg_quote($tag, '/') . '[^>]*>([\s\S]*?)<\/' . preg_quote($tag, '/') . '>/', $content, $m)) return null;
            return trim(preg_replace('/<!\[CDATA\[|\]\]>/', '', $m[1]));
        };

        $title   = $get('title') ?? 'Unknown Event';
        $t       = strtolower($title);
        $link    = $get('link');
        $pubDate = $get('pubDate');
        $alert   = strtolower($get('gdacs:alertlevel') ?? '');

        $severity = 'medium';
        if (str_contains($alert, 'red') || str_contains($alert, 'orange')) $severity = 'high';
        elseif (str_contains($alert, 'green'))                              $severity = 'low';

        $type = 'other';
        if (str_contains($t, 'earthquake'))                                          $type = 'earthquake';
        elseif (str_contains($t, 'flood'))                                           $type = 'flood';
        elseif (str_contains($t, 'storm') || str_contains($t, 'cyclone') || str_contains($t, 'typhoon')) $type = 'storm';
        elseif (str_contains($t, 'volcano'))                                         $type = 'volcano';
        elseif (str_contains($t, 'drought'))                                         $type = 'drought';
        elseif (str_contains($t, 'wildfire') || str_contains($t, 'fire'))           $type = 'wildfire';
        elseif (str_contains($t, 'tsunami'))                                         $type = 'tsunami';

        $out[] = [
            'id'          => 'gdacs-' . md5($link ?? $title),
            'title'       => $title,
            'type'        => $type,
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

$reliefweb = fetch_reliefweb();
$gdacs     = fetch_gdacs();
$combined  = array_merge($gdacs, $reliefweb);

$json = json_encode($combined, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
@file_put_contents($cacheFile, $json);

echo $json;
exit;
