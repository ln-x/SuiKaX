import { Router } from "express";
import { randomUUID } from "crypto";
import { eq, and } from "drizzle-orm";
import { db, customCategoriesTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/categories", requireAuth, async (req, res): Promise<void> => {
  const cats = await db
    .select()
    .from(customCategoriesTable)
    .where(eq(customCategoriesTable.userId, req.session.userId!));
  res.json(
    cats.map((c) => ({
      id: c.id,
      userId: c.userId,
      name: c.name,
      color: c.color,
      createdAt: c.createdAt.toISOString(),
    })),
  );
});

router.post("/categories", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const body = req.body as { name: string; color: string };
  if (!body.name || !body.color) {
    res.status(400).json({ error: "name and color are required" });
    return;
  }

  const [cat] = await db
    .insert(customCategoriesTable)
    .values({ id: randomUUID(), userId, name: body.name, color: body.color })
    .returning();

  res.status(201).json({ id: cat.id, userId: cat.userId, name: cat.name, color: cat.color, createdAt: cat.createdAt.toISOString() });
});

router.delete("/categories/:id", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await db
    .delete(customCategoriesTable)
    .where(and(eq(customCategoriesTable.id, rawId), eq(customCategoriesTable.userId, req.session.userId!)));
  res.sendStatus(204);
});

export default router;
