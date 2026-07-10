<?php
// local-env.php — live local environment data (Open-Meteo, CAMS, NASA POWER)
// Public endpoint: works for guests (default Vienna location) and for logged-in
// users with a saved location. Never throws raw errors into the JSON body.

@ini_set('display_errors', '0');
@error_reporting(0);

require_once __DIR__ . '/bootstrap.php';

const DEFAULT_LAT = 48.2082;
const DEFAULT_LON = 16.3738;
const WX_TTL = 15 * 60;      // 15 min
const POWER_TTL = 6 * 3600;  // 6 hours
const FETCH_TIMEOUT_SEC = 12;

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(float $n, int $d = 0): float { return (float) round($n, $d); }

function http_get_json(string $url, array $headers = []): ?array {
    if (!function_exists('curl_init')) return null;
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => FETCH_TIMEOUT_SEC,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_HTTPHEADER     => array_merge(['User-Agent: SuiKa-App/1.0 (burnout-recovery-companion)'], $headers),
    ]);
    $body = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($body === false || $status < 200 || $status >= 300) return null;
    $decoded = json_decode($body, true);
    return is_array($decoded) ? $decoded : null;
}

function daylight_desc(int $pct): string {
    if ($pct > 80) return "Clear skies with abundant sunshine. Excellent conditions for outdoor activity and natural light exposure.";
    if ($pct > 60) return "Mostly sunny with some cloud cover. Good natural light for mood and energy.";
    if ($pct > 40) return "Partly cloudy. Moderate light exposure — consider outdoor breaks during clear spells.";
    return "Overcast conditions. Limited natural light may affect mood and energy levels.";
}

function windchill_desc(float $diff): string {
    if ($diff > 5) return "Strong wind chill. Dress warmer than the actual temperature suggests.";
    if ($diff > 2) return "Moderate wind chill. The wind makes it feel noticeably cooler.";
    if ($diff > -1) return "Mild wind chill. A slight cooling effect from the wind, but nothing uncomfortable.";
    return "No wind chill effect. The air feels warmer than the thermometer reads.";
}

function sultriness_level(float $humidity, float $feelsLike): string {
    if ($humidity > 75) return "Very Sultry";
    if ($humidity > 60 && $feelsLike > 22) return "Sultry";
    if ($humidity > 40 && $feelsLike > 22) return "Slightly Sultry";
    return "Comfortable";
}

function sultriness_desc(float $humidity, float $feelsLike): string {
    if ($humidity > 75) return "Very sultry. High humidity significantly increases heat stress. Stay hydrated.";
    if ($humidity > 60 && $feelsLike > 22) return "Sultry conditions. The combination of heat and humidity adds heat stress.";
    if ($humidity > 40 && $feelsLike > 22) return "Moderate sultriness. Some heat-humidity discomfort may occur during activity.";
    return "Not sultry. Humidity levels are comfortable and not adding to heat stress.";
}

function pressure_level(float $hPa): string {
    if ($hPa < 1000) return "Low";
    if ($hPa > 1020) return "High";
    return "Normal";
}

function pressure_desc(float $hPa): string {
    if ($hPa < 1000) return "Low pressure system. Some people experience headaches, fatigue, or joint discomfort during low pressure conditions.";
    if ($hPa > 1020) return "High pressure system. Clear, stable conditions often associated with good weather and easy breathing.";
    return "Normal atmospheric pressure. Comfortable for most people. No significant pressure-related effects expected.";
}

function aqi_label(int $aqi): string {
    if ($aqi <= 20) return "Good";
    if ($aqi <= 40) return "Fair";
    if ($aqi <= 60) return "Moderate";
    if ($aqi <= 80) return "Poor";
    if ($aqi <= 100) return "Very Poor";
    return "Extremely Poor";
}

function aqi_desc(int $aqi): string {
    if ($aqi <= 20) return "Air quality is excellent. No health concerns for any group.";
    if ($aqi <= 40) return "Air quality is fair. Outdoor activities are fine for most people.";
    if ($aqi <= 60) return "Moderate air quality. Sensitive individuals may want to limit prolonged outdoor exertion.";
    if ($aqi <= 80) return "Poor air quality. Sensitive groups should limit outdoor activities.";
    return "Very poor air quality. Most people should reduce outdoor activities.";
}

