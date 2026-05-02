import { useState } from "react";
import { PainelLayout, PageHeader } from "@/components/painel/layout";
import { useGetRelatorioVendas } from "@workspace/api-client-react";
import type { RelatorioVendasPeriodo } from "@workspace/api-client-react";

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatPct(v: number | null) {
  if (v === null) return "—";
  const color = v >= 0 ? "text-green-600" : "text-red-600";
  return <span className={`font-semibold ${color}`}>{v.toFixed(1)}%</span>;
}

function formatLucro(v: number | null) {
  if (v === null) return <span className="text-gray-400">—</span>;
  if (v >= 0)
    return <span className="text-green-700 font-semibold">{formatBRL(v)}</span>;
  return <span className="text-red-600 font-semibold">{formatBRL(v)}</span>;
}

const PERIODO_LABELS: Record<RelatorioVendasPeriodo, string> = {
  mes: "Este mês",
  trimestre: "Este trimestre",
  ano: "Este ano",
  todos: "Todos os períodos",
};

export default function RelatorioVendas() {
  const [periodo, setPeriodo] = useState<RelatorioVendasPeriodo>("mes");

  const { data, isLoading } = useGetRelatorioVendas({ periodo });

  const items = data?.items ?? [];
  const totais = data?.totais;

  const totalComVenda = items.filter((i) => i.valor_venda_real !== null).length;
  const totalSemVenda = items.filter((i) => i.valor_venda_real === null).length;

  return (
    <PainelLayout>
      <PageHeader
        title="Relatório de Rentabilidade"
        subtitle="Lucro real por veículo vendido"
        actions={
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value as RelatorioVendasPeriodo)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            {(Object.keys(PERIODO_LABELS) as RelatorioVendasPeriodo[]).map((p) => (
              <option key={p} value={p}>
                {PERIODO_LABELS[p]}
              </option>
            ))}
          </select>
        }
      />

      <div className="p-6 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            Carregando...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">
                  Veículos Vendidos
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {totais?.total_vendidos ?? 0}
                </p>
                {totalSemVenda > 0 && (
                  <p className="text-xs text-orange-500 mt-1">
                    {totalSemVenda} sem valor de venda
                  </p>
                )}
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">
                  Receita Total
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {totais ? formatBRL(totais.receita_total) : "—"}
                </p>
                {totalComVenda < (totais?.total_vendidos ?? 0) && (
                  <p className="text-xs text-gray-400 mt-1">
                    Baseado em {totalComVenda} vendas com valor
                  </p>
                )}
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">
                  Custo Total
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {totais ? formatBRL(totais.custo_total) : "—"}
                </p>
              </div>
              <div className={`rounded-2xl border shadow-sm p-5 ${
                (totais?.lucro_total ?? 0) >= 0
                  ? "bg-green-50 border-green-100"
                  : "bg-red-50 border-red-100"
              }`}>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">
                  Lucro Total
                </p>
                <p className={`text-2xl font-bold ${
                  (totais?.lucro_total ?? 0) >= 0 ? "text-green-700" : "text-red-600"
                }`}>
                  {totais ? formatBRL(totais.lucro_total) : "—"}
                </p>
              </div>
            </div>

            {items.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
                <p className="text-gray-400 text-lg">
                  Nenhum veículo vendido {periodo !== "todos" ? `em ${PERIODO_LABELS[periodo].toLowerCase()}` : ""}
                </p>
                <p className="text-sm text-gray-300 mt-1">
                  Marque veículos como vendidos para ver o relatório de rentabilidade
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Veículo</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Vendido em</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500">Custo Total</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500">Valor de Venda</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500">Lucro Bruto</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500">Margem %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {items.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">
                            {item.marca} {item.modelo}
                          </p>
                          <p className="text-xs text-gray-400">
                            {item.ano_fabricacao}/{item.ano_modelo} · {item.placa}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {item.vendido_em
                            ? new Date(item.vendido_em).toLocaleDateString("pt-BR")
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          {formatBRL(item.custo_total)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {item.valor_venda_real !== null ? (
                            <span className="text-gray-900 font-medium">
                              {formatBRL(item.valor_venda_real)}
                            </span>
                          ) : (
                            <span className="text-xs text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">
                              Não registrado
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {formatLucro(item.lucro_bruto)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {formatPct(item.margem_pct)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </PainelLayout>
  );
}
