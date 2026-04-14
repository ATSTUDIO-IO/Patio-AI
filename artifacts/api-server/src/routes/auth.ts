import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq, and } from "drizzle-orm";
import { db, lojas, usuarios, sessoes } from "@workspace/db";
import {
  RegisterLojaBody,
  LoginBody,
  GetMeResponse,
  LoginResponse,
  LogoutResponse,
} from "@workspace/api-zod";
import { requireAuth, signToken } from "../middlewares/auth";
import { formatZodError } from "../lib/errors";

const router: IRouter = Router();

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterLojaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  const { razao_social, nome_fantasia, cnpj, email, senha, telefone, cidade } =
    parsed.data;

  const cnpjNormalizado = cnpj.replace(/\D/g, "");

  const [lojaExistente] = await db
    .select({ id: lojas.id })
    .from(lojas)
    .where(eq(lojas.cnpj, cnpjNormalizado))
    .limit(1);

  if (lojaExistente) {
    res.status(409).json({ error: "CNPJ já cadastrado" });
    return;
  }

  const [emailExistente] = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(eq(usuarios.email, email.toLowerCase()))
    .limit(1);

  if (emailExistente) {
    res.status(409).json({ error: "Email já cadastrado" });
    return;
  }

  const senhaHash = await bcrypt.hash(senha, 12);

  const [loja] = await db
    .insert(lojas)
    .values({
      razaoSocial: razao_social,
      nomeFantasia: nome_fantasia,
      cnpj: cnpjNormalizado,
      emailContato: email.toLowerCase(),
      telefone: telefone ?? null,
      cidade: cidade ?? null,
      plano: "starter",
      ativo: true,
    })
    .returning();

  const [usuario] = await db
    .insert(usuarios)
    .values({
      lojaId: loja.id,
      nome: nome_fantasia,
      email: email.toLowerCase(),
      senhaHash,
      perfil: "dono",
      ativo: true,
    })
    .returning();

  const token = signToken({
    id: usuario.id,
    loja_id: loja.id,
    perfil: usuario.perfil,
  });

  await db.insert(sessoes).values({
    usuarioId: usuario.id,
    token,
    expiraEm: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  const responseData = LoginResponse.parse({
    token,
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
      loja_id: usuario.lojaId,
    },
  });

  req.log.info({ lojaId: loja.id }, "Nova loja registrada");
  res.status(201).json(responseData);
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: formatZodError(parsed.error) });
    return;
  }

  const { email, senha } = parsed.data;

  const [usuario] = await db
    .select()
    .from(usuarios)
    .where(eq(usuarios.email, email.toLowerCase()))
    .limit(1);

  if (!usuario) {
    res.status(401).json({ error: "Email ou senha inválidos" });
    return;
  }

  if (!usuario.ativo) {
    res.status(401).json({ error: "Usuário inativo" });
    return;
  }

  const senhaValida = await bcrypt.compare(senha, usuario.senhaHash);
  if (!senhaValida) {
    res.status(401).json({ error: "Email ou senha inválidos" });
    return;
  }

  const token = signToken({
    id: usuario.id,
    loja_id: usuario.lojaId,
    perfil: usuario.perfil,
  });

  await db.insert(sessoes).values({
    usuarioId: usuario.id,
    token,
    expiraEm: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  await db
    .update(usuarios)
    .set({ ultimoAcesso: new Date() })
    .where(eq(usuarios.id, usuario.id));

  const responseData = LoginResponse.parse({
    token,
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
      loja_id: usuario.lojaId,
    },
  });

  req.log.info({ usuarioId: usuario.id }, "Login efetuado");
  res.json(responseData);
});

router.post(
  "/auth/logout",
  requireAuth,
  async (req, res): Promise<void> => {
    const authorization = req.headers.authorization!;
    const token = authorization.slice(7);

    await db
      .delete(sessoes)
      .where(
        and(eq(sessoes.token, token), eq(sessoes.usuarioId, req.user!.id)),
      );

    const data = LogoutResponse.parse({ message: "Sessão encerrada com sucesso" });
    req.log.info({ usuarioId: req.user!.id }, "Logout efetuado");
    res.json(data);
  },
);

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [usuario] = await db
    .select()
    .from(usuarios)
    .where(eq(usuarios.id, req.user!.id))
    .limit(1);

  if (!usuario) {
    res.status(401).json({ error: "Usuário não encontrado" });
    return;
  }

  let loja = null;
  if (usuario.lojaId) {
    const [lojaData] = await db
      .select()
      .from(lojas)
      .where(eq(lojas.id, usuario.lojaId))
      .limit(1);
    if (lojaData) {
      loja = {
        id: lojaData.id,
        razao_social: lojaData.razaoSocial,
        nome_fantasia: lojaData.nomeFantasia,
        cnpj: lojaData.cnpj,
        telefone: lojaData.telefone,
        email_contato: lojaData.emailContato,
        cidade: lojaData.cidade,
        plano: lojaData.plano,
        ativo: lojaData.ativo,
        criado_em: lojaData.criadoEm,
      };
    }
  }

  const data = GetMeResponse.parse({
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
      loja_id: usuario.lojaId,
    },
    loja,
  });

  res.json(data);
});

export default router;
