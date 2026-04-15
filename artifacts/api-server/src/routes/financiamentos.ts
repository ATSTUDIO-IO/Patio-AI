import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { z } from "zod/v4";
import { db, financiamentos, veiculos, qrcodes } from "@workspace/db";
import { requireAuth, requirePerfil } from "../middlewares/auth";
import { formatZodError } from "../lib/errors";
import { simular } from "../lib/simulator";

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
  requirePerfil("dono", "admin_patioai"),
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
  requirePerfil("dono", "admin_patioai"),
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

router.delete(
  "/financiamentos/:financiamentoId",
  requireAuth,
  requirePerfil("dono", "admin_patioai"),
  async (req, res): Promise<void> => {
    const params = FinanciamentoIdParam.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: formatZodError(params.error) });
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

    await db
      .delete(financiamentos)
      .where(eq(financiamentos.id, params.data.financiamentoId));

    res.status(204).send();
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

    const resultado = await simular({
      lojaId: veiculo.lojaId,
      precoVenda,
      entradaPct: entrada_pct,
      nParcelas: n_parcelas,
      financiamentoId: financiamento_id,
    });

    res.json(resultado);
  },
);

export default router;
