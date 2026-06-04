import { Router } from "express";
import { randomUUID } from "crypto";
import { eq, and } from "drizzle-orm";
import { db, healthLogsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router = Router();

function formatLog(log: typeof healthLogsTable.$inferSelect) {
  return {
    id: log.id,
    userId: log.userId,
    date: log.date,
    physicalPain: log.physicalPain,
    mentalPain: log.mentalPain,
    soulState: log.soulState ?? null,
    shutdownMeltdown: log.shutdownMeltdown ?? null,
    bodyEntries: JSON.parse(log.bodyEntries || "[]"),
    stressEntries: JSON.parse(log.stressEntries || "[]"),
    regulationEntries: JSON.parse(log.regulationEntries || "[]"),
    notes: log.notes ?? null,
    createdAt: log.createdAt.toISOString(),
  };
}

router.get("/health-logs", requireAuth, async (req, res): Promise<void> => {
  const logs = await db
    .select()
    .from(healthLogsTable)
    .where(eq(healthLogsTable.userId, req.session.userId!));
  res.json(logs.map(formatLog));
});

router.post("/health-logs", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const today = new Date().toISOString().slice(0, 10);
  const body = req.body as {
    physicalPain: number;
    mentalPain: number;
    soulState?: number | null;
    shutdownMeltdown?: string | null;
    bodyEntries?: unknown[];
    stressEntries?: string[];
    regulationEntries?: string[];
    notes?: string | null;
  };

  const existing = await db
    .select()
    .from(healthLogsTable)
    .where(and(eq(healthLogsTable.userId, userId), eq(healthLogsTable.date, today)));

  const values = {
    userId,
    date: today,
    physicalPain: body.physicalPain ?? 0,
    mentalPain: body.mentalPain ?? 0,
    soulState: body.soulState ?? null,
    shutdownMeltdown: body.shutdownMeltdown ?? null,
    bodyEntries: JSON.stringify(body.bodyEntries ?? []),
    stressEntries: JSON.stringify(body.stressEntries ?? []),
    regulationEntries: JSON.stringify(body.regulationEntries ?? []),
    notes: body.notes ?? null,
  };

  let log;
  if (existing.length > 0) {
    [log] = await db
      .update(healthLogsTable)
      .set(values)
      .where(eq(healthLogsTable.id, existing[0].id))
      .returning();
  } else {
    [log] = await db
      .insert(healthLogsTable)
      .values({ id: randomUUID(), ...values })
      .returning();
  }

  res.json(formatLog(log));
});

export default router;
