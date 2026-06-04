import { Router } from "express";
import { randomUUID } from "crypto";
import { eq, and } from "drizzle-orm";
import { db, presetsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/presets", requireAuth, async (req, res): Promise<void> => {
  const presets = await db
    .select()
    .from(presetsTable)
    .where(eq(presetsTable.userId, req.session.userId!));
  res.json(
    presets.map((p) => ({
      id: p.id,
      userId: p.userId,
      name: p.name,
      duration: p.duration,
      categoryId: p.categoryId,
    })),
  );
});

router.post("/presets", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const body = req.body as { name: string; duration: number; categoryId: string };
  if (!body.name || body.duration == null || !body.categoryId) {
    res.status(400).json({ error: "name, duration, and categoryId are required" });
    return;
  }

  const [preset] = await db
    .insert(presetsTable)
    .values({ id: randomUUID(), userId, name: body.name, duration: body.duration, categoryId: body.categoryId })
    .returning();

  res.status(201).json({ id: preset.id, userId: preset.userId, name: preset.name, duration: preset.duration, categoryId: preset.categoryId });
});

router.delete("/presets/:id", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await db
    .delete(presetsTable)
    .where(and(eq(presetsTable.id, rawId), eq(presetsTable.userId, req.session.userId!)));
  res.sendStatus(204);
});

export default router;
