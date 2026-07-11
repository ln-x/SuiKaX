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

// Only trust the cache if it actually decodes to the current response shape
// — { events: [...], sources: [...] } — with a non-empty events array. This
// deliberately rejects two kinds of stale cache: (1) a file written during
// an earlier failure (e.g. the now-removed auth requirement blocking every
// fetch), and (2) a file written by an older version of this script before
// the events/sources wrapper was introduced (a bare array). Either must
// never be served blindly for up to 30 minutes just because it's "fresh"
// by mtime — that would silently resurrect a bug we already fixed in code.
if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < $cacheTtl) {
    $cached = file_get_contents($cacheFile);
    $decoded = $cached !== false ? json_decode($cached, true) : null;
    if (is_array($decoded) && isset($decoded['events']) && is_array($decoded['events']) && count($decoded['events']) > 0) {
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
function debug_log(string $msg): void {
    $file = sys_get_temp_dir() . '/suika_earth_feeds_debug.log';
    @file_put_contents($file, '[' . gmdate('c') . '] ' . $msg . "\n", FILE_APPEND);
}

// Hard wall-clock watchdog (default 20s) on top of per-handle CURLOPT_TIMEOUT.
// Some shared-hosting FastCGI/reverse-proxy stacks kill the whole PHP process
// on their own hard timeout *before* PHP's own error handling (and even
// register_shutdown_function) gets a chance to run, producing a completely
// silent empty response. Bailing out of the select loop ourselves — instead
// of trusting curl_multi_exec()'s $running flag to reach 0 — guarantees we
// always reach the code that builds and echoes a response.
function http_get_multi(array $urls, int $wallClockBudgetSec = 20): array {
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
            // HTTP/2 multiplexing across many concurrent curl_multi handles
            // has caused select()-loop hangs on some older curl/proxy combos;
            // force HTTP/1.1 which every one of these upstream hosts supports.
            CURLOPT_HTTP_VERSION   => CURL_HTTP_VERSION_1_1,
        ]);
        curl_multi_add_handle($mh, $ch);
        $handles[$i] = $ch;
    }

    debug_log("http_get_multi: starting {$count} handles");
    $start = microtime(true);
    $running = null;
    do {
        $status = curl_multi_exec($mh, $running);
        if ($running) curl_multi_select($mh, 1.0);
        if ((microtime(true) - $start) > $wallClockBudgetSec) {
            debug_log("http_get_multi: wall-clock budget exceeded, bailing with {$running} still running");
            break;
        }
    } while ($running && $status === CURLM_OK);
    debug_log('http_get_multi: loop finished after ' . round(microtime(true) - $start, 2) . 's');

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

// ── EO-aware type classifier ──────────────────────────────────────────────────
// Like classify_type() but falls back to 'eo-news' instead of 'other', so
// ESA/Copernicus/NASA editorial articles remain distinct from operational alerts.
function classify_eo_type(string $title, string $desc): string {
    $t = strtolower($title . ' ' . $desc);
    if (str_contains($t, 'earthquake') || str_contains($t, 'seismic'))    return 'earthquake';
    if (str_contains($t, 'flood'))                                         return 'flood';
    if (str_contains($t, 'storm') || str_contains($t, 'cyclone') || str_contains($t, 'typhoon') || str_contains($t, 'hurricane')) return 'storm';
    if (str_contains($t, 'volcano') || str_contains($t, 'volcanic'))      return 'volcano';
    if (str_contains($t, 'drought'))                                       return 'drought';
    if (str_contains($t, 'wildfire') || (str_contains($t, 'fire') && str_contains($t, 'forest'))) return 'wildfire';
    if (str_contains($t, 'tsunami'))                                       return 'tsunami';
    if (str_contains($t, 'epidemic') || str_contains($t, 'outbreak') || str_contains($t, 'disease')) return 'epidemic';
    return 'eo-news';
}

// ── og:image scraper (ESA / Copernicus — their RSS omits images) ─────────────
// File-based TTL cache so repeated requests within the same feed cycle skip
// re-scraping. Mirrors Node's LruCache<string,string|null> TTL behaviour.
define('OG_HIT_TTL',  86400); // 24h for successful hits
define('OG_MISS_TTL',   600); // 10min for null/error misses — self-heals quickly

function og_cache_get(string $url): string|null|false {
    $file = sys_get_temp_dir() . '/suika_og_' . md5($url) . '.cache';
    if (!file_exists($file)) return false;
    $data = @json_decode((string)@file_get_contents($file), true);
    if (!is_array($data) || !isset($data['expires'])) return false;
    if (time() > (int)$data['expires']) { @unlink($file); return false; }
    return $data['value']; // string URL (hit) or null (miss)
}

