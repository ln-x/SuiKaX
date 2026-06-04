import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const regulationLogsTable = pgTable("regulation_logs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  date: text("date").notNull(),
  activeStrategyIds: text("active_strategy_ids").notNull().default("[]"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRegulationLogSchema = createInsertSchema(regulationLogsTable);
export type InsertRegulationLog = z.infer<typeof insertRegulationLogSchema>;
export type RegulationLog = typeof regulationLogsTable.$inferSelect;
