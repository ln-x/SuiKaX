import React, { useState, useEffect } from "react";
import { useGetEarthFeeds } from "@workspace/api-client-react";
import type { EarthEvent, FeedSourceStatus } from "@workspace/api-client-react";
import {
  Globe, RefreshCw, ExternalLink, AlertCircle, ChevronDown, ChevronUp,
  Mountain, Droplets, CloudLightning, Sun, Flame, Waves, CheckCircle2, XCircle, Clock, Satellite,
} from "lucide-react";

// ── NASA EPIC ─────────────────────────────────────────────────────────────────
const NASA_KEY = (import.meta.env.VITE_NASA_API_KEY as string | undefined) ?? "DEMO_KEY";

interface EpicImage { image: string; date: string; caption: string }

function useNasaEpic() {
  const [epic, setEpic] = useState<{ url: string; date: string } | null>(null);
  useEffect(() => {
    fetch(`https://api.nasa.gov/EPIC/api/natural?api_key=${NASA_KEY}`)
      .then((r) => r.json())
      .then((data: EpicImage[]) => {
        if (!data?.length) return;
        const img = data[0];
        const d = img.date.slice(0, 10).replace(/-/g, "/");
        setEpic({ url: `https://epic.gsfc.nasa.gov/archive/natural/${d}/jpg/${img.image}.jpg`, date: img.date.slice(0, 10) });
      })
      .catch(() => {});
  }, []);
  return epic;
}

// ── Ecosystem data ────────────────────────────────────────────────────────────
const ECOSYSTEMS = [
  {
    id: "arctic",
    name: "Arctic Sea Ice",
    status: "Critical decline",
    color: "#4FC3F7",
    icon: "🧊",
    source: "NSIDC · NOAA",
    sourceUrl: "https://nsidc.org/arcticseaicenews/",
    metrics: [
      { label: "Summer extent", value: "4.3M km²" },
      { label: "Trend", value: "−12.2% / decade" },
      { label: "vs 1980s", value: "−40%" },
    ],
  },
  {
    id: "amoc",
    name: "Atlantic Circulation",
    status: "Weakening observed",
    color: "#7986CB",
    icon: "🌊",
    source: "RAPID Array · Nat. Climate Change",
    sourceUrl: "https://rapid.ac.uk/rapidmoc/",
    metrics: [
      { label: "Strength", value: "~15 Sv" },
      { label: "Decline", value: "−15% since 1950" },
      { label: "Stability", value: "Weakest in 1 ka" },
    ],
  },
  {
    id: "rainforest",
    name: "Amazon Rainforest",
    status: "Approaching tipping point",
    color: "#66BB6A",
    icon: "🌳",
    source: "INPE · MapBiomas",
    sourceUrl: "https://inpe.br/",
    metrics: [
      { label: "Forest lost", value: "~17%" },
      { label: "Tipping point", value: "20–25%" },
      { label: "Carbon role", value: "Net source" },
    ],
  },
  {
    id: "landseal",
    name: "Global Land Sealing",
    status: "Accelerating urban sprawl",
    color: "#E8A25C",
    icon: "🏗️",
    source: "EEA · ESA Copernicus",
    sourceUrl: "https://www.eea.europa.eu/en/topics/in-depth/land-use",
    metrics: [
      { label: "Europe", value: "∘2.4%/decade" },
      { label: "East Asia", value: "∘4.1%/decade" },
      { label: "Global area", value: "~1.6%" },
    ],
  },
] as const;

// ── Event type config ──────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  earthquake: { label: "Earthquake", icon: <Mountain size={14} />, color: "#FF9500" },
  flood:      { label: "Flood",      icon: <Droplets size={14} />, color: "#4FC3F7" },
  storm:      { label: "Storm",      icon: <CloudLightning size={14} />, color: "#7986CB" },
  volcano:    { label: "Volcano",    icon: <Mountain size={14} />, color: "#FF6B6B" },
  drought:    { label: "Drought",    icon: <Sun size={14} />,      color: "#FFD60A" },
  wildfire:   { label: "Wildfire",   icon: <Flame size={14} />,    color: "#FF453A" },
  tsunami:    { label: "Tsunami",    icon: <Waves size={14} />,    color: "#30D5C8" },
  epidemic:   { label: "Epidemic",   icon: <AlertCircle size={14} />, color: "#AF52DE" },
  "eo-news":  { label: "EO News",    icon: <Satellite size={14} />,   color: "#00C4FF" },
  other:      { label: "Other",      icon: <AlertCircle size={14} />, color: "#8E8E93" },
};

const SEVERITY_COLOR: Record<string, string> = {
  high:   "#FF453A",
  medium: "#FF9500",
  low:    "#34C759",
};

