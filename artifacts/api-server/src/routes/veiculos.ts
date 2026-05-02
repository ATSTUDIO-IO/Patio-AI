import { Router, type IRouter } from "express";
import { eq, and, sql, sum, gte, desc } from "drizzle-orm";
import { db, veiculos, qrcodes, eventosBilling, lojas, veiculoDespesas } from "@workspace/db";
import {
  ListVeiculosQueryParams,
  CreateVeiculoBody,
  GetVeiculoParams,
  UpdateVeiculoParams,
  UpdateVeiculoBody,
  PatchVeiculoStatusParams,
  PatchVeiculoStatusBody,
  GetVeiculoQrParams,
} from "@workspace/api-zod";
import { requireAuth, requireLojaId } from "../middlewares/auth";
import { formatZodError } from "../lib/errors";
import { getPlanoConfig } from "../lib/planos";
import {
  gerarSlugCandidatos,
  gerarUrlPublica,
  gerarImagemQr,
  gerarQrPng,
} from "../lib/qrcode";
import * as zod from "zod";

const router: IRouter = Router();

const ALERTA_PATIO_AMARELO = 60;
const ALERTA_PATIO_VERMELHO = 90;
const MARGEM_SUGERIDA = 0.20;

function calcularDiasPatio(dataEntrada: string | null | undefined): number | null {
  if (!dataEntrada) return null;
  const entrada = new Date(dataEntrada + "T12:00:00Z");
  const hoje = new Date();
  const diff = Math.floor((hoje.getTime() - entrada.getTime()) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff : 0;
}

function mapVeiculo(
  v: typeof veiculos.$inferSelect,
  qr?: typeof qrcodes.$inferSelect | null,
  extras?: {
    custoTotal?: number | null;
    precoSugerido?: number | null;
    despesas?: DespesaItem[];
  },
) {
  const diasNoPatio = calcularDiasPatio(v.dataEntradaPatio as string | null);
  const alertaPatio = diasNoPatio !== null && v.status === "ativo" && diasNoPatio >= ALERTA_PATIO_AMARELO;

  return {
    id: v.id,
    loja_id: v.lojaId,
    placa: v.placa,
    marca: v.marca,
    modelo: v.modelo,
    ano_fabricacao: v.anoFabricacao,
    ano_modelo: v.anoModelo,
    quilometragem: v.quilometragem,
    preco_venda: v.precoVenda,
    cor: v.cor,
    cambio: v.cambio,
    combustivel: v.combustivel,
    opcionais: v.opcionais,
    descricao_agente: v.descricaoAgente,
    status: v.status,
    ativo_agente: v.ativoAgente,
    tipo_aquisicao: v.tipoAquisicao,
    valor_aquisicao: v.valorAquisicao,
    consignado_proprietario_nome: v.consignadoProprietarioNome,
    consignado_proprietario_telefone: v.consignadoProprietarioTelefone,
    comissao_consignado_pct: v.comissaoConsignadoPct,
    data_entrada_patio: v.dataEntradaPatio,
    dias_no_patio: diasNoPatio,
    alerta_patio: alertaPatio,
    criado_em: v.criadoEm,
    vendido_em: v.vendidoEm,
    valor_venda_real: v.valorVendaReal ? parseFloat(v.valorVendaReal) : null,
    ...(extras?.custoTotal !== undefined && { custo_total: extras.custoTotal }),
    ...(extras?.precoSugerido !== undefined && { preco_sugerido: extras.precoSugerido }),
    ...(extras?.despesas !== undefined && { despesas: extras.despesas }),
    qr_code: qr
      ? {
          id: qr.id,
          slug: qr.slug,
          url_publica: qr.urlPublica,
          imagem_qr: qr.imagemQr,
          ativo: qr.ativo,
          total_scans: qr.totalScans ?? 0,
        }
      : null,
  };
}

type DespesaItem = {
  id: string;
  categoria: string;
  descricao: string;
  valor: string;
  data: string;
  criado_em: Date | null;
};

async function calcularCustoTotal(veiculoId: string, valorAquisicao: string | null): Promise<number> {
  const [result] = await db
    .select({ total: sql<string>`COALESCE(SUM(valor), 0)` })
    .from(veiculoDespesas)
    .where(eq(veiculoDespesas.veiculoId, veiculoId));
  const totalDespesas = parseFloat(result?.total ?? "0");
  const aquisicao = parseFloat(valorAquisicao ?? "0");
  return aquisicao + totalDespesas;
}

// ─── GET /veiculos ────────────────────────────────────────────────────────────
router.get("/veiculos", requireAuth, async (req, res): Promise<void> => {
  const query = ListVeiculosQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: formatZodError(query.error) });
    return;
  }

  const lojaId = requireLojaId(req, res);
  if (!lojaId) return;

  const conditions = [eq(veiculos.lojaId, lojaId)];
  if (query.data.status) {
    conditions.push(
      eq(veiculos.status, query.data.status as "ativo" | "vendido" | "pausado"),
    );
  }
  if ((req.query as Record<string, string>).alerta_patio === "true") {
    conditions.push(eq(veiculos.status, "ativo"));
  }

  const rows = await db
    .select()
    .from(veiculos)
    .where(and(...conditions))
    .orderBy(veiculos.criadoEm);

  const ids = rows.map((v) => v.id);
  const qrRows =
    ids.length > 0
      ? await db
          .select()
          .from(qrcodes)
          .where(
            sql`${qrcodes.veiculoId} = ANY(ARRAY[${sql.join(
              ids.map((id) => sql`${id}::uuid`),
              sql`, `,
            )}])`,
          )
      : [];

  const qrByVeiculo = Object.fromEntries(qrRows.map((q) => [q.veiculoId, q]));
  let result = rows.map((v) => mapVeiculo(v, qrByVeiculo[v.id]));

  if ((req.query as Record<string, string>).alerta_patio === "true") {
    result = result.filter((v) => v.alerta_patio === true);
  }

  res.json(result);
});

