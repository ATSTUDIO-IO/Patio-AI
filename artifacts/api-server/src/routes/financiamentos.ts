import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { z } from "zod/v4";
import { db, financiamentos, veiculos, qrcodes } from "@workspace/db";
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

const CreateFinanciamentoBody = z.object({
  banco: z.string().min(1, "Banco obrigatório"),
  modalidade: z.enum(["CDC", "consorcio", "leasing"]),
  taxa_mensal: z.number().positive("Taxa mensal deve ser positiva"),
  parcelas_min: z.number().int().min(1).default(12),
  parcelas_max: z.number().int().min(1).max(360).default(60),
  entrada_min_pct: z.number().min(0).max(100).default(20),
  ativo: z.boolean().default(true),
});

const UpdateFinanciamentoBody = CreateFinanciamentoBody.partial();

const FinanciamentoIdParam = z.object({
  financiamentoId: z.string().uuid("financiamentoId deve ser UUID"),
});

const SimularBody = z.object({
  veiculo_id: z.string().uuid("veiculo_id deve ser UUID"),
  slug: z.string().min(1, "slug obrigatório"),
  entrada_pct: z.number().min(0).max(100).default(20),
  n_parcelas: z.number().int().min(1).max(360).default(48),
  financiamento_id: z.string().uuid().optional(),
});

function calcularParcela(
  precoVenda: number,
  entradaPct: number,
  nParcelas: number,
  taxaMensal: number,
): number {
  const valorFinanciado = precoVenda * (1 - entradaPct / 100);
  const taxa = taxaMensal / 100;

  if (taxa === 0) {
    return valorFinanciado / nParcelas;
  }

  const fator = Math.pow(1 + taxa, nParcelas);
  return (valorFinanciado * (taxa * fator)) / (fator - 1);
}

function mapFinanciamento(f: typeof financiamentos.$inferSelect) {
  return {
    id: f.id,
    banco: f.banco,
    modalidade: f.modalidade,
    taxa_mensal: Number(f.taxaMensal),
    parcelas_min: f.parcelasMin,
    parcelas_max: f.parcelasMax,
    entrada_min_pct: Number(f.entradaMinPct),
    ativo: f.ativo,
  };
}

router.get(
  "/financiamentos",
  requireAuth,
  async (req, res): Promise<void> => {
    const lojaId = requireLojaId(req, res);
    if (!lojaId) return;

    const rows = await db
      .select()
      .from(financiamentos)
      .where(eq(financiamentos.lojaId, lojaId));

    res.json(rows.map(mapFinanciamento));
  },
);

router.post(
  "/financiamentos",
  requireAuth,
  async (req, res): Promise<void> => {
    const lojaId = requireLojaId(req, res);
    if (!lojaId) return;

    const body = CreateFinanciamentoBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: formatZodError(body.error) });
      return;
    }

    const [created] = await db
      .insert(financiamentos)
      .values({
        lojaId,
        banco: body.data.banco,
        modalidade: body.data.modalidade,
        taxaMensal: String(body.data.taxa_mensal),
        parcelasMin: body.data.parcelas_min,
        parcelasMax: body.data.parcelas_max,
        entradaMinPct: String(body.data.entrada_min_pct),
        ativo: body.data.ativo,
      })
      .returning();

    res.status(201).json(mapFinanciamento(created));
  },
);