function og_cache_set(string $url, string|null $value, int $ttl): void {
    $file = sys_get_temp_dir() . '/suika_og_' . md5($url) . '.cache';
    @file_put_contents($file, json_encode(['value' => $value, 'expires' => time() + $ttl]));
}

function og_is_absolute_url(string $url): bool {
    return (bool)preg_match('/^https?:\/\/.+/', $url);
}

function og_extract_from_html(string $html): ?string {
    // property-first variant
    if (preg_match('/<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']/', $html, $m)
     || preg_match('/<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']/', $html, $m)) {
        $url = trim($m[1]);
        return og_is_absolute_url($url) ? $url : null;
    }
    return null;
}

// Sources whose RSS feeds omit image URLs — we scrape og:image from the article page.
const OG_SCRAPE_SOURCES = ['ESA', 'Copernicus'];

function backfill_og_images(array &$items): void {
    // Split into cached-already and needs-fetch
    $todo_idx  = []; // item index => article url
    foreach ($items as $i => &$item) {
        if ($item['imageUrl'] || !$item['url']) continue;
        if (!in_array($item['source'], OG_SCRAPE_SOURCES, true)) continue;
        $cached = og_cache_get($item['url']);
        if ($cached !== false) {
            if ($cached) $item['imageUrl'] = $cached;
            continue;
        }
        $todo_idx[$i] = $item['url'];
    }
    unset($item);
    if (empty($todo_idx)) return;

    // Batch-fetch article pages concurrently with curl_multi.
    // Each handle gets a write function that aborts the transfer once we have
    // enough HTML to find <og:image> (first </head> or 20 KB) — saves bandwidth.
    $indices = array_keys($todo_idx);
    $urls    = array_values($todo_idx);
    $n       = count($urls);
    $buffers = array_fill(0, $n, '');

    $mh      = curl_multi_init();
    $handles = [];
    for ($j = 0; $j < $n; $j++) {
        $ch = curl_init($urls[$j]);
        $jCapture = $j;
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => false,
            CURLOPT_TIMEOUT        => 8,
            CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_USERAGENT      => 'SuiKa-App/1.0 (burnout-recovery-companion)',
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_HTTP_VERSION   => CURL_HTTP_VERSION_1_1,
            CURLOPT_WRITEFUNCTION  => function($ch, $data) use (&$buffers, $jCapture): int {
                $buffers[$jCapture] .= $data;
                // Abort once we reach </head> or 20 KB — og:image is always in <head>
                if (str_contains($buffers[$jCapture], '</head>') || strlen($buffers[$jCapture]) >= 20480) {
                    return -1; // triggers CURLE_WRITE_ERROR (23) — expected, not a real error
                }
                return strlen($data);
            },
        ]);
        curl_multi_add_handle($mh, $ch);
        $handles[$j] = $ch;
    }

    $start   = microtime(true);
    $running = null;
    do {
        curl_multi_exec($mh, $running);
        if ($running) curl_multi_select($mh, 0.5);
        if ((microtime(true) - $start) > 9) break; // 9s wall-clock budget
    } while ($running);

    foreach ($handles as $j => $ch) {
        curl_multi_remove_handle($mh, $ch);
        curl_close($ch);
    }
    curl_multi_close($mh);

    // Extract og:image from partial HTML, cache + apply results
    foreach ($indices as $k => $i) {
        $html    = $buffers[$k];
        $imgUrl  = $html ? og_extract_from_html($html) : null;
        og_cache_set($todo_idx[$i], $imgUrl, $imgUrl ? OG_HIT_TTL : OG_MISS_TTL);
        if ($imgUrl) $items[$i]['imageUrl'] = $imgUrl;
    }
    debug_log('backfill_og_images: scraped ' . $n . ' pages, found ' . count(array_filter(array_map(fn($i) => $items[$i]['imageUrl'], $indices))) . ' images');
}