// ─── POST /veiculos ───────────────────────────────────────────────────────────
router.post("/veiculos", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateVeiculoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  const lojaId = requireLojaId(req, res);
  if (!lojaId) return;

  const placaNormalizada = parsed.data.placa
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  const [placaExistente] = await db
    .select({ id: veiculos.id })
    .from(veiculos)
    .where(
      and(eq(veiculos.lojaId, lojaId), eq(veiculos.placa, placaNormalizada)),
    )
    .limit(1);

  if (placaExistente) {
    res.status(409).json({ error: "Placa já cadastrada nesta loja" });
    return;
  }

  const dataEntrada = parsed.data.data_entrada_patio ?? new Date().toISOString().slice(0, 10);

  const { veiculo, qr } = await db.transaction(async (tx) => {
    const [veiculo] = await tx
      .insert(veiculos)
      .values({
        lojaId,
        placa: placaNormalizada,
        marca: parsed.data.marca,
        modelo: parsed.data.modelo,
        anoFabricacao: parsed.data.ano_fabricacao,
        anoModelo: parsed.data.ano_modelo,
        quilometragem: parsed.data.quilometragem,
        precoVenda: parsed.data.preco_venda,
        cor: parsed.data.cor ?? null,
        cambio: (parsed.data.cambio ?? null) as "manual" | "automatico" | "cvt" | null,
        combustivel: (parsed.data.combustivel ?? null) as "flex" | "gasolina" | "diesel" | "eletrico" | null,
        opcionais: parsed.data.opcionais ?? null,
        descricaoAgente: parsed.data.descricao_agente ?? null,
        status: "ativo",
        ativoAgente: true,
        tipoAquisicao: (parsed.data.tipo_aquisicao ?? "proprio") as "proprio" | "consignado",
        valorAquisicao: parsed.data.valor_aquisicao != null ? String(parsed.data.valor_aquisicao) : null,
        consignadoProprietarioNome: parsed.data.consignado_proprietario_nome ?? null,
        consignadoProprietarioTelefone: parsed.data.consignado_proprietario_telefone ?? null,
        comissaoConsignadoPct: parsed.data.comissao_consignado_pct != null ? String(parsed.data.comissao_consignado_pct) : null,
        dataEntradaPatio: dataEntrada,
      })
      .returning();

    const MAX_SLUG_TENTATIVAS = 5;
    let qr: typeof qrcodes.$inferSelect | undefined;
    for (let i = 0; i < MAX_SLUG_TENTATIVAS; i++) {
      const slug = gerarSlugCandidatos(veiculo.modelo, veiculo.anoFabricacao, 1)[0];
      const urlPublica = gerarUrlPublica(slug);
      const imagemQr = await gerarImagemQr(urlPublica);
      try {
        const [inserted] = await tx
          .insert(qrcodes)
          .values({ veiculoId: veiculo.id, slug, urlPublica, imagemQr, ativo: true })
          .returning();
        qr = inserted;
        break;
      } catch (err: unknown) {
        const pgErr = err as { code?: string };
        if (pgErr?.code === "23505" && i < MAX_SLUG_TENTATIVAS - 1) continue;
        throw err;
      }
    }
    if (!qr) throw new Error("Falha ao gerar slug único para o QR code");

    await tx.insert(eventosBilling).values({
      lojaId,
      veiculoId: veiculo.id,
      tipo: "ativacao",
      motivo: "Veículo cadastrado",
    });

    return { veiculo, qr };
  });

  req.log.info({ veiculoId: veiculo.id, slug: qr.slug }, "Veículo criado com QR code");
  res.status(201).json(mapVeiculo(veiculo, qr));
});

