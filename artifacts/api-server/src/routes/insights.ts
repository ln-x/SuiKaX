import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, healthLogsTable, timerSessionsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/insights/stats", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  const [logs, sessions] = await Promise.all([
    db.select().from(healthLogsTable).where(eq(healthLogsTable.userId, userId)),
    db.select().from(timerSessionsTable).where(eq(timerSessionsTable.userId, userId)),
  ]);

  // Session stats
  const totalSessions = sessions.length;
  const totalTimeSeconds = sessions.reduce((acc, s) => acc + s.duration, 0);
  const longestSession = sessions.reduce((acc, s) => Math.max(acc, s.duration), 0);

  // Streak calculation
  const sessionDates = [...new Set(sessions.map((s) => s.completedAt.toISOString().slice(0, 10)))].sort();
  let currentStreak = 0;
  if (sessionDates.length > 0) {
    const today = new Date().toISOString().slice(0, 10);
    let checkDate = today;
    for (let i = sessionDates.length - 1; i >= 0; i--) {
      if (sessionDates[i] === checkDate) {
        currentStreak++;
        const d = new Date(checkDate);
        d.setDate(d.getDate() - 1);
        checkDate = d.toISOString().slice(0, 10);
      } else {
        break;
      }
    }
  }

  // Body region frequency
  const regionCounts: Record<string, { label: string; score: number }> = {};
  for (const log of logs) {
    let entries: Array<{ regionId: string; intensity: number; duration: string }> = [];
    try {
      entries = JSON.parse(log.bodyEntries || "[]");
    } catch {
      /* ignore */
    }
    for (const e of entries) {
      if (!regionCounts[e.regionId]) regionCounts[e.regionId] = { label: e.regionId, score: 0 };
      regionCounts[e.regionId].score += e.intensity;
    }
  }
  const topBodyRegions = Object.entries(regionCounts)
    .map(([regionId, v]) => ({ regionId, label: v.label, score: v.score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // Top stressors
  const stressCounts: Record<string, number> = {};
  for (const log of logs) {
    let entries: string[] = [];
    try { entries = JSON.parse(log.stressEntries || "[]"); } catch { /* ignore */ }
    for (const e of entries) {
      stressCounts[e] = (stressCounts[e] ?? 0) + 1;
    }
  }
  const topStressors = Object.entries(stressCounts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Top strategies
  const strategyCounts: Record<string, number> = {};
  for (const log of logs) {
    let entries: string[] = [];
    try { entries = JSON.parse(log.regulationEntries || "[]"); } catch { /* ignore */ }
    for (const e of entries) {
      strategyCounts[e] = (strategyCounts[e] ?? 0) + 1;
    }
  }
  const topStrategies = Object.entries(strategyCounts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  res.json({
    totalSessions,
    totalTimeSeconds,
    longestSession,
    currentStreak,
    topBodyRegions,
    topStressors,
    topStrategies,
  });
});

export default router;
