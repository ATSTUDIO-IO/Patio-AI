import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
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
      .select({ id: lojas.id })
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

export default router;
