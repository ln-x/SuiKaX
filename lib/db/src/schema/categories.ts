import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const customCategoriesTable = pgTable("custom_categories", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  color: text("color").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCategorySchema = createInsertSchema(customCategoriesTable).omit({ createdAt: true });
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof customCategoriesTable.$inferSelect;