type FilterType = "all" | keyof typeof TYPE_CONFIG;

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "< 1h ago";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Source status pill ─────────────────────────────────────────────────────────
function SourcePill({ s }: { s: FeedSourceStatus }) {
  const isOk = s.status === "ok";
  const isStale = s.status === "stale";
  const isEmpty = s.status === "empty";
  const isError = s.status === "error";

  const icon = isOk || isStale ? (
    isStale
      ? <Clock size={10} className="shrink-0" style={{ color: "#FF9500" }} />
      : <CheckCircle2 size={10} className="shrink-0" style={{ color: "#34C759" }} />
  ) : isEmpty ? (
    <CheckCircle2 size={10} className="shrink-0 opacity-40" />
  ) : (
    <XCircle size={10} className="shrink-0" style={{ color: "#FF453A" }} />
  );

  const textColor = isOk
    ? "#34C759"
    : isStale
    ? "#FF9500"
    : isEmpty
    ? "var(--muted-foreground)"
    : "#FF453A";

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-border/30"
      style={{ color: textColor }}
      title={
        isError
          ? `Error: ${s.error ?? "unknown"}`
          : isStale
          ? `Stale: last data has ${s.count} events`
          : isEmpty
          ? "No active events right now"
          : `${s.count} event${s.count !== 1 ? "s" : ""}`
      }
    >
      {icon}
      <span className="truncate max-w-[80px]">{s.name}</span>
      {(isOk || isStale) && s.count > 0 && (
        <span className="opacity-60">{s.count}</span>
      )}
    </span>
  );
}

// ── Ecosystem card ─────────────────────────────────────────────────────────────
function EcosystemCard({ eco }: { eco: typeof ECOSYSTEMS[number] }) {
  return (
    <div
      className="rounded-xl p-4 border border-border/40"
      style={{ backgroundColor: eco.color + "0f" }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{eco.icon}</span>
        <div className="min-w-0">
          <p className="text-xs font-semibold truncate" style={{ color: eco.color }}>{eco.name}</p>
          <p className="text-xs text-muted-foreground">{eco.status}</p>
        </div>
      </div>
      <div className="space-y-1.5 mb-3">
        {eco.metrics.map((m) => (
          <div key={m.label} className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{m.label}</span>
            <span className="text-xs font-semibold tabular-nums" style={{ color: eco.color }}>{m.value}</span>
          </div>
        ))}
      </div>
      <a
        href={eco.sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors opacity-60 hover:opacity-100"
      >
        <ExternalLink size={9} />
        {eco.source}
      </a>
    </div>
  );
}

// ── EO source badge config ─────────────────────────────────────────────────────
const EO_SOURCE_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  "ESA":        { label: "ESA",        color: "#00A4E4", bg: "#00A4E422" },
  "NASA EO":    { label: "NASA EO",    color: "#FC3D21", bg: "#FC3D2122" },
  "Copernicus": { label: "Copernicus", color: "#009B77", bg: "#009B7722" },
};

function EoSourceBadge({ source }: { source: string }) {
  const cfg = EO_SOURCE_BADGE[source];
  if (!cfg) return <span className="text-xs text-muted-foreground opacity-50">{source}</span>;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-semibold tracking-wide"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}
    >
      <Satellite size={9} />
      {cfg.label}
    </span>
  );
}

