import { Router, type IRouter } from "express";
import { eq, and, lt, sql, gte, inArray } from "drizzle-orm";
import { db, leads, veiculos, qrcodes, conversas } from "@workspace/db";
import { requireAuth, requireLojaId } from "../middlewares/auth";

const router: IRouter = Router();

type Alerta = {
  tipo:
    | "lead_quente_sem_contato"
    | "veiculo_sem_scans"
    | "scans_sem_lead"
    | "lead_financiamento_pendente";
  prioridade: "alta" | "media";
  titulo: string;
  descricao: string;
  contexto: Record<string, unknown>;
};

router.get("/alertas", requireAuth, async (req, res): Promise<void> => {
  const lojaId = requireLojaId(req, res);
  if (!lojaId) return;

  const alertas: Alerta[] = [];
  const agora = new Date();

  const duasHorasAtras = new Date(agora.getTime() - 2 * 60 * 60 * 1000);
  const trintaDiasAtras = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000);
  const seteDiasAtras = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [leadsQuentes, leadsFinanciamento, veiculosAtivos] = await Promise.all([
    db
      .select()
      .from(leads)
      .where(
        and(
          eq(leads.lojaId, lojaId),
          eq(leads.interesse, "alto"),
          eq(leads.statusCrm, "novo"),
          lt(leads.criadoEm, duasHorasAtras),
        ),
      )
      .leftJoin(veiculos, eq(leads.veiculoId, veiculos.id)),

    db
      .select()
      .from(leads)
      .where(
        and(
          eq(leads.lojaId, lojaId),
          eq(leads.pediuFinanciamento, true),
          eq(leads.statusCrm, "novo"),
        ),
      )
      .leftJoin(veiculos, eq(leads.veiculoId, veiculos.id)),

    db
      .select()
      .from(veiculos)
      .where(and(eq(veiculos.lojaId, lojaId), eq(veiculos.ativoAgente, true)))
      .leftJoin(qrcodes, eq(qrcodes.veiculoId, veiculos.id)),
  ]);

  for (const row of leadsQuentes) {
    const lead = row.leads;
    const veiculo = row.veiculos;
    alertas.push({
      tipo: "lead_quente_sem_contato",
      prioridade: "alta",
      titulo: "Lead quente sem contato",
      descricao: `${lead.nome ?? "Lead anônimo"} tem interesse alto e ainda não foi contactado há mais de 2 horas.`,
      contexto: {
        lead_id: lead.id,
        nome: lead.nome,
        telefone: lead.telefone,
        email: lead.email,
        criado_em: lead.criadoEm,
        veiculo: veiculo
          ? `${veiculo.marca} ${veiculo.modelo} ${veiculo.anoFabricacao}`
          : null,
      },
    });
  }

  for (const row of leadsFinanciamento) {
    const lead = row.leads;
    const veiculo = row.veiculos;
    alertas.push({
      tipo: "lead_financiamento_pendente",
      prioridade: "alta",
      titulo: "Lead solicitou financiamento",
      descricao: `${lead.nome ?? "Lead anônimo"} pediu simulação de financiamento e ainda está com status "novo".`,
      contexto: {
        lead_id: lead.id,
        nome: lead.nome,
        telefone: lead.telefone,
        email: lead.email,
        criado_em: lead.criadoEm,
        veiculo: veiculo
          ? `${veiculo.marca} ${veiculo.modelo} ${veiculo.anoFabricacao}`
          : null,
      },
    });
  }

  for (const row of veiculosAtivos) {
    const veiculo = row.veiculos;
    const qr = row.qrcodes;
    if (!qr) continue;

    const [ultimoScan] = await db
      .select({ criadoEm: conversas.iniciadaEm })
      .from(conversas)
      .where(eq(conversas.veiculoId, veiculo.id))
      .orderBy(sql`${conversas.iniciadaEm} DESC`)
      .limit(1);

    if (!ultimoScan || ultimoScan.criadoEm! < trintaDiasAtras) {
      alertas.push({
        tipo: "veiculo_sem_scans",
        prioridade: "media",
        titulo: "Veículo sem interações",
        descricao: `${veiculo.marca} ${veiculo.modelo} ${veiculo.anoFabricacao} (${veiculo.placa}) não recebe scans há mais de 30 dias.`,
        contexto: {
          veiculo_id: veiculo.id,
          placa: veiculo.placa,
          marca: veiculo.marca,
          modelo: veiculo.modelo,
          ultimo_scan: ultimoScan?.criadoEm ?? null,
        },
      });
    }

    const [countRow] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(conversas)
      .where(
        and(
          eq(conversas.veiculoId, veiculo.id),
          sql`${conversas.iniciadaEm} >= ${seteDiasAtras}`,
        ),
      );

    const scansNaSemana = countRow?.total ?? 0;

    if (scansNaSemana >= 5) {
      const [leadCount] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(conversas)
        .where(
          and(
            eq(conversas.veiculoId, veiculo.id),
            sql`${conversas.iniciadaEm} >= ${seteDiasAtras}`,
            sql`${conversas.leadId} IS NOT NULL`,
          ),
        );

      const leadsNaSemana = leadCount?.total ?? 0;

      if (leadsNaSemana === 0) {
        alertas.push({
          tipo: "scans_sem_lead",
          prioridade: "media",
          titulo: "Scans sem leads identificados",
          descricao: `${veiculo.marca} ${veiculo.modelo} ${veiculo.anoFabricacao} (${veiculo.placa}) teve ${scansNaSemana} interações esta semana mas nenhum lead identificado.`,
          contexto: {
            veiculo_id: veiculo.id,
            placa: veiculo.placa,
            marca: veiculo.marca,
            modelo: veiculo.modelo,
            scans_semana: scansNaSemana,
          },
        });
      }
    }
  }

  const ordenados = alertas.sort((a, b) => {
    if (a.prioridade === "alta" && b.prioridade !== "alta") return -1;
    if (a.prioridade !== "alta" && b.prioridade === "alta") return 1;
    return 0;
  });

  res.json(ordenados);
});

