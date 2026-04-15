import { Router, type IRouter } from "express";
import { eq, count, desc, sql, inArray, and } from "drizzle-orm";
import { z } from "zod/v4";
import { db, lojas, usuarios, veiculos, conversas, ciclosBilling } from "@workspace/db";
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

    res.json({
      total_lojas_ativas: totalLojas,
      total_veiculos_ativos: totalVeiculos,
      total_conversas: totalConversas,
      receita_total: Number(receitaResult[0]?.total ?? 0),
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

        const [{ totalUsuarios }] = await db
          .select({ totalUsuarios: count() })
          .from(usuarios)
          .where(eq(usuarios.lojaId, loja.id));

        return {
          ...loja,
          veiculos_ativos: veiculosAtivos,
          total_conversas: totalConversas,
          total_usuarios: totalUsuarios,
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
      .limit(6);

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

export default router;
