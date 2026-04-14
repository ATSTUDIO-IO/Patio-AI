import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod/v4";
import { db, conversas, mensagens, veiculos, leads } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { formatZodError } from "../lib/errors";

const router: IRouter = Router();

function requireLojaId(
  req: Parameters<Parameters<typeof router.get>[1]>[0],
  res: Parameters<Parameters<typeof router.get>[1]>[1],
): string | null {
  const lojaId = req.user?.loja_id ?? null;
  if (!lojaId) {
    res.status(403).json({ error: "Usuário sem loja associada" });
    return null;
  }
  return lojaId;
}

const ListConversasQuery = z.object({
  veiculo_id: z.string().uuid().optional(),
  lead_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const ConversaIdParam = z.object({ conversaId: z.string().uuid("conversaId deve ser UUID") });

router.get("/conversas", requireAuth, async (req, res): Promise<void> => {
  const query = ListConversasQuery.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: formatZodError(query.error) });
    return;
  }

  const lojaId = requireLojaId(req, res);
  if (!lojaId) return;

  const { veiculo_id, lead_id, limit, offset } = query.data;

  const conditions = [eq(veiculos.lojaId, lojaId)];
  if (veiculo_id) conditions.push(eq(conversas.veiculoId, veiculo_id));
  if (lead_id) conditions.push(eq(conversas.leadId, lead_id));

  const rows = await db
    .select({
      conversa: conversas,
      veiculo: {
        id: veiculos.id,
        marca: veiculos.marca,
        modelo: veiculos.modelo,
        anoFabricacao: veiculos.anoFabricacao,
        anoModelo: veiculos.anoModelo,
      },
      lead: {
        id: leads.id,
        nome: leads.nome,
        interesse: leads.interesse,
      },
    })
    .from(conversas)
    .innerJoin(veiculos, eq(conversas.veiculoId, veiculos.id))
    .leftJoin(leads, eq(conversas.leadId, leads.id))
    .where(and(...conditions))
    .orderBy(desc(conversas.iniciadaEm))
    .limit(limit)
    .offset(offset);

  res.json(
    rows.map((r) => ({
      id: r.conversa.id,
      iniciada_em: r.conversa.iniciadaEm,
      encerrada_em: r.conversa.encerradaEm,
      duracao_segundos: r.conversa.duracaoSegundos,
      resumo_ia: r.conversa.resumoIa,
      simulacao_realizada: r.conversa.simulacaoRealizada,
      consentimento_lgpd: r.conversa.consentimentoLgpd,
      veiculo: {
        id: r.veiculo.id,
        marca: r.veiculo.marca,
        modelo: r.veiculo.modelo,
        ano_fabricacao: r.veiculo.anoFabricacao,
        ano_modelo: r.veiculo.anoModelo,
      },
      lead: r.lead,
    })),
  );
});

router.get(
  "/conversas/:conversaId",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = ConversaIdParam.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: formatZodError(params.error) });
      return;
    }

    const lojaId = requireLojaId(req, res);
    if (!lojaId) return;

    const [row] = await db
      .select({
        conversa: conversas,
        veiculo: {
          id: veiculos.id,
          marca: veiculos.marca,
          modelo: veiculos.modelo,
          placa: veiculos.placa,
          anoFabricacao: veiculos.anoFabricacao,
          anoModelo: veiculos.anoModelo,
          precoVenda: veiculos.precoVenda,
        },
      })
      .from(conversas)
      .innerJoin(veiculos, eq(conversas.veiculoId, veiculos.id))
      .where(
        and(eq(conversas.id, params.data.conversaId), eq(veiculos.lojaId, lojaId)),
      )
      .limit(1);

    if (!row) {
      res.status(404).json({ error: "Conversa não encontrada" });
      return;
    }

    const msgs = await db
      .select()
      .from(mensagens)
      .where(eq(mensagens.conversaId, row.conversa.id))
      .orderBy(mensagens.criadoEm);

    let lead = null;
    if (row.conversa.leadId) {
      const [leadRow] = await db
        .select()
        .from(leads)
        .where(eq(leads.id, row.conversa.leadId))
        .limit(1);
      if (leadRow) {
        lead = {
          id: leadRow.id,
          nome: leadRow.nome,
          telefone: leadRow.telefone,
          email: leadRow.email,
          interesse: leadRow.interesse,
          pediu_financiamento: leadRow.pediuFinanciamento,
          pediu_test_drive: leadRow.pediuTestDrive,
          status_crm: leadRow.statusCrm,
        };
      }
    }

    res.json({
      id: row.conversa.id,
      iniciada_em: row.conversa.iniciadaEm,
      encerrada_em: row.conversa.encerradaEm,
      duracao_segundos: row.conversa.duracaoSegundos,
      transcricao: row.conversa.transcricao,
      resumo_ia: row.conversa.resumoIa,
      simulacao_realizada: row.conversa.simulacaoRealizada,
      consentimento_lgpd: row.conversa.consentimentoLgpd,
      veiculo: {
        id: row.veiculo.id,
        marca: row.veiculo.marca,
        modelo: row.veiculo.modelo,
        placa: row.veiculo.placa,
        ano_fabricacao: row.veiculo.anoFabricacao,
        ano_modelo: row.veiculo.anoModelo,
        preco_venda: row.veiculo.precoVenda,
      },
      lead,
      mensagens: msgs.map((m) => ({
        id: m.id,
        papel: m.papel,
        conteudo: m.conteudo,
        criado_em: m.criadoEm,
      })),
    });
  },
);

export default router;
