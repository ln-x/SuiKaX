import { Router } from "express";
import { randomUUID } from "crypto";
import { eq, and } from "drizzle-orm";
import { db, environmentSnapshotsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router = Router();

function formatSnapshot(s: typeof environmentSnapshotsTable.$inferSelect) {
  return {
    id: s.id,
    userId: s.userId,
    date: s.date,
    pollenLevel: s.pollenLevel ?? null,
    aqi: s.aqi ?? null,
    pressure: s.pressure ?? null,
    daylightMinutes: s.daylightMinutes ?? null,
    feelsLikeTemp: s.feelsLikeTemp ?? null,
    humidity: s.humidity ?? null,
  };
}

router.get("/environment-snapshots", requireAuth, async (req, res): Promise<void> => {
  const snapshots = await db
    .select()
    .from(environmentSnapshotsTable)
    .where(eq(environmentSnapshotsTable.userId, req.session.userId!));
  res.json(snapshots.map(formatSnapshot));
});

router.post("/environment-snapshots", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const today = new Date().toISOString().slice(0, 10);
  const body = req.body as {
    pollenLevel?: string | null;
    aqi?: number | null;
    pressure?: number | null;
    daylightMinutes?: number | null;
    feelsLikeTemp?: number | null;
    humidity?: number | null;
  };

  const existing = await db
    .select()
    .from(environmentSnapshotsTable)
    .where(and(eq(environmentSnapshotsTable.userId, userId), eq(environmentSnapshotsTable.date, today)));

  const values = {
    userId,
    date: today,
    pollenLevel: body.pollenLevel ?? null,
    aqi: body.aqi ?? null,
    pressure: body.pressure ?? null,
    daylightMinutes: body.daylightMinutes ?? null,
    feelsLikeTemp: body.feelsLikeTemp ?? null,
    humidity: body.humidity ?? null,
  };

  let snapshot;
  if (existing.length > 0) {
    [snapshot] = await db
      .update(environmentSnapshotsTable)
      .set(values)
      .where(eq(environmentSnapshotsTable.id, existing[0].id))
      .returning();
  } else {
    [snapshot] = await db
      .insert(environmentSnapshotsTable)
      .values({ id: randomUUID(), ...values })
      .returning();
  }

  res.json(formatSnapshot(snapshot));
});

export default router;
