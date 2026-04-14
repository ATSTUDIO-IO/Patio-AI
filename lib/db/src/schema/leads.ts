import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { lojas } from "./lojas";
import { veiculos, qrcodes } from "./veiculos";

export const interesseEnum = pgEnum("interesse", ["alto", "medio", "baixo"]);
export const statusCrmEnum = pgEnum("status_crm", [
  "novo",
  "em_contato",
  "perdido",
  "ganho",
]);
export const papelEnum = pgEnum("papel", ["user", "agente"]);

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    veiculoId: uuid("veiculo_id").references(() => veiculos.id),
    lojaId: uuid("loja_id").references(() => lojas.id),
    nome: text("nome"),
    telefone: text("telefone"),
    email: text("email"),
    interesse: interesseEnum("interesse").notNull().default("baixo"),
    pediuFinanciamento: boolean("pediu_financiamento").default(false),
    pediuTestDrive: boolean("pediu_test_drive").default(false),
    statusCrm: statusCrmEnum("status_crm").notNull().default("novo"),
    origem: text("origem").default("qr_patio"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_leads_loja").on(table.lojaId),
    index("idx_leads_interesse").on(table.interesse),
  ],
);

export const conversas = pgTable(
  "conversas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id").references(() => leads.id),
    veiculoId: uuid("veiculo_id")
      .notNull()
      .references(() => veiculos.id),
    qrcodeId: uuid("qrcode_id")
      .notNull()
      .references(() => qrcodes.id),
    iniciadaEm: timestamp("iniciada_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
    encerradaEm: timestamp("encerrada_em", { withTimezone: true }),
    duracaoSegundos: integer("duracao_segundos"),
    transcricao: text("transcricao"),
    resumoIa: text("resumo_ia"),
    simulacaoRealizada: boolean("simulacao_realizada").default(false),
    consentimentoLgpd: boolean("consentimento_lgpd").notNull().default(false),
  },
  (table) => [
    index("idx_conversas_veiculo").on(table.veiculoId),
    index("idx_conversas_data").on(table.iniciadaEm),
  ],
);

export const mensagens = pgTable("mensagens", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversaId: uuid("conversa_id")
    .notNull()
    .references(() => conversas.id, { onDelete: "cascade" }),
  papel: papelEnum("papel").notNull(),
  conteudo: text("conteudo").notNull(),
  criadoEm: timestamp("criado_em", { withTimezone: true }).defaultNow(),
});

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  criadoEm: true,
});
export const selectLeadSchema = createSelectSchema(leads);
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;

export const insertConversaSchema = createInsertSchema(conversas).omit({
  id: true,
  iniciadaEm: true,
});
export const selectConversaSchema = createSelectSchema(conversas);
export type InsertConversa = z.infer<typeof insertConversaSchema>;
export type Conversa = typeof conversas.$inferSelect;

export const insertMensagemSchema = createInsertSchema(mensagens).omit({
  id: true,
  criadoEm: true,
});
export type InsertMensagem = z.infer<typeof insertMensagemSchema>;
export type Mensagem = typeof mensagens.$inferSelect;
