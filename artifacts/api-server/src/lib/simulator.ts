import { eq, and } from "drizzle-orm";
import { db, financiamentos } from "@workspace/db";

export interface SimulacaoInput {
  lojaId: string;
  precoVenda: number;
  entradaPct: number;
  nParcelas: number;
  financiamentoId?: string;
}

export interface SimulacaoResult {
  preco_venda: number;
  entrada_pct: number;
  valor_entrada: number;
  valor_financiado: number;
  n_parcelas: number;
  taxa_mensal: number;
  valor_parcela: number;
  banco: string | null;
  modalidade: string | null;
  descricao: string;
}

export function calcularParcelaPrice(
  precoVenda: number,
  entradaPct: number,
  nParcelas: number,
  taxaMensal: number,
): number {
  const valorFinanciado = precoVenda * (1 - entradaPct / 100);
  const taxa = taxaMensal / 100;
  if (taxa === 0) return valorFinanciado / nParcelas;
  const fator = Math.pow(1 + taxa, nParcelas);
  return (valorFinanciado * (taxa * fator)) / (fator - 1);
}

export async function simular(input: SimulacaoInput): Promise<SimulacaoResult> {
  const { lojaId, precoVenda, entradaPct, nParcelas, financiamentoId } = input;

  let financiamento: typeof financiamentos.$inferSelect | null = null;

  if (financiamentoId) {
    const [found] = await db
      .select()
      .from(financiamentos)
      .where(
        and(
          eq(financiamentos.id, financiamentoId),
          eq(financiamentos.lojaId, lojaId),
          eq(financiamentos.ativo, true),
        ),
      )
      .limit(1);
    financiamento = found ?? null;
  }

  if (!financiamento) {
    const [first] = await db
      .select()
      .from(financiamentos)
      .where(and(eq(financiamentos.lojaId, lojaId), eq(financiamentos.ativo, true)))
      .limit(1);
    financiamento = first ?? null;
  }

  const taxaMensal = financiamento ? Number(financiamento.taxaMensal) : 1.5;
  const entradaMinPct = financiamento ? Number(financiamento.entradaMinPct) : 20;
  const parcelasMin = financiamento?.parcelasMin ?? 1;
  const parcelasMax = financiamento?.parcelasMax ?? 360;

  const entradaEfetiva = Math.max(entradaPct, entradaMinPct);
  const nParcelasEfetivo = Math.min(Math.max(nParcelas, parcelasMin), parcelasMax);

  const valorParcela = calcularParcelaPrice(precoVenda, entradaEfetiva, nParcelasEfetivo, taxaMensal);
  const valorEntrada = precoVenda * (entradaEfetiva / 100);
  const valorFinanciado = precoVenda - valorEntrada;

  const fmtBRL = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const banco = financiamento?.banco ?? null;
  const modalidade = financiamento?.modalidade ?? null;
  const bancoDesc = banco ? ` (${banco}${modalidade ? ` - ${modalidade}` : ""})` : "";

  return {
    preco_venda: precoVenda,
    entrada_pct: entradaEfetiva,
    valor_entrada: valorEntrada,
    valor_financiado: valorFinanciado,
    n_parcelas: nParcelasEfetivo,
    taxa_mensal: taxaMensal,
    valor_parcela: valorParcela,
    banco,
    modalidade,
    descricao: `Com ${entradaEfetiva}% de entrada (${fmtBRL(valorEntrada)}), em ${nParcelasEfetivo} parcelas${bancoDesc}, você pagaria aproximadamente ${fmtBRL(valorParcela)} por mês.`,
  };
}

export function formatarSimulacaoParaAgente(resultado: SimulacaoResult): string {
  const fmtBRL = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const bancoStr = resultado.banco ? ` pelo ${resultado.banco}` : "";
  return `[SIMULAÇÃO DE FINANCIAMENTO] Com ${resultado.entrada_pct}% de entrada (${fmtBRL(resultado.valor_entrada)}), em ${resultado.n_parcelas} parcelas${bancoStr}, a parcela estimada seria de ${fmtBRL(resultado.valor_parcela)} por mês (taxa ${resultado.taxa_mensal}% a.m.).`;
}
