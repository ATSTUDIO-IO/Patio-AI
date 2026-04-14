import { Router, type IRouter } from "express";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { z } from "zod/v4";
import { db, leads, conversas, mensagens, veiculos } from "@workspace/db";
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

const ListLeadsQuery = z.object({
  status: z.enum(["novo", "em_contato", "perdido", "ganho"]).optional(),
  interesse: z.enum(["alto", "medio", "baixo"]).optional(),
  veiculo_id: z.string().uuid().optional(),
  desde: z.string().datetime({ offset: true }).optional(),
  ate: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const LeadIdParam = z.object({ leadId: z.string().uuid("leadId deve ser UUID") });

const PatchLeadStatusBody = z.object({
  status: z.enum(["novo", "em_contato", "perdido", "ganho"]),
});

router.get("/leads", requireAuth, async (req, res): Promise<void> => {
  const query = ListLeadsQuery.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: formatZodError(query.error) });
    return;
  }

  const lojaId = requireLojaId(req, res);
  if (!lojaId) return;

  const { status, interesse, veiculo_id, desde, ate, limit, offset } = query.data;
  const conditions = [eq(leads.lojaId, lojaId)];
  if (status) conditions.push(eq(leads.statusCrm, status));
  if (interesse) conditions.push(eq(leads.interesse, interesse));
  if (veiculo_id) conditions.push(eq(leads.veiculoId, veiculo_id));
  if (desde) conditions.push(gte(leads.criadoEm, new Date(desde)));
  if (ate) conditions.push(lte(leads.criadoEm, new Date(ate)));

  const rows = await db
    .select({
      lead: leads,
      veiculo: {
        marca: veiculos.marca,
        modelo: veiculos.modelo,
        anoFabricacao: veiculos.anoFabricacao,
        anoModelo: veiculos.anoModelo,
      },
    })
    .from(leads)
    .leftJoin(veiculos, eq(leads.veiculoId, veiculos.id))
    .where(and(...conditions))
    .orderBy(desc(leads.criadoEm))
    .limit(limit)
    .offset(offset);

  res.json(
    rows.map((r) => ({
      id: r.lead.id,
      nome: r.lead.nome,
      telefone: r.lead.telefone,
      email: r.lead.email,
      interesse: r.lead.interesse,
      pediu_financiamento: r.lead.pediuFinanciamento,
      pediu_test_drive: r.lead.pediuTestDrive,
      status_crm: r.lead.statusCrm,
      origem: r.lead.origem,
      criado_em: r.lead.criadoEm,
      veiculo: r.veiculo
        ? {
            marca: r.veiculo.marca,
            modelo: r.veiculo.modelo,
            ano_fabricacao: r.veiculo.anoFabricacao,
            ano_modelo: r.veiculo.anoModelo,
          }
        : null,
    })),
  );
});

router.get("/leads/:leadId", requireAuth, async (req, res): Promise<void> => {
  const params = LeadIdParam.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: formatZodError(params.error) });
    return;
  }

  const lojaId = requireLojaId(req, res);
  if (!lojaId) return;

  const [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, params.data.leadId), eq(leads.lojaId, lojaId)))
    .limit(1);

  if (!lead) {
    res.status(404).json({ error: "Lead não encontrado" });
    return;
  }

  const [veiculo] = await db
    .select()
    .from(veiculos)
    .where(eq(veiculos.id, lead.veiculoId))
    .limit(1);

  const conversasLead = await db
    .select()
    .from(conversas)
    .where(eq(conversas.leadId, lead.id))
    .orderBy(desc(conversas.iniciadaEm));

  const conversasComMsgs = await Promise.all(
    conversasLead.map(async (c) => {
      const msgs = await db
        .select()
        .from(mensagens)
        .where(eq(mensagens.conversaId, c.id))
        .orderBy(mensagens.criadoEm);
      return {
        id: c.id,
        iniciada_em: c.iniciadaEm,
        encerrada_em: c.encerradaEm,
        duracao_segundos: c.duracaoSegundos,
        resumo_ia: c.resumoIa,
        transcricao: c.transcricao,
        simulacao_realizada: c.simulacaoRealizada,
        mensagens: msgs.map((m) => ({
          id: m.id,
          papel: m.papel,
          conteudo: m.conteudo,
          criado_em: m.criadoEm,
        })),
      };
    }),
  );

  res.json({
    id: lead.id,
    nome: lead.nome,
    telefone: lead.telefone,
    email: lead.email,
    interesse: lead.interesse,
    pediu_financiamento: lead.pediuFinanciamento,
    pediu_test_drive: lead.pediuTestDrive,
    status_crm: lead.statusCrm,
    origem: lead.origem,
    criado_em: lead.criadoEm,
    veiculo: veiculo
      ? {
          id: veiculo.id,
          marca: veiculo.marca,
          modelo: veiculo.modelo,
          placa: veiculo.placa,
          ano_fabricacao: veiculo.anoFabricacao,
          ano_modelo: veiculo.anoModelo,
          preco_venda: veiculo.precoVenda,
        }
      : null,
    conversas: conversasComMsgs,
  });
});

router.patch(
  "/leads/:leadId/status",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = LeadIdParam.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: formatZodError(params.error) });
      return;
    }

    const body = PatchLeadStatusBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: formatZodError(body.error) });
      return;
    }

    const lojaId = requireLojaId(req, res);
    if (!lojaId) return;

    const [lead] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, params.data.leadId), eq(leads.lojaId, lojaId)))
      .limit(1);

    if (!lead) {
      res.status(404).json({ error: "Lead não encontrado" });
      return;
    }

    const [atualizado] = await db
      .update(leads)
      .set({ statusCrm: body.data.status })
      .where(eq(leads.id, lead.id))
      .returning();

    res.json({
      id: atualizado.id,
      status_crm: atualizado.statusCrm,
    });
  },
);

export default router;
