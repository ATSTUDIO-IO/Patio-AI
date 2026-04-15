import { Router, type IRouter } from "express";
import { eq, count, desc, sql, inArray, and, gte } from "drizzle-orm";
import { z } from "zod/v4";
import { db, lojas, usuarios, veiculos, conversas, ciclosBilling, leads, notasAdmin } from "@workspace/db";
import { requireAuth, requirePerfil } from "../middlewares/auth";

const router: IRouter = Router();

async function getVeiculoIdsByLoja(lojaId: string): Promise<string[]> {
  const rows = await db.select({ id: veiculos.id }).from(veiculos).where(eq(veiculos.lojaId, lojaId));
  return rows.map((v) => v.id);
}

async function countConversasByVeiculoIds(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const [{ total }] = await db.select({ total: count() }).from(conversas).where(inArray(conversas.veiculoId, ids));
  return total;
}

async function countConversasByLojaRecentes(lojaId: string, dias: number): Promise<number> {
  const ids = await getVeiculoIdsByLoja(lojaId);
  if (ids.length === 0) return 0;
  const desde = new Date();
  desde.setDate(desde.getDate() - dias);
  const [{ total }] = await db
    .select({ total: count() })
    .from(conversas)
    .where(and(inArray(conversas.veiculoId, ids), gte(conversas.iniciadaEm, desde)));
  return total;
}

async function countLeadsByLojaRecentes(lojaId: string, dias: number): Promise<number> {
  const desde = new Date();
  desde.setDate(desde.getDate() - dias);
  const [{ total }] = await db
    .select({ total: count() })
    .from(leads)
    .where(and(eq(leads.lojaId, lojaId), gte(leads.criadoEm, desde)));
  return total;
}

function calcHealthScore(params: {
  scans30d: number;
  leads30d: number;
  activeUsers: number;
  pagamentoEmDia: boolean;
}): number {
  const scansComp = Math.min(params.scans30d / 10, 1) * 100;
  const leadsComp = Math.min(params.leads30d / 5, 1) * 100;
  const loginComp = Math.min(params.activeUsers / 2, 1) * 100;
  const pgtoComp = params.pagamentoEmDia ? 100 : 0;
  return Math.round(scansComp * 0.30 + leadsComp * 0.25 + loginComp * 0.20 + pgtoComp * 0.25);
}