// ─── GET /veiculos/relatorio-vendas ───────────────────────────────────────────
const RelatorioVendasQueryParams = zod.object({
  periodo: zod.enum(["mes", "trimestre", "ano", "todos"]).default("mes"),
});

router.get("/veiculos/relatorio-vendas", requireAuth, async (req, res): Promise<void> => {
  const query = RelatorioVendasQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: formatZodError(query.error) });
    return;
  }

  const lojaId = requireLojaId(req, res);
  if (!lojaId) return;

  const periodo = query.data.periodo;
  const agora = new Date();
  let dataInicio: Date | null = null;

  if (periodo === "mes") {
    dataInicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
  } else if (periodo === "trimestre") {
    const trimestre = Math.floor(agora.getMonth() / 3);
    dataInicio = new Date(agora.getFullYear(), trimestre * 3, 1);
  } else if (periodo === "ano") {
    dataInicio = new Date(agora.getFullYear(), 0, 1);
  }

  const conditions = [eq(veiculos.lojaId, lojaId), eq(veiculos.status, "vendido")];
  if (dataInicio) {
    conditions.push(gte(veiculos.vendidoEm, dataInicio));
  }

  const vendidos = await db
    .select()
    .from(veiculos)
    .where(and(...conditions))
    .orderBy(desc(veiculos.vendidoEm));

  const items = await Promise.all(
    vendidos.map(async (v) => {
      const custoTotal = await calcularCustoTotal(v.id, v.valorAquisicao);
      const valorVendaReal = v.valorVendaReal ? parseFloat(v.valorVendaReal) : null;
      const lucroBruto = valorVendaReal !== null ? valorVendaReal - custoTotal : null;
      const margemPct = lucroBruto !== null && valorVendaReal !== null && valorVendaReal > 0 ? (lucroBruto / valorVendaReal) * 100 : null;

      return {
        id: v.id,
        marca: v.marca,
        modelo: v.modelo,
        ano_fabricacao: v.anoFabricacao,
        ano_modelo: v.anoModelo,
        placa: v.placa,
        vendido_em: v.vendidoEm?.toISOString() ?? null,
        custo_total: custoTotal,
        valor_venda_real: valorVendaReal,
        lucro_bruto: lucroBruto,
        margem_pct: margemPct !== null ? parseFloat(margemPct.toFixed(2)) : null,
      };
    }),
  );

  const comVenda = items.filter((i) => i.valor_venda_real !== null);
  const receitaTotal = comVenda.reduce((acc, i) => acc + (i.valor_venda_real ?? 0), 0);
  const custoTotalGeral = comVenda.reduce((acc, i) => acc + i.custo_total, 0);
  const lucroTotal = comVenda.reduce((acc, i) => acc + (i.lucro_bruto ?? 0), 0);

  res.json({
    items,
    totais: {
      receita_total: receitaTotal,
      custo_total: custoTotalGeral,
      lucro_total: lucroTotal,
      total_vendidos: items.length,
    },
  });
});

