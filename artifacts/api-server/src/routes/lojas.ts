import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq, and } from "drizzle-orm";
import { z } from "zod/v4";
import { db, lojas, usuarios } from "@workspace/db";
import {
  UpdateLojaBody,
  UpdateLojaParams,
  CreateVendedorBody,
  CreateVendedorParams,
  UpdateLojaResponse,
} from "@workspace/api-zod";
import { requireAuth, requirePerfil } from "../middlewares/auth";
import { formatZodError } from "../lib/errors";
import { getPlanoConfig } from "../lib/planos";

const router: IRouter = Router();

router.put(
  "/lojas/:lojaId",
  requireAuth,
  requirePerfil("dono", "admin_patioai"),
  async (req, res): Promise<void> => {
    const params = UpdateLojaParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: formatZodError(params.error) });
      return;
    }

    const body = UpdateLojaBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: formatZodError(body.error) });
      return;
    }

    const { lojaId } = params.data;

    if (
      req.user!.perfil !== "admin_patioai" &&
      req.user!.loja_id !== lojaId
    ) {
      res.status(403).json({ error: "Acesso negado a esta loja" });
      return;
    }

    const [lojaExistente] = await db
      .select()
      .from(lojas)
      .where(eq(lojas.id, lojaId))
      .limit(1);

    if (!lojaExistente) {
      res.status(404).json({ error: "Loja não encontrada" });
      return;
    }

    const cfg = getPlanoConfig(lojaExistente.plano);
    const CAMPOS_AVANCADOS = ["instrucoes_especificas", "descricao_garantia", "bancos_parceiros"] as const;

    if (!cfg.personalizacaoAvancada && req.user!.perfil !== "admin_patioai") {
      const tentouCampoAvancado = CAMPOS_AVANCADOS.some(
        (campo) => body.data[campo] !== undefined && body.data[campo] !== null && body.data[campo] !== "",
      );
      if (tentouCampoAvancado) {
        res.status(403).json({
          error: "Personalização avançada (instruções especiais, garantia personalizada e bancos parceiros) está disponível a partir do plano Pro. Faça upgrade para desbloquear.",
          codigo: "FEATURE_NAO_DISPONIVEL",
          plano_atual: lojaExistente.plano,
        });
        return;
      }
    }

    const updateData: Record<string, unknown> = {};
    if (body.data.razao_social !== undefined)
      updateData.razaoSocial = body.data.razao_social;
    if (body.data.nome_fantasia !== undefined)
      updateData.nomeFantasia = body.data.nome_fantasia;
    if (body.data.telefone !== undefined)
      updateData.telefone = body.data.telefone;
    if (body.data.email_contato !== undefined)
      updateData.emailContato = body.data.email_contato;
    if (body.data.cidade !== undefined) updateData.cidade = body.data.cidade;
    if (body.data.nome_agente !== undefined)
      updateData.nomeAgente = body.data.nome_agente;
    if (body.data.tom_agente !== undefined)
      updateData.tomAgente = body.data.tom_agente;
    if (body.data.horario_atendimento !== undefined)
      updateData.horarioAtendimento = body.data.horario_atendimento;
    if (body.data.instrucoes_especificas !== undefined)
      updateData.instrucoesEspecificas = body.data.instrucoes_especificas;
    if (body.data.aceita_troca !== undefined)
      updateData.aceitaTroca = body.data.aceita_troca;
    if (body.data.descricao_garantia !== undefined)
      updateData.descricaoGarantia = body.data.descricao_garantia;
    if (body.data.bancos_parceiros !== undefined)
      updateData.bancosParceiros = body.data.bancos_parceiros;
    if (body.data.mencionar_tempo_patio !== undefined)
      updateData.mencionarTempoPatio = body.data.mencionar_tempo_patio;

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ error: "Nenhum campo para atualizar" });
      return;
    }

    const [lojaAtualizada] = await db
      .update(lojas)
      .set(updateData)
      .where(eq(lojas.id, lojaId))
      .returning();

    const data = UpdateLojaResponse.parse({
      id: lojaAtualizada.id,
      razao_social: lojaAtualizada.razaoSocial,
      nome_fantasia: lojaAtualizada.nomeFantasia,
      cnpj: lojaAtualizada.cnpj,
      telefone: lojaAtualizada.telefone,
      email_contato: lojaAtualizada.emailContato,
      cidade: lojaAtualizada.cidade,
      plano: lojaAtualizada.plano,
      ativo: lojaAtualizada.ativo,
      nome_agente: lojaAtualizada.nomeAgente,
      tom_agente: lojaAtualizada.tomAgente,
      horario_atendimento: lojaAtualizada.horarioAtendimento,
      instrucoes_especificas: lojaAtualizada.instrucoesEspecificas,
      aceita_troca: lojaAtualizada.aceitaTroca,
      descricao_garantia: lojaAtualizada.descricaoGarantia,
      bancos_parceiros: lojaAtualizada.bancosParceiros,
      mencionar_tempo_patio: lojaAtualizada.mencionarTempoPatio,
      criado_em: lojaAtualizada.criadoEm,
    });

    req.log.info({ lojaId }, "Loja atualizada");
    res.json(data);
  },
);

