import { pgTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const regulationStrategiesTable = pgTable("regulation_strategies", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  label: text("label").notNull(),
  channel: text("channel").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRegulationStrategySchema = createInsertSchema(regulationStrategiesTable).omit({ createdAt: true });
export type InsertRegulationStrategy = z.infer<typeof insertRegulationStrategySchema>;
export type RegulationStrategy = typeof regulationStrategiesTable.$inferSelect;
