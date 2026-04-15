import { useState } from "react";
import { PainelLayout, PageHeader } from "@/components/painel/layout";
import { useListConversas, useGetConversa } from "@workspace/api-client-react";

function timeAgo(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function PainelConversas() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: conversas = [], isLoading } = useListConversas();
  const { data: conversa } = useGetConversa(selectedId ?? "");

  return (
    <PainelLayout>
      <PageHeader title="Conversas" subtitle={`${conversas.length} sessões registradas`} />
      <div className="p-6">
        <div className="flex gap-4 h-[calc(100vh-140px)]">
          <div className="w-80 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
            <div className="p-3 border-b border-gray-100">
              <p className="text-xs text-gray-400 font-medium uppercase">Sessões</p>
            </div>
            {isLoading ? (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Carregando...</div>
            ) : conversas.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm px-4 text-center">
                Nenhuma conversa ainda. Os leads aparecem ao escanear QR codes.
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
                {conversas.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full text-left p-3 hover:bg-gray-50 transition-colors ${selectedId === c.id ? "bg-blue-50 border-l-2 border-blue-500" : ""}`}
                  >
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {c.veiculo ? `${c.veiculo.marca ?? ""} ${c.veiculo.modelo ?? ""}`.trim() : `Sessão ${c.id.slice(-6)}`}
                      </p>
                      <span className="text-xs text-gray-400 ml-2">{timeAgo(c.iniciada_em)}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {c.duracao_segundos ? `${Math.round(c.duracao_segundos / 60)}min` : "em andamento"}
                      {c.resumo_ia ? " · resumo disponível" : ""}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
            {!selectedId ? (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <p className="text-4xl mb-2">💬</p>
                  <p className="text-sm">Selecione uma conversa para ver a transcrição</p>
                </div>
              </div>
            ) : (
              <>
                <div className="p-4 border-b border-gray-100 bg-gray-50">
                  <p className="font-medium text-gray-900 text-sm">
                    {conversa?.veiculo ? `${conversa.veiculo.marca ?? ""} ${conversa.veiculo.modelo ?? ""}`.trim() : "Transcrição"}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {conversa ? new Date(conversa.iniciada_em).toLocaleString("pt-BR") : ""}
                    {conversa?.duracao_segundos ? ` · ${Math.round(conversa.duracao_segundos / 60)} min` : ""}
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {conversa?.resumo_ia && (
                    <div className="mb-4 p-3 bg-blue-50 rounded-xl border border-blue-100">
                      <p className="text-xs font-semibold text-blue-700 mb-1">Resumo da IA</p>
                      <p className="text-sm text-blue-800">{conversa.resumo_ia}</p>
                    </div>
                  )}
                  {conversa?.transcricao ? (
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">Transcrição</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{conversa.transcricao}</p>
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm text-center pt-8">
                      {conversa ? "Transcrição não disponível para esta sessão" : "Carregando..."}
                    </p>
                  )}
                  {conversa?.simulacao_realizada && (
                    <div className="mt-3 p-2 bg-green-50 rounded-lg border border-green-100">
                      <p className="text-xs text-green-700 font-medium">✓ Simulação de financiamento realizada nesta sessão</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </PainelLayout>
  );
}
