import QRCode from "qrcode";
import { randomBytes } from "crypto";

function getPublicBase(): string {
  if (process.env.PUBLIC_BASE_URL) {
    return process.env.PUBLIC_BASE_URL.replace(/\/$/, "");
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  return "http://localhost:8080";
}

export function gerarSlug(modelo: string, anoFabricacao: number): string {
  const modeloSanitizado = modelo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 6);

  const hash = randomBytes(2).toString("hex");
  return `VT-${modeloSanitizado}${anoFabricacao}-${hash}`;
}

export function gerarSlugCandidatos(
  modelo: string,
  anoFabricacao: number,
  quantidade: number,
): string[] {
  return Array.from({ length: quantidade }, () =>
    gerarSlug(modelo, anoFabricacao),
  );
}

export function gerarUrlPublica(slug: string): string {
  return `${getPublicBase()}/web/v/${slug}`;
}

export async function gerarImagemQr(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    type: "image/png",
    width: 512,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });
}

export async function gerarQrPng(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    type: "png",
    width: 512,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });
}
