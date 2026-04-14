import type { ZodError } from "zod";

const FIELD_LABELS: Record<string, string> = {
  razao_social: "Razão social",
  nome_fantasia: "Nome fantasia",
  cnpj: "CNPJ",
  email: "E-mail",
  senha: "Senha",
  telefone: "Telefone",
  cidade: "Cidade",
  nome: "Nome",
  email_contato: "E-mail de contato",
  lojaId: "ID da loja",
};

function fieldLabel(path: (string | number)[]): string {
  if (path.length === 0) return "Campo";
  const key = String(path[path.length - 1]);
  return FIELD_LABELS[key] ?? key;
}

export function formatZodError(err: ZodError): string {
  const issue = err.issues[0];
  if (!issue) return "Dados inválidos";

  const label = fieldLabel(issue.path);

  switch (issue.code) {
    case "invalid_type":
      if (issue.received === "undefined") {
        return `${label} é obrigatório`;
      }
      return `${label} tem tipo inválido`;
    case "too_small":
      if (issue.type === "string") {
        return `${label} deve ter pelo menos ${String(issue.minimum)} caractere(s)`;
      }
      return `${label} é muito pequeno`;
    case "too_big":
      if (issue.type === "string") {
        return `${label} deve ter no máximo ${String(issue.maximum)} caractere(s)`;
      }
      return `${label} é muito grande`;
    case "invalid_string":
      if (issue.validation === "email") {
        return `${label} deve ser um e-mail válido`;
      }
      if (issue.validation === "uuid") {
        return `${label} deve ser um UUID válido`;
      }
      return `${label} tem formato inválido`;
    case "invalid_enum_value":
      return `${label} deve ser um dos valores: ${(issue.options as string[]).join(", ")}`;
    default:
      return `${label}: dados inválidos`;
  }
}
