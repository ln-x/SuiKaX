import React, { useState } from "react";
import {
  useGetHealthLogs,
  useSaveHealthLog,
  useGetStressFactors,
} from "@workspace/api-client-react";
import { Heart, CheckCircle } from "lucide-react";

const PHYSICAL_PAIN = [
  { value: 1, emoji: "🟢", label: "None" },
  { value: 2, emoji: "🟡", label: "Mild" },
  { value: 3, emoji: "🟠", label: "Moderate" },
  { value: 4, emoji: "🔴", label: "Severe" },
  { value: 5, emoji: "🆘", label: "Intense" },
];

const MENTAL_PAIN = [
  { value: 1, emoji: "😊", label: "Clear" },
  { value: 2, emoji: "🙂", label: "Slight fog" },
  { value: 3, emoji: "😐", label: "Foggy" },
  { value: 4, emoji: "😞", label: "Heavy" },
  { value: 5, emoji: "😔", label: "Overwhelmed" },
];

const SOUL_STATES = [
  { value: 1, label: "Present" },
  { value: 2, label: "Distracted" },
  { value: 3, label: "Withdrawn" },
  { value: 4, label: "Shutdown" },
  { value: 5, label: "Meltdown" },
];

const TCM_ORGAN_CLOCKS = [
  { organ: "Lung", time: "3–5 AM", element: "Metal" },
  { organ: "Large Intestine", time: "5–7 AM", element: "Metal" },
  { organ: "Stomach", time: "7–9 AM", element: "Earth" },
  { organ: "Spleen", time: "9–11 AM", element: "Earth" },
  { organ: "Heart", time: "11 AM–1 PM", element: "Fire" },
  { organ: "Small Intestine", time: "1–3 PM", element: "Fire" },
  { organ: "Bladder", time: "3–5 PM", element: "Water" },
  { organ: "Kidney", time: "5–7 PM", element: "Water" },
  { organ: "Pericardium", time: "7–9 PM", element: "Fire" },
  { organ: "Triple Warmer", time: "9–11 PM", element: "Fire" },
  { organ: "Gallbladder", time: "11 PM–1 AM", element: "Wood" },
  { organ: "Liver", time: "1–3 AM", element: "Wood" },
];

const ELEMENT_COLORS: Record<string, string> = {
  Metal: "text-purple-300",
  Earth: "text-yellow-400",
  Fire: "text-red-400",
  Water: "text-blue-400",
  Wood: "text-green-400",
};

function getCurrentOrgan() {
  const h = new Date().getHours();
  const pairs: [number, number, string][] = [
    [3, 5, "Lung"], [5, 7, "Large Intestine"], [7, 9, "Stomach"],
    [9, 11, "Spleen"], [11, 13, "Heart"], [13, 15, "Small Intestine"],
    [15, 17, "Bladder"], [17, 19, "Kidney"], [19, 21, "Pericardium"],
    [21, 23, "Triple Warmer"], [23, 25, "Gallbladder"], [1, 3, "Liver"],
  ];
  for (const [start, end, organ] of pairs) {
    if (h >= start && h < end) return organ;
    if (start >= 23 && (h >= start || h < end - 24)) return organ;
  }
  return null;
}