router.get(
  "/admin/stats",
  requireAuth,
  requirePerfil("admin_patioai"),
  async (_req, res): Promise<void> => {
    const [{ totalLojas }] = await db
      .select({ totalLojas: count() })
      .from(lojas)
      .where(eq(lojas.ativo, true));

    const [{ totalVeiculos }] = await db
      .select({ totalVeiculos: count() })
      .from(veiculos)
      .where(eq(veiculos.status, "ativo"));

    const [{ totalConversas }] = await db.select({ totalConversas: count() }).from(conversas);

    const receitaResult = await db
      .select({ total: sql<string>`COALESCE(SUM(${ciclosBilling.valorTotal}), 0)` })
      .from(ciclosBilling)
      .where(eq(ciclosBilling.status, "pago"));

    const agora = new Date();
    const mesRef = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-01`;
    const mrrResult = await db
      .select({ total: sql<string>`COALESCE(SUM(${ciclosBilling.valorTotal}), 0)` })
      .from(ciclosBilling)
      .where(eq(ciclosBilling.mesRef, mesRef));

    res.json({
      total_lojas_ativas: totalLojas,
      total_veiculos_ativos: totalVeiculos,
      total_conversas: totalConversas,
      receita_total: Number(receitaResult[0]?.total ?? 0),
      mrr_mes_atual: Number(mrrResult[0]?.total ?? 0),
    });
  },
);

router.get(
  "/admin/dashboard",
  requireAuth,
  requirePerfil("admin_patioai"),
  async (_req, res): Promise<void> => {
    const agora = new Date();
    const mesRefAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-01`;
    const anoMesAnterior = agora.getMonth() === 0
      ? `${agora.getFullYear() - 1}-12-01`
      : `${agora.getFullYear()}-${String(agora.getMonth()).padStart(2, "0")}-01`;

    const [statsLojas] = await db.select({ total: count() }).from(lojas).where(eq(lojas.ativo, true));
    const [statsVeiculos] = await db.select({ total: count() }).from(veiculos).where(eq(veiculos.status, "ativo"));
    const [statsConversas] = await db.select({ total: count() }).from(conversas);

    const [mrrAtualResult] = await db
      .select({ total: sql<string>`COALESCE(SUM(${ciclosBilling.valorTotal}), 0)` })
      .from(ciclosBilling)
      .where(eq(ciclosBilling.mesRef, mesRefAtual));
    const mrrAtualTotal = Number(mrrAtualResult?.total ?? 0);

    const mrrMesAnteriorResult = await db
      .select({ total: sql<string>`COALESCE(SUM(${ciclosBilling.valorTotal}), 0)` })
      .from(ciclosBilling)
      .where(eq(ciclosBilling.mesRef, anoMesAnterior));
    const mrrAnterior = Number(mrrMesAnteriorResult[0]?.total ?? 0);

    const ciclosAtual = await db
      .select({ lojaId: ciclosBilling.lojaId, valor: ciclosBilling.valorTotal })
      .from(ciclosBilling)
      .where(eq(ciclosBilling.mesRef, mesRefAtual));
    const ciclosAnteriorLista = await db
      .select({ lojaId: ciclosBilling.lojaId, valor: ciclosBilling.valorTotal })
      .from(ciclosBilling)
      .where(eq(ciclosBilling.mesRef, anoMesAnterior));

    const valorAnteriorPorLoja = new Map(ciclosAnteriorLista.map((c) => [c.lojaId, Number(c.valor)]));
    const lojaIdsAnterior = new Set(ciclosAnteriorLista.map((c) => c.lojaId));

    const mrrNovo = ciclosAtual
      .filter((c) => !lojaIdsAnterior.has(c.lojaId))
      .reduce((s, c) => s + Number(c.valor), 0);

    const mrrExpandido = ciclosAtual
      .filter((c) => lojaIdsAnterior.has(c.lojaId) && Number(c.valor) > (valorAnteriorPorLoja.get(c.lojaId) ?? 0))
      .reduce((s, c) => s + Number(c.valor) - (valorAnteriorPorLoja.get(c.lojaId) ?? 0), 0);

    const lojaIdsAtual = new Set(ciclosAtual.map((c) => c.lojaId));
    const mrrPerdido = ciclosAnteriorLista
      .filter((c) => !lojaIdsAtual.has(c.lojaId))
      .reduce((s, c) => s + Number(c.valor), 0);

    const todasLojas = await db
      .select({
        id: lojas.id,
        nome_fantasia: lojas.nomeFantasia,
        cnpj: lojas.cnpj,
        plano: lojas.plano,
        ativo: lojas.ativo,
        cidade: lojas.cidade,
        criado_em: lojas.criadoEm,
      })
      .from(lojas)
      .orderBy(desc(lojas.criadoEm));

    const dashboardLojaIds = todasLojas.map((l) => l.id);
    const desde30dDash = new Date();
    desde30dDash.setDate(desde30dDash.getDate() - 30);

    const [dashVeicBatch, dashLeadsBatch, dashScansBatch, dashFaturasBatch] =
      dashboardLojaIds.length > 0
        ? await Promise.all([
            db
              .select({ lojaId: veiculos.lojaId, total: count() })
              .from(veiculos)
              .where(and(inArray(veiculos.lojaId, dashboardLojaIds), eq(veiculos.status, "ativo")))
              .groupBy(veiculos.lojaId),
            db
              .select({ lojaId: leads.lojaId, total: count() })
              .from(leads)
              .where(and(inArray(leads.lojaId, dashboardLojaIds), gte(leads.criadoEm, desde30dDash)))
              .groupBy(leads.lojaId),
            db
              .select({ lojaId: veiculos.lojaId, total: count() })
              .from(conversas)
              .innerJoin(veiculos, eq(conversas.veiculoId, veiculos.id))
              .where(and(inArray(veiculos.lojaId, dashboardLojaIds), gte(conversas.iniciadaEm, desde30dDash)))
              .groupBy(veiculos.lojaId),
            db
              .selectDistinctOn([ciclosBilling.lojaId], {
                lojaId: ciclosBilling.lojaId,
                status: ciclosBilling.status,
                valor: ciclosBilling.valorTotal,
              })
              .from(ciclosBilling)
              .where(inArray(ciclosBilling.lojaId, dashboardLojaIds))
              .orderBy(ciclosBilling.lojaId, desc(ciclosBilling.mesRef)),
          ])
        : [[], [], [], []];

    const dashVeicMap = new Map(dashVeicBatch.map((r) => [r.lojaId, r.total]));
    const dashLeadsMap = new Map(dashLeadsBatch.map((r) => [r.lojaId, r.total]));
    const dashScansMap = new Map(dashScansBatch.map((r) => [r.lojaId, r.total]));
    const dashFaturaMap = new Map(dashFaturasBatch.map((r) => [r.lojaId, r]));

    const lojasComMetricas = todasLojas.map((loja) => ({
      ...loja,
      veiculos_ativos: dashVeicMap.get(loja.id) ?? 0,
      leads_30d: dashLeadsMap.get(loja.id) ?? 0,
      scans_30d: dashScansMap.get(loja.id) ?? 0,
      mrr: Number(dashFaturaMap.get(loja.id)?.valor ?? 0),
      status_fatura: dashFaturaMap.get(loja.id)?.status ?? null,
    }));

    const historicoMrrRaw = await db
      .select({
        mes_ref: ciclosBilling.mesRef,
        total: sql<string>`COALESCE(SUM(${ciclosBilling.valorTotal}), 0)`,
      })
      .from(ciclosBilling)
      .where(sql`${ciclosBilling.mesRef} >= CURRENT_DATE - INTERVAL '6 months'`)
      .groupBy(ciclosBilling.mesRef)
      .orderBy(ciclosBilling.mesRef);

    const historicoLojas: { mes_ref: string; total: number }[] = [];
    const historicoVeiculos: { mes_ref: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
      const mesRef = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
      const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const endStr = endOfMonth.toISOString().split("T")[0];
      const [lojaCount] = await db.select({ total: count() }).from(lojas)
        .where(and(eq(lojas.ativo, true), sql`${lojas.criadoEm} <= ${endStr}::timestamp`));
      const [veicCount] = await db.select({ total: count() }).from(veiculos)
        .where(sql`DATE(${veiculos.criadoEm}) <= ${endStr}::date`);
      historicoLojas.push({ mes_ref: mesRef, total: lojaCount.total });
      historicoVeiculos.push({ mes_ref: mesRef, total: veicCount.total });
    }

    res.json({
      mrr: {
        total: mrrAtualTotal,
        novo: mrrNovo,
        expandido: mrrExpandido,
        perdido: mrrPerdido,
      },
      historico_mrr: historicoMrrRaw.map((r) => ({ mes_ref: r.mes_ref, total: Number(r.total) })),
      historico_lojas: historicoLojas,
      historico_veiculos: historicoVeiculos,
      total_lojas_ativas: statsLojas.total,
      total_veiculos_ativos: statsVeiculos.total,
      total_conversas: statsConversas.total,
      lojas: lojasComMetricas,
    });
  },
);