function pollen_severity(float $grains): string {
    if ($grains <= 10) return "Low";
    if ($grains <= 30) return "Moderate";
    if ($grains <= 60) return "High";
    return "Very High";
}

function pollen_desc(string $type, string $severity): string {
    if ($severity === "Low") return "Low pollen levels from $type. Minimal impact for most people.";
    if ($severity === "Moderate") return "Moderate pollen from $type. If you're sensitive, consider timing outdoor activities for early morning or after rain.";
    if ($severity === "High") return "High pollen from $type. Allergy sufferers should consider medication and limit time outdoors.";
    return "Very high pollen from $type. Strongly consider staying indoors and taking allergy medication.";
}

function temp_desc(float $anomaly): string {
    if ($anomaly > 3) return "Significantly warmer than usual. Heat may add to stress load on the nervous system.";
    if ($anomaly > 1) return "Above-average temperatures. Comfortable but warmer than the seasonal norm.";
    if ($anomaly > -1) return "Temperatures are close to the local average. Comfortable conditions for activity and recovery.";
    if ($anomaly > -3) return "Slightly below average temperatures. Cooler than the seasonal norm.";
    return "Significantly cooler than usual for this time of year.";
}

function prec_desc(float $pct): string {
    if ($pct > 30) return "Well above-normal precipitation. Wet conditions may limit outdoor activities.";
    if ($pct > 10) return "Slightly above normal precipitation for this period.";
    if ($pct > -10) return "Precipitation is near normal levels for this area.";
    if ($pct > -30) return "Drier than usual. Lower precipitation than typical for this time of year.";
    return "Significantly drier than normal. Drought conditions may be developing.";
}

