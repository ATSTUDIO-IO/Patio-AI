import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const planoEnum = pgEnum("plano", ["starter", "pro", "full"]);
export const perfilEnum = pgEnum("perfil", [
  "dono",
  "vendedor",
  "admin_patioai",
]);

export const lojas = pgTable("lojas", {
  id: uuid("id").primaryKey().defaultRandom(),
  razaoSocial: text("razao_social").notNull(),
  nomeFantasia: text("nome_fantasia").notNull(),
  cnpj: text("cnpj").unique().notNull(),
  telefone: text("telefone"),
  emailContato: text("email_contato").notNull(),
  cidade: text("cidade"),
  plano: planoEnum("plano").notNull().default("starter"),
  ativo: boolean("ativo").notNull().default(true),
  criadoEm: timestamp("criado_em", { withTimezone: true }).defaultNow(),
});

export const usuarios = pgTable("usuarios", {
  id: uuid("id").primaryKey().defaultRandom(),
  lojaId: uuid("loja_id").references(() => lojas.id, { onDelete: "cascade" }),
  nome: text("nome").notNull(),
  email: text("email").unique().notNull(),
  senhaHash: text("senha_hash").notNull(),
  perfil: perfilEnum("perfil").notNull().default("vendedor"),
  ultimoAcesso: timestamp("ultimo_acesso", { withTimezone: true }),
  criadoEm: timestamp("criado_em", { withTimezone: true }).defaultNow(),
});

export const sessoes = pgTable("sessoes", {
  id: uuid("id").primaryKey().defaultRandom(),
  usuarioId: uuid("usuario_id")
    .notNull()
    .references(() => usuarios.id, { onDelete: "cascade" }),
  token: text("token").notNull(),
  expiraEm: timestamp("expira_em", { withTimezone: true }).notNull(),
  criadoEm: timestamp("criado_em", { withTimezone: true }).defaultNow(),
});

export const insertLojaSchema = createInsertSchema(lojas).omit({
  id: true,
  criadoEm: true,
});
export const selectLojaSchema = createSelectSchema(lojas);
export type InsertLoja = z.infer<typeof insertLojaSchema>;
export type Loja = typeof lojas.$inferSelect;

export const insertUsuarioSchema = createInsertSchema(usuarios).omit({
  id: true,
  criadoEm: true,
  ultimoAcesso: true,
});
export const selectUsuarioSchema = createSelectSchema(usuarios);
export type InsertUsuario = z.infer<typeof insertUsuarioSchema>;
export type Usuario = typeof usuarios.$inferSelect;

export const insertSessaoSchema = createInsertSchema(sessoes).omit({
  id: true,
  criadoEm: true,
});
export type InsertSessao = z.infer<typeof insertSessaoSchema>;
export type Sessao = typeof sessoes.$inferSelect;