router.get(
  "/admin/lojas",
  requireAuth,
  requirePerfil("admin_patioai"),
  async (req, res): Promise<void> => {
    const { plano, status, cidade, atividade } = req.query as Record<string, string | undefined>;

    let rows = await db
      .select({
        id: lojas.id,
        razao_social: lojas.razaoSocial,
        nome_fantasia: lojas.nomeFantasia,
        cnpj: lojas.cnpj,
        plano: lojas.plano,
        ativo: lojas.ativo,
        criado_em: lojas.criadoEm,
        cidade: lojas.cidade,
        telefone: lojas.telefone,
      })
      .from(lojas)
      .orderBy(desc(lojas.criadoEm));

    if (plano && ["starter", "pro", "full"].includes(plano)) {
      rows = rows.filter((l) => l.plano === plano);
    }
    if (status === "ativa") {
      rows = rows.filter((l) => l.ativo);
    } else if (status === "inativa") {
      rows = rows.filter((l) => !l.ativo);
    }
    if (cidade) {
      const cidadeLower = cidade.toLowerCase();
      rows = rows.filter((l) => l.cidade?.toLowerCase().includes(cidadeLower));
    }

    if (rows.length === 0) {
      res.json([]);
      return;
    }

    const lojaIds = rows.map((l) => l.id);
    const desde30d = new Date();
    desde30d.setDate(desde30d.getDate() - 30);

    const [veiculosBatch, leadsBatch, scansBatch, usuariosBatch, faturasBatch] = await Promise.all([
      db
        .select({ lojaId: veiculos.lojaId, total: count() })
        .from(veiculos)
        .where(and(inArray(veiculos.lojaId, lojaIds), eq(veiculos.status, "ativo")))
        .groupBy(veiculos.lojaId),
      db
        .select({ lojaId: leads.lojaId, total: count() })
        .from(leads)
        .where(and(inArray(leads.lojaId, lojaIds), gte(leads.criadoEm, desde30d)))
        .groupBy(leads.lojaId),
      db
        .select({ lojaId: veiculos.lojaId, total: count() })
        .from(conversas)
        .innerJoin(veiculos, eq(conversas.veiculoId, veiculos.id))
        .where(and(inArray(veiculos.lojaId, lojaIds), gte(conversas.iniciadaEm, desde30d)))
        .groupBy(veiculos.lojaId),
      db
        .select({ lojaId: usuarios.lojaId, total: count() })
        .from(usuarios)
        .where(inArray(usuarios.lojaId, lojaIds))
        .groupBy(usuarios.lojaId),
      db
        .selectDistinctOn([ciclosBilling.lojaId], {
          lojaId: ciclosBilling.lojaId,
          status: ciclosBilling.status,
          valorTotal: ciclosBilling.valorTotal,
        })
        .from(ciclosBilling)
        .where(inArray(ciclosBilling.lojaId, lojaIds))
        .orderBy(ciclosBilling.lojaId, desc(ciclosBilling.mesRef)),
    ]);

    const veicMap = new Map(veiculosBatch.map((r) => [r.lojaId, r.total]));
    const leadsMap = new Map(leadsBatch.map((r) => [r.lojaId, r.total]));
    const scansMap = new Map(scansBatch.map((r) => [r.lojaId, r.total]));
    const usersMap = new Map(usuariosBatch.map((r) => [r.lojaId ?? "", r.total]));
    const faturaMap = new Map(faturasBatch.map((r) => [r.lojaId, r]));

    const lojasComStats = rows
      .map((loja) => {
        const veiculosAtivos = veicMap.get(loja.id) ?? 0;
        const leads30d = leadsMap.get(loja.id) ?? 0;
        const scans30d = scansMap.get(loja.id) ?? 0;
        const totalUsuarios = usersMap.get(loja.id) ?? 0;
        const ultimaFatura = faturaMap.get(loja.id);

        if (atividade) {
          if (atividade === "ativa" && leads30d === 0 && veiculosAtivos === 0) return null;
          if (atividade === "inativa" && (leads30d > 0 || veiculosAtivos > 0)) return null;
        }

        return {
          ...loja,
          veiculos_ativos: veiculosAtivos,
          scans_30d: scans30d,
          leads_30d: leads30d,
          total_usuarios: totalUsuarios,
          status_fatura: ultimaFatura?.status ?? null,
          mrr: ultimaFatura ? Number(ultimaFatura.valorTotal) : 0,
        };
      })
      .filter(Boolean);

    res.json(lojasComStats);
  },
);