router.put(
  "/financiamentos/:financiamentoId",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = FinanciamentoIdParam.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: formatZodError(params.error) });
      return;
    }

    const body = UpdateFinanciamentoBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: formatZodError(body.error) });
      return;
    }

    const lojaId = requireLojaId(req, res);
    if (!lojaId) return;

    const [existing] = await db
      .select()
      .from(financiamentos)
      .where(
        and(
          eq(financiamentos.id, params.data.financiamentoId),
          eq(financiamentos.lojaId, lojaId),
        ),
      )
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Financiamento não encontrado" });
      return;
    }

    const updateData: Record<string, unknown> = {};
    const d = body.data;
    if (d.banco !== undefined) updateData.banco = d.banco;
    if (d.modalidade !== undefined) updateData.modalidade = d.modalidade;
    if (d.taxa_mensal !== undefined) updateData.taxaMensal = String(d.taxa_mensal);
    if (d.parcelas_min !== undefined) updateData.parcelasMin = d.parcelas_min;
    if (d.parcelas_max !== undefined) updateData.parcelasMax = d.parcelas_max;
    if (d.entrada_min_pct !== undefined) updateData.entradaMinPct = String(d.entrada_min_pct);
    if (d.ativo !== undefined) updateData.ativo = d.ativo;

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ error: "Nenhum campo para atualizar" });
      return;
    }

    const [updated] = await db
      .update(financiamentos)
      .set(updateData)
      .where(eq(financiamentos.id, params.data.financiamentoId))
      .returning();

    res.json(mapFinanciamento(updated));
  },
);

router.post(
  "/financiamentos/simular",
  async (req, res): Promise<void> => {
    const body = SimularBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: formatZodError(body.error) });
      return;
    }

    const { veiculo_id, slug, entrada_pct, n_parcelas, financiamento_id } = body.data;

    const [qr] = await db
      .select({ id: qrcodes.id, veiculoId: qrcodes.veiculoId })
      .from(qrcodes)
      .where(eq(qrcodes.slug, slug))
      .limit(1);

    if (!qr || qr.veiculoId !== veiculo_id) {
      res.status(404).json({ error: "Veículo ou slug não encontrado" });
      return;
    }

    const [veiculo] = await db
      .select({ precoVenda: veiculos.precoVenda, lojaId: veiculos.lojaId })
      .from(veiculos)
      .where(eq(veiculos.id, veiculo_id))
      .limit(1);

    if (!veiculo) {
      res.status(404).json({ error: "Veículo não encontrado" });
      return;
    }

    const precoVenda = Number(veiculo.precoVenda);

    let financiamento: typeof financiamentos.$inferSelect | null = null;

    if (financiamento_id) {
      const [found] = await db
        .select()
        .from(financiamentos)
        .where(
          and(
            eq(financiamentos.id, financiamento_id),
            eq(financiamentos.lojaId, veiculo.lojaId),
            eq(financiamentos.ativo, true),
          ),
        )
        .limit(1);
      financiamento = found ?? null;
    }

    if (!financiamento) {
      const [first] = await db
        .select()
        .from(financiamentos)
        .where(and(eq(financiamentos.lojaId, veiculo.lojaId), eq(financiamentos.ativo, true)))
        .limit(1);
      financiamento = first ?? null;
    }

    const taxaMensal = financiamento ? Number(financiamento.taxaMensal) : 1.5;
    const entradaMinPct = financiamento ? Number(financiamento.entradaMinPct) : 20;
    const entradaEfetiva = Math.max(entrada_pct, entradaMinPct);

    const parcelasMin = financiamento?.parcelasMin ?? 1;
    const parcelasMax = financiamento?.parcelasMax ?? 360;
    const nParcelasEfetivo = Math.min(Math.max(n_parcelas, parcelasMin), parcelasMax);

    const valorParcela = calcularParcela(precoVenda, entradaEfetiva, nParcelasEfetivo, taxaMensal);
    const valorEntrada = precoVenda * (entradaEfetiva / 100);
    const valorFinanciado = precoVenda - valorEntrada;

    const fmtBRL = (v: number) =>
      v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    res.json({
      preco_venda: precoVenda,
      entrada_pct: entradaEfetiva,
      valor_entrada: valorEntrada,
      valor_financiado: valorFinanciado,
      n_parcelas: nParcelasEfetivo,
      taxa_mensal: taxaMensal,
      valor_parcela: valorParcela,
      banco: financiamento?.banco ?? null,
      modalidade: financiamento?.modalidade ?? null,
      descricao: `Com ${entradaEfetiva}% de entrada (${fmtBRL(valorEntrada)}), em ${nParcelasEfetivo} parcelas${financiamento ? ` (${financiamento.banco} - ${financiamento.modalidade})` : ""}, você pagaria aproximadamente ${fmtBRL(valorParcela)} por mês.`,
    });
  },
);

export default router;
