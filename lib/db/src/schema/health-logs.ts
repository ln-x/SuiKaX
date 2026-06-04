import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const healthLogsTable = pgTable("health_logs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  date: text("date").notNull(),
  physicalPain: integer("physical_pain").notNull().default(0),
  mentalPain: integer("mental_pain").notNull().default(0),
  soulState: integer("soul_state"),
  shutdownMeltdown: text("shutdown_meltdown"),
  bodyEntries: text("body_entries").notNull().default("[]"),
  stressEntries: text("stress_entries").notNull().default("[]"),
  regulationEntries: text("regulation_entries").notNull().default("[]"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertHealthLogSchema = createInsertSchema(healthLogsTable).omit({ createdAt: true });
export type InsertHealthLog = z.infer<typeof insertHealthLogSchema>;
export type HealthLog = typeof healthLogsTable.$inferSelect;
