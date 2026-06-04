import React from "react";
import {
  useGetLocalEnv,
  useGetEnvironmentSnapshots,
  useGetMe,
  type LocalEnvResponse,
  type LocalEnvMeta,
} from "@workspace/api-client-react";
import {
  Sun, Snowflake, Droplets, Wind, Leaf, Thermometer, CloudRain,
  MapPin, TreeDeciduous, Info, Activity,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────
function secToHm(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m}m`;
}

function MetaLine({ meta }: { meta: LocalEnvMeta }) {
  return (
    <p className="text-[10px] text-muted-foreground/45 mt-2 border-t border-border/20 pt-2 leading-relaxed">
      {meta.grid} · {meta.lat.toFixed(2)}°N {meta.lon.toFixed(2)}°E
      {meta.elevation != null ? ` · ${meta.elevation}m elev.` : ""}
    </p>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
function Badge({ label, color }: { label: string; color: string }) {
  const colorMap: Record<string, string> = {
    green: "bg-green-500/20 text-green-400 border-green-500/30",
    yellow: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    orange: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    red: "bg-red-500/20 text-red-400 border-red-500/30",
    blue: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    teal: "bg-teal-500/20 text-teal-400 border-teal-500/30",
    muted: "bg-muted/40 text-muted-foreground border-border/40",
    purple: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs border font-medium ${colorMap[color] ?? colorMap.muted}`}>
      {label}
    </span>
  );
}

// ── Card shell ────────────────────────────────────────────────────────────────
function EnvCard({
  icon,
  title,
  subtitle,
  children,
  meta,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  meta: LocalEnvMeta;
}) {
  return (
    <div className="bg-card rounded-2xl p-4 border border-border/40">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-full bg-card border border-border/50 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {children}
      <MetaLine meta={meta} />
    </div>
  );
}

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return <div className="bg-muted/40 rounded-2xl h-36 border border-border/60 animate-pulse" />;
}

