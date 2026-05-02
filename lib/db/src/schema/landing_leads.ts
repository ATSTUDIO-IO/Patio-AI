import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const landingLeads = pgTable(
  "landing_leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nome: text("nome").notNull(),
    email: text("email").notNull(),
    telefone: text("telefone"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_landing_leads_email").on(table.email),
    index("idx_landing_leads_criado_em").on(table.criadoEm),
  ],
);

export const insertLandingLeadSchema = createInsertSchema(landingLeads).omit({
  id: true,
  criadoEm: true,
});
export const selectLandingLeadSchema = createSelectSchema(landingLeads);
export type InsertLandingLead = z.infer<typeof insertLandingLeadSchema>;
export type LandingLead = typeof landingLeads.$inferSelect;
