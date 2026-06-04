import { Router } from "express";
import { randomUUID } from "crypto";
import { eq, and } from "drizzle-orm";
import { db, stressFactorsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/stress-factors", requireAuth, async (req, res): Promise<void> => {
  const factors = await db
    .select()
    .from(stressFactorsTable)
    .where(eq(stressFactorsTable.userId, req.session.userId!));
  res.json(
    factors.map((f) => ({
      id: f.id,
      userId: f.userId,
      label: f.label,
      category: f.category,
      sortOrder: f.sortOrder,
      isDefault: f.isDefault,
    })),
  );
});

router.post("/stress-factors", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const body = req.body as { label: string; category: string };
  if (!body.label || !body.category) {
    res.status(400).json({ error: "label and category are required" });
    return;
  }

  const [factor] = await db
    .insert(stressFactorsTable)
    .values({ id: randomUUID(), userId, label: body.label, category: body.category, sortOrder: 0, isDefault: false })
    .returning();

  res.status(201).json({ id: factor.id, userId: factor.userId, label: factor.label, category: factor.category, sortOrder: factor.sortOrder, isDefault: factor.isDefault });
});

router.delete("/stress-factors/:id", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await db
    .delete(stressFactorsTable)
    .where(and(eq(stressFactorsTable.id, rawId), eq(stressFactorsTable.userId, req.session.userId!)));
  res.sendStatus(204);
});

export default router;
