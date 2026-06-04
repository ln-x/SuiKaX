import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, healthLogsTable, timerSessionsTable, environmentSnapshotsTable, stressFactorsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router = Router();

router.patch("/user/location", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const body = req.body as { defaultLat?: number | null; defaultLon?: number | null; defaultLocationName?: string | null };

  const [user] = await db
    .update(usersTable)
    .set({
      defaultLat: body.defaultLat ?? null,
      defaultLon: body.defaultLon ?? null,
      defaultLocationName: body.defaultLocationName ?? null,
    })
    .where(eq(usersTable.id, userId))
    .returning();

  res.json({
    id: user.id,
    username: user.username,
    displayName: user.displayName ?? null,
    defaultLat: user.defaultLat ?? null,
    defaultLon: user.defaultLon ?? null,
    defaultLocationName: user.defaultLocationName ?? null,
  });
});

router.get("/my-data", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  const [healthLogs, sessions, envSnapshots, stressFactors] = await Promise.all([
    db.select().from(healthLogsTable).where(eq(healthLogsTable.userId, userId)),
    db.select().from(timerSessionsTable).where(eq(timerSessionsTable.userId, userId)),
    db.select().from(environmentSnapshotsTable).where(eq(environmentSnapshotsTable.userId, userId)),
    db.select().from(stressFactorsTable).where(eq(stressFactorsTable.userId, userId)),
  ]);

  res.json({
    healthLogs: healthLogs.map((l) => ({
      id: l.id,
      userId: l.userId,
      date: l.date,
      physicalPain: l.physicalPain,
      mentalPain: l.mentalPain,
      soulState: l.soulState ?? null,
      shutdownMeltdown: l.shutdownMeltdown ?? null,
      bodyEntries: JSON.parse(l.bodyEntries || "[]"),
      stressEntries: JSON.parse(l.stressEntries || "[]"),
      regulationEntries: JSON.parse(l.regulationEntries || "[]"),
      notes: l.notes ?? null,
      createdAt: l.createdAt.toISOString(),
    })),
    timerSessions: sessions.map((s) => ({
      id: s.id,
      userId: s.userId,
      presetId: s.presetId ?? null,
      categoryId: s.categoryId,
      categoryName: s.categoryName,
      categoryColor: s.categoryColor,
      duration: s.duration,
      completedAt: s.completedAt.toISOString(),
      mode: s.mode,
      connectionReflection: s.connectionReflection ?? null,
    })),
    environmentSnapshots: envSnapshots.map((s) => ({
      id: s.id,
      userId: s.userId,
      date: s.date,
      pollenLevel: s.pollenLevel ?? null,
      aqi: s.aqi ?? null,
      pressure: s.pressure ?? null,
      daylightMinutes: s.daylightMinutes ?? null,
      feelsLikeTemp: s.feelsLikeTemp ?? null,
      humidity: s.humidity ?? null,
    })),
    stressFactors: stressFactors.map((f) => ({
      id: f.id,
      userId: f.userId,
      label: f.label,
      category: f.category,
      sortOrder: f.sortOrder,
      isDefault: f.isDefault,
    })),
  });
});

const ALLOWED_TABLES = ["health_logs", "timer_sessions", "environment_snapshots", "stress_factors"] as const;
type AllowedTable = (typeof ALLOWED_TABLES)[number];

router.delete("/my-data/:table/:id", requireAuth, async (req, res): Promise<void> => {
  const rawTable = Array.isArray(req.params.table) ? req.params.table[0] : req.params.table;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const userId = req.session.userId!;

  if (!ALLOWED_TABLES.includes(rawTable as AllowedTable)) {
    res.status(400).json({ error: "Invalid table" });
    return;
  }

  const tableMap = {
    health_logs: healthLogsTable,
    timer_sessions: timerSessionsTable,
    environment_snapshots: environmentSnapshotsTable,
    stress_factors: stressFactorsTable,
  } as const;

  const table = tableMap[rawTable as AllowedTable];
  await db.delete(table).where(eq(table.id, rawId));
  res.sendStatus(204);
});

export default router;
