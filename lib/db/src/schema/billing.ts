import {
  pgTable,
  uuid,
  integer,
  numeric,
  timestamp,
  date,
  pgEnum,
  unique,
  text,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { lojas } from "./lojas";
import { veiculos } from "./veiculos";

export const statusBillingEnum = pgEnum("status_billing", [
  "aberto",
  "pago",
  "inadimplente",
]);
export const tipoBillingEnum = pgEnum("tipo_billing", [
  "ativacao",
  "baixa",
  "pausa",
]);

export const ciclosBilling = pgTable(
  "ciclos_billing",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lojaId: uuid("loja_id")
      .notNull()
      .references(() => lojas.id),
    mesRef: date("mes_ref").notNull(),
    conversasIncluidas: integer("conversas_incluidas").notNull().default(0),
    conversasUsadas: integer("conversas_usadas").notNull().default(0),
    conversasExcedentes: integer("conversas_excedentes").notNull().default(0),
    valorBase: numeric("valor_base", { precision: 10, scale: 2 }).notNull().default("0"),
    valorExcedente: numeric("valor_excedente", { precision: 10, scale: 2 }).notNull().default("0"),
    valorTotal: numeric("valor_total", { precision: 12, scale: 2 }).notNull(),
    status: statusBillingEnum("status").notNull().default("aberto"),
    geradoEm: timestamp("gerado_em", { withTimezone: true }).defaultNow(),
    pagoEm: timestamp("pago_em", { withTimezone: true }),
  },
  (table) => [
    unique("uq_ciclo_loja_mes").on(table.lojaId, table.mesRef),
    index("idx_ciclos_loja_mes").on(table.lojaId, table.mesRef),
    index("idx_ciclos_status").on(table.status),
  ],
);

export const eventosBilling = pgTable(
  "eventos_billing",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lojaId: uuid("loja_id")
      .notNull()
      .references(() => lojas.id),
    veiculoId: uuid("veiculo_id")
      .references(() => veiculos.id),
    tipo: tipoBillingEnum("tipo").notNull(),
    ocorridoEm: timestamp("ocorrido_em", { withTimezone: true }).defaultNow(),
    motivo: text("motivo"),
  },
  (table) => [
    index("idx_eventos_loja").on(table.lojaId),
    index("idx_eventos_veiculo").on(table.veiculoId),
    index("idx_eventos_ocorrido_em").on(table.ocorridoEm),
  ],
);

export const insertCicloBillingSchema = createInsertSchema(ciclosBilling).omit(
  { id: true, geradoEm: true, pagoEm: true },
);
export const selectCicloBillingSchema = createSelectSchema(ciclosBilling);
export type InsertCicloBilling = z.infer<typeof insertCicloBillingSchema>;
export type CicloBilling = typeof ciclosBilling.$inferSelect;

export const insertEventoBillingSchema = createInsertSchema(
  eventosBilling,
).omit({ id: true, ocorridoEm: true });
export const selectEventoBillingSchema = createSelectSchema(eventosBilling);
export type InsertEventoBilling = z.infer<typeof insertEventoBillingSchema>;
export type EventoBilling = typeof eventosBilling.$inferSelect;
