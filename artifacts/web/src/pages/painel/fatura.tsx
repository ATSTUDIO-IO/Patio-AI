import { PainelLayout, PageHeader } from "@/components/painel/layout";
import { useAuth } from "@/hooks/use-auth";
import { useGetFaturaAtual, useListFaturas } from "@workspace/api-client-react";

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const STATUS_INFO: Record<string, { label: string; color: string }> = {
  aberta: { label: "Em aberto", color: "bg-yellow-100 text-yellow-700" },
  fechada: { label: "Fechada", color: "bg-blue-100 text-blue-600" },
  paga: { label: "Paga", color: "bg-green-100 text-green-700" },
  inadimplente: { label: "Inadimplente", color: "bg-red-100 text-red-700" },
};

export default function PainelFatura() {
  const { user } = useAuth();

  const { data: atual, isLoading: isLoadingAtual } = useGetFaturaAtual();
  const { data: historico = [], isLoading: isLoadingHistorico } = useListFaturas();

  return (
    <PainelLayout>
      <PageHeader title="Faturamento" subtitle="Ciclos de cobrança mensais" />
      <div className="p-6 space-y-6 max-w-3xl">
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white">
          <p className="text-white/70 text-sm font-medium mb-1">Fatura do Mês Atual</p>
          {isLoadingAtual ? (
            <p className="text-2xl font-bold">Carregando...</p>
          ) : atual ? (
            <>
              <p className="text-4xl font-bold mt-1">{formatBRL(atual.valor_total)}</p>
              <div className="mt-4 grid grid-cols-3 gap-4">
                <div>
                  <p className="text-white/60 text-xs">Veículos Ativos</p>
                  <p className="text-lg font-semibold">{atual.veiculos_ativos}</p>
                </div>
                <div>
                  <p className="text-white/60 text-xs">Preço Unitário</p>
                  <p className="text-lg font-semibold">{formatBRL(atual.preco_unitario)}/veíc.</p>
                </div>
                <div>
                  <p className="text-white/60 text-xs">Plano</p>
                  <p className="text-lg font-semibold capitalize">{user?.loja?.plano ?? atual.plano}</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-white/20">
                <p className="text-xs text-white/60">
                  Mês de referência: {atual.mes_ref} · Vencimento: {new Date(atual.vencimento).toLocaleDateString("pt-BR")}
                </p>
                <span className="inline-block mt-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white/20 text-white">
                  {STATUS_INFO[atual.status]?.label ?? atual.status}
                </span>
              </div>
            </>
          ) : (
            <p className="text-white/70 mt-2">Nenhuma fatura encontrada</p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Histórico de Faturas</h2>
          </div>
          {isLoadingHistorico ? (
            <div className="p-8 text-center text-gray-400 text-sm">Carregando...</div>
          ) : historico.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">Nenhuma fatura anterior</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {historico.slice(0, 6).map((f) => (
                <div key={f.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{f.mes_ref}</p>
                    <p className="text-xs text-gray-400">
                      {f.veiculos_ativos} veíc. × {formatBRL(f.preco_unitario)}
                      {f.gerado_em ? ` · Gerado em ${new Date(f.gerado_em).toLocaleDateString("pt-BR")}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_INFO[f.status]?.color ?? "bg-gray-100 text-gray-600"}`}>
                      {STATUS_INFO[f.status]?.label ?? f.status}
                    </span>
                    <p className="text-sm font-semibold text-gray-900">{formatBRL(f.valor_total)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-blue-50 rounded-2xl p-4">
          <p className="text-sm text-blue-700 font-medium">ℹ️ Como funciona a cobrança</p>
          <p className="text-xs text-blue-600 mt-1.5 leading-relaxed">
            O valor é calculado com base no número de veículos ativos no período. Veículos pausados ou vendidos não são cobrados.
            As faturas são fechadas mensalmente pela equipe PátioAI e o pagamento é processado automaticamente.
          </p>
        </div>
      </div>
    </PainelLayout>
  );
}
