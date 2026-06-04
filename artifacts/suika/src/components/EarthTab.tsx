import React, { useState, useEffect } from "react";
import { useGetEarthFeeds } from "@workspace/api-client-react";
import type { EarthEvent } from "@workspace/api-client-react";
import {
  Globe, RefreshCw, ExternalLink, AlertCircle, ChevronDown, ChevronUp,
  Mountain, Droplets, CloudLightning, Sun, Flame, Waves,
} from "lucide-react";

// ── NASA EPIC ─────────────────────────────────────────────────────────────────
const NASA_KEY = (import.meta.env.VITE_NASA_API_KEY as string | undefined) ?? "DEMO_KEY";

interface EpicImage {
  image: string;
  date: string;
  caption: string;
}

function useNasaEpic() {
  const [epic, setEpic] = useState<{ url: string; date: string } | null>(null);
  useEffect(() => {
    fetch(`https://api.nasa.gov/EPIC/api/natural?api_key=${NASA_KEY}`)
      .then((r) => r.json())
      .then((data: EpicImage[]) => {
        if (!data?.length) return;
        const img = data[0];
        const d = img.date.slice(0, 10).replace(/-/g, "/");
        const url = `https://epic.gsfc.nasa.gov/archive/natural/${d}/png/${img.image}.png`;
        setEpic({ url, date: img.date.slice(0, 10) });
      })
      .catch(() => {});
  }, []);
  return epic;
}

// ── Ecosystem cards ───────────────────────────────────────────────────────────
const ECOSYSTEMS = [
  {
    id: "arctic",
    name: "Arctic Sea Ice",
    status: "Critical decline",
    color: "#4FC3F7",
    icon: "🧊",
    metrics: [
      { label: "Summer extent", value: "4.3M km²" },
      { label: "Trend", value: "−12.2% / decade" },
      { label: "vs 1980s", value: "−40%" },
    ],
  },
  {
    id: "amoc",
    name: "Atlantic Circulation (AMOC)",
    status: "Weakening observed",
    color: "#7986CB",
    icon: "🌊",
    metrics: [
      { label: "Strength", value: "~15 Sv" },
      { label: "Decline", value: "−15% since 1950" },
      { label: "Stability", value: "Weakest in 1,000+ yrs" },
    ],
  },
  {
    id: "rainforest",
    name: "Amazon Rainforest",
    status: "Approaching tipping point",
    color: "#66BB6A",
    icon: "🌳",
    metrics: [
      { label: "Forest lost", value: "~17%" },
      { label: "Tipping point", value: "20–25%" },
      { label: "Carbon role", value: "Net source" },
    ],
  },
] as const;

// ── Event type config ─────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  earthquake: { label: "Earthquake", icon: <Mountain size={14} />, color: "#FF9500" },
  flood:      { label: "Flood",      icon: <Droplets size={14} />, color: "#4FC3F7" },
  storm:      { label: "Storm",      icon: <CloudLightning size={14} />, color: "#7986CB" },
  volcano:    { label: "Volcano",    icon: <Mountain size={14} />, color: "#FF6B6B" },
  drought:    { label: "Drought",    icon: <Sun size={14} />,      color: "#FFD60A" },
  wildfire:   { label: "Wildfire",   icon: <Flame size={14} />,    color: "#FF453A" },
  tsunami:    { label: "Tsunami",    icon: <Waves size={14} />,    color: "#30D5C8" },
  epidemic:   { label: "Epidemic",   icon: <AlertCircle size={14} />, color: "#AF52DE" },
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

