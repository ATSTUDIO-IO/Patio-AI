import { Router, type IRouter } from "express";
import { eq, and, lt, sql, gte, inArray } from "drizzle-orm";
import { db, leads, veiculos, qrcodes, conversas, lojas } from "@workspace/db";
import { requireAuth, requireLojaId } from "../middlewares/auth";
import { getPlanoConfig, getInicioMesAtual } from "../lib/planos";

const router: IRouter = Router();

const ALERTA_PATIO_AMARELO = 60;
const ALERTA_PATIO_VERMELHO = 90;

type Alerta = {
  tipo:
    | "lead_quente_sem_contato"
    | "veiculo_sem_scans"
    | "scans_sem_lead"
    | "lead_financiamento_pendente"
    | "cota_80pct"
    | "cota_esgotada"
    | "veiculo_tempo_patio";
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

  const veiculosAtivosComPatio = await db
    .select()
    .from(veiculos)
    .where(and(eq(veiculos.lojaId, lojaId), eq(veiculos.status, "ativo")));

  for (const veiculo of veiculosAtivosComPatio) {
    if (!veiculo.dataEntradaPatio) continue;
    const entrada = new Date((veiculo.dataEntradaPatio as string) + "T12:00:00Z");
    const dias = Math.floor((agora.getTime() - entrada.getTime()) / (1000 * 60 * 60 * 24));
    if (dias >= ALERTA_PATIO_AMARELO) {
      const prioridade = dias >= ALERTA_PATIO_VERMELHO ? "alta" : "media";
      alertas.push({
        tipo: "veiculo_tempo_patio",
        prioridade,
        titulo: dias >= ALERTA_PATIO_VERMELHO ? "Veículo há mais de 90 dias no pátio" : "Veículo há mais de 60 dias no pátio",
        descricao: `${veiculo.marca} ${veiculo.modelo} (${veiculo.placa}) está no pátio há ${dias} dias. Considere ajustar o preço ou estratégia de venda.`,
        contexto: {
          veiculo_id: veiculo.id,
          placa: veiculo.placa,
          marca: veiculo.marca,
          modelo: veiculo.modelo,
          dias_no_patio: dias,
          data_entrada_patio: veiculo.dataEntradaPatio,
          preco_venda: veiculo.precoVenda,
        },
      });
    }
  }

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

  const [lojaData] = await db
    .select({ plano: lojas.plano })
    .from(lojas)
    .where(eq(lojas.id, lojaId))
    .limit(1);

  if (lojaData) {
    const planoConfig = getPlanoConfig(lojaData.plano);
    const inicioMes = getInicioMesAtual();

    const idsVeiculos = await db
      .select({ id: veiculos.id })
      .from(veiculos)
      .where(eq(veiculos.lojaId, lojaId));

    const ids = idsVeiculos.map((v) => v.id);

    if (ids.length > 0) {
      const veiculoFilter = ids.length === 1
        ? eq(conversas.veiculoId, ids[0])
        : inArray(conversas.veiculoId, ids);

      const [{ totalConv }] = await db
        .select({ totalConv: sql<number>`count(*)::int` })
        .from(conversas)
        .where(and(veiculoFilter, gte(conversas.iniciadaEm, inicioMes)));

      const cota = planoConfig.conversasIncluidas;
      const pct = (totalConv / cota) * 100;

      if (totalConv >= cota) {
        alertas.push({
          tipo: "cota_esgotada",
          prioridade: "alta",
          titulo: "Cota de conversas atingida",
          descricao: `Você usou ${totalConv} de ${cota} conversas incluídas no plano ${lojaData.plano}. O agente pode ser bloqueado em até ${planoConfig.bufferExcedente} conversas adicionais.`,
          contexto: {
            conversas_usadas: totalConv,
            conversas_incluidas: cota,
            buffer_excedente: planoConfig.bufferExcedente,
            preco_excedente: planoConfig.precoExcedente,
          },
        });
      } else if (pct >= 80) {
        alertas.push({
          tipo: "cota_80pct",
          prioridade: "media",
          titulo: "80% da cota de conversas utilizada",
          descricao: `Você utilizou ${totalConv} de ${cota} conversas incluídas no mês (${Math.round(pct)}%). Conversas acima da cota custam R$0,75 cada.`,
          contexto: {
            conversas_usadas: totalConv,
            conversas_incluidas: cota,
            percentual: Math.round(pct),
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