// ── Daylight card ─────────────────────────────────────────────────────────────
function DaylightCard({ d }: { d: LocalEnvResponse["daylight"] }) {
  const daylightHours = d.daylightSec / 3600;
  const sunriseH = Math.max(6, 12 - daylightHours / 2);
  const sunsetH = Math.min(18, 12 + daylightHours / 2);
  const sunrisePct = ((sunriseH - 6) / 12) * 100;
  const sunsetPct = ((sunsetH - 6) / 12) * 100;
  const sunshineWidth = ((sunsetPct - sunrisePct) * d.sunshinePercent) / 100;

  return (
    <EnvCard
      icon={<Sun size={18} className="text-yellow-400" />}
      title="Daylight"
      subtitle={`today's total · ${d.meta.source}`}
      meta={d.meta}
    >
      <div className="flex items-baseline gap-4 mb-2">
        <div>
          <span className="text-3xl font-light">{secToHm(d.daylightSec)}</span>
          <span className="text-xs text-muted-foreground ml-2">daylight</span>
        </div>
        <div>
          <span className="text-2xl font-light text-yellow-400">{secToHm(d.sunshineSec)}</span>
          <span className="text-xs text-muted-foreground ml-1">sunshine ({d.sunshinePercent}%)</span>
        </div>
      </div>
      <div className="relative h-2 bg-muted/30 rounded-full mb-1">
        <div
          className="absolute top-0 h-full bg-yellow-400/70 rounded-full"
          style={{ left: `${sunrisePct}%`, width: `${sunshineWidth}%` }}
        />
        <div
          className="absolute top-0 h-full border-r border-yellow-400/40"
          style={{ left: `${sunrisePct + (sunsetPct - sunrisePct)}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground/50 mb-2">
        <span>6h</span><span>12h</span><span>18h</span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{d.description}</p>
    </EnvCard>
  );
}

// ── Wind Chill card ────────────────────────────────────────────────────────────
function WindChillCard({ d }: { d: LocalEnvResponse["windChill"] }) {
  return (
    <EnvCard
      icon={<Snowflake size={18} className="text-sky-300" />}
      title="Wind Chill"
      subtitle={`current 15-min sample · ${d.meta.source}`}
      meta={d.meta}
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-3xl font-light">{d.feelsLike}<span className="text-base ml-0.5">°C feels like</span></p>
        <div className="text-right text-xs text-muted-foreground space-y-0.5">
          <div><span className="text-muted-foreground/60 mr-1">ACTUAL</span><span className="font-medium text-foreground">{d.actualTemp}°C</span></div>
          <div><span className="text-muted-foreground/60 mr-1">WIND</span><span className="font-medium text-foreground">{d.windSpeed} km/h</span></div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{d.description}</p>
    </EnvCard>
  );
}

// ── Sultriness card ────────────────────────────────────────────────────────────
function SultrinessCard({ d }: { d: LocalEnvResponse["sultriness"] }) {
  const levelColor = d.level === "Comfortable" ? "green" : d.level === "Slightly Sultry" ? "yellow" : d.level === "Sultry" ? "orange" : "red";
  return (
    <EnvCard
      icon={<Droplets size={18} className="text-emerald-400" />}
      title="Sultriness"
      subtitle={`current 15-min sample · ${d.meta.source}`}
      meta={d.meta}
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-3xl font-light">{d.feelsLike}<span className="text-base ml-0.5">°C feels like</span></p>
        <div className="text-right text-xs text-muted-foreground space-y-0.5">
          <div><span className="text-muted-foreground/60 mr-1">ACTUAL</span><span className="font-medium text-foreground">{d.actualTemp}°C</span></div>
          <div><span className="text-muted-foreground/60 mr-1">HUMIDITY</span><span className="font-medium text-foreground">{d.humidity}%</span></div>
        </div>
      </div>
      <div className="mb-2">
        <Badge label={d.level} color={levelColor} />
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{d.description}</p>
    </EnvCard>
  );
}

// ── Pressure card ─────────────────────────────────────────────────────────────
function PressureCard({ d }: { d: LocalEnvResponse["pressure"] }) {
  const levelColor = d.level === "Low" ? "blue" : d.level === "High" ? "yellow" : "muted";
  return (
    <EnvCard
      icon={<Activity size={18} className="text-blue-400" />}
      title="Atmospheric Pressure"
      subtitle={`current 15-min sample · ${d.meta.source}`}
      meta={d.meta}
    >
      <div className="flex items-center gap-3 mb-2">
        <span className="text-4xl font-light">{d.hPa}</span>
        <span className="text-base text-muted-foreground">hPa</span>
        <Badge label={d.level} color={levelColor} />
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{d.description}</p>
    </EnvCard>
  );
}

// ── Air Quality card ──────────────────────────────────────────────────────────
function AirQualityCard({ d }: { d: LocalEnvResponse["airQuality"] }) {
  const aqiPct = Math.min((d.aqi / 100) * 100, 100);
  const aqiColor = d.aqi <= 20 ? "#4ade80" : d.aqi <= 40 ? "#86efac" : d.aqi <= 60 ? "#fbbf24" : d.aqi <= 80 ? "#fb923c" : "#f87171";
  const labelColor = d.aqi <= 20 ? "green" : d.aqi <= 40 ? "green" : d.aqi <= 60 ? "yellow" : d.aqi <= 80 ? "orange" : "red";

  return (
    <EnvCard
      icon={<Wind size={18} className="text-orange-400" />}
      title="Air Quality"
      subtitle={`current hourly · ${d.meta.source}`}
      meta={d.meta}
    >
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-4xl font-light">{d.aqi}</span>
        <span className="text-lg font-medium" style={{ color: aqiColor }}>{d.aqiLabel}</span>
      </div>
      <div className="relative h-2 bg-muted/30 rounded-full mb-1 overflow-hidden">
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${aqiPct}%`, backgroundColor: aqiColor }} />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground/50 mb-3">
        <span>0</span><span>50</span><span>100+</span>
      </div>
      <div className="flex flex-wrap gap-2 mb-2">
        {([["PM2.5", d.pm25], ["PM10", d.pm10], ["NO2", d.no2], ["O3", d.o3], ["SO2", d.so2]] as [string, number][]).map(([k, v]) => (
          <div key={k} className="flex flex-col items-center bg-muted/20 rounded-lg px-2 py-1 min-w-[40px]">
            <span className="text-[10px] text-muted-foreground">{k}</span>
            <span className="text-xs font-semibold">{v}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{d.description}</p>
    </EnvCard>
  );
}

// ── Pollen card ───────────────────────────────────────────────────────────────
function PollenCard({ d }: { d: NonNullable<LocalEnvResponse["pollen"]> }) {
  const sevColor = d.severity === "Low" ? "green" : d.severity === "Moderate" ? "yellow" : d.severity === "High" ? "orange" : "red";
  return (
    <EnvCard
      icon={<Leaf size={18} className="text-purple-400" />}
      title="Pollen"
      subtitle={`current hourly · ${d.meta.source}`}
      meta={d.meta}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="space-y-1">
          <span className="inline-block px-2 py-0.5 rounded-lg bg-purple-500/20 text-purple-300 text-sm font-medium border border-purple-500/30">
            {d.dominant}
          </span>
          <p className="text-sm text-muted-foreground">{d.grains} grains/m³</p>
        </div>
        <Badge label={d.severity} color={sevColor} />
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{d.description}</p>
    </EnvCard>
  );
}

// ── Temperature card (NASA POWER) ─────────────────────────────────────────────
function TemperatureCard({ d }: { d: LocalEnvResponse["temperature"] }) {
  const anomalySign = d.anomaly > 0 ? "↑" : d.anomaly < 0 ? "↓" : "→";
  const anomalyColor = Math.abs(d.anomaly) < 1 ? "teal" : d.anomaly > 0 ? "orange" : "blue";
  return (
    <EnvCard
      icon={<Thermometer size={18} className="text-red-400" />}
      title="Temperature"
      subtitle={`monthly mean · ${d.meta.source}`}
      meta={d.meta}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-4xl font-light">{d.monthly30dMean}<span className="text-lg ml-0.5">°C</span></span>
        <Badge label={`${anomalySign} ${d.anomaly > 0 ? "+" : ""}${d.anomaly} anomaly`} color={anomalyColor} />
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{d.description}</p>
    </EnvCard>
  );
}

// ── Precipitation card (NASA POWER) ──────────────────────────────────────────
function PrecipitationCard({ d }: { d: LocalEnvResponse["precipitation"] }) {
  const pctSign = d.pctVsAvg >= 0 ? "+" : "";
  const pctColor = Math.abs(d.pctVsAvg) < 15 ? "green" : d.pctVsAvg > 0 ? "blue" : "orange";
  return (
    <EnvCard
      icon={<CloudRain size={18} className="text-sky-400" />}
      title="Precipitation"
      subtitle={`monthly mean · ${d.meta.source}`}
      meta={d.meta}
    >
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-4xl font-light">{d.monthly30dSum}</span>
          <span className="text-base text-muted-foreground ml-1">mm (30d)</span>
        </div>
        <Badge label={`${pctSign}${d.pctVsAvg}% vs avg`} color={pctColor} />
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{d.description}</p>
    </EnvCard>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function LocalTab() {
  const { data: me } = useGetMe();
  const { data: env, isLoading, isError } = useGetLocalEnv();
  const { data: snapshotsData } = useGetEnvironmentSnapshots();

  const locationLabel = me?.defaultLocationName
    ? me.defaultLocationName
    : me?.defaultLat != null && me?.defaultLon != null
    ? `${me.defaultLat.toFixed(2)}°N ${me.defaultLon.toFixed(2)}°E`
    : "Vienna, Austria";

  return (
    <div className="flex flex-col gap-4 px-4 pt-5 pb-6">
      <div className="flex items-center gap-2">
        <TreeDeciduous size={18} className="text-primary" />
        <h2 className="text-lg font-semibold">Local Environment</h2>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <MapPin size={12} />
        <span>{locationLabel}</span>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {isError && (
        <div className="bg-card rounded-2xl p-4 border border-border/40 text-center text-xs text-muted-foreground">
          Could not load environment data. Check connection and try again.
        </div>
      )}

      {env && (
        <>
          <DaylightCard d={env.daylight} />
          <WindChillCard d={env.windChill} />
          <SultrinessCard d={env.sultriness} />
          <PressureCard d={env.pressure} />
          <AirQualityCard d={env.airQuality} />
          {env.pollen && <PollenCard d={env.pollen} />}

          <div className="flex items-center gap-3 mt-1">
            <div className="h-px flex-1 bg-border/30" />
            <span className="text-[11px] text-muted-foreground/60 shrink-0">Broader climate context</span>
            <div className="h-px flex-1 bg-border/30" />
          </div>

          <TemperatureCard d={env.temperature} />
          <PrecipitationCard d={env.precipitation} />

          <div className="flex items-start gap-2 bg-card/50 rounded-xl p-3 border border-border/30">
            <Info size={14} className="text-orange-400 shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground/70 italic">
              Local conditions directly affect your well-being. Air quality, daylight, pressure, wind chill, and humidity all influence how your body feels and recovers.
            </p>
          </div>
        </>
      )}

      {snapshotsData && snapshotsData.length > 0 && (
        <div className="bg-card rounded-2xl p-4 border border-border/40">
          <h3 className="text-sm font-medium mb-3 text-muted-foreground">Recent Snapshots</h3>
          <div className="space-y-2">
            {snapshotsData.slice(0, 5).map((s, i) => (
              <div
                key={i}
                className="flex justify-between items-center text-xs py-1 border-b border-border/20 last:border-0"
              >
                <span className="text-muted-foreground">
                  {new Date(s.date).toLocaleDateString()}
                </span>
                <div className="flex gap-3 text-muted-foreground">
                  {s.humidity != null && <span>💧 {Math.round(s.humidity)}%</span>}
                  {s.aqi != null && <span>AQI {Math.round(s.aqi)}</span>}
                  {s.pollenLevel && <span>🌿 {s.pollenLevel}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
