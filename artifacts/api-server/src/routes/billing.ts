import { Router, type IRouter } from "express";
import { eq, and, desc, count, gte, inArray } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  lojas,
  veiculos,
  conversas,
  ciclosBilling,
  eventosBilling,
} from "@workspace/db";
import { requireAuth, requirePerfil } from "../middlewares/auth";
import { formatZodError } from "../lib/errors";
import { PLANOS_CONFIG, getPlanoConfig, getInicioMesAtual } from "../lib/planos";

const router: IRouter = Router();

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
    conversas_incluidas: c.conversasIncluidas,
    conversas_usadas: c.conversasUsadas,
    conversas_excedentes: c.conversasExcedentes,
    valor_base: Number(c.valorBase),
    valor_excedente: Number(c.valorExcedente),
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

async function contarConversasMes(lojaId: string, inicioMes: Date): Promise<number> {
  const veiculosDaLoja = await db
    .select({ id: veiculos.id })
    .from(veiculos)
    .where(eq(veiculos.lojaId, lojaId));
  const ids = veiculosDaLoja.map((v) => v.id);
  if (ids.length === 0) return 0;
  const veiculoFilter = ids.length === 1
    ? eq(conversas.veiculoId, ids[0])
    : inArray(conversas.veiculoId, ids);
  const [{ total }] = await db
    .select({ total: count() })
    .from(conversas)
    .where(and(veiculoFilter, gte(conversas.iniciadaEm, inicioMes)));
  return total;
}

router.get(
  "/billing/faturas",
  requireAuth,
  requirePerfil("dono"),
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
  requirePerfil("dono"),
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

    const cfg = getPlanoConfig(loja.plano);
    const inicioMes = getInicioMesAtual();
    const conversasUsadas = await contarConversasMes(lojaId, inicioMes);
    const conversasExcedentes = Math.max(0, conversasUsadas - cfg.conversasIncluidas);
    const valorBase = cfg.precoUnitario;
    const valorExcedente = conversasExcedentes * cfg.precoExcedente;
    const valorTotal = valorBase + valorExcedente;

    const now = new Date();
    const mesRef = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    const [cicloExistente] = await db
      .select()
      .from(ciclosBilling)
      .where(and(eq(ciclosBilling.lojaId, lojaId), eq(ciclosBilling.mesRef, mesRef)))
      .limit(1);

    const vencimento = new Date(now.getFullYear(), now.getMonth() + 1, 10);

    const pctCota = Math.round((conversasUsadas / cfg.conversasIncluidas) * 100);

    res.json({
      mes_ref: mesRef,
      plano: loja.plano,
      conversas_incluidas: cfg.conversasIncluidas,
      conversas_usadas: conversasUsadas,
      conversas_excedentes: conversasExcedentes,
      buffer_excedente: cfg.bufferExcedente,
      preco_excedente: cfg.precoExcedente,
      pct_cota: pctCota,
      valor_base: valorBase,
      valor_excedente: valorExcedente,
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
  requirePerfil("dono"),
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
    const inicioMes = getInicioMesAtual();

    const todasLojas = await db
      .select({ id: lojas.id, plano: lojas.plano })
      .from(lojas)
      .where(eq(lojas.ativo, true));

    const resultados: Array<{ loja_id: string; status: string }> = [];

    for (const loja of todasLojas) {
      const cfg = getPlanoConfig(loja.plano);
      const conversasUsadas = await contarConversasMes(loja.id, inicioMes);
      const conversasExcedentes = Math.max(0, conversasUsadas - cfg.conversasIncluidas);
      const valorBase = cfg.precoUnitario;
      const valorExcedente = conversasExcedentes * cfg.precoExcedente;
      const valorTotal = valorBase + valorExcedente;

      const inserted = await db
        .insert(ciclosBilling)
        .values({
          lojaId: loja.id,
          mesRef,
          conversasIncluidas: cfg.conversasIncluidas,
          conversasUsadas: conversasUsadas,
          conversasExcedentes: conversasExcedentes,
          valorBase: String(valorBase),
          valorExcedente: String(valorExcedente),
          valorTotal: String(valorTotal),
          status: "aberto",
        })
        .onConflictDoNothing()
        .returning({ id: ciclosBilling.id });

      if (inserted.length > 0) {
        resultados.push({ loja_id: loja.id, status: "criado" });
      } else {
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