router.get(
  "/admin/lojas/:lojaId",
  requireAuth,
  requirePerfil("admin_patioai"),
  async (req, res): Promise<void> => {
    const lojaId = req.params.lojaId as string;

    const [loja] = await db.select().from(lojas).where(eq(lojas.id, lojaId)).limit(1);
    if (!loja) {
      res.status(404).json({ error: "Loja não encontrada" });
      return;
    }

    const [{ veiculosAtivos }] = await db
      .select({ veiculosAtivos: count() })
      .from(veiculos)
      .where(and(eq(veiculos.lojaId, lojaId), eq(veiculos.status, "ativo")));

    const veiculoIds = await getVeiculoIdsByLoja(lojaId);
    const totalConversas = await countConversasByVeiculoIds(veiculoIds);
    const leads30d = await countLeadsByLojaRecentes(lojaId, 30);
    const scans30d = await countConversasByLojaRecentes(lojaId, 30);

    const [{ totalLeads }] = await db
      .select({ totalLeads: count() })
      .from(leads)
      .where(eq(leads.lojaId, lojaId));

    const usuariosLoja = await db
      .select({ id: usuarios.id, nome: usuarios.nome, email: usuarios.email, perfil: usuarios.perfil, ativo: usuarios.ativo })
      .from(usuarios)
      .where(eq(usuarios.lojaId, lojaId));

    const faturas = await db
      .select()
      .from(ciclosBilling)
      .where(eq(ciclosBilling.lojaId, lojaId))
      .orderBy(desc(ciclosBilling.mesRef))
      .limit(12);

    const notas = await db
      .select({ id: notasAdmin.id, conteudo: notasAdmin.conteudo, criado_em: notasAdmin.criadoEm, admin_id: notasAdmin.adminId })
      .from(notasAdmin)
      .where(eq(notasAdmin.lojaId, lojaId))
      .orderBy(desc(notasAdmin.criadoEm))
      .limit(20);

    const leadsData = await db
      .select({ interesse: leads.interesse, criado_em: leads.criadoEm })
      .from(leads)
      .where(eq(leads.lojaId, lojaId))
      .orderBy(desc(leads.criadoEm))
      .limit(100);

    const interesseDist = leadsData.reduce(
      (acc, l) => {
        const k = l.interesse ?? "Não informado";
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const estoqueVeiculos = await db
      .select({
        id: veiculos.id,
        placa: veiculos.placa,
        marca: veiculos.marca,
        modelo: veiculos.modelo,
        ano_fabricacao: veiculos.anoFabricacao,
        ano_modelo: veiculos.anoModelo,
        quilometragem: veiculos.quilometragem,
        preco_venda: veiculos.precoVenda,
        status: veiculos.status,
        criado_em: veiculos.criadoEm,
      })
      .from(veiculos)
      .where(eq(veiculos.lojaId, lojaId))
      .orderBy(desc(veiculos.criadoEm))
      .limit(50);

    let analise_conversas = {
      total: totalConversas,
      avg_duracao_segundos: 0,
      com_lead_gerado: 0,
      taxa_conversao_pct: 0,
    };
    if (veiculoIds.length > 0) {
      const [durResult] = await db
        .select({ avg: sql<string>`ROUND(AVG(${conversas.duracaoSegundos}), 0)` })
        .from(conversas)
        .where(and(inArray(conversas.veiculoId, veiculoIds), sql`${conversas.duracaoSegundos} IS NOT NULL`));
      const [comLeadResult] = await db
        .select({ total: count() })
        .from(conversas)
        .where(and(inArray(conversas.veiculoId, veiculoIds), sql`${conversas.leadId} IS NOT NULL`));
      analise_conversas = {
        total: totalConversas,
        avg_duracao_segundos: Number(durResult?.avg ?? 0),
        com_lead_gerado: comLeadResult.total,
        taxa_conversao_pct: totalConversas > 0 ? Math.round((comLeadResult.total / totalConversas) * 100) : 0,
      };
    }

    res.json({
      id: loja.id,
      razao_social: loja.razaoSocial,
      nome_fantasia: loja.nomeFantasia,
      cnpj: loja.cnpj,
      plano: loja.plano,
      ativo: loja.ativo,
      cidade: loja.cidade,
      telefone: loja.telefone,
      email_contato: loja.emailContato,
      criado_em: loja.criadoEm,
      veiculos_ativos: veiculosAtivos,
      total_conversas: totalConversas,
      total_leads: totalLeads,
      leads_30d: leads30d,
      scans_30d: scans30d,
      usuarios: usuariosLoja,
      faturas: faturas.map((f) => ({
        id: f.id,
        mes_ref: f.mesRef,
        veiculos_ativos: f.veiculosAtivos,
        preco_unitario: Number(f.precoUnitario),
        valor_total: Number(f.valorTotal),
        status: f.status,
        gerado_em: f.geradoEm,
        pago_em: f.pagoEm,
      })),
      notas,
      interesse_distribuicao: Object.entries(interesseDist).map(([interesse, total]) => ({ interesse, total })),
      estoque: estoqueVeiculos.map((v) => ({
        id: v.id,
        placa: v.placa,
        marca: v.marca,
        modelo: v.modelo,
        ano_fabricacao: v.ano_fabricacao,
        ano_modelo: v.ano_modelo,
        quilometragem: v.quilometragem,
        preco_venda: Number(v.preco_venda),
        status: v.status,
      })),
      analise_conversas,
    });
  },
);

router.patch(
  "/admin/lojas/:lojaId/status",
  requireAuth,
  requirePerfil("admin_patioai"),
  async (req, res): Promise<void> => {
    const lojaId = req.params.lojaId as string;
    const schema = z.object({ ativo: z.boolean() });
    const body = schema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Campo 'ativo' é obrigatório (boolean)" });
      return;
    }
    const [updated] = await db
      .update(lojas)
      .set({ ativo: body.data.ativo })
      .where(eq(lojas.id, lojaId))
      .returning({ id: lojas.id, ativo: lojas.ativo, nome_fantasia: lojas.nomeFantasia });
    if (!updated) {
      res.status(404).json({ error: "Loja não encontrada" });
      return;
    }
    res.json({ id: updated.id, ativo: updated.ativo, nome_fantasia: updated.nome_fantasia });
  },
);

router.patch(
  "/admin/lojas/:lojaId/plano",
  requireAuth,
  requirePerfil("admin_patioai"),
  async (req, res): Promise<void> => {
    const lojaId = req.params.lojaId as string;
    const schema = z.object({ plano: z.enum(["starter", "pro", "full"]) });
    const body = schema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Campo 'plano' inválido. Use: starter, pro ou full" });
      return;
    }
    const [updated] = await db
      .update(lojas)
      .set({ plano: body.data.plano })
      .where(eq(lojas.id, lojaId))
      .returning({ id: lojas.id, plano: lojas.plano, nome_fantasia: lojas.nomeFantasia });
    if (!updated) {
      res.status(404).json({ error: "Loja não encontrada" });
      return;
    }
    res.json({ id: updated.id, plano: updated.plano, nome_fantasia: updated.nome_fantasia });
  },
);

