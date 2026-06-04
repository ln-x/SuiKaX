import { pgTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const stressFactorsTable = pgTable("stress_factors", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  label: text("label").notNull(),
  category: text("category").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStressFactorSchema = createInsertSchema(stressFactorsTable).omit({ createdAt: true });
export type InsertStressFactor = z.infer<typeof insertStressFactorSchema>;
export type StressFactor = typeof stressFactorsTable.$inferSelect;
