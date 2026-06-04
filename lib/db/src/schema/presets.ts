import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const presetsTable = pgTable("presets", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  duration: integer("duration").notNull(),
  categoryId: text("category_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPresetSchema = createInsertSchema(presetsTable).omit({ createdAt: true });
export type InsertPreset = z.infer<typeof insertPresetSchema>;
export type Preset = typeof presetsTable.$inferSelect;
