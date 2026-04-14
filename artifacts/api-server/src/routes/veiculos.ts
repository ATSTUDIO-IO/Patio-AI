import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, veiculos, qrcodes, lojas, eventosBilling } from "@workspace/db";
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
import { requireAuth } from "../middlewares/auth";
import { formatZodError } from "../lib/errors";
import {
  gerarSlug,
  gerarUrlPublica,
  gerarImagemQr,
  gerarQrPng,
} from "../lib/qrcode";

const router: IRouter = Router();

function mapVeiculo(v: typeof veiculos.$inferSelect, qr?: typeof qrcodes.$inferSelect | null) {
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
    criado_em: v.criadoEm,
    vendido_em: v.vendidoEm,
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

router.get("/veiculos", requireAuth, async (req, res): Promise<void> => {
  const query = ListVeiculosQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: formatZodError(query.error) });
    return;
  }

  const lojaId = req.user!.loja_id;
  if (!lojaId) {
    res.status(403).json({ error: "Usuário sem loja associada" });
    return;
  }

  const conditions = [eq(veiculos.lojaId, lojaId)];
  if (query.data.status) {
    conditions.push(
      eq(veiculos.status, query.data.status as "ativo" | "vendido" | "pausado"),
    );
  }

  const rows = await db
    .select()
    .from(veiculos)
    .where(and(...conditions))
    .orderBy(veiculos.criadoEm);

  const ids = rows.map((v) => v.id);
  const qrRows =
    ids.length > 0
      ? await db.select().from(qrcodes).where(
          sql`${qrcodes.veiculoId} = ANY(ARRAY[${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)}])`,
        )
      : [];

  const qrByVeiculo = Object.fromEntries(qrRows.map((q) => [q.veiculoId, q]));

  res.json(rows.map((v) => mapVeiculo(v, qrByVeiculo[v.id])));
});

router.post("/veiculos", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateVeiculoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  const lojaId = req.user!.loja_id;
  if (!lojaId) {
    res.status(403).json({ error: "Usuário sem loja associada" });
    return;
  }

  const placaNormalizada = parsed.data.placa.toUpperCase().replace(/[^A-Z0-9]/g, "");

  const [placaExistente] = await db
    .select({ id: veiculos.id })
    .from(veiculos)
    .where(and(eq(veiculos.lojaId, lojaId), eq(veiculos.placa, placaNormalizada)))
    .limit(1);

  if (placaExistente) {
    res.status(409).json({ error: "Placa já cadastrada nesta loja" });
    return;
  }

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
      })
      .returning();

    const slug = gerarSlug(veiculo.modelo, veiculo.anoFabricacao);
    const urlPublica = gerarUrlPublica(slug);
    const imagemQr = await gerarImagemQr(urlPublica);

    const [qr] = await tx
      .insert(qrcodes)
      .values({
        veiculoId: veiculo.id,
        slug,
        urlPublica,
        imagemQr,
        ativo: true,
      })
      .returning();

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

router.get(
  "/veiculos/:veiculoId",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = GetVeiculoParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: formatZodError(params.error) });
      return;
    }

    const lojaId = req.user!.loja_id;
    const conditions = [eq(veiculos.id, params.data.veiculoId)];
    if (lojaId) conditions.push(eq(veiculos.lojaId, lojaId));

    const [veiculo] = await db.select().from(veiculos).where(and(...conditions)).limit(1);

    if (!veiculo) {
      res.status(404).json({ error: "Veículo não encontrado" });
      return;
    }

    const [qr] = await db
      .select()
      .from(qrcodes)
      .where(eq(qrcodes.veiculoId, veiculo.id))
      .limit(1);

    res.json(mapVeiculo(veiculo, qr ?? null));
  },
);

router.put(
  "/veiculos/:veiculoId",
  requireAuth,
  async (req, res): Promise<void> => {
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

    const lojaId = req.user!.loja_id;
    const conditions = [eq(veiculos.id, params.data.veiculoId)];
    if (lojaId) conditions.push(eq(veiculos.lojaId, lojaId));

    const [veiculoExistente] = await db
      .select()
      .from(veiculos)
      .where(and(...conditions))
      .limit(1);

    if (!veiculoExistente) {
      res.status(404).json({ error: "Veículo não encontrado" });
      return;
    }

    const updateData: Record<string, unknown> = {};
    const d = body.data;
    if (d.placa !== undefined) updateData.placa = d.placa.toUpperCase().replace(/[^A-Z0-9]/g, "");
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
  },
);

