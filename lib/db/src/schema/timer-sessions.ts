import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const timerSessionsTable = pgTable("timer_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  presetId: text("preset_id"),
  categoryId: text("category_id").notNull(),
  categoryName: text("category_name").notNull(),
  categoryColor: text("category_color").notNull(),
  duration: integer("duration").notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  mode: text("mode").notNull().default("timer"),
  connectionReflection: text("connection_reflection"),
});

export const insertTimerSessionSchema = createInsertSchema(timerSessionsTable);
export type InsertTimerSession = z.infer<typeof insertTimerSessionSchema>;
export type TimerSession = typeof timerSessionsTable.$inferSelect;
