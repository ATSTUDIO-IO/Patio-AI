import { pgTable, uuid, text, timestamp, index, unique } from "drizzle-orm/pg-core";
import { lojas } from "./lojas";
import { conversas } from "./leads";

export const whatsappSessoes = pgTable(
  "whatsapp_sessoes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    from: text("from").notNull(),
    lojaId: uuid("loja_id")
      .notNull()
      .references(() => lojas.id, { onDelete: "cascade" }),
    conversaId: uuid("conversa_id")
      .notNull()
      .references(() => conversas.id, { onDelete: "cascade" }),
    ultimaMensagemEm: timestamp("ultima_mensagem_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
    veiculoIdDetectado: uuid("veiculo_id_detectado"),
  },
  (table) => [
    unique("uq_whatsapp_sessoes_from_loja").on(table.from, table.lojaId),
    index("idx_whatsapp_sessoes_ultima_mensagem").on(table.ultimaMensagemEm),
  ],
);

export type WhatsAppSessao = typeof whatsappSessoes.$inferSelect;