// ── EO News card — rich card with thumbnail and source badge ───────────────────
function EoNewsCard({ item }: { item: EarthEvent }) {
  const [imgError, setImgError] = useState(false);
  const hasImage = !!item.imageUrl && !imgError;
  const cfg = TYPE_CONFIG[item.type ?? "eo-news"] ?? TYPE_CONFIG["eo-news"];

  return (
    <a
      href={item.url ?? undefined}
      target="_blank"
      rel="noreferrer"
      className="block bg-card rounded-xl border border-border/40 overflow-hidden hover:border-border/70 transition-colors group"
    >
      {hasImage && (
        <div className="relative w-full h-36 overflow-hidden bg-black/20">
          <img
            src={item.imageUrl!}
            alt=""
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
            loading="lazy"
            onError={() => setImgError(true)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          {item.type !== "eo-news" && (
            <span
              className="absolute top-2 left-2 text-xs px-1.5 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: cfg.color + "dd", color: "#fff" }}
            >
              {cfg.label}
            </span>
          )}
        </div>
      )}
      <div className="p-3">
        <p className="text-sm font-medium leading-snug line-clamp-2 mb-2">{item.title}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <EoSourceBadge source={item.source} />
          {!hasImage && item.type !== "eo-news" && (
            <span
              className="text-xs px-1.5 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: cfg.color + "22", color: cfg.color }}
            >
              {cfg.label}
            </span>
          )}
          {item.publishedAt && (
            <span className="text-xs text-muted-foreground">{relativeTime(item.publishedAt)}</span>
          )}
          {item.url && (
            <ExternalLink size={10} className="ml-auto shrink-0 text-muted-foreground opacity-40 group-hover:opacity-70 transition-opacity" />
          )}
        </div>
        {item.description && (
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed line-clamp-2">{item.description}</p>
        )}
      </div>
    </a>
  );
}

// ── Event card ─────────────────────────────────────────────────────────────────
function EventCard({ item }: { item: EarthEvent }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = TYPE_CONFIG[item.type ?? "other"] ?? TYPE_CONFIG.other;
  const sevColor = SEVERITY_COLOR[(item.severity ?? "medium").toLowerCase()] ?? "#FF9500";

  return (
    <div className="bg-card rounded-xl border border-border/40 overflow-hidden">
      <button className="w-full text-left p-4 flex items-start gap-3" onClick={() => setExpanded((v) => !v)}>
        <div
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5"
          style={{ backgroundColor: cfg.color + "22", color: cfg.color }}
        >
          {cfg.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-snug line-clamp-2">{item.title}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: cfg.color + "22", color: cfg.color }}>
              {cfg.label}
            </span>
            <span className="flex items-center gap-1 text-xs font-medium" style={{ color: sevColor }}>
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: sevColor }} />
              {item.severity}
            </span>
            {item.publishedAt && (
              <span className="text-xs text-muted-foreground">{relativeTime(item.publishedAt)}</span>
            )}
            <span className="text-xs text-muted-foreground opacity-50">{item.source}</span>
          </div>
        </div>
        <div className="shrink-0 text-muted-foreground mt-1">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-border/30">
          {item.description && (
            <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{item.description}</p>
          )}
          {item.countries && item.countries.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {item.countries.map((c) => (
                <span key={c} className="text-xs bg-secondary px-2 py-0.5 rounded-full text-muted-foreground">{c}</span>
              ))}
            </div>
          )}
          {item.url && (
            <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 mt-3 text-xs text-primary hover:underline">
              Full report <ExternalLink size={11} />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function EarthTab() {
  const [filter, setFilter] = useState<FilterType>("all");
  const [showAll, setShowAll] = useState(false);
  const epic = useNasaEpic();

  const { data, isLoading, error, refetch, isFetching } = useGetEarthFeeds();

  const allItems: EarthEvent[] = data?.events ?? [];
  const sources: FeedSourceStatus[] = data?.sources ?? [];
  const filtered = filter === "all" ? allItems : allItems.filter((e) => e.type === filter);
  const visible = showAll ? filtered : filtered.slice(0, 6);
  const hasMore = filtered.length > 6;

  // eo-news appears first so satellite/observation news is a quick tap after "All"
  const filterTypes = [
    "all", "eo-news",
    ...Object.keys(TYPE_CONFIG).filter((k) => k !== "eo-news"),
  ] as FilterType[];

  return (
    /*
     * Layout strategy
     * ───────────────
     * mobile  (< md): flex-col, single scroll — DOM order = EPIC → events → ecosystem
     * md+           : CSS grid, 2 cols × 2 rows, each cell independently scrollable
     *
     *   col 1 (340px)         col 2 (flex-1)
     *   ┌─────────────────┐   ┌──────────────────────────────┐
     *   │ EPIC hero       │   │ Events (header/pills/list)   │
     *   │  row 1: 260px   │   │  row-span-2, own scroll      │
     *   ├─────────────────┤   │                              │
     *   │ Ecosystem Voice │   │                              │
     *   │  row 2: 1fr     │   │                              │
     *   └─────────────────┘   └──────────────────────────────┘
     *
     * DOM order: EPIC → events → ecosystem
     * On mobile: flex-col respects DOM order → correct (EPIC, events, ecosystem)
     * On md+:    grid placement via col-start/row-start overrides visual position
     *            EPIC  → col 1 row 1, events → col 2 row 1–2, ecosystem → col 1 row 2
     */
    <div className="h-full flex flex-col overflow-y-auto md:grid md:grid-cols-[340px_1fr] md:grid-rows-[260px_1fr] md:overflow-hidden">

      {/* ── NASA EPIC Hero ──────────────────────────────────────────────────── */}
      {/* mobile: full-width aspect-video  |  md+: col 1, row 1, fixed 260px */}
      <div className="relative w-full aspect-video md:aspect-auto md:col-start-1 md:row-start-1 md:border-r md:border-b md:border-border/30 bg-card overflow-hidden shrink-0">
        {epic ? (
          <img src={epic.url} alt="Earth from DSCOVR-EPIC" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-blue-950 to-black">
            <Globe size={48} className="text-blue-400 opacity-40" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <div className="absolute bottom-3 left-4 right-4">
          <p className="text-xs text-white/60 italic">A living being, seen from afar</p>
          {epic && <p className="text-xs text-white/40 mt-0.5">NASA EPIC · {epic.date}</p>}
        </div>
      </div>

      {/* ── Events column ───────────────────────────────────────────────────── */}
      {/* mobile: second (natural DOM order)  |  md+: col 2, row 1–2, own scroll */}
      <div className="md:col-start-2 md:row-start-1 md:row-span-2 md:h-full md:overflow-y-auto">
        <div className="pb-6">

          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-5 pb-2">
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Live Global Events</h3>
              {allItems.length > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">{allItems.length} events across all sources</p>
              )}
            </div>
            <button
              onClick={() => { setShowAll(false); refetch(); }}
              disabled={isFetching}
              className="p-2 rounded-full hover:bg-card transition-colors disabled:opacity-40"
              title="Refresh feeds"
            >
              <RefreshCw size={15} className={isFetching ? "animate-spin" : ""} />
            </button>
          </div>

          {/* Source status row — outer clips, inner preserves px-4 during horizontal scroll */}
          {sources.length > 0 && (
            <div className="overflow-x-auto scrollbar-none pb-3">
              <div className="flex gap-1.5 px-4 min-w-max">
                {sources.map((s) => <SourcePill key={s.name} s={s} />)}
              </div>
            </div>
          )}

          {/* Filter pills — same nested pattern */}
          <div className="overflow-x-auto scrollbar-none pb-3">
            <div className="flex gap-2 px-4 min-w-max">
              {filterTypes.map((t) => {
                const cfg = t === "all" ? null : TYPE_CONFIG[t];
                return (
                  <button
                    key={t}
                    onClick={() => { setFilter(t); setShowAll(false); }}
                    style={filter === t ? { backgroundColor: cfg?.color ?? "var(--primary)", color: "#fff", borderColor: cfg?.color ?? "var(--primary)" } : {}}
                    className={`shrink-0 px-3 py-1 rounded-full text-xs border transition-colors ${
                      filter === t ? "border-transparent" : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {cfg ? cfg.label : "All"}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Events list */}
          <div className="px-4 space-y-3">
            {isLoading && Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-card rounded-xl p-4 animate-pulse h-20 border border-border/40" />
            ))}

            {error && (
              <div className="text-muted-foreground text-center py-10 text-sm">
                <AlertCircle size={24} className="mx-auto mb-3 text-orange-400" />
                Unable to load feeds. Tap refresh to try again.
              </div>
            )}

            {!isLoading && !error && filtered.length === 0 && (
              <div className="text-muted-foreground text-center py-10 text-sm">
                <Globe size={22} className="mx-auto mb-3 opacity-40" />
                {filter === "all" ? (
                  "No global events reported right now."
                ) : (
                  <>
                    No active {TYPE_CONFIG[filter as string]?.label.toLowerCase() ?? filter} events right now.
                    <span className="block text-xs opacity-60 mt-1">The feed is live — this category is quiet.</span>
                  </>
                )}
              </div>
            )}

            {visible.map((item, i) =>
              item.source === "ESA" || item.source === "NASA EO" || item.source === "Copernicus"
                ? <EoNewsCard key={item.id ?? i} item={item} />
                : <EventCard key={item.id ?? i} item={item} />
            )}

            {hasMore && (
              <button
                onClick={() => setShowAll((v) => !v)}
                className="w-full py-2.5 text-xs text-muted-foreground hover:text-foreground border border-border/40 rounded-xl transition-colors"
              >
                {showAll ? "Show less" : `Show ${filtered.length - 6} more events`}
              </button>
            )}
          </div>

        </div>
      </div>

      {/* ── Ecosystem Voices ────────────────────────────────────────────────── */}
      {/* mobile: third (natural DOM order, after events)  |  md+: col 1, row 2, own scroll */}
      <div className="md:col-start-1 md:row-start-2 md:overflow-y-auto md:border-r md:border-border/30">
        <div className="px-4 pt-5 pb-1">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Ecosystem Voices</h3>
        </div>
        {/* mobile: horizontal scroll  |  md+: 2-column grid */}
        <div className="flex gap-3 px-4 overflow-x-auto pb-4 scrollbar-none md:grid md:grid-cols-2 md:overflow-x-visible md:pb-6 md:px-2 md:gap-2">
          {ECOSYSTEMS.map((eco) => (
            <div key={eco.id} className="shrink-0 w-56 md:w-auto md:shrink">
              <EcosystemCard eco={eco} />
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
