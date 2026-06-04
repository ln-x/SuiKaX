import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

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
