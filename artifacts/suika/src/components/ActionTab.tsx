import React, { useState, useEffect, useRef } from "react";
import {
  useGetRegulationStrategies,
  useGetRegulationLog,
  useSaveRegulationLog,
  useCreateSession,
} from "@workspace/api-client-react";
import { Play, Pause, Square, ChevronDown, ChevronUp, CheckCircle2, Timer } from "lucide-react";

const BREATHING_PRESETS = [
  {
    id: "box",
    label: "Box Breathing",
    durationSec: 240,
    phases: [4, 4, 4, 4],
    description: "4-4-4-4 inhale, hold, exhale, hold",
    channel: "breath",
  },
  {
    id: "478",
    label: "4-7-8 Breath",
    durationSec: 180,
    phases: [4, 7, 8, 0],
    description: "Inhale 4s, hold 7s, exhale 8s",
    channel: "breath",
  },
  {
    id: "physiological",
    label: "Physiological Sigh",
    durationSec: 120,
    phases: [2, 2, 8, 0],
    description: "Double inhale, long exhale",
    channel: "breath",
  },
  {
    id: "coherent",
    label: "Coherent Breathing",
    durationSec: 300,
    phases: [5, 0, 5, 0],
    description: "5s inhale, 5s exhale rhythm",
    channel: "breath",
  },
];

const PHASE_LABELS = ["Inhale", "Hold", "Exhale", "Hold"];

function useTimer(durationSec: number) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setElapsed((e) => {
          if (e + 1 >= durationSec) {
            clearInterval(intervalRef.current!);
            setRunning(false);
            setDone(true);
            return durationSec;
          }
          return e + 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, durationSec]);

  const reset = () => {
    setElapsed(0);
    setRunning(false);
    setDone(false);
  };

  return { elapsed, running, done, setRunning, reset };
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function BreathingCircle({ phases, elapsed }: { phases: number[]; elapsed: number }) {
  const cycle = phases.reduce((a, b) => a + b, 0);
  if (cycle === 0) return null;
  const pos = elapsed % cycle;
  let phase = 0;
  let acc = 0;
  for (let i = 0; i < phases.length; i++) {
    if (phases[i] === 0) continue;
    if (pos < acc + phases[i]) {
      phase = i;
      break;
    }
    acc += phases[i];
  }
  const phaseProgress = phases[phase] > 0 ? (pos - acc) / phases[phase] : 0;
  const isExpanding = phase === 0 || phase === 1;
  const scale = isExpanding ? 0.7 + phaseProgress * 0.3 : 1.0 - phaseProgress * 0.3;

  return (
    <div className="flex flex-col items-center gap-3 my-4">
      <div
        className="w-28 h-28 rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center transition-transform duration-1000"
        style={{ transform: `scale(${scale})` }}
      >
        <span className="text-xs text-primary font-medium">{PHASE_LABELS[phase]}</span>
      </div>
    </div>
  );
}

