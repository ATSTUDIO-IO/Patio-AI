import { PainelLayout, PageHeader } from "@/components/painel/layout";
import { useAuth } from "@/hooks/use-auth";
import { useGetFaturaAtual, useListFaturas } from "@workspace/api-client-react";

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const STATUS_INFO: Record<string, { label: string; color: string }> = {
  aberto: { label: "Em aberto", color: "bg-yellow-100 text-yellow-700" },
  pago: { label: "Pago", color: "bg-green-100 text-green-700" },
  inadimplente: { label: "Inadimplente", color: "bg-red-100 text-red-700" },
};

function QuotaBar({ usadas, incluidas, buffer }: { usadas: number; incluidas: number; buffer: number }) {
  const pct = Math.min((usadas / incluidas) * 100, 100);
  const excedentes = Math.max(0, usadas - incluidas);
  const cor = usadas >= incluidas ? "bg-red-400" : pct >= 80 ? "bg-yellow-400" : "bg-green-400";
  return (
    <div className="mt-4">
      <div className="flex justify-between text-xs text-white/70 mb-1">
        <span>Uso de conversas</span>
        <span>{usadas} / {incluidas} incluídas {excedentes > 0 ? `(+${excedentes} excedentes)` : ""}</span>
      </div>
      <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${cor}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-white/50 mt-1">Buffer de {buffer} conversas adicionais após a cota</p>
    </div>
  );
}

export default function PainelFatura() {
  const { user } = useAuth();

  const { data: atual, isLoading: isLoadingAtual } = useGetFaturaAtual();
  const { data: historico = [], isLoading: isLoadingHistorico } = useListFaturas();

  const planoLabel: Record<string, string> = { starter: "Starter", pro: "Pro", full: "Full" };

  return (
    <PainelLayout>
      <PageHeader title="Faturamento" subtitle="Ciclos de cobrança mensais" />
      <div className="p-6 space-y-6 max-w-3xl">
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl p-6 text-white">
          <p className="text-white/70 text-sm font-medium mb-1">Fatura do Mês Atual</p>
          {isLoadingAtual ? (
            <p className="text-2xl font-bold">Carregando...</p>
          ) : atual ? (
            <>
              <p className="text-4xl font-bold mt-1">{formatBRL(atual.valor_total)}</p>
              <div className="mt-4 grid grid-cols-3 gap-4">
                <div>
                  <p className="text-white/60 text-xs">Plano</p>
                  <p className="text-lg font-semibold">{planoLabel[user?.loja?.plano ?? atual.plano] ?? atual.plano}</p>
                </div>
                <div>
                  <p className="text-white/60 text-xs">Mensalidade Base</p>
                  <p className="text-lg font-semibold">{formatBRL(atual.valor_base)}</p>
                </div>
                <div>
                  <p className="text-white/60 text-xs">Excedente</p>
                  <p className="text-lg font-semibold">{formatBRL(atual.valor_excedente)}</p>
                </div>
              </div>

              <QuotaBar
                usadas={atual.conversas_usadas ?? 0}
                incluidas={atual.conversas_incluidas ?? 0}
                buffer={atual.buffer_excedente ?? 0}
              />

              <div className="mt-4 pt-4 border-t border-white/20">
                <p className="text-xs text-white/60">
                  Mês de referência: {atual.mes_ref} · Vencimento: {new Date(atual.vencimento).toLocaleDateString("pt-BR")}
                </p>
                {(atual.conversas_excedentes ?? 0) > 0 && (
                  <p className="text-xs text-white/60 mt-1">
                    {atual.conversas_excedentes} conversas excedentes × {formatBRL(atual.preco_excedente ?? 0)} = {formatBRL(atual.valor_excedente)}
                  </p>
                )}
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
                      {f.conversas_usadas}/{f.conversas_incluidas} conversas
                      {(f.conversas_excedentes ?? 0) > 0 ? ` · +${f.conversas_excedentes} excedentes` : ""}
                      {f.gerado_em ? ` · ${new Date(f.gerado_em).toLocaleDateString("pt-BR")}` : ""}
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

        <div className="bg-indigo-50 rounded-2xl p-4 space-y-3">
          <p className="text-sm text-indigo-700 font-medium">ℹ️ Como funciona a cobrança</p>
          <p className="text-xs text-indigo-600 leading-relaxed">
            Cada plano inclui uma cota mensal de conversas. Ao ultrapassar a cota, há um buffer de 20 conversas adicionais incluídas.
            Conversas acima da cota são cobradas a R$0,75 por conversa. O agente é bloqueado ao esgotar o buffer.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { plano: "Starter", preco: "R$129,90", cotas: "60 conv./mês" },
              { plano: "Pro", preco: "R$249,90", cotas: "200 conv./mês" },
              { plano: "Full", preco: "R$449,90", cotas: "500 conv./mês" },
            ].map((p) => (
              <div key={p.plano} className="bg-white rounded-xl p-3 text-center border border-indigo-100">
                <p className="text-xs font-bold text-indigo-800">{p.plano}</p>
                <p className="text-sm font-semibold text-indigo-700 mt-1">{p.preco}</p>
                <p className="text-xs text-indigo-500">{p.cotas}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PainelLayout>
  );
}
