import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { lojas, usuarios } from "./lojas";

export const notasAdmin = pgTable("notas_admin", {
  id: uuid("id").primaryKey().defaultRandom(),
  lojaId: uuid("loja_id")
    .notNull()
    .references(() => lojas.id),
  adminId: uuid("admin_id")
    .notNull()
    .references(() => usuarios.id),
  conteudo: text("conteudo").notNull(),
  criadoEm: timestamp("criado_em", { withTimezone: true }).defaultNow(),
});

export const insertNotaAdminSchema = createInsertSchema(notasAdmin).omit({
  id: true,
  criadoEm: true,
});
export const selectNotaAdminSchema = createSelectSchema(notasAdmin);
export type InsertNotaAdmin = z.infer<typeof insertNotaAdminSchema>;
export type NotaAdmin = typeof notasAdmin.$inferSelect;