// ── Generic RSS 2.0 parser (ESA / Copernicus / NASA EO) ───────────────────────
function parse_eo_rss(string|false $raw, string $source): array {
    if (!$raw) return [];
    $out  = [];
    $seen = [];
    preg_match_all('/<item>([\s\S]*?)<\/item>/', $raw, $matches);
    foreach ($matches[1] ?? [] as $content) {
        $get = function(string $tag) use ($content): ?string {
            if (!preg_match('/<' . preg_quote($tag, '/') . '[^>]*>([\s\S]*?)<\/' . preg_quote($tag, '/') . '>/', $content, $m)) return null;
            $val = preg_replace('/<!\[CDATA\[|\]\]>/', '', $m[1]);
            $val = trim(strip_tags((string)$val));
            return $val !== '' ? $val : null;
        };
        $title   = $get('title') ?? 'EO News';
        $link    = $get('link') ?? $get('guid') ?? null;
        $pubDate = $get('pubDate') ?? null;
        $desc    = $get('description') ?? null;
        $key = $link ?? $title;
        if (isset($seen[$key])) continue;
        $seen[$key] = true;
        $type = classify_eo_type($title, (string)$desc);
        // Extract thumbnail: media:thumbnail, media:content medium="image", enclosure type="image/..."
        $imageUrl = null;
        if (preg_match('/media:thumbnail[^>]+url=["\']([^"\']+)["\']/', $content, $tm)) {
            $imageUrl = $tm[1];
        } elseif (preg_match('/media:content[^>]+url=["\']([^"\']+)["\'][^>]+medium=["\']image["\']/', $content, $tm)
               || preg_match('/media:content[^>]+medium=["\']image["\'][^>]+url=["\']([^"\']+)["\']/', $content, $tm)) {
            $imageUrl = $tm[1];
        } elseif (preg_match('/enclosure[^>]+url=["\']([^"\']+)["\'][^>]+type=["\']image\//', $content, $tm)
               || preg_match('/enclosure[^>]+type=["\']image\/[^"\']*["\'][^>]+url=["\']([^"\']+)["\']/', $content, $tm)) {
            $imageUrl = $tm[1];
        }
        $out[] = [
            'id'          => 'eo-' . substr(md5($key), 0, 10),
            'title'       => $title,
            'type'        => $type,
            'severity'    => $type !== 'eo-news' ? 'medium' : 'low',
            'source'      => $source,
            'publishedAt' => $pubDate ? gmdate('c', (int)strtotime($pubDate)) : gmdate('c'),
            'description' => $desc ? mb_substr(strip_tags((string)$desc), 0, 200) : null,
            'countries'   => [],
            'url'         => $link,
            'imageUrl'    => $imageUrl,
        ];
    }
    return $out;
}

// Fetch all 14 independent upstream feeds concurrently — see http_get_multi()
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
    $eonetClosedIceRaw,
    $eoEsaRaw,
    $eoCopernicusRaw,
    $eoNasaRaw,
    $eoNasaHazardsRaw,
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
    // Icebergs (EONET's "Sea and Lake Ice" category) are long-lived but
    // eventually marked closed once they drift/melt/get archived — without
    // this, an iceberg disappears from the feed the moment EONET closes it,
    // even though it's still a real, recent event worth surfacing.
    'https://eonet.gsfc.nasa.gov/api/v3/events?category=seaLakeIce&status=closed&days=360&limit=15',
    // EO news: editorial articles from ESA, Copernicus, and NASA Earth Observatory.
    // Natural Hazards feed may overlap with the main EO feed — deduplicated by ID below.
    'https://www.esa.int/rssfeed/Our_Activities/Observing_the_Earth',
    'https://www.copernicus.eu/en/rss.xml',
    'https://earthobservatory.nasa.gov/feeds/earth-observatory.rss',
    'https://earthobservatory.nasa.gov/feeds/natural-hazards.rss',
]);

// Build a { name, status, count, error } entry per source, mirroring the
// Node reference implementation's SourceStatus shape (artifacts/api-server
// /src/routes/earth-feeds.ts) so the frontend's `data.sources` rendering
// works identically on both backends.
function source_status(string $name, string|false $raw, array $items): array {
    if ($raw === false) {
        return ['name' => $name, 'status' => 'error', 'count' => 0, 'error' => 'fetch failed'];
    }
    if (count($items) === 0) {
        return ['name' => $name, 'status' => 'empty', 'count' => 0, 'error' => null];
    }
    return ['name' => $name, 'status' => 'ok', 'count' => count($items), 'error' => null];
}

