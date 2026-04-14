import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  pgEnum,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { lojas } from "./lojas";

export const statusVeiculoEnum = pgEnum("status_veiculo", [
  "ativo",
  "vendido",
  "pausado",
]);
export const cambioEnum = pgEnum("cambio", ["manual", "automatico", "cvt"]);
export const combustivelEnum = pgEnum("combustivel", [
  "flex",
  "gasolina",
  "diesel",
  "eletrico",
]);
export const modalidadeEnum = pgEnum("modalidade", [
  "CDC",
  "consorcio",
  "leasing",
]);

export const veiculos = pgTable(
  "veiculos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lojaId: uuid("loja_id")
      .notNull()
      .references(() => lojas.id, { onDelete: "cascade" }),
    placa: text("placa").notNull(),
    marca: text("marca").notNull(),
    modelo: text("modelo").notNull(),
    anoFabricacao: integer("ano_fabricacao").notNull(),
    anoModelo: integer("ano_modelo").notNull(),
    quilometragem: integer("quilometragem").notNull(),
    precoVenda: numeric("preco_venda", { precision: 12, scale: 2 }).notNull(),
    cor: text("cor"),
    cambio: cambioEnum("cambio"),
    combustivel: combustivelEnum("combustivel"),
    opcionais: text("opcionais").array(),
    descricaoAgente: text("descricao_agente"),
    status: statusVeiculoEnum("status").notNull().default("ativo"),
    ativoAgente: boolean("ativo_agente").notNull().default(true),
    criadoEm: timestamp("criado_em", { withTimezone: true }).defaultNow(),
    vendidoEm: timestamp("vendido_em", { withTimezone: true }),
  },
  (table) => [
    unique("uq_veiculo_loja_placa").on(table.lojaId, table.placa),
    index("idx_veiculos_loja").on(table.lojaId),
    index("idx_veiculos_ativo").on(table.ativoAgente),
  ],
);

export const qrcodes = pgTable(
  "qrcodes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    veiculoId: uuid("veiculo_id")
      .unique()
      .notNull()
      .references(() => veiculos.id, { onDelete: "cascade" }),
    slug: text("slug").unique().notNull(),
    urlPublica: text("url_publica").notNull(),
    imagemQr: text("imagem_qr"),
    ativo: boolean("ativo").notNull().default(true),
    totalScans: integer("total_scans").default(0),
    criadoEm: timestamp("criado_em", { withTimezone: true }).defaultNow(),
  },
  (table) => [index("idx_qrcodes_slug").on(table.slug)],
);

export const financiamentos = pgTable("financiamentos", {
  id: uuid("id").primaryKey().defaultRandom(),
  lojaId: uuid("loja_id")
    .notNull()
    .references(() => lojas.id, { onDelete: "cascade" }),
  banco: text("banco").notNull(),
  modalidade: modalidadeEnum("modalidade").notNull(),
  taxaMensal: numeric("taxa_mensal", { precision: 6, scale: 4 }).notNull(),
  parcelasMin: integer("parcelas_min").default(12),
  parcelasMax: integer("parcelas_max").default(60),
  entradaMinPct: numeric("entrada_min_pct", {
    precision: 5,
    scale: 2,
  }).default("20.00"),
  ativo: boolean("ativo").default(true),
});

export const insertVeiculoSchema = createInsertSchema(veiculos).omit({
  id: true,
  criadoEm: true,
  vendidoEm: true,
});
export const selectVeiculoSchema = createSelectSchema(veiculos);
export type InsertVeiculo = z.infer<typeof insertVeiculoSchema>;
export type Veiculo = typeof veiculos.$inferSelect;

export const insertQrcodeSchema = createInsertSchema(qrcodes).omit({
  id: true,
  criadoEm: true,
  totalScans: true,
});
export type InsertQrcode = z.infer<typeof insertQrcodeSchema>;
export type Qrcode = typeof qrcodes.$inferSelect;

export const insertFinanciamentoSchema = createInsertSchema(
  financiamentos,
).omit({ id: true });
export type InsertFinanciamento = z.infer<typeof insertFinanciamentoSchema>;
export type Financiamento = typeof financiamentos.$inferSelect;