router.patch(
  "/admin/billing/:cicloId/pago",
  requireAuth,
  requirePerfil("admin_patioai"),
  async (req, res): Promise<void> => {
    const cicloId = req.params.cicloId as string;
    const [ciclo] = await db.select().from(ciclosBilling).where(eq(ciclosBilling.id, cicloId)).limit(1);
    if (!ciclo) {
      res.status(404).json({ error: "Ciclo de billing não encontrado" });
      return;
    }
    const [updated] = await db
      .update(ciclosBilling)
      .set({ status: "pago", pagoEm: new Date() })
      .where(eq(ciclosBilling.id, cicloId))
      .returning();
    res.json({
      id: updated.id,
      mes_ref: updated.mesRef,
      status: updated.status,
      pago_em: updated.pagoEm,
      valor_total: Number(updated.valorTotal),
    });
  },
);

router.post(
  "/admin/lojas/:lojaId/notas",
  requireAuth,
  requirePerfil("admin_patioai"),
  async (req, res): Promise<void> => {
    const lojaId = req.params.lojaId as string;
    const adminId = req.user?.id;
    if (!adminId) {
      res.status(401).json({ error: "Não autenticado" });
      return;
    }
    const schema = z.object({ conteudo: z.string().min(1).max(2000) });
    const body = schema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Conteúdo é obrigatório" });
      return;
    }
    const [nota] = await db
      .insert(notasAdmin)
      .values({ lojaId, adminId, conteudo: body.data.conteudo })
      .returning();
    res.status(201).json({ id: nota.id, conteudo: nota.conteudo, criado_em: nota.criadoEm, admin_id: nota.adminId });
  },
);

