import { Router, type IRouter } from "express";
import { eq, and, desc, count } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  lojas,
  veiculos,
  ciclosBilling,
  eventosBilling,
} from "@workspace/db";
import { requireAuth, requirePerfil } from "../middlewares/auth";
import { formatZodError } from "../lib/errors";

const router: IRouter = Router();

const PRECOS: Record<string, number> = {
  starter: 30,
  pro: 50,
  full: 75,
};

function requireLojaIdDono(
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

function mapCiclo(c: typeof ciclosBilling.$inferSelect) {
  return {
    id: c.id,
    mes_ref: c.mesRef,
    veiculos_ativos: c.veiculosAtivos,
    preco_unitario: Number(c.precoUnitario),
    valor_total: Number(c.valorTotal),
    status: c.status,
    gerado_em: c.geradoEm,
    pago_em: c.pagoEm,
  };
}

function mapEvento(
  e: typeof eventosBilling.$inferSelect & { veiculo_marca?: string | null; veiculo_modelo?: string | null },
) {
  return {
    id: e.id,
    veiculo_id: e.veiculoId,
    veiculo_descricao: e.veiculo_marca && e.veiculo_modelo ? `${e.veiculo_marca} ${e.veiculo_modelo}` : null,
    tipo: e.tipo,
    ocorrido_em: e.ocorridoEm,
    motivo: e.motivo,
  };
}

router.get(
  "/billing/faturas",
  requireAuth,
  requirePerfil("dono", "admin_patioai"),
  async (req, res): Promise<void> => {
    const lojaId = requireLojaIdDono(req, res);
    if (!lojaId) return;

    const rows = await db
      .select()
      .from(ciclosBilling)
      .where(eq(ciclosBilling.lojaId, lojaId))
      .orderBy(desc(ciclosBilling.mesRef))
      .limit(12);

    res.json(rows.map(mapCiclo));
  },
);

router.get(
  "/billing/atual",
  requireAuth,
  requirePerfil("dono", "admin_patioai"),
  async (req, res): Promise<void> => {
    const lojaId = requireLojaIdDono(req, res);
    if (!lojaId) return;

    const [loja] = await db
      .select({ plano: lojas.plano })
      .from(lojas)
      .where(eq(lojas.id, lojaId))
      .limit(1);

    if (!loja) {
      res.status(404).json({ error: "Loja não encontrada" });
      return;
    }

    const [{ value: veiculosAtivos }] = await db
      .select({ value: count() })
      .from(veiculos)
      .where(and(eq(veiculos.lojaId, lojaId), eq(veiculos.status, "ativo")));

    const now = new Date();
    const mesRef = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const precoUnitario = PRECOS[loja.plano] ?? 30;
    const valorTotal = veiculosAtivos * precoUnitario;

    const [cicloExistente] = await db
      .select()
      .from(ciclosBilling)
      .where(and(eq(ciclosBilling.lojaId, lojaId), eq(ciclosBilling.mesRef, mesRef)))
      .limit(1);

    const vencimento = new Date(now.getFullYear(), now.getMonth() + 1, 10);

    res.json({
      mes_ref: mesRef,
      plano: loja.plano,
      veiculos_ativos: veiculosAtivos,
      preco_unitario: precoUnitario,
      valor_total: valorTotal,
      status: cicloExistente?.status ?? "aberto",
      vencimento: vencimento.toISOString().split("T")[0],
      ciclo_id: cicloExistente?.id ?? null,
    });
  },
);

router.get(
  "/billing/eventos",
  requireAuth,
  requirePerfil("dono", "admin_patioai"),
  async (req, res): Promise<void> => {
    const lojaId = requireLojaIdDono(req, res);
    if (!lojaId) return;

    const schema = z.object({
      limit: z.coerce.number().int().min(1).max(200).default(50),
      offset: z.coerce.number().int().min(0).default(0),
    });
    const query = schema.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({ error: formatZodError(query.error) });
      return;
    }

    const rows = await db
      .select({
        id: eventosBilling.id,
        veiculoId: eventosBilling.veiculoId,
        tipo: eventosBilling.tipo,
        ocorridoEm: eventosBilling.ocorridoEm,
        motivo: eventosBilling.motivo,
        veiculo_marca: veiculos.marca,
        veiculo_modelo: veiculos.modelo,
      })
      .from(eventosBilling)
      .leftJoin(veiculos, eq(eventosBilling.veiculoId, veiculos.id))
      .where(eq(eventosBilling.lojaId, lojaId))
      .orderBy(desc(eventosBilling.ocorridoEm))
      .limit(query.data.limit)
      .offset(query.data.offset);

    res.json(
      rows.map((r) =>
        mapEvento({
          id: r.id,
          lojaId,
          veiculoId: r.veiculoId,
          tipo: r.tipo,
          ocorridoEm: r.ocorridoEm,
          motivo: r.motivo,
          veiculo_marca: r.veiculo_marca,
          veiculo_modelo: r.veiculo_modelo,
        }),
      ),
    );
  },
);

router.post(
  "/billing/fechar",
  requireAuth,
  requirePerfil("admin_patioai"),
  async (_req, res): Promise<void> => {
    const now = new Date();
    const mesRef = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    const todasLojas = await db
      .select({ id: lojas.id, plano: lojas.plano })
      .from(lojas)
      .where(eq(lojas.ativo, true));

    const resultados: Array<{ loja_id: string; status: string }> = [];

    for (const loja of todasLojas) {
      const [{ value: veiculosAtivos }] = await db
        .select({ value: count() })
        .from(veiculos)
        .where(and(eq(veiculos.lojaId, loja.id), eq(veiculos.status, "ativo")));

      const precoUnitario = PRECOS[loja.plano] ?? 30;
      const valorTotal = veiculosAtivos * precoUnitario;

      try {
        await db
          .insert(ciclosBilling)
          .values({
            lojaId: loja.id,
            mesRef,
            veiculosAtivos: veiculosAtivos,
            precoUnitario: String(precoUnitario),
            valorTotal: String(valorTotal),
            status: "aberto",
          })
          .onConflictDoNothing();
        resultados.push({ loja_id: loja.id, status: "criado" });
      } catch {
        resultados.push({ loja_id: loja.id, status: "ja_existia" });
      }
    }

    res.json({
      mes_ref: mesRef,
      lojas_processadas: todasLojas.length,
      resultados,
    });
  },
);

export default router;
