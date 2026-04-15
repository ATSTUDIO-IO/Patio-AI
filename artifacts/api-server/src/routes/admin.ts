import { Router, type IRouter } from "express";
import { eq, count, desc, sql, inArray, and, gte } from "drizzle-orm";
import { z } from "zod/v4";
import { db, lojas, usuarios, veiculos, conversas, ciclosBilling, leads, notasAdmin } from "@workspace/db";
import { requireAuth, requirePerfil } from "../middlewares/auth";

const router: IRouter = Router();

async function countConversasByLoja(lojaId: string): Promise<number> {
  const veiculosIds = await db
    .select({ id: veiculos.id })
    .from(veiculos)
    .where(eq(veiculos.lojaId, lojaId));

  if (veiculosIds.length === 0) return 0;

  const ids = veiculosIds.map((v) => v.id);
  const [{ total }] = await db
    .select({ total: count() })
    .from(conversas)
    .where(inArray(conversas.veiculoId, ids));

  return total;
}

async function countLeadsByLoja(lojaId: string): Promise<number> {
  const [{ total }] = await db
    .select({ total: count() })
    .from(leads)
    .where(eq(leads.lojaId, lojaId));
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

    const [{ totalConversas }] = await db
      .select({ totalConversas: count() })
      .from(conversas);

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
  "/admin/lojas",
  requireAuth,
  requirePerfil("admin_patioai"),
  async (_req, res): Promise<void> => {
    const rows = await db
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

    const lojasComStats = await Promise.all(
      rows.map(async (loja) => {
        const [{ veiculosAtivos }] = await db
          .select({ veiculosAtivos: count() })
          .from(veiculos)
          .where(and(eq(veiculos.lojaId, loja.id), eq(veiculos.status, "ativo")));

        const totalConversas = await countConversasByLoja(loja.id);
        const totalLeads = await countLeadsByLoja(loja.id);

        const [{ totalUsuarios }] = await db
          .select({ totalUsuarios: count() })
          .from(usuarios)
          .where(eq(usuarios.lojaId, loja.id));

        const [ultimaFatura] = await db
          .select({ status: ciclosBilling.status, valorTotal: ciclosBilling.valorTotal })
          .from(ciclosBilling)
          .where(eq(ciclosBilling.lojaId, loja.id))
          .orderBy(desc(ciclosBilling.mesRef))
          .limit(1);

        return {
          ...loja,
          veiculos_ativos: veiculosAtivos,
          total_conversas: totalConversas,
          total_leads: totalLeads,
          total_usuarios: totalUsuarios,
          ultima_fatura_status: ultimaFatura?.status ?? null,
          ultima_fatura_valor: ultimaFatura ? Number(ultimaFatura.valorTotal) : 0,
        };
      }),
    );

    res.json(lojasComStats);
  },
);

router.get(
  "/admin/lojas/:lojaId",
  requireAuth,
  requirePerfil("admin_patioai"),
  async (req, res): Promise<void> => {
    const lojaId = req.params.lojaId as string;

    const [loja] = await db
      .select()
      .from(lojas)
      .where(eq(lojas.id, lojaId))
      .limit(1);

    if (!loja) {
      res.status(404).json({ error: "Loja não encontrada" });
      return;
    }

    const [{ veiculosAtivos }] = await db
      .select({ veiculosAtivos: count() })
      .from(veiculos)
      .where(and(eq(veiculos.lojaId, lojaId), eq(veiculos.status, "ativo")));

    const totalConversas = await countConversasByLoja(lojaId);
    const totalLeads = await countLeadsByLoja(lojaId);
    const leads30d = await countLeadsByLojaRecentes(lojaId, 30);

    const usuariosLoja = await db
      .select({
        id: usuarios.id,
        nome: usuarios.nome,
        email: usuarios.email,
        perfil: usuarios.perfil,
        ativo: usuarios.ativo,
      })
      .from(usuarios)
      .where(eq(usuarios.lojaId, lojaId));

    const faturas = await db
      .select()
      .from(ciclosBilling)
      .where(eq(ciclosBilling.lojaId, lojaId))
      .orderBy(desc(ciclosBilling.mesRef))
      .limit(12);

    const notas = await db
      .select({
        id: notasAdmin.id,
        conteudo: notasAdmin.conteudo,
        criado_em: notasAdmin.criadoEm,
        admin_id: notasAdmin.adminId,
      })
      .from(notasAdmin)
      .where(eq(notasAdmin.lojaId, lojaId))
      .orderBy(desc(notasAdmin.criadoEm))
      .limit(20);

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

    const [ciclo] = await db
      .select()
      .from(ciclosBilling)
      .where(eq(ciclosBilling.id, cicloId))
      .limit(1);

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

    res.status(201).json({
      id: nota.id,
      conteudo: nota.conteudo,
      criado_em: nota.criadoEm,
      admin_id: nota.adminId,
    });
  },
);

