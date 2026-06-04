import { Router } from "express";
import { randomUUID } from "crypto";
import { eq, and } from "drizzle-orm";
import { db, timerSessionsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router = Router();

function formatSession(s: typeof timerSessionsTable.$inferSelect) {
  return {
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
  };
}

router.get("/sessions", requireAuth, async (req, res): Promise<void> => {
  const sessions = await db
    .select()
    .from(timerSessionsTable)
    .where(eq(timerSessionsTable.userId, req.session.userId!));
  res.json(sessions.map(formatSession));
});

router.post("/sessions", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const body = req.body as {
    presetId?: string | null;
    categoryId: string;
    categoryName: string;
    categoryColor: string;
    duration: number;
    mode: string;
    connectionReflection?: string | null;
  };

  const [session] = await db
    .insert(timerSessionsTable)
    .values({
      id: randomUUID(),
      userId,
      presetId: body.presetId ?? null,
      categoryId: body.categoryId,
      categoryName: body.categoryName,
      categoryColor: body.categoryColor,
      duration: body.duration,
      mode: body.mode,
      connectionReflection: body.connectionReflection ?? null,
    })
    .returning();

  res.status(201).json(formatSession(session));
});

router.patch("/sessions/:id", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const userId = req.session.userId!;
  const body = req.body as { connectionReflection?: string | null };

  const [updated] = await db
    .update(timerSessionsTable)
    .set({ connectionReflection: body.connectionReflection ?? null })
    .where(and(eq(timerSessionsTable.id, rawId), eq(timerSessionsTable.userId, userId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.json(formatSession(updated));
});

export default router;