router.get("/dashboard/metricas", requireAuth, async (req, res): Promise<void> => {
  const lojaId = requireLojaId(req, res);
  if (!lojaId) return;

  const veiculosIds = await db
    .select({ id: veiculos.id })
    .from(veiculos)
    .where(eq(veiculos.lojaId, lojaId));

  const ids = veiculosIds.map((v) => v.id);

  if (ids.length === 0) {
    const dias = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return { data: d.toISOString().slice(0, 10), scans: 0 };
    });
    res.json({ scans_hoje: 0, scans_semana: dias });
    return;
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const semanaAtras = new Date();
  semanaAtras.setDate(semanaAtras.getDate() - 6);
  semanaAtras.setHours(0, 0, 0, 0);

  const rows = await db
    .select({
      data: sql<string>`DATE(${conversas.iniciadaEm} AT TIME ZONE 'America/Sao_Paulo')`,
      scans: sql<number>`COUNT(*)::int`,
    })
    .from(conversas)
    .where(
      and(
        inArray(conversas.veiculoId, ids),
        gte(conversas.iniciadaEm, semanaAtras),
      ),
    )
    .groupBy(sql`DATE(${conversas.iniciadaEm} AT TIME ZONE 'America/Sao_Paulo')`)
    .orderBy(sql`DATE(${conversas.iniciadaEm} AT TIME ZONE 'America/Sao_Paulo')`);

  const scansPorDia: Record<string, number> = {};
  for (const r of rows) {
    scansPorDia[r.data] = r.scans;
  }

  const scansSemana = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    return { data: key, scans: scansPorDia[key] ?? 0 };
  });

  const hojeStr = hoje.toISOString().slice(0, 10);
  const scansHoje = scansPorDia[hojeStr] ?? 0;

  res.json({ scans_hoje: scansHoje, scans_semana: scansSemana });
});

export default router;
