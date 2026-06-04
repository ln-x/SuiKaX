import { pgTable, text, real, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const environmentSnapshotsTable = pgTable("environment_snapshots", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  date: text("date").notNull(),
  pollenLevel: text("pollen_level"),
  aqi: real("aqi"),
  pressure: real("pressure"),
  daylightMinutes: integer("daylight_minutes"),
  feelsLikeTemp: real("feels_like_temp"),
  humidity: real("humidity"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEnvironmentSnapshotSchema = createInsertSchema(environmentSnapshotsTable).omit({ createdAt: true });
export type InsertEnvironmentSnapshot = z.infer<typeof insertEnvironmentSnapshotSchema>;
export type EnvironmentSnapshot = typeof environmentSnapshotsTable.$inferSelect;