// ─── GET /veiculos/:veiculoId ─────────────────────────────────────────────────
router.get("/veiculos/:veiculoId", requireAuth, async (req, res): Promise<void> => {
  const params = GetVeiculoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: formatZodError(params.error) });
    return;
  }

  const lojaId = requireLojaId(req, res);
  if (!lojaId) return;

  const [veiculo] = await db
    .select()
    .from(veiculos)
    .where(and(eq(veiculos.id, params.data.veiculoId), eq(veiculos.lojaId, lojaId)))
    .limit(1);

  if (!veiculo) {
    res.status(404).json({ error: "Veículo não encontrado" });
    return;
  }

  const [qr] = await db
    .select()
    .from(qrcodes)
    .where(eq(qrcodes.veiculoId, veiculo.id))
    .limit(1);

  const despesasRows = await db
    .select()
    .from(veiculoDespesas)
    .where(eq(veiculoDespesas.veiculoId, veiculo.id))
    .orderBy(veiculoDespesas.data);

  const despesas: DespesaItem[] = despesasRows.map((d) => ({
    id: d.id,
    categoria: d.categoria,
    descricao: d.descricao,
    valor: d.valor,
    data: d.data as string,
    criado_em: d.criadoEm,
  }));

  const totalDespesas = despesasRows.reduce((acc, d) => acc + parseFloat(d.valor), 0);
  const custoTotal = parseFloat(veiculo.valorAquisicao ?? "0") + totalDespesas;
  const precoSugerido = custoTotal > 0 ? custoTotal * (1 + MARGEM_SUGERIDA) : null;

  res.json(mapVeiculo(veiculo, qr ?? null, { custoTotal, precoSugerido, despesas }));
});

// ─── PUT /veiculos/:veiculoId ─────────────────────────────────────────────────
router.put("/veiculos/:veiculoId", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateVeiculoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: formatZodError(params.error) });
    return;
  }

  const body = UpdateVeiculoBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: formatZodError(body.error) });
    return;
  }

  const lojaId = requireLojaId(req, res);
  if (!lojaId) return;

  const [veiculoExistente] = await db
    .select()
    .from(veiculos)
    .where(and(eq(veiculos.id, params.data.veiculoId), eq(veiculos.lojaId, lojaId)))
    .limit(1);

  if (!veiculoExistente) {
    res.status(404).json({ error: "Veículo não encontrado" });
    return;
  }

  const updateData: Record<string, unknown> = {};
  const d = body.data;

  if (d.placa !== undefined) {
    const placaNova = d.placa.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (placaNova !== veiculoExistente.placa) {
      const [placaConflito] = await db
        .select({ id: veiculos.id })
        .from(veiculos)
        .where(and(eq(veiculos.lojaId, lojaId), eq(veiculos.placa, placaNova)))
        .limit(1);
      if (placaConflito) {
        res.status(409).json({ error: "Placa já cadastrada nesta loja" });
        return;
      }
    }
    updateData.placa = placaNova;
  }
  if (d.marca !== undefined) updateData.marca = d.marca;
  if (d.modelo !== undefined) updateData.modelo = d.modelo;
  if (d.ano_fabricacao !== undefined) updateData.anoFabricacao = d.ano_fabricacao;
  if (d.ano_modelo !== undefined) updateData.anoModelo = d.ano_modelo;
  if (d.quilometragem !== undefined) updateData.quilometragem = d.quilometragem;
  if (d.preco_venda !== undefined) updateData.precoVenda = d.preco_venda;
  if (d.cor !== undefined) updateData.cor = d.cor;
  if (d.cambio !== undefined) updateData.cambio = d.cambio;
  if (d.combustivel !== undefined) updateData.combustivel = d.combustivel;
  if (d.opcionais !== undefined) updateData.opcionais = d.opcionais;
  if (d.descricao_agente !== undefined) updateData.descricaoAgente = d.descricao_agente;
  if (d.ativo_agente !== undefined) updateData.ativoAgente = d.ativo_agente;
  if (d.tipo_aquisicao !== undefined) updateData.tipoAquisicao = d.tipo_aquisicao;
  if (d.valor_aquisicao !== undefined) updateData.valorAquisicao = d.valor_aquisicao != null ? String(d.valor_aquisicao) : null;
  if (d.consignado_proprietario_nome !== undefined) updateData.consignadoProprietarioNome = d.consignado_proprietario_nome;
  if (d.consignado_proprietario_telefone !== undefined) updateData.consignadoProprietarioTelefone = d.consignado_proprietario_telefone;
  if (d.comissao_consignado_pct !== undefined) updateData.comissaoConsignadoPct = d.comissao_consignado_pct != null ? String(d.comissao_consignado_pct) : null;
  if (d.data_entrada_patio !== undefined) updateData.dataEntradaPatio = d.data_entrada_patio;

  if (Object.keys(updateData).length === 0) {
    res.status(400).json({ error: "Nenhum campo para atualizar" });
    return;
  }

  const [veiculoAtualizado] = await db
    .update(veiculos)
    .set(updateData)
    .where(eq(veiculos.id, params.data.veiculoId))
    .returning();

  const [qr] = await db
    .select()
    .from(qrcodes)
    .where(eq(qrcodes.veiculoId, veiculoAtualizado.id))
    .limit(1);

  req.log.info({ veiculoId: veiculoAtualizado.id }, "Veículo atualizado");
  res.json(mapVeiculo(veiculoAtualizado, qr ?? null));
});