debug_log('parsing: usgs');
$usgs         = parse_usgs($usgsRaw);
debug_log('parsing: nws_floods');
$nws_floods   = parse_nws_floods($nwsFloodsRaw);
debug_log('parsing: nws_storms');
$nws_storms   = parse_nws_storms($nwsStormsRaw);
debug_log('parsing: gvp');
$gvp          = parse_gvp($gvpRaw);
debug_log('parsing: eonet_open');
$eonet_open   = parse_eonet($eonetOpenRaw);
debug_log('parsing: eonet_closed');
$eonet_closed = array_merge(
    parse_eonet($eonetClosedFloodsRaw),
    parse_eonet($eonetClosedStormsRaw),
    parse_eonet($eonetClosedIceRaw),
);
debug_log('parsing: who');
$who          = parse_who($whoRaw);
debug_log('parsing: tsunami');
$tsunami      = parse_tsunami($tsunamiRaw);
debug_log('parsing: copernicus (raw len=' . ($copernicusRaw !== false ? strlen($copernicusRaw) : 'FALSE') . ')');
$copernicus   = parse_copernicus_ems($copernicusRaw);
debug_log('parsing: eo_news');
$eo_esa           = parse_eo_rss($eoEsaRaw, 'ESA');
$eo_copernicus    = parse_eo_rss($eoCopernicusRaw, 'Copernicus');
$eo_nasa          = parse_eo_rss($eoNasaRaw, 'NASA EO');
$eo_nasa_hazards  = parse_eo_rss($eoNasaHazardsRaw, 'NASA EO');
// Merge all EO feeds and deduplicate by ID (NASA EO + Natural Hazards overlap)
$eo_all  = [];
$eo_seen = [];
foreach (array_merge($eo_esa, $eo_copernicus, $eo_nasa, $eo_nasa_hazards) as $item) {
    if (!isset($eo_seen[$item['id']])) {
        $eo_seen[$item['id']] = true;
        $eo_all[] = $item;
    }
}
$eo_all = array_slice($eo_all, 0, 30);
// Scrape og:image for ESA/Copernicus items that don't have a thumbnail in RSS
debug_log('backfill_og_images: starting');
backfill_og_images($eo_all);
debug_log('backfill_og_images: done');
debug_log('parsing: done, counts usgs=' . count($usgs) . ' nws_floods=' . count($nws_floods) . ' nws_storms=' . count($nws_storms)
    . ' gvp=' . count($gvp) . ' eonet_open=' . count($eonet_open) . ' eonet_closed=' . count($eonet_closed)
    . ' who=' . count($who) . ' tsunami=' . count($tsunami) . ' copernicus=' . count($copernicus)
    . ' eo_all=' . count($eo_all));

$eonet_all = array_merge($eonet_open, $eonet_closed);
// Each EO RSS feed gets its own source status — independent status + stale-cache
// slot per feed, mirroring the Node makeEoFetcher() approach.
$sources = [
    source_status('USGS', $usgsRaw, $usgs),
    source_status('NWS Floods', $nwsFloodsRaw, $nws_floods),
    source_status('NWS Storms', $nwsStormsRaw, $nws_storms),
    source_status('NWS Tsunami', $tsunamiRaw, $tsunami),
    source_status('GVP', $gvpRaw, $gvp),
    source_status('NASA EONET', $eonetOpenRaw, $eonet_all),
    source_status('WHO', $whoRaw, $who),
    source_status('Copernicus EMS', $copernicusRaw, $copernicus),
    source_status('ESA', $eoEsaRaw, $eo_esa),
    source_status('Copernicus News', $eoCopernicusRaw, $eo_copernicus),
    source_status('NASA EO', $eoNasaRaw, $eo_nasa),
    source_status('NASA Hazards', $eoNasaHazardsRaw, $eo_nasa_hazards),
];

$combined = array_merge($usgs, $nws_floods, $nws_storms, $gvp, $eonet_open, $eonet_closed, $who, $tsunami, $copernicus, $eo_all);
debug_log('sorting ' . count($combined) . ' combined events');
usort($combined, fn($a, $b) => strtotime($b['publishedAt']) - strtotime($a['publishedAt']));

// The frontend (EarthTab.tsx) expects `{ events, sources }`, matching the
// Node reference implementation's response shape — NOT a bare array. This
// mismatch was the actual reason the site showed zero events even after
// the earlier UTF-8/json_encode bug was fixed: the API returned valid JSON,
// but as a plain array, so `data?.events` was always undefined client-side.
$responseBody = ['events' => $combined, 'sources' => $sources];

// Upstream feeds (GVP's RSS/XML in particular) occasionally contain bytes
// that aren't valid UTF-8. json_encode() has no partial-failure mode — one
// bad byte anywhere in the whole tree makes the entire call return false,
// which we'd then blindly echo as a 200-OK empty body. This is exactly what
// caused the silent empty responses seen in production. JSON_INVALID_UTF8_SUBSTITUTE
// swaps invalid bytes for U+FFFD instead of failing the whole encode.
debug_log('json_encode starting');
$json = json_encode($responseBody, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
debug_log('json_encode done, json_last_error=' . json_last_error() . ' (' . json_last_error_msg() . '), len=' . ($json === false ? 'FALSE' : strlen($json)));

// Belt-and-suspenders: if encoding still somehow fails, never echo `false`
// as a fake 200-OK empty body again — return a real error so it's visible.
if ($json === false) {
    debug_log('json_encode STILL failed after substitute flag: ' . json_last_error_msg());
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Failed to encode earth feeds', 'detail' => json_last_error_msg()]);
    exit;
}
// Only persist non-empty results — never let a transient all-feeds-failed
// moment get cached and served as "no events" for a full 30 minutes.
if (count($combined) > 0) {
    @file_put_contents($cacheFile, $json);
}

debug_log('echoing response, about to exit');
echo $json;
exit;
