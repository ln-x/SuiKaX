import React, { useState } from "react";
import {
  useGetEnvironmentSnapshots,
  useSaveEnvironmentSnapshot,
  useGetMe,
} from "@workspace/api-client-react";
import { TreeDeciduous, MapPin, Wind, Droplets, Thermometer, Sun, CheckCircle } from "lucide-react";

const TCM_MERIDIANS = [
  { id: "liver", label: "Liver / Wood", color: "#4ade80", cx: 50, cy: 30 },
  { id: "heart", label: "Heart / Fire", color: "#f87171", cx: 60, cy: 35 },
  { id: "spleen", label: "Spleen / Earth", color: "#facc15", cx: 45, cy: 42 },
  { id: "lung", label: "Lung / Metal", color: "#c084fc", cx: 65, cy: 32 },
  { id: "kidney", label: "Kidney / Water", color: "#60a5fa", cx: 52, cy: 52 },
  { id: "gallbladder", label: "Gallbladder", color: "#86efac", cx: 38, cy: 40 },
  { id: "stomach", label: "Stomach", color: "#fcd34d", cx: 55, cy: 45 },
  { id: "bladder", label: "Bladder", color: "#93c5fd", cx: 50, cy: 60 },
];

function BodyMap({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <svg viewBox="0 0 100 80" className="w-[130px] shrink-0 h-[200px]">
      <ellipse cx="50" cy="12" rx="8" ry="10" fill="#222" stroke="#444" strokeWidth="0.5" />
      <rect x="40" y="22" width="20" height="28" rx="3" fill="#1a1a1a" stroke="#444" strokeWidth="0.5" />
      <rect x="30" y="23" width="9" height="22" rx="3" fill="#1a1a1a" stroke="#444" strokeWidth="0.5" />
      <rect x="61" y="23" width="9" height="22" rx="3" fill="#1a1a1a" stroke="#444" strokeWidth="0.5" />
      <rect x="42" y="50" width="7" height="24" rx="3" fill="#1a1a1a" stroke="#444" strokeWidth="0.5" />
      <rect x="51" y="50" width="7" height="24" rx="3" fill="#1a1a1a" stroke="#444" strokeWidth="0.5" />
      {TCM_MERIDIANS.map((m) => (
        <circle
          key={m.id}
          cx={m.cx}
          cy={m.cy}
          r={selected.includes(m.id) ? 3.5 : 2.5}
          fill={m.color + "80"}
          stroke={m.color}
          strokeWidth="0.8"
          style={{ cursor: "pointer", opacity: selected.includes(m.id) ? 1 : 0.5 }}
          onClick={() => onToggle(m.id)}
        >
          <title>{m.label}</title>
        </circle>
      ))}
    </svg>
  );
}

export function LocalTab() {
  const { data: me } = useGetMe();
  const { data: snapshotsData, isLoading } = useGetEnvironmentSnapshots();
  const saveSnapshot = useSaveEnvironmentSnapshot();

  const [selectedMeridians, setSelectedMeridians] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);

  const latest = snapshotsData?.[0];

  const toggleMeridian = (id: string) => {
    setSelectedMeridians((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const handleSave = () => {
    saveSnapshot.mutate(
      {
        data: {
          aqi: null,
          pollenLevel: null,
          pressure: null,
          daylightMinutes: null,
          feelsLikeTemp: null,
          humidity: null,
        },
      },
      {
        onSuccess: () => {
          setSaved(true);
          setNote("");
          setSelectedMeridians([]);
          setTimeout(() => setSaved(false), 2000);
        },
      }
    );
  };

  const weatherVal = (val?: number | null, unit = "") =>
    val != null ? `${Math.round(val)}${unit}` : "—";

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

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card rounded-xl h-16 animate-pulse border border-border/40" />
          ))}
        </div>
      ) : latest ? (
        <div className="grid grid-cols-2 gap-3">
          <WeatherCard
            icon={<Thermometer size={16} className="text-orange-400" />}
            label="Feels Like"
            value={weatherVal(latest.feelsLikeTemp, "°C")}
          />
          <WeatherCard
            icon={<Droplets size={16} className="text-blue-400" />}
            label="Humidity"
            value={weatherVal(latest.humidity, "%")}
          />
          <WeatherCard
            icon={<Wind size={16} className="text-sky-400" />}
            label="Air Quality"
            value={latest.aqi != null ? `AQI ${Math.round(latest.aqi)}` : "—"}
          />
          <WeatherCard
            icon={<Sun size={16} className="text-yellow-400" />}
            label="Pollen"
            value={latest.pollenLevel ?? "—"}
          />
        </div>
      ) : (
        <div className="bg-card rounded-xl px-4 py-6 border border-border/40 text-center text-xs text-muted-foreground">
          Log your first environment snapshot below.
        </div>
      )}

      <div className="bg-card rounded-2xl p-4 border border-border/40">
        <h3 className="text-sm font-medium mb-3 text-muted-foreground">
          TCM Body Map — What feels active?
        </h3>
        <div className="flex gap-4">
          <BodyMap selected={selectedMeridians} onToggle={toggleMeridian} />

          <div className="flex-1 flex flex-col gap-2 min-w-0">
            <p className="text-xs text-muted-foreground">
              Tap meridian points that feel tense or active:
            </p>
            <div className="flex flex-wrap gap-1 mt-1 min-h-[32px]">
              {selectedMeridians.map((id) => {
                const m = TCM_MERIDIANS.find((m) => m.id === id);
                return (
                  <span
                    key={id}
                    className="text-xs px-2 py-0.5 rounded-full border"
                    style={{ borderColor: m?.color, color: m?.color }}
                  >
                    {m?.label.split(" /")[0]}
                  </span>
                );
              })}
              {selectedMeridians.length === 0 && (
                <span className="text-xs text-muted-foreground/50">None selected</span>
              )}
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note how you feel..."
              rows={4}
              className="flex-1 bg-transparent text-xs border border-border/40 rounded-lg p-2 resize-none outline-none focus:border-primary/50 placeholder:text-muted-foreground/50"
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saveSnapshot.isPending || saved}
          className="w-full mt-3 py-2 rounded-full border border-primary/50 text-sm text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saved ? (
            <>
              <CheckCircle size={14} />
              Snapshot Saved
            </>
          ) : saveSnapshot.isPending ? (
            "Saving..."
          ) : (
            "Log Snapshot"
          )}
        </button>
      </div>

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

function WeatherCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-card rounded-xl p-3 border border-border/40 flex items-center gap-3">
      {icon}
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}