router.get(
  "/admin/lojas/:lojaId/exportar",
  requireAuth,
  requirePerfil("admin_patioai"),
  async (req, res): Promise<void> => {
    const lojaId = req.params.lojaId as string;
    const [loja] = await db.select({ nome: lojas.nomeFantasia }).from(lojas).where(eq(lojas.id, lojaId)).limit(1);
    if (!loja) {
      res.status(404).json({ error: "Loja não encontrada" });
      return;
    }

    const veiculosData = await db.select().from(veiculos).where(eq(veiculos.lojaId, lojaId)).orderBy(desc(veiculos.criadoEm));
    const leadsData = await db.select().from(leads).where(eq(leads.lojaId, lojaId)).orderBy(desc(leads.criadoEm));

    const veiculoIds = veiculosData.map((v) => v.id);
    const conversasData = veiculoIds.length > 0
      ? await db.select().from(conversas).where(inArray(conversas.veiculoId, veiculoIds)).orderBy(desc(conversas.iniciadaEm))
      : [];

    function csvField(value: string | number | null | undefined): string {
      const str = String(value ?? "");
      const safe = /^[=+\-@|]/.test(str) ? `\t${str}` : str;
      return `"${safe.replace(/"/g, '""')}"`;
    }
    function csvRow(...fields: (string | number | null | undefined)[]): string {
      return fields.map(csvField).join(",");
    }

    const linhas: string[] = [];

    linhas.push("=== VEÍCULOS ===");
    linhas.push("ID,Placa,Marca,Modelo,Ano Fab,Ano Mod,Km,Preço,Status,Criado Em");
    for (const v of veiculosData) {
      linhas.push(csvRow(v.id, v.placa, v.marca, v.modelo, v.anoFabricacao, v.anoModelo,
        v.quilometragem, v.precoVenda, v.status, v.criadoEm?.toISOString() ?? ""));
    }

    linhas.push("");
    linhas.push("=== LEADS ===");
    linhas.push("ID,Nome,Telefone,Email,Interesse,Criado Em");
    for (const l of leadsData) {
      linhas.push(csvRow(l.id, l.nome ?? "", l.telefone ?? "", l.email ?? "",
        l.interesse ?? "", l.criadoEm?.toISOString() ?? ""));
    }

    linhas.push("");
    linhas.push("=== CONVERSAS ===");
    linhas.push("ID,Veículo ID,Iniciada Em,Encerrada Em");
    for (const c of conversasData) {
      linhas.push(csvRow(c.id, c.veiculoId, c.iniciadaEm?.toISOString() ?? "", c.encerradaEm?.toISOString() ?? ""));
    }

    const csv = linhas.join("\n");
    const nomeArquivo = `patioai_${loja.nome.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${nomeArquivo}"`);
    res.send("\uFEFF" + csv);
  },
);

