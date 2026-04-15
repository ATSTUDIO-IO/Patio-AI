import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, veiculos, qrcodes, eventosBilling, lojas } from "@workspace/db";
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

const router: IRouter = Router();


function mapVeiculo(
  v: typeof veiculos.$inferSelect,
  qr?: typeof qrcodes.$inferSelect | null,
) {
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

  const lojaId = requireLojaId(req, res);
  if (!lojaId) return;

  const conditions = [eq(veiculos.lojaId, lojaId)];
  if (query.data.status) {
    conditions.push(
      eq(
        veiculos.status,
        query.data.status as "ativo" | "vendido" | "pausado",
      ),
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
  res.json(rows.map((v) => mapVeiculo(v, qrByVeiculo[v.id])));
});

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
        cambio: (parsed.data.cambio ?? null) as
          | "manual"
          | "automatico"
          | "cvt"
          | null,
        combustivel: (parsed.data.combustivel ?? null) as
          | "flex"
          | "gasolina"
          | "diesel"
          | "eletrico"
          | null,
        opcionais: parsed.data.opcionais ?? null,
        descricaoAgente: parsed.data.descricao_agente ?? null,
        status: "ativo",
        ativoAgente: true,
      })
      .returning();

    const MAX_SLUG_TENTATIVAS = 5;
    let qr: typeof qrcodes.$inferSelect | undefined;
    for (let i = 0; i < MAX_SLUG_TENTATIVAS; i++) {
      const slug = gerarSlugCandidatos(
        veiculo.modelo,
        veiculo.anoFabricacao,
        1,
      )[0];
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
        if (pgErr?.code === "23505" && i < MAX_SLUG_TENTATIVAS - 1) {
          continue;
        }
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

router.get(
  "/veiculos/:veiculoId",
  requireAuth,
  async (req, res): Promise<void> => {
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
      .where(
        and(
          eq(veiculos.id, params.data.veiculoId),
          eq(veiculos.lojaId, lojaId),
        ),
      )
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

    const lojaId = requireLojaId(req, res);
    if (!lojaId) return;

    const [veiculoExistente] = await db
      .select()
      .from(veiculos)
      .where(
        and(
          eq(veiculos.id, params.data.veiculoId),
          eq(veiculos.lojaId, lojaId),
        ),
      )
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
          .where(
            and(
              eq(veiculos.lojaId, lojaId),
              eq(veiculos.placa, placaNova),
            ),
          )
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
    if (d.descricao_agente !== undefined)
      updateData.descricaoAgente = d.descricao_agente;
    if (d.ativo_agente !== undefined) {
      updateData.ativoAgente = d.ativo_agente;
    }

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

    const lojaId = requireLojaId(req, res);
    if (!lojaId) return;

    const [veiculoExistente] = await db
      .select()
      .from(veiculos)
      .where(
        and(
          eq(veiculos.id, params.data.veiculoId),
          eq(veiculos.lojaId, lojaId),
        ),
      )
      .limit(1);

    if (!veiculoExistente) {
      res.status(404).json({ error: "Veículo não encontrado" });
      return;
    }

    const novoStatus = body.data.status as "ativo" | "vendido" | "pausado";
    const motivo = body.data.motivo ?? null;

    const { veiculoAtualizado, qrAtualizado } = await db.transaction(
      async (tx) => {
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

        let tipoBilling: "ativacao" | "baixa" | "pausa" | null = null;
        let qrAtivo: boolean | null = null;

        if (novoStatus === "vendido") {
          tipoBilling = "baixa";
          qrAtivo = true;
        } else if (novoStatus === "pausado") {
          tipoBilling = "pausa";
          qrAtivo = false;
        } else if (novoStatus === "ativo") {
          tipoBilling = "ativacao";
          qrAtivo = true;
        }

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
      },
    );

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

    const lojaId = requireLojaId(req, res);
    if (!lojaId) return;

    const [veiculo] = await db
      .select({ id: veiculos.id })
      .from(veiculos)
      .where(
        and(
          eq(veiculos.id, params.data.veiculoId),
          eq(veiculos.lojaId, lojaId),
        ),
      )
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

router.get(
  "/veiculos/:veiculoId/consulta-documental",
  requireAuth,
  async (req, res): Promise<void> => {
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
        error: "Consulta documental está disponível a partir do plano Pro. Faça upgrade para acessar esta funcionalidade.",
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
      sinistros: {
        status: "pendente_integracao",
        ocorrencias: null,
      },
      historico_leilao: {
        status: "pendente_integracao",
        participou_leilao: null,
      },
      restricoes: {
        financiamento: { status: "pendente_integracao", bloqueado: null },
        judicial: { status: "pendente_integracao", bloqueado: null },
        roubo_furto: { status: "pendente_integracao", bloqueado: null },
      },
    });
  },
);

export default router;