// ── Weather + air quality (Open-Meteo, 15-min cache) ─────────────────────────
function fetch_weather(float $lat, float $lon): array {
    $wx = http_get_json(
        "https://api.open-meteo.com/v1/forecast?latitude={$lat}&longitude={$lon}" .
        "&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,surface_pressure" .
        "&daily=daylight_duration,sunshine_duration&timezone=auto&forecast_days=1"
    );
    $aq = http_get_json(
        "https://air-quality-api.open-meteo.com/v1/air-quality?latitude={$lat}&longitude={$lon}" .
        "&current=pm2_5,pm10,nitrogen_dioxide,ozone,sulphur_dioxide,european_aqi" .
        "&hourly=grass_pollen,birch_pollen,alder_pollen,mugwort_pollen,ragweed_pollen" .
        "&forecast_days=1&timezone=auto"
    );

    if ($wx === null || $aq === null) {
        throw new RuntimeException('Open-Meteo fetch failed');
    }

    $c = $wx['current'] ?? [];
    $wlat = fmt((float)($wx['latitude'] ?? $lat), 2);
    $wlon = fmt((float)($wx['longitude'] ?? $lon), 2);
    $qlat = fmt((float)($aq['latitude'] ?? $lat), 2);
    $qlon = fmt((float)($aq['longitude'] ?? $lon), 2);
    $elevation = isset($wx['elevation']) ? (int) round((float)$wx['elevation']) : null;

    $daylightSec = (float)($wx['daily']['daylight_duration'][0] ?? 0);
    $sunshineSec = (float)($wx['daily']['sunshine_duration'][0] ?? 0);
    $sunshinePercent = $daylightSec > 0 ? (int) round(($sunshineSec / $daylightSec) * 100) : 0;

    $temp = (float)($c['temperature_2m'] ?? 0);
    $feels = (float)($c['apparent_temperature'] ?? $temp);
    $humidity = (float)($c['relative_humidity_2m'] ?? 0);
    $wind = (float)($c['wind_speed_10m'] ?? 0);
    $pHpa = fmt((float)($c['surface_pressure'] ?? 1013), 0);
    $diff = $temp - $feels;
    $sultLevel = sultriness_level($humidity, $feels);

    $aqc = $aq['current'] ?? [];
    $aqi = (int) round((float)($aqc['european_aqi'] ?? 0));

    $pollen = null;
    $hourly = $aq['hourly'] ?? [];
    $times = $hourly['time'] ?? [];
    $hourIdx = min((int) date('G'), max(count($times) - 1, 0));
    if ($hourIdx >= 0 && count($times) > 0) {
        $candidates = [
            ['type' => 'Grass',   'grains' => (float)($hourly['grass_pollen'][$hourIdx] ?? 0)],
            ['type' => 'Birch',   'grains' => (float)($hourly['birch_pollen'][$hourIdx] ?? 0)],
            ['type' => 'Alder',   'grains' => (float)($hourly['alder_pollen'][$hourIdx] ?? 0)],
            ['type' => 'Mugwort', 'grains' => (float)($hourly['mugwort_pollen'][$hourIdx] ?? 0)],
            ['type' => 'Ragweed', 'grains' => (float)($hourly['ragweed_pollen'][$hourIdx] ?? 0)],
        ];
        $dominant = $candidates[0];
        foreach ($candidates as $cand) {
            if ($cand['grains'] > $dominant['grains']) $dominant = $cand;
        }
        if ($dominant['grains'] > 0) {
            $severity = pollen_severity($dominant['grains']);
            $pollen = [
                'dominant' => $dominant['type'],
                'grains' => fmt($dominant['grains'], 0),
                'severity' => $severity,
                'description' => pollen_desc($dominant['type'], $severity),
                'meta' => ['source' => 'Open-Meteo CAMS', 'grid' => '~11 km (CAMS Europe)', 'lat' => $qlat, 'lon' => $qlon],
            ];
        }
    }

    return [
        'daylight' => [
            'daylightSec' => (int) round($daylightSec),
            'sunshineSec' => (int) round($sunshineSec),
            'sunshinePercent' => $sunshinePercent,
            'description' => daylight_desc($sunshinePercent),
            'meta' => ['source' => 'Open-Meteo', 'grid' => '~1 km, interpolated to point', 'lat' => $wlat, 'lon' => $wlon, 'elevation' => $elevation],
        ],
        'windChill' => [
            'feelsLike' => fmt($feels, 1),
            'actualTemp' => fmt($temp, 1),
            'windSpeed' => fmt($wind, 1),
            'description' => windchill_desc($diff),
            'meta' => ['source' => 'Open-Meteo', 'grid' => '~1 km, interpolated to point', 'lat' => $wlat, 'lon' => $wlon],
        ],
        'sultriness' => [
            'feelsLike' => fmt($feels, 1),
            'actualTemp' => fmt($temp, 1),
            'humidity' => (int) round($humidity),
            'level' => $sultLevel,
            'description' => sultriness_desc($humidity, $feels),
            'meta' => ['source' => 'Open-Meteo', 'grid' => '~1 km, interpolated to point', 'lat' => $wlat, 'lon' => $wlon],
        ],
        'pressure' => [
            'hPa' => $pHpa,
            'level' => pressure_level($pHpa),
            'description' => pressure_desc($pHpa),
            'meta' => ['source' => 'Open-Meteo', 'grid' => '~1 km, interpolated to point', 'lat' => $wlat, 'lon' => $wlon, 'elevation' => $elevation],
        ],
        'airQuality' => [
            'aqi' => $aqi,
            'aqiLabel' => aqi_label($aqi),
            'pm25' => fmt((float)($aqc['pm2_5'] ?? 0), 0),
            'pm10' => fmt((float)($aqc['pm10'] ?? 0), 0),
            'no2' => fmt((float)($aqc['nitrogen_dioxide'] ?? 0), 0),
            'o3' => fmt((float)($aqc['ozone'] ?? 0), 0),
            'so2' => fmt((float)($aqc['sulphur_dioxide'] ?? 0), 0),
            'description' => aqi_desc($aqi),
            'meta' => ['source' => 'Copernicus CAMS', 'grid' => '~11 km (CAMS Europe)', 'lat' => $qlat, 'lon' => $qlon],
        ],
        'pollen' => $pollen,
    ];
}

// ── NASA POWER (30-day mean + 5yr historical comparison, 6-hour cache) ───────
function power_date(int $ts): string { return gmdate('Ymd', $ts); }

