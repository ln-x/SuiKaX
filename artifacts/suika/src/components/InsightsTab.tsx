import React, { useState } from "react";
import {
  useGetInsightStats,
  useGetSessions,
  useGetHealthLogs,
} from "@workspace/api-client-react";
import { BarChart2, TrendingUp, Zap, Activity, Timer } from "lucide-react";

function MiniBar({
  value,
  max,
  color = "bg-primary",
}: {
  value: number;
  max: number;
  color?: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex-1 h-2 bg-border/30 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-card rounded-xl p-3 border border-border/40 flex items-start gap-3">
      <div className="mt-0.5 text-primary">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function InsightsTab() {
  const [period, setPeriod] = useState<"week" | "month">("week");

  const { data: stats, isLoading: statsLoading } = useGetInsightStats();

  const { data: sessions } = useGetSessions();

  const { data: healthLogs } = useGetHealthLogs();

  const recentLogs = healthLogs?.slice(0, 7) ?? [];
  const physAvg =
    recentLogs.length > 0
      ? recentLogs.reduce((a, l) => a + l.physicalPain, 0) / recentLogs.length
      : null;
  const mentalAvg =
    recentLogs.length > 0
      ? recentLogs.reduce((a, l) => a + l.mentalPain, 0) / recentLogs.length
      : null;

  return (
    <div className="flex flex-col gap-4 px-4 pt-5 pb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 size={18} className="text-primary" />
          <h2 className="text-lg font-semibold">Insights</h2>
        </div>
        <div className="flex gap-1 border border-border/40 rounded-full p-0.5">
          {(["week", "month"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-0.5 rounded-full text-xs capitalize transition-colors ${
                period === p ? "bg-primary text-white" : "text-muted-foreground"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<Timer size={15} />}
          label="Total Sessions"
          value={stats ? `${stats.totalSessions}` : "—"}
          sub={stats ? formatDuration(stats.totalTimeSeconds) : ""}
        />
        <StatCard
          icon={<Zap size={15} />}
          label="Streak"
          value={stats?.currentStreak != null ? `${stats.currentStreak}d` : "—"}
          sub="consecutive days"
        />
        <StatCard
          icon={<Activity size={15} />}
          label="Body Tension"
          value={physAvg != null ? `${physAvg.toFixed(1)}/5` : "—"}
          sub={`${recentLogs.length} recent logs`}
        />
        <StatCard
          icon={<Activity size={15} />}
          label="Mental State"
          value={mentalAvg != null ? `${mentalAvg.toFixed(1)}/5` : "—"}
          sub="avg this week"
        />
      </div>

      {statsLoading ? (
        <div className="bg-card rounded-2xl h-40 animate-pulse border border-border/40" />
      ) : stats ? (
        <>
          {stats.topBodyRegions.length > 0 && (
            <div className="bg-card rounded-2xl p-4 border border-border/40">
              <h3 className="text-sm font-medium mb-3 text-muted-foreground flex items-center gap-1">
                <TrendingUp size={13} />
                Top Body Regions
              </h3>
              <div className="space-y-2">
                {stats.topBodyRegions.slice(0, 5).map((r) => (
                  <div key={r.regionId} className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground w-28 shrink-0 truncate">{r.label}</span>
                    <MiniBar value={r.score} max={stats.topBodyRegions[0]?.score ?? 1} />
                    <span className="w-8 text-right">{r.score}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stats.topStressors.length > 0 && (
            <div className="bg-card rounded-2xl p-4 border border-border/40">
              <h3 className="text-sm font-medium mb-3 text-muted-foreground">Top Stressors</h3>
              <div className="space-y-2">
                {stats.topStressors.slice(0, 5).map((s) => (
                  <div key={s.label} className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground w-28 shrink-0 truncate">{s.label}</span>
                    <MiniBar
                      value={s.count}
                      max={stats.topStressors[0]?.count ?? 1}
                      color="bg-orange-400"
                    />
                    <span className="w-8 text-right">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stats.topStrategies.length > 0 && (
            <div className="bg-card rounded-2xl p-4 border border-border/40">
              <h3 className="text-sm font-medium mb-3 text-muted-foreground">Most Used Strategies</h3>
              <div className="space-y-2">
                {stats.topStrategies.slice(0, 5).map((s) => (
                  <div key={s.label} className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground w-28 shrink-0 truncate">{s.label}</span>
                    <MiniBar
                      value={s.count}
                      max={stats.topStrategies[0]?.count ?? 1}
                      color="bg-green-400"
                    />
                    <span className="w-8 text-right">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : null}

      {sessions && sessions.length > 0 && (
        <div className="bg-card rounded-2xl p-4 border border-border/40">
          <h3 className="text-sm font-medium mb-3 text-muted-foreground">Recent Sessions</h3>
          <div className="space-y-2">
            {sessions.slice(0, 5).map((s, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-xs py-1 border-b border-border/20 last:border-0"
              >
                <div>
                  <span>{s.categoryName ?? s.presetId ?? "Session"}</span>
                  {s.completedAt && (
                    <span className="ml-2 text-green-400">✓</span>
                  )}
                </div>
                <div className="flex gap-3 text-muted-foreground">
                  <span>{formatDuration(s.duration)}</span>
                  <span>{new Date(s.completedAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-card rounded-2xl p-4 border border-border/40">
        <h3 className="text-sm font-medium mb-3 text-muted-foreground">Systems Map</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Your nervous system recovery is a{" "}
          <strong className="text-foreground">feedback loop</strong>: stress inputs feed your
          autonomic response, which your body signals via physical and mental tension. Regulation
          practices (breathwork, rest, connection) shift you toward{" "}
          <strong className="text-foreground">parasympathetic balance</strong>. Consistent tracking
          here surfaces the patterns that matter most for your recovery.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {[
            "Stressors → Body",
            "Body → Signals",
            "Practices → Recovery",
            "Recovery → Resilience",
          ].map((node) => (
            <div
              key={node}
              className="px-3 py-1.5 bg-primary/10 border border-primary/30 rounded-full text-primary"
            >
              {node}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