// ─── PATCH /veiculos/:veiculoId/status ────────────────────────────────────────
router.patch("/veiculos/:veiculoId/status", requireAuth, async (req, res): Promise<void> => {
  const params = PatchVeiculoStatusParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: formatZodError(params.error) });
    return;
  }

  const body = PatchVeiculoStatusBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: formatZodError(body.error) });
    return;
  }

  const lojaId = requireLojaId(req, res);
  if (!lojaId) return;

  const [veiculoExistente] = await db
    .select()
    .from(veiculos)
    .where(and(eq(veiculos.id, params.data.veiculoId), eq(veiculos.lojaId, lojaId)))
    .limit(1);

  if (!veiculoExistente) {
    res.status(404).json({ error: "Veículo não encontrado" });
    return;
  }

  const novoStatus = body.data.status as "ativo" | "vendido" | "pausado";
  const motivo = body.data.motivo ?? null;
  const valorVendaReal = (body.data as { valor_venda_real?: number | null }).valor_venda_real ?? null;

  const { veiculoAtualizado, qrAtualizado } = await db.transaction(async (tx) => {
    const veiculoUpdate: Record<string, unknown> = { status: novoStatus };

    if (novoStatus === "vendido") {
      veiculoUpdate.ativoAgente = false;
      veiculoUpdate.vendidoEm = new Date();
      if (valorVendaReal !== null) {
        veiculoUpdate.valorVendaReal = String(valorVendaReal);
      }
    } else if (novoStatus === "pausado") {
      veiculoUpdate.ativoAgente = false;
    } else if (novoStatus === "ativo") {
      veiculoUpdate.ativoAgente = true;
      veiculoUpdate.vendidoEm = null;
      veiculoUpdate.valorVendaReal = null;
    }

    const [veiculoAtualizado] = await tx
      .update(veiculos)
      .set(veiculoUpdate)
      .where(eq(veiculos.id, params.data.veiculoId))
      .returning();

    let tipoBilling: "ativacao" | "baixa" | "pausa" | null = null;
    let qrAtivo: boolean | null = null;

    if (novoStatus === "vendido") { tipoBilling = "baixa"; qrAtivo = true; }
    else if (novoStatus === "pausado") { tipoBilling = "pausa"; qrAtivo = false; }
    else if (novoStatus === "ativo") { tipoBilling = "ativacao"; qrAtivo = true; }

    if (tipoBilling) {
      await tx.insert(eventosBilling).values({
        lojaId: veiculoAtualizado.lojaId,
        veiculoId: veiculoAtualizado.id,
        tipo: tipoBilling,
        motivo: motivo ?? undefined,
      });
    }

    const [qrAtualizado] = await tx
      .update(qrcodes)
      .set({ ativo: qrAtivo! })
      .where(eq(qrcodes.veiculoId, veiculoAtualizado.id))
      .returning();

    return { veiculoAtualizado, qrAtualizado: qrAtualizado ?? null };
  });

  req.log.info({ veiculoId: veiculoAtualizado.id, status: novoStatus }, "Status do veículo atualizado");
  res.json(mapVeiculo(veiculoAtualizado, qrAtualizado));
});

