import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { eq, and, gt } from "drizzle-orm";
import { db, sessoes } from "@workspace/db";

export interface JwtPayload {
  id: string;
  loja_id: string | null;
  perfil: "dono" | "vendedor" | "admin_patioai";
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET não configurado");
  }
  return secret;
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authorization = req.headers.authorization;
  if (!authorization || !authorization.startsWith("Bearer ")) {
    res.status(401).json({ error: "Token de autenticação não fornecido" });
    return;
  }

  const token = authorization.slice(7);
  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, getJwtSecret()) as JwtPayload;
  } catch {
    res.status(401).json({ error: "Token inválido ou expirado" });
    return;
  }

  const [sessao] = await db
    .select({ id: sessoes.id })
    .from(sessoes)
    .where(
      and(
        eq(sessoes.token, token),
        eq(sessoes.usuarioId, payload.id),
        gt(sessoes.expiraEm, new Date()),
      ),
    )
    .limit(1);

  if (!sessao) {
    res.status(401).json({ error: "Sessão inválida ou encerrada" });
    return;
  }

  req.user = payload;
  next();
}

export function requirePerfil(...perfis: JwtPayload["perfil"][]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Não autenticado" });
      return;
    }
    if (!perfis.includes(req.user.perfil)) {
      res.status(403).json({ error: "Acesso negado para este perfil" });
      return;
    }
    next();
  };
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
}
