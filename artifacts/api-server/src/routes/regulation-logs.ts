import { Router } from "express";
import { randomUUID } from "crypto";
import { eq, and } from "drizzle-orm";
import { db, regulationLogsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/regulation-log", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const today = new Date().toISOString().slice(0, 10);

  const [log] = await db
    .select()
    .from(regulationLogsTable)
    .where(and(eq(regulationLogsTable.userId, userId), eq(regulationLogsTable.date, today)));

  if (!log) {
    res.json({ id: "", userId, date: today, activeStrategyIds: [] });
    return;
  }

  res.json({
    id: log.id,
    userId: log.userId,
    date: log.date,
    activeStrategyIds: JSON.parse(log.activeStrategyIds || "[]"),
  });
});

router.post("/regulation-log", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const today = new Date().toISOString().slice(0, 10);
  const body = req.body as { activeStrategyIds: string[] };
  const activeStrategyIds = JSON.stringify(body.activeStrategyIds ?? []);

  const existing = await db
    .select()
    .from(regulationLogsTable)
    .where(and(eq(regulationLogsTable.userId, userId), eq(regulationLogsTable.date, today)));

  let log;
  if (existing.length > 0) {
    [log] = await db
      .update(regulationLogsTable)
      .set({ activeStrategyIds })
      .where(eq(regulationLogsTable.id, existing[0].id))
      .returning();
  } else {
    [log] = await db
      .insert(regulationLogsTable)
      .values({ id: randomUUID(), userId, date: today, activeStrategyIds })
      .returning();
  }

  res.json({
    id: log.id,
    userId: log.userId,
    date: log.date,
    activeStrategyIds: JSON.parse(log.activeStrategyIds || "[]"),
  });
});

export default router;