router.post(
  "/lojas/:lojaId/usuarios",
  requireAuth,
  requirePerfil("dono", "admin_patioai"),
  async (req, res): Promise<void> => {
    const params = CreateVendedorParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: formatZodError(params.error) });
      return;
    }

    const body = CreateVendedorBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: formatZodError(body.error) });
      return;
    }

    const { lojaId } = params.data;

    if (
      req.user!.perfil !== "admin_patioai" &&
      req.user!.loja_id !== lojaId
    ) {
      res.status(403).json({ error: "Acesso negado a esta loja" });
      return;
    }

    const [lojaExistente] = await db
      .select({ id: lojas.id, plano: lojas.plano })
      .from(lojas)
      .where(eq(lojas.id, lojaId))
      .limit(1);

    if (!lojaExistente) {
      res.status(404).json({ error: "Loja não encontrada" });
      return;
    }


    const emailNormalizado = body.data.email.toLowerCase();
    const [emailExistente] = await db
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(eq(usuarios.email, emailNormalizado))
      .limit(1);

    if (emailExistente) {
      res.status(409).json({ error: "Email já cadastrado" });
      return;
    }

    const senhaHash = await bcrypt.hash(body.data.senha, 12);

    const [novoUsuario] = await db
      .insert(usuarios)
      .values({
        lojaId,
        nome: body.data.nome,
        email: emailNormalizado,
        senhaHash,
        perfil: "vendedor",
        ativo: true,
      })
      .returning();

    const data = {
      id: novoUsuario.id,
      nome: novoUsuario.nome,
      email: novoUsuario.email,
      perfil: novoUsuario.perfil,
      loja_id: novoUsuario.lojaId,
    };

    req.log.info({ lojaId, usuarioId: novoUsuario.id }, "Vendedor criado");
    res.status(201).json(data);
  },
);

const ListUsuariosParams = z.object({ lojaId: z.string().uuid() });
const DeleteUsuarioParams = z.object({
  lojaId: z.string().uuid(),
  usuarioId: z.string().uuid(),
});

router.get(
  "/lojas/:lojaId/usuarios",
  requireAuth,
  requirePerfil("dono", "admin_patioai"),
  async (req, res): Promise<void> => {
    const params = ListUsuariosParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "lojaId inválido" });
      return;
    }
    const { lojaId } = params.data;
    if (req.user!.perfil !== "admin_patioai" && req.user!.loja_id !== lojaId) {
      res.status(403).json({ error: "Acesso negado a esta loja" });
      return;
    }
    const rows = await db
      .select({
        id: usuarios.id,
        nome: usuarios.nome,
        email: usuarios.email,
        perfil: usuarios.perfil,
        loja_id: usuarios.lojaId,
        ativo: usuarios.ativo,
        criado_em: usuarios.criadoEm,
      })
      .from(usuarios)
      .where(eq(usuarios.lojaId, lojaId))
      .orderBy(usuarios.criadoEm);
    res.json(rows);
  },
);

router.delete(
  "/lojas/:lojaId/usuarios/:usuarioId",
  requireAuth,
  requirePerfil("dono", "admin_patioai"),
  async (req, res): Promise<void> => {
    const params = DeleteUsuarioParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Parâmetros inválidos" });
      return;
    }
    const { lojaId, usuarioId } = params.data;
    if (req.user!.perfil !== "admin_patioai" && req.user!.loja_id !== lojaId) {
      res.status(403).json({ error: "Acesso negado a esta loja" });
      return;
    }
    if (req.user!.id === usuarioId) {
      res.status(400).json({ error: "Não é possível remover o próprio usuário" });
      return;
    }
    const [existing] = await db
      .select({ id: usuarios.id, perfil: usuarios.perfil })
      .from(usuarios)
      .where(and(eq(usuarios.id, usuarioId), eq(usuarios.lojaId, lojaId)))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Usuário não encontrado" });
      return;
    }
    if (existing.perfil === "dono" && req.user!.perfil !== "admin_patioai") {
      res.status(403).json({ error: "Não é possível remover o dono da loja" });
      return;
    }
    await db.delete(usuarios).where(eq(usuarios.id, usuarioId));
    res.json({ message: "Usuário removido com sucesso" });
  },
);

export default router;
