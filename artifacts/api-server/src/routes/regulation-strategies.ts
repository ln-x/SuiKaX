import { Router } from "express";
import { randomUUID } from "crypto";
import { eq, and } from "drizzle-orm";
import { db, regulationStrategiesTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/regulation-strategies", requireAuth, async (req, res): Promise<void> => {
  const strategies = await db
    .select()
    .from(regulationStrategiesTable)
    .where(eq(regulationStrategiesTable.userId, req.session.userId!));
  res.json(
    strategies.map((s) => ({
      id: s.id,
      userId: s.userId,
      label: s.label,
      channel: s.channel,
      sortOrder: s.sortOrder,
      isDefault: s.isDefault,
    })),
  );
});

router.post("/regulation-strategies", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const body = req.body as { label: string; channel: string };
  if (!body.label || !body.channel) {
    res.status(400).json({ error: "label and channel are required" });
    return;
  }

  const [strategy] = await db
    .insert(regulationStrategiesTable)
    .values({ id: randomUUID(), userId, label: body.label, channel: body.channel, sortOrder: 0, isDefault: false })
    .returning();

  res.status(201).json({ id: strategy.id, userId: strategy.userId, label: strategy.label, channel: strategy.channel, sortOrder: strategy.sortOrder, isDefault: strategy.isDefault });
});

router.delete("/regulation-strategies/:id", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await db
    .delete(regulationStrategiesTable)
    .where(and(eq(regulationStrategiesTable.id, rawId), eq(regulationStrategiesTable.userId, req.session.userId!)));
  res.sendStatus(204);
});

export default router;