// ─── GET /veiculos/:veiculoId/qr ──────────────────────────────────────────────
router.get("/veiculos/:veiculoId/qr", requireAuth, async (req, res): Promise<void> => {
  const params = GetVeiculoQrParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: formatZodError(params.error) });
    return;
  }

  const lojaId = requireLojaId(req, res);
  if (!lojaId) return;

  const [veiculo] = await db
    .select({ id: veiculos.id })
    .from(veiculos)
    .where(and(eq(veiculos.id, params.data.veiculoId), eq(veiculos.lojaId, lojaId)))
    .limit(1);

  if (!veiculo) {
    res.status(404).json({ error: "Veículo não encontrado" });
    return;
  }

  const [qr] = await db
    .select()
    .from(qrcodes)
    .where(eq(qrcodes.veiculoId, veiculo.id))
    .limit(1);

  if (!qr) {
    res.status(404).json({ error: "QR code não encontrado" });
    return;
  }

  const pngBuffer = await gerarQrPng(qr.urlPublica);
  res.set({
    "Content-Type": "image/png",
    "Content-Disposition": `attachment; filename="qr-${qr.slug}.png"`,
    "Content-Length": pngBuffer.length,
  });
  res.send(pngBuffer);
});

// ─── GET /veiculos/:veiculoId/consulta-documental ─────────────────────────────
router.get("/veiculos/:veiculoId/consulta-documental", requireAuth, async (req, res): Promise<void> => {
  const params = GetVeiculoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: formatZodError(params.error) });
    return;
  }

  const lojaId = requireLojaId(req, res);
  if (!lojaId) return;

  const [lojaData] = await db
    .select({ plano: lojas.plano })
    .from(lojas)
    .where(eq(lojas.id, lojaId))
    .limit(1);

  const cfg = getPlanoConfig(lojaData?.plano ?? "starter");
  if (!cfg.consultaDocumental) {
    res.status(403).json({
      error: "Consulta documental está disponível a partir do plano Full. Faça upgrade para acessar esta funcionalidade.",
      codigo: "FEATURE_NAO_DISPONIVEL",
      plano_atual: lojaData?.plano ?? "starter",
    });
    return;
  }

  const [veiculo] = await db
    .select({ id: veiculos.id, placa: veiculos.placa, marca: veiculos.marca, modelo: veiculos.modelo })
    .from(veiculos)
    .where(and(eq(veiculos.id, params.data.veiculoId), eq(veiculos.lojaId, lojaId)))
    .limit(1);

  if (!veiculo) {
    res.status(404).json({ error: "Veículo não encontrado" });
    return;
  }

  res.json({
    veiculo_id: veiculo.id,
    placa: veiculo.placa,
    veiculo: `${veiculo.marca} ${veiculo.modelo}`,
    integracao_pendente: true,
    mensagem: "Integração com provedor de consulta documental em breve. Os dados abaixo são ilustrativos.",
    consultado_em: new Date().toISOString(),
    debitos: {
      ipva: { status: "pendente_integracao", valor: null },
      dpvat: { status: "pendente_integracao", valor: null },
      multas: { status: "pendente_integracao", quantidade: null },
    },
    sinistros: { status: "pendente_integracao", ocorrencias: null },
    historico_leilao: { status: "pendente_integracao", participou_leilao: null },
    restricoes: {
      financiamento: { status: "pendente_integracao", bloqueado: null },
      judicial: { status: "pendente_integracao", bloqueado: null },
      roubo_furto: { status: "pendente_integracao", bloqueado: null },
    },
  });
});