router.get(
  "/admin/inteligencia",
  requireAuth,
  requirePerfil("admin_patioai"),
  async (_req, res): Promise<void> => {
    const todasLojas = await db
      .select({ id: lojas.id, nome_fantasia: lojas.nomeFantasia, plano: lojas.plano, ativo: lojas.ativo, cidade: lojas.cidade, criado_em: lojas.criadoEm })
      .from(lojas)
      .where(eq(lojas.ativo, true))
      .orderBy(lojas.nomeFantasia);

    const scores = await Promise.all(
      todasLojas.map(async (loja) => {
        const [{ veiculosAtivos }] = await db
          .select({ veiculosAtivos: count() })
          .from(veiculos)
          .where(and(eq(veiculos.lojaId, loja.id), eq(veiculos.status, "ativo")));

        const leads30d = await countLeadsByLojaRecentes(loja.id, 30);
        const scans30d = await countConversasByLojaRecentes(loja.id, 30);

        const [{ totalLeads }] = await db
          .select({ totalLeads: count() })
          .from(leads)
          .where(eq(leads.lojaId, loja.id));

        const [{ activeUsers }] = await db
          .select({ activeUsers: count() })
          .from(usuarios)
          .where(and(eq(usuarios.lojaId, loja.id), eq(usuarios.ativo, true)));

        const [ultimaFatura] = await db
          .select({ status: ciclosBilling.status })
          .from(ciclosBilling)
          .where(eq(ciclosBilling.lojaId, loja.id))
          .orderBy(desc(ciclosBilling.mesRef))
          .limit(1);

        const pagamentoEmDia = !ultimaFatura || ultimaFatura.status === "pago";
        const score = calcHealthScore({ scans30d, leads30d, activeUsers, pagamentoEmDia });
        const risco = score >= 60 ? "baixo" : score >= 30 ? "medio" : "alto";
        const elegivel_upsell = loja.plano === "starter" && leads30d >= 20;

        return {
          loja_id: loja.id,
          nome_fantasia: loja.nome_fantasia,
          plano: loja.plano,
          cidade: loja.cidade,
          score,
          risco_churn: risco as "alto" | "medio" | "baixo",
          veiculos_ativos: veiculosAtivos,
          leads_30d: leads30d,
          scans_30d: scans30d,
          total_leads: totalLeads,
          active_users: activeUsers,
          pagamento_em_dia: pagamentoEmDia,
          elegivel_upsell,
          mrr_potencial_upsell: elegivel_upsell ? (50 - 30) * veiculosAtivos : 0,
        };
      }),
    );

    scores.sort((a, b) => a.score - b.score);
    const sinaisUpsell = scores.filter((s) => s.elegivel_upsell);

    const porCidade = scores.reduce(
      (acc, s) => {
        const cidade = s.cidade ?? "Não informada";
        if (!acc[cidade]) acc[cidade] = { total: 0, leads: 0, scans: 0, lojaIds: [] };
        acc[cidade].total++;
        acc[cidade].leads += s.leads_30d;
        acc[cidade].scans += s.scans_30d;
        acc[cidade].lojaIds.push(s.loja_id);
        return acc;
      },
      {} as Record<string, { total: number; leads: number; scans: number; lojaIds: string[] }>,
    );

    const performancePorCidade = await Promise.all(
      Object.entries(porCidade).map(async ([cidade, dados]) => {
        let avgDuration = 0;
        const allVeicIds: string[] = [];
        for (const lojaId of dados.lojaIds) {
          const ids = await getVeiculoIdsByLoja(lojaId);
          allVeicIds.push(...ids);
        }
        if (allVeicIds.length > 0) {
          const [durResult] = await db
            .select({ avg: sql<string>`ROUND(AVG(${conversas.duracaoSegundos}), 0)` })
            .from(conversas)
            .where(and(
              inArray(conversas.veiculoId, allVeicIds),
              sql`${conversas.duracaoSegundos} IS NOT NULL`,
            ));
          avgDuration = Number(durResult?.avg ?? 0);
        }
        return {
          cidade,
          lojas: dados.total,
          leads_30d: dados.leads,
          scans_30d: dados.scans,
          media_leads_por_loja: dados.total > 0 ? Math.round(dados.leads / dados.total) : 0,
          taxa_conversao_pct: dados.scans > 0 ? Math.round((dados.leads / dados.scans) * 100) : 0,
          duracao_media_segundos: avgDuration,
        };
      }),
    );
    performancePorCidade.sort((a, b) => b.leads_30d - a.leads_30d);
    const performancePorCidadeTop = performancePorCidade.slice(0, 10);

    const benchmarks = await db
      .select({ marca: veiculos.marca, total: count() })
      .from(veiculos)
      .groupBy(veiculos.marca)
      .orderBy(desc(count()))
      .limit(10);

    const ticketMedioResult = await db
      .select({ media: sql<string>`ROUND(AVG(CAST(${veiculos.precoVenda} AS NUMERIC)), 2)` })
      .from(veiculos)
      .where(eq(veiculos.status, "ativo"));

    const leadsJornada = await db
      .select({
        interesse: leads.interesse,
        total: count(),
        avg_duracao: sql<string>`ROUND(AVG(${conversas.duracaoSegundos}), 0)`,
      })
      .from(leads)
      .leftJoin(conversas, eq(conversas.leadId, leads.id))
      .groupBy(leads.interesse)
      .orderBy(desc(count()))
      .limit(10);

    res.json({
      scores_saude: scores,
      sinais_upsell: sinaisUpsell,
      performance_por_cidade: performancePorCidadeTop,
      benchmarks_mercado: {
        marcas_mais_cadastradas: benchmarks.map((b) => ({ marca: b.marca, total: b.total })),
        ticket_medio_ativo: Number(ticketMedioResult[0]?.media ?? 0),
      },
      jornada_lead: leadsJornada.map((l) => ({
        interesse: l.interesse ?? "Não informado",
        total: l.total,
        avg_duracao_segundos: Number(l.avg_duracao ?? 0),
      })),
      resumo: {
        total_lojas: scores.length,
        risco_alto: scores.filter((s) => s.risco_churn === "alto").length,
        risco_medio: scores.filter((s) => s.risco_churn === "medio").length,
        risco_baixo: scores.filter((s) => s.risco_churn === "baixo").length,
        total_elegivel_upsell: sinaisUpsell.length,
      },
    });
  },
);

export default router;