router.get(
  "/admin/lojas/:lojaId/exportar",
  requireAuth,
  requirePerfil("admin_patioai"),
  async (req, res): Promise<void> => {
    const lojaId = req.params.lojaId as string;

    const [loja] = await db
      .select({ nome: lojas.nomeFantasia })
      .from(lojas)
      .where(eq(lojas.id, lojaId))
      .limit(1);

    if (!loja) {
      res.status(404).json({ error: "Loja não encontrada" });
      return;
    }

    const veiculosData = await db
      .select()
      .from(veiculos)
      .where(eq(veiculos.lojaId, lojaId))
      .orderBy(desc(veiculos.criadoEm));

    const leadsData = await db
      .select()
      .from(leads)
      .where(eq(leads.lojaId, lojaId))
      .orderBy(desc(leads.criadoEm));

    const linhas: string[] = [];

    linhas.push("=== VEÍCULOS ===");
    linhas.push("ID,Placa,Marca,Modelo,Ano Fab,Ano Mod,Km,Preço,Status,Criado Em");
    for (const v of veiculosData) {
      linhas.push([v.id, v.placa, v.marca, v.modelo, v.anoFabricacao, v.anoModelo,
        v.quilometragem, v.precoVenda, v.status, v.criadoEm?.toISOString() ?? ""].join(","));
    }

    linhas.push("");
    linhas.push("=== LEADS ===");
    linhas.push("ID,Nome,Telefone,Email,Interesse,Criado Em");
    for (const l of leadsData) {
      linhas.push([l.id, l.nome ?? "", l.telefone ?? "", l.email ?? "",
        l.interesse ?? "", l.criadoEm?.toISOString() ?? ""].join(","));
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
      .select({
        id: lojas.id,
        nome_fantasia: lojas.nomeFantasia,
        plano: lojas.plano,
        ativo: lojas.ativo,
        cidade: lojas.cidade,
        criado_em: lojas.criadoEm,
      })
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
        const totalLeads = await countLeadsByLoja(loja.id);

        const veiculosIds = await db
          .select({ id: veiculos.id })
          .from(veiculos)
          .where(eq(veiculos.lojaId, loja.id));

        let scans30d = 0;
        if (veiculosIds.length > 0) {
          const ids = veiculosIds.map((v) => v.id);
          const desde = new Date();
          desde.setDate(desde.getDate() - 30);
          const [{ total }] = await db
            .select({ total: count() })
            .from(conversas)
            .where(and(inArray(conversas.veiculoId, ids), gte(conversas.iniciadaEm, desde)));
          scans30d = total;
        }

        const [ultimaFatura] = await db
          .select({ status: ciclosBilling.status })
          .from(ciclosBilling)
          .where(eq(ciclosBilling.lojaId, loja.id))
          .orderBy(desc(ciclosBilling.mesRef))
          .limit(1);

        const pagamentoEmDia = !ultimaFatura || ultimaFatura.status === "pago" ? 25 : 0;
        const scoreScans = Math.min(scans30d * 3, 30);
        const scoreLeads = Math.min(leads30d * 5, 25);
        const scoreAtividade = veiculosAtivos > 0 ? 20 : 0;
        const score = Math.round(scoreScans + scoreLeads + scoreAtividade + pagamentoEmDia);

        const risco = score >= 60 ? "baixo" : score >= 30 ? "medio" : "alto";
        const elegivel_upsell = loja.plano === "starter" && leads30d >= 20;

        return {
          loja_id: loja.id,
          nome_fantasia: loja.nome_fantasia,
          plano: loja.plano,
          cidade: loja.cidade,
          score,
          risco_churn: risco,
          veiculos_ativos: veiculosAtivos,
          leads_30d: leads30d,
          scans_30d: scans30d,
          total_leads: totalLeads,
          pagamento_em_dia: pagamentoEmDia === 25,
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
        if (!acc[cidade]) acc[cidade] = { total: 0, leads: 0, scans: 0 };
        acc[cidade].total++;
        acc[cidade].leads += s.leads_30d;
        acc[cidade].scans += s.scans_30d;
        return acc;
      },
      {} as Record<string, { total: number; leads: number; scans: number }>,
    );

    const performancePorCidade = Object.entries(porCidade)
      .map(([cidade, dados]) => ({
        cidade,
        lojas: dados.total,
        leads_30d: dados.leads,
        scans_30d: dados.scans,
        media_leads_por_loja: dados.total > 0 ? Math.round(dados.leads / dados.total) : 0,
      }))
      .sort((a, b) => b.leads_30d - a.leads_30d)
      .slice(0, 10);

    res.json({
      scores_saude: scores,
      sinais_upsell: sinaisUpsell,
      performance_por_cidade: performancePorCidade,
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