// ─── GET /veiculos/:veiculoId/despesas ────────────────────────────────────────
router.get("/veiculos/:veiculoId/despesas", requireAuth, async (req, res): Promise<void> => {
  const params = GetVeiculoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: formatZodError(params.error) });
    return;
  }

  const lojaId = requireLojaId(req, res);
  if (!lojaId) return;

  const [veiculo] = await db
    .select({ id: veiculos.id })
    .from(veiculos)
    .where(and(eq(veiculos.id, params.data.veiculoId), eq(veiculos.lojaId, lojaId)))
    .limit(1);

  if (!veiculo) {
    res.status(404).json({ error: "Veículo não encontrado" });
    return;
  }

  const despesas = await db
    .select()
    .from(veiculoDespesas)
    .where(eq(veiculoDespesas.veiculoId, veiculo.id))
    .orderBy(veiculoDespesas.data);

  res.json(despesas.map((d) => ({
    id: d.id,
    veiculo_id: d.veiculoId,
    categoria: d.categoria,
    descricao: d.descricao,
    valor: d.valor,
    data: d.data,
    criado_em: d.criadoEm,
  })));
});

// ─── POST /veiculos/:veiculoId/despesas ───────────────────────────────────────
const CreateDespesaBody = zod.object({
  categoria: zod.enum(["manutencao_mecanica", "manutencao_estetica", "documentacao", "outros"]),
  descricao: zod.string().min(1),
  valor: zod.number().positive(),
  data: zod.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

router.post("/veiculos/:veiculoId/despesas", requireAuth, async (req, res): Promise<void> => {
  const params = GetVeiculoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: formatZodError(params.error) });
    return;
  }

  const body = CreateDespesaBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: formatZodError(body.error) });
    return;
  }

  const lojaId = requireLojaId(req, res);
  if (!lojaId) return;

  const [veiculo] = await db
    .select({ id: veiculos.id })
    .from(veiculos)
    .where(and(eq(veiculos.id, params.data.veiculoId), eq(veiculos.lojaId, lojaId)))
    .limit(1);

  if (!veiculo) {
    res.status(404).json({ error: "Veículo não encontrado" });
    return;
  }

  const [despesa] = await db
    .insert(veiculoDespesas)
    .values({
      veiculoId: veiculo.id,
      categoria: body.data.categoria as "manutencao_mecanica" | "manutencao_estetica" | "documentacao" | "outros",
      descricao: body.data.descricao,
      valor: String(body.data.valor),
      data: body.data.data,
    })
    .returning();

  res.status(201).json({
    id: despesa.id,
    veiculo_id: despesa.veiculoId,
    categoria: despesa.categoria,
    descricao: despesa.descricao,
    valor: despesa.valor,
    data: despesa.data,
    criado_em: despesa.criadoEm,
  });
});

// ─── DELETE /veiculos/:veiculoId/despesas/:despesaId ──────────────────────────
const DeleteDespesaParams = zod.object({
  veiculoId: zod.coerce.string().uuid(),
  despesaId: zod.coerce.string().uuid(),
});

router.delete("/veiculos/:veiculoId/despesas/:despesaId", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteDespesaParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: formatZodError(params.error) });
    return;
  }

  const lojaId = requireLojaId(req, res);
  if (!lojaId) return;

  const [veiculo] = await db
    .select({ id: veiculos.id })
    .from(veiculos)
    .where(and(eq(veiculos.id, params.data.veiculoId), eq(veiculos.lojaId, lojaId)))
    .limit(1);

  if (!veiculo) {
    res.status(404).json({ error: "Veículo não encontrado" });
    return;
  }

  const [deleted] = await db
    .delete(veiculoDespesas)
    .where(and(eq(veiculoDespesas.id, params.data.despesaId), eq(veiculoDespesas.veiculoId, veiculo.id)))
    .returning({ id: veiculoDespesas.id });

  if (!deleted) {
    res.status(404).json({ error: "Despesa não encontrada" });
    return;
  }

  res.json({ message: "Despesa removida" });
});

export default router;
