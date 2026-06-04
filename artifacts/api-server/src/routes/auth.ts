import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db, usersTable, stressFactorsTable, regulationStrategiesTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const DEFAULT_STRESS_FACTORS: Array<{ label: string; category: string; sortOrder: number }> = [
  { label: "Work Overload", category: "work", sortOrder: 0 },
  { label: "Conflict", category: "relationships", sortOrder: 1 },
  { label: "Financial Pressure", category: "financial", sortOrder: 2 },
  { label: "Health Concerns", category: "health", sortOrder: 3 },
  { label: "Social Isolation", category: "social", sortOrder: 4 },
  { label: "Sleep Deprivation", category: "health", sortOrder: 5 },
  { label: "Uncertainty", category: "mental", sortOrder: 6 },
  { label: "Overstimulation", category: "environment", sortOrder: 7 },
];

const DEFAULT_REGULATION_STRATEGIES: Array<{ label: string; channel: string; sortOrder: number }> = [
  { label: "Box Breathing", channel: "breath", sortOrder: 0 },
  { label: "4-7-8 Breath", channel: "breath", sortOrder: 1 },
  { label: "Physiological Sigh", channel: "breath", sortOrder: 2 },
  { label: "Coherent Breathing", channel: "breath", sortOrder: 3 },
  { label: "Cold Water Face", channel: "body", sortOrder: 4 },
  { label: "Movement / Walk", channel: "body", sortOrder: 5 },
  { label: "Nature Time", channel: "environment", sortOrder: 6 },
  { label: "Journaling", channel: "cognitive", sortOrder: 7 },
];

const router = Router();

router.post("/auth/register", async (req, res): Promise<void> => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.username, username));
  if (existing.length > 0) {
    res.status(409).json({ error: "Username already taken" });
    return;
  }

  const hashed = await bcrypt.hash(password, 10);
  const id = randomUUID();
  const [user] = await db.insert(usersTable).values({ id, username, password: hashed }).returning();

  await db.insert(stressFactorsTable).values(
    DEFAULT_STRESS_FACTORS.map((f) => ({
      id: randomUUID(),
      userId: user.id,
      label: f.label,
      category: f.category,
      sortOrder: f.sortOrder,
      isDefault: true,
    }))
  );

  await db.insert(regulationStrategiesTable).values(
    DEFAULT_REGULATION_STRATEGIES.map((s) => ({
      id: randomUUID(),
      userId: user.id,
      label: s.label,
      channel: s.channel,
      sortOrder: s.sortOrder,
      isDefault: true,
    }))
  );

  req.session.userId = user.id;
  req.session.username = user.username;

  res.status(201).json({
    id: user.id,
    username: user.username,
    displayName: user.displayName ?? null,
    defaultLat: user.defaultLat ?? null,
    defaultLon: user.defaultLon ?? null,
    defaultLocationName: user.defaultLocationName ?? null,
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username));
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  req.session.userId = user.id;
  req.session.username = user.username;

  res.json({
    id: user.id,
    username: user.username,
    displayName: user.displayName ?? null,
    defaultLat: user.defaultLat ?? null,
    defaultLon: user.defaultLon ?? null,
    defaultLocationName: user.defaultLocationName ?? null,
  });
});

router.post("/auth/logout", (req, res): void => {
  req.session.destroy(() => {});
  res.json({ message: "Logged out" });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!));
  if (!user) {
    res.status(401).json({ error: "Session invalid" });
    return;
  }
  res.json({
    id: user.id,
    username: user.username,
    displayName: user.displayName ?? null,
    defaultLat: user.defaultLat ?? null,
    defaultLon: user.defaultLon ?? null,
    defaultLocationName: user.defaultLocationName ?? null,
  });
});

router.delete("/auth/account", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  // Cascading delete — delete all user data then the user
  await db.delete(usersTable).where(eq(usersTable.id, userId));
  req.session.destroy(() => {});
  res.json({ message: "Account deleted" });
});

export default router;