export function HealthTab() {
  const [physicalPain, setPhysicalPain] = useState<number>(1);
  const [mentalPain, setMentalPain] = useState<number>(1);
  const [soulState, setSoulState] = useState<number | null>(null);
  const [selectedStress, setSelectedStress] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);

  const { data: healthLogs, refetch: refetchLogs } = useGetHealthLogs();
  const { data: stressFactors } = useGetStressFactors();
  const saveLog = useSaveHealthLog();

  const handleSave = () => {
    saveLog.mutate(
      {
        data: {
          physicalPain,
          mentalPain,
          soulState: soulState ?? undefined,
          stressEntries: selectedStress.length > 0 ? selectedStress : undefined,
          notes: notes || undefined,
        },
      },
      {
        onSuccess: () => {
          setSaved(true);
          setPhysicalPain(1);
          setMentalPain(1);
          setSoulState(null);
          setSelectedStress([]);
          setNotes("");
          refetchLogs();
          setTimeout(() => setSaved(false), 2500);
        },
      }
    );
  };

  const toggleStress = (label: string) => {
    setSelectedStress((prev) =>
      prev.includes(label) ? prev.filter((s) => s !== label) : [...prev, label]
    );
  };

  const activeOrganName = getCurrentOrgan();
  const activeOrgan = TCM_ORGAN_CLOCKS.find((o) => o.organ === activeOrganName);

  return (
    <div className="flex flex-col gap-4 px-4 pt-5 pb-6">
      <div className="flex items-center gap-2">
        <Heart size={18} className="text-primary" />
        <h2 className="text-lg font-semibold">Health Log</h2>
      </div>

      {activeOrgan && (
        <div className="bg-card rounded-xl px-4 py-3 border border-border/40 text-xs">
          <span className="text-muted-foreground">Active meridian now: </span>
          <span className={`font-medium ${ELEMENT_COLORS[activeOrgan.element] ?? "text-foreground"}`}>
            {activeOrgan.organ}
          </span>
          <span className="text-muted-foreground"> ({activeOrgan.element}) · {activeOrgan.time}</span>
        </div>
      )}

      <div className="bg-card rounded-2xl p-4 border border-border/40 space-y-4">
        <div>
          <p className="text-xs text-muted-foreground mb-2">Physical discomfort</p>
          <div className="flex justify-between">
            {PHYSICAL_PAIN.map((m) => (
              <button
                key={m.value}
                onClick={() => setPhysicalPain(m.value)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-colors ${
                  physicalPain === m.value ? "bg-primary/20 ring-1 ring-primary" : "hover:bg-secondary/30"
                }`}
              >
                <span className="text-2xl">{m.emoji}</span>
                <span className="text-[9px] text-muted-foreground">{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-2">Mental/emotional state</p>
          <div className="flex justify-between">
            {MENTAL_PAIN.map((m) => (
              <button
                key={m.value}
                onClick={() => setMentalPain(m.value)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-colors ${
                  mentalPain === m.value ? "bg-primary/20 ring-1 ring-primary" : "hover:bg-secondary/30"
                }`}
              >
                <span className="text-2xl">{m.emoji}</span>
                <span className="text-[9px] text-muted-foreground">{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-2">Nervous system state (optional)</p>
          <div className="flex gap-2 flex-wrap">
            {SOUL_STATES.map((s) => (
              <button
                key={s.value}
                onClick={() => setSoulState(soulState === s.value ? null : s.value)}
                className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                  soulState === s.value
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {stressFactors && stressFactors.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Stress factors today</p>
            <div className="flex flex-wrap gap-2">
              {stressFactors.map((f) => (
                <button
                  key={f.id}
                  onClick={() => toggleStress(f.label)}
                  className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                    selectedStress.includes(f.label)
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)..."
          rows={2}
          className="w-full bg-transparent text-xs border border-border/40 rounded-lg p-2 resize-none outline-none focus:border-primary/50 placeholder:text-muted-foreground/50"
        />

        <button
          onClick={handleSave}
          disabled={saveLog.isPending || saved}
          className="w-full py-2 rounded-full border border-primary/50 text-sm text-primary hover:bg-primary/10 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {saved ? (
            <>
              <CheckCircle size={14} />
              Saved!
            </>
          ) : saveLog.isPending ? (
            "Saving..."
          ) : (
            "Log Check-in"
          )}
        </button>
      </div>

      <div className="bg-card rounded-2xl p-4 border border-border/40">
        <h3 className="text-sm font-medium mb-3 text-muted-foreground">TCM Organ Clock</h3>
        <div className="space-y-0.5">
          {TCM_ORGAN_CLOCKS.map((o) => (
            <div
              key={o.organ}
              className={`flex justify-between items-center px-3 py-2 rounded-lg text-xs ${
                activeOrgan?.organ === o.organ ? "bg-primary/10 border border-primary/30" : ""
              }`}
            >
              <span className={activeOrgan?.organ === o.organ ? "font-medium" : "text-muted-foreground"}>
                {o.organ}
              </span>
              <div className="flex gap-3">
                <span className={ELEMENT_COLORS[o.element]}>{o.element}</span>
                <span className="text-muted-foreground">{o.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {healthLogs && healthLogs.length > 0 && (
        <div className="bg-card rounded-2xl p-4 border border-border/40">
          <h3 className="text-sm font-medium mb-3 text-muted-foreground">Recent Logs</h3>
          <div className="space-y-2">
            {healthLogs.slice(0, 7).map((log, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-border/20 last:border-0">
                <span className="text-muted-foreground">
                  {new Date(log.createdAt).toLocaleDateString()}
                </span>
                <div className="flex gap-3">
                  <span className="text-muted-foreground">
                    Body {log.physicalPain}/5
                  </span>
                  <span className="text-muted-foreground">
                    Mind {log.mentalPain}/5
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