router.patch(
  "/veiculos/:veiculoId/status",
  requireAuth,
  async (req, res): Promise<void> => {
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

    const lojaId = req.user!.loja_id;
    const conditions = [eq(veiculos.id, params.data.veiculoId)];
    if (lojaId) conditions.push(eq(veiculos.lojaId, lojaId));

    const [veiculoExistente] = await db
      .select()
      .from(veiculos)
      .where(and(...conditions))
      .limit(1);

    if (!veiculoExistente) {
      res.status(404).json({ error: "Veículo não encontrado" });
      return;
    }

    const novoStatus = body.data.status as "ativo" | "vendido" | "pausado";
    const motivo = body.data.motivo ?? null;

    const { veiculoAtualizado, qrAtualizado } = await db.transaction(async (tx) => {
      const veiculoUpdate: Record<string, unknown> = { status: novoStatus };

      if (novoStatus === "vendido") {
        veiculoUpdate.ativoAgente = false;
        veiculoUpdate.vendidoEm = new Date();
      } else if (novoStatus === "pausado") {
        veiculoUpdate.ativoAgente = false;
      } else if (novoStatus === "ativo") {
        veiculoUpdate.ativoAgente = true;
        veiculoUpdate.vendidoEm = null;
      }

      const [veiculoAtualizado] = await tx
        .update(veiculos)
        .set(veiculoUpdate)
        .where(eq(veiculos.id, params.data.veiculoId))
        .returning();

      let qrAtualizado: typeof qrcodes.$inferSelect | null = null;

      if (novoStatus === "pausado" || novoStatus === "vendido") {
        const tipoBilling = novoStatus === "vendido" ? "baixa" : "pausa";

        await tx.insert(eventosBilling).values({
          lojaId: veiculoAtualizado.lojaId,
          veiculoId: veiculoAtualizado.id,
          tipo: tipoBilling as "baixa" | "pausa",
          motivo,
        });

        if (novoStatus === "pausado") {
          const [qr] = await tx
            .update(qrcodes)
            .set({ ativo: false })
            .where(eq(qrcodes.veiculoId, veiculoAtualizado.id))
            .returning();
          qrAtualizado = qr ?? null;
        }
      } else if (novoStatus === "ativo") {
        await tx.insert(eventosBilling).values({
          lojaId: veiculoAtualizado.lojaId,
          veiculoId: veiculoAtualizado.id,
          tipo: "ativacao",
          motivo: motivo ?? "Veículo reativado",
        });

        const [qr] = await tx
          .update(qrcodes)
          .set({ ativo: true })
          .where(eq(qrcodes.veiculoId, veiculoAtualizado.id))
          .returning();
        qrAtualizado = qr ?? null;
      }

      if (!qrAtualizado) {
        const [qr] = await tx
          .select()
          .from(qrcodes)
          .where(eq(qrcodes.veiculoId, veiculoAtualizado.id))
          .limit(1);
        qrAtualizado = qr ?? null;
      }

      return { veiculoAtualizado, qrAtualizado };
    });

    req.log.info(
      { veiculoId: veiculoAtualizado.id, status: novoStatus },
      "Status do veículo atualizado",
    );
    res.json(mapVeiculo(veiculoAtualizado, qrAtualizado));
  },
);

router.get(
  "/veiculos/:veiculoId/qr",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = GetVeiculoQrParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: formatZodError(params.error) });
      return;
    }

    const lojaId = req.user!.loja_id;
    const conditions = [eq(veiculos.id, params.data.veiculoId)];
    if (lojaId) conditions.push(eq(veiculos.lojaId, lojaId));

    const [veiculo] = await db
      .select({ id: veiculos.id })
      .from(veiculos)
      .where(and(...conditions))
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
  },
);

export default router;