export function ActionTab() {
  const [selectedPreset, setSelectedPreset] = useState(BREATHING_PRESETS[0]);
  const [expandedStrategy, setExpandedStrategy] = useState<string | null>(null);

  const { data: strategies } = useGetRegulationStrategies();
  const { data: regulationLog, refetch: refetchLog } = useGetRegulationLog();
  const saveRegLog = useSaveRegulationLog();
  const createSession = useCreateSession();

  const { elapsed, running, done, setRunning, reset } = useTimer(selectedPreset.durationSec);

  const activeStrategyIds = regulationLog?.activeStrategyIds ?? [];

  const handleStart = () => {
    setRunning(true);
  };

  const handleEnd = () => {
    if (elapsed > 10) {
      createSession.mutate({
        data: {
          presetId: selectedPreset.id,
          categoryId: "breath",
          categoryName: "Breathwork",
          categoryColor: "#FF453A",
          duration: elapsed,
          mode: selectedPreset.id,
        },
      });
    }
    reset();
  };

  const toggleStrategy = (strategyId: string) => {
    const updated = activeStrategyIds.includes(strategyId)
      ? activeStrategyIds.filter((id) => id !== strategyId)
      : [...activeStrategyIds, strategyId];
    saveRegLog.mutate(
      { data: { activeStrategyIds: updated } },
      { onSuccess: () => refetchLog() }
    );
  };

  const remaining = selectedPreset.durationSec - elapsed;
  const progress = elapsed / selectedPreset.durationSec;

  return (
    <div className="flex flex-col gap-4 px-4 pt-5 pb-6">
      <div className="flex items-center gap-2">
        <Timer size={18} className="text-primary" />
        <h2 className="text-lg font-semibold">Regulation Timer</h2>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {BREATHING_PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              setSelectedPreset(p);
              reset();
            }}
            className={`text-left px-3 py-2 rounded-xl border text-xs transition-colors ${
              selectedPreset.id === p.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            <div className="font-medium">{p.label}</div>
            <div className="mt-0.5 opacity-70">{p.description}</div>
          </button>
        ))}
      </div>

      <div className="bg-card rounded-2xl p-4 border border-border/40 flex flex-col items-center">
        <div className="relative w-full h-1 bg-border/40 rounded-full mb-1">
          <div
            className="absolute left-0 top-0 h-full bg-primary rounded-full transition-all duration-1000"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        {done ? (
          <div className="py-8 text-center">
            <div className="text-4xl mb-2">🕉️</div>
            <p className="text-sm text-muted-foreground">Session complete</p>
          </div>
        ) : running && elapsed > 0 ? (
          <>
            <BreathingCircle phases={selectedPreset.phases} elapsed={elapsed} />
            <div className="text-xs text-muted-foreground mb-3">
              {formatTime(remaining)} remaining
            </div>
          </>
        ) : (
          <div className="py-8 text-4xl font-mono text-foreground/80">
            {formatTime(remaining)}
          </div>
        )}

        <div className="flex gap-3">
          {!running && !done ? (
            <button
              onClick={handleStart}
              className="flex items-center gap-2 px-6 py-2 bg-primary rounded-full text-white text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Play size={14} fill="white" />
              {elapsed > 0 ? "Resume" : "Begin"}
            </button>
          ) : !done ? (
            <button
              onClick={() => setRunning(false)}
              className="flex items-center gap-2 px-6 py-2 border border-border rounded-full text-sm hover:bg-card transition-colors"
            >
              <Pause size={14} />
              Pause
            </button>
          ) : null}

          {(elapsed > 0 || done) && (
            <button
              onClick={handleEnd}
              className="flex items-center gap-2 px-4 py-2 border border-border/40 rounded-full text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Square size={13} />
              {done ? "New Session" : "End & Save"}
            </button>
          )}
        </div>
      </div>

      <div className="bg-card rounded-2xl p-4 border border-border/40">
        <h3 className="text-sm font-medium mb-3 text-muted-foreground">
          Regulation Strategies{" "}
          <span className="text-xs font-normal">(tap to toggle for today)</span>
        </h3>
        {!strategies || strategies.length === 0 ? (
          <p className="text-xs text-muted-foreground">No strategies available.</p>
        ) : (
          <div className="space-y-2">
            {strategies.map((s) => (
              <div key={s.id} className="border border-border/40 rounded-xl overflow-hidden">
                <div className="flex items-center">
                  <button
                    onClick={() => toggleStrategy(s.id)}
                    className={`p-3 transition-colors ${
                      activeStrategyIds.includes(s.id) ? "text-green-400" : "text-muted-foreground/40"
                    }`}
                  >
                    <CheckCircle2 size={16} />
                  </button>
                  <button
                    onClick={() =>
                      setExpandedStrategy(expandedStrategy === s.id ? null : s.id)
                    }
                    className="flex-1 flex items-center justify-between pr-3 py-2.5 text-left hover:bg-secondary/20 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm truncate">{s.label}</span>
                      <span className="text-xs text-muted-foreground shrink-0 capitalize">
                        · {s.channel}
                      </span>
                    </div>
                    {expandedStrategy === s.id ? (
                      <ChevronUp size={14} className="text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronDown size={14} className="text-muted-foreground shrink-0" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
