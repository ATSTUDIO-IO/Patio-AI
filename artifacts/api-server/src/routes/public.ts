import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, qrcodes, veiculos, lojas } from "@workspace/db";
import { GetVeiculoPublicoParams } from "@workspace/api-zod";
import { formatZodError } from "../lib/errors";

const router: IRouter = Router();

const DIAS_QR_VENDIDO = 30;

router.get("/v/:slug", async (req, res): Promise<void> => {
  const params = GetVeiculoPublicoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: formatZodError(params.error) });
    return;
  }

  const [qr] = await db
    .select()
    .from(qrcodes)
    .where(eq(qrcodes.slug, params.data.slug))
    .limit(1);

  if (!qr) {
    res.status(404).json({ error: "QR code não encontrado" });
    return;
  }

  const [veiculo] = await db
    .select()
    .from(veiculos)
    .where(eq(veiculos.id, qr.veiculoId))
    .limit(1);

  if (!veiculo) {
    res.status(404).json({ error: "Veículo não encontrado" });
    return;
  }

  const [loja] = await db
    .select({
      nome_fantasia: lojas.nomeFantasia,
      cidade: lojas.cidade,
      telefone: lojas.telefone,
    })
    .from(lojas)
    .where(eq(lojas.id, veiculo.lojaId))
    .limit(1);

  await db
    .update(qrcodes)
    .set({ totalScans: sql`${qrcodes.totalScans} + 1` })
    .where(eq(qrcodes.id, qr.id));

  if (veiculo.status === "vendido" && veiculo.vendidoEm) {
    const diasDesdeVenda = Math.floor(
      (Date.now() - veiculo.vendidoEm.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diasDesdeVenda <= DIAS_QR_VENDIDO) {
      res.json({
        disponivel: false,
        veiculo: null,
        loja: loja ?? null,
        mensagem: `Este veículo já foi vendido. Conheça outros modelos disponíveis na ${loja?.nome_fantasia ?? "nossa loja"}.`,
      });
      return;
    }

    res.status(404).json({ error: "QR code inativo" });
    return;
  }

  if (veiculo.status === "pausado" || !qr.ativo) {
    res.json({
      disponivel: false,
      veiculo: null,
      loja: loja ?? null,
      mensagem: "Este veículo não está disponível no momento.",
    });
    return;
  }

  res.json({
    disponivel: true,
    veiculo: {
      id: veiculo.id,
      marca: veiculo.marca,
      modelo: veiculo.modelo,
      ano_fabricacao: veiculo.anoFabricacao,
      ano_modelo: veiculo.anoModelo,
      quilometragem: veiculo.quilometragem,
      preco_venda: veiculo.precoVenda,
      cor: veiculo.cor,
      cambio: veiculo.cambio,
      combustivel: veiculo.combustivel,
      opcionais: veiculo.opcionais,
      slug: qr.slug,
    },
    loja: loja ?? null,
    mensagem: null,
  });
});

export default router;