// ── Event card ────────────────────────────────────────────────────────────────
function EventCard({ item }: { item: EarthEvent }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = TYPE_CONFIG[item.type ?? "other"] ?? TYPE_CONFIG.other;
  const sevColor = SEVERITY_COLOR[(item.severity ?? "medium").toLowerCase()] ?? "#FF9500";

  return (
    <div className="bg-card rounded-xl border border-border/40 overflow-hidden">
      <button
        className="w-full text-left p-4 flex items-start gap-3"
        onClick={() => setExpanded((v) => !v)}
      >
        <div
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5"
          style={{ backgroundColor: cfg.color + "22", color: cfg.color }}
        >
          {cfg.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-snug line-clamp-2">{item.title}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span
              className="text-xs px-1.5 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: cfg.color + "22", color: cfg.color }}
            >
              {cfg.label}
            </span>
            <span className="flex items-center gap-1 text-xs font-medium" style={{ color: sevColor }}>
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: sevColor }} />
              {item.severity}
            </span>
            {item.publishedAt && (
              <span className="text-xs text-muted-foreground">{relativeTime(item.publishedAt)}</span>
            )}
            <span className="text-xs text-muted-foreground opacity-60">{item.source}</span>
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
                <span key={c} className="text-xs bg-secondary px-2 py-0.5 rounded-full text-muted-foreground">
                  {c}
                </span>
              ))}
            </div>
          )}
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 mt-3 text-xs text-primary hover:underline"
            >
              Full report <ExternalLink size={11} />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function EarthTab() {
  const [filter, setFilter] = useState<FilterType>("all");
  const [showAll, setShowAll] = useState(false);
  const epic = useNasaEpic();

  const { data, isLoading, error, refetch, isFetching } = useGetEarthFeeds();

  const allItems: EarthEvent[] = data ?? [];
  const filtered =
    filter === "all" ? allItems : allItems.filter((e) => e.type === filter);
  const visible = showAll ? filtered : filtered.slice(0, 6);
  const hasMore = filtered.length > 6;

  const filterTypes = ["all", ...Object.keys(TYPE_CONFIG)] as FilterType[];

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-6">

      {/* NASA EPIC Hero */}
      <div className="relative w-full aspect-video bg-card overflow-hidden shrink-0">
        {epic ? (
          <img
            src={epic.url}
            alt="Earth from DSCOVR-EPIC"
            className="w-full h-full object-cover"
            loading="lazy"
          />
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

      {/* Ecosystem voices */}
      <div className="px-4 pt-5 pb-1">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Ecosystem Voices
        </h3>
      </div>
      <div className="flex gap-3 px-4 overflow-x-auto pb-1 scrollbar-none shrink-0">
        {ECOSYSTEMS.map((eco) => (
          <div
            key={eco.id}
            className="shrink-0 w-56 rounded-xl p-4 border border-border/40"
            style={{ backgroundColor: eco.color + "0f" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">{eco.icon}</span>
              <div>
                <p className="text-xs font-semibold" style={{ color: eco.color }}>{eco.name}</p>
                <p className="text-xs text-muted-foreground">{eco.status}</p>
              </div>
            </div>
            <div className="space-y-1.5">
              {eco.metrics.map((m) => (
                <div key={m.label} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{m.label}</span>
                  <span className="text-xs font-semibold tabular-nums" style={{ color: eco.color }}>
                    {m.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Live events */}
      <div className="flex items-center justify-between px-4 pt-5 pb-2 shrink-0">
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Live Global Events
          </h3>
          {allItems.length > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {allItems.length} events · GDACS · USGS · NASA EONET
            </p>
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

      {/* Filter pills */}
      <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-none shrink-0">
        {filterTypes.map((t) => {
          const cfg = t === "all" ? null : TYPE_CONFIG[t];
          return (
            <button
              key={t}
              onClick={() => { setFilter(t); setShowAll(false); }}
              style={
                filter === t
                  ? { backgroundColor: cfg?.color ?? "var(--primary)", color: "#fff", borderColor: cfg?.color ?? "var(--primary)" }
                  : {}
              }
              className={`shrink-0 px-3 py-1 rounded-full text-xs border transition-colors ${
                filter === t ? "border-transparent" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {cfg ? cfg.label : "All"}
            </button>
          );
        })}
      </div>

      {/* Events list */}
      <div className="px-4 space-y-3">
        {isLoading && (
          <>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-card rounded-xl p-4 animate-pulse h-20 border border-border/40" />
            ))}
          </>
        )}

        {error && (
          <div className="text-muted-foreground text-center py-10 text-sm">
            <AlertCircle size={24} className="mx-auto mb-3 text-orange-400" />
            Unable to load feeds. Tap refresh to try again.
          </div>
        )}

        {!isLoading && !error && filtered.length === 0 && (
          <div className="text-muted-foreground text-center py-10 text-sm">
            No {filter === "all" ? "" : filter} events right now.
          </div>
        )}

        {visible.map((item, i) => (
          <EventCard key={item.id ?? i} item={item} />
        ))}

        {hasMore && (
          <button
            onClick={() => setShowAll((v) => !v)}
            className="w-full py-2.5 text-xs text-muted-foreground hover:text-foreground border border-border/40 rounded-xl transition-colors"
          >
            {showAll
              ? `Show less`
              : `Show ${filtered.length - 6} more events`}
          </button>
        )}
      </div>
    </div>
  );
}