function fetch_power(float $lat, float $lon): array {
    $now = time();
    $d30 = $now - 30 * 86400;
    $hist5yEnd = strtotime('-5 years', $now);
    $hist5yStart = strtotime('-5 years', $d30);

    $base = "https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,PRECTOTCORR&community=AG&longitude={$lon}&latitude={$lat}&format=JSON";

    $cur = http_get_json("{$base}&start=" . power_date($d30) . "&end=" . power_date($now));
    $hist = http_get_json("{$base}&start=" . power_date($hist5yStart) . "&end=" . power_date($hist5yEnd));

    if ($cur === null || $hist === null) {
        throw new RuntimeException('NASA POWER fetch failed');
    }

    $validVals = function (array $obj): array {
        return array_values(array_filter($obj, fn($v) => $v != -999));
    };
    $mean = function (array $obj) use ($validVals): float {
        $v = $validVals($obj);
        return count($v) ? array_sum($v) / count($v) : 0.0;
    };
    $sum = function (array $obj) use ($validVals): float {
        return array_sum($validVals($obj));
    };

    $curT2M = $cur['properties']['parameter']['T2M'] ?? [];
    $histT2M = $hist['properties']['parameter']['T2M'] ?? [];
    $curP = $cur['properties']['parameter']['PRECTOTCORR'] ?? [];
    $histP = $hist['properties']['parameter']['PRECTOTCORR'] ?? [];

    $curT = $mean($curT2M);
    $histTMean = $mean($histT2M);
    $curPSum = $sum($curP);
    $histPSum = $sum($histP);
    $anomaly = $curT - $histTMean;
    $pctVsAvg = $histPSum > 0 ? (int) round((($curPSum - $histPSum) / $histPSum) * 100) : 0;

    $coords = $cur['geometry']['coordinates'] ?? [$lon, $lat, 0];
    $plat = fmt((float)($coords[1] ?? $lat), 2);
    $plon = fmt((float)($coords[0] ?? $lon), 2);
    $meta = ['source' => 'NASA POWER', 'grid' => '~0.5°×0.5° (~55 km)', 'lat' => $plat, 'lon' => $plon];

    return [
        'temperature' => [
            'monthly30dMean' => fmt($curT, 1),
            'anomaly' => fmt($anomaly, 1),
            'description' => temp_desc($anomaly),
            'meta' => $meta,
        ],
        'precipitation' => [
            'monthly30dSum' => fmt($curPSum, 0),
            'pctVsAvg' => $pctVsAvg,
            'description' => prec_desc($pctVsAvg),
            'meta' => $meta,
        ],
    ];
}

// ── Route ─────────────────────────────────────────────────────────────────────
$lat = DEFAULT_LAT;
$lon = DEFAULT_LON;

$userId = $_SESSION['user_id'] ?? null;
if ($userId) {
    try {
        $stmt = db()->prepare('SELECT default_lat, default_lon FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        $row = $stmt->fetch();
        if ($row && $row['default_lat'] !== null && $row['default_lon'] !== null) {
            $lat = (float) $row['default_lat'];
            $lon = (float) $row['default_lon'];
        }
    } catch (\Throwable $e) {
        // Fall back to default location if the DB lookup fails for any reason
        // (e.g. misconfigured credentials) — never let a logged-in user's
        // broken DB connection break this public-data endpoint.
        $lat = DEFAULT_LAT;
        $lon = DEFAULT_LON;
    }
}

$cacheKey = sprintf('%.2f,%.2f', $lat, $lon);
$tmpDir = sys_get_temp_dir();
$wxFile = "{$tmpDir}/suika_wx_{$cacheKey}.json";
$powerFile = "{$tmpDir}/suika_power_{$cacheKey}.json";
$now = time();

try {
    if (file_exists($wxFile) && ($now - filemtime($wxFile)) < WX_TTL) {
        $wx = json_decode((string) file_get_contents($wxFile), true);
        if (!is_array($wx)) $wx = fetch_weather($lat, $lon);
    } else {
        $wx = fetch_weather($lat, $lon);
    }
    @file_put_contents($wxFile, json_encode($wx));

    if (file_exists($powerFile) && ($now - filemtime($powerFile)) < POWER_TTL) {
        $power = json_decode((string) file_get_contents($powerFile), true);
        if (!is_array($power)) $power = fetch_power($lat, $lon);
    } else {
        $power = fetch_power($lat, $lon);
    }
    @file_put_contents($powerFile, json_encode($power));

    ok(array_merge($wx, $power));
} catch (\Throwable $e) {
    err('Could not load environment data: ' . $e->getMessage(), 502);
}
