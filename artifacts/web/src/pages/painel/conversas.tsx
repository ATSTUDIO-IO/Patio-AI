import { useState } from "react";
import { PainelLayout, PageHeader } from "@/components/painel/layout";
import { useListConversas, useGetConversa } from "@workspace/api-client-react";

type Canal = "todos" | "qr_patio" | "whatsapp";

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

function ChannelBadge({ canal }: { canal?: string | null }) {
  if (canal === "whatsapp") {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-700 border border-green-200">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
        WhatsApp
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 text-indigo-700 border border-indigo-200">
      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block" />
      QR Pátio
    </span>
  );
}

function ChatBubble({ papel, conteudo, criadoEm }: { papel: string; conteudo: string; criadoEm?: string | null }) {
  const isUser = papel === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-2`}>
      <div
        className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? "bg-green-500 text-white rounded-br-sm"
            : "bg-gray-100 text-gray-800 rounded-bl-sm"
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{conteudo}</p>
        {criadoEm && (
          <p className={`text-[10px] mt-1 text-right ${isUser ? "text-green-100" : "text-gray-400"}`}>
            {new Date(criadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>
    </div>
  );
}

export default function PainelConversas() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [canalFilter, setCanalFilter] = useState<Canal>("todos");

  const { data: conversas = [], isLoading } = useListConversas(
    canalFilter === "todos" ? undefined : { canal: canalFilter }
  );
  const { data: conversa } = useGetConversa(selectedId ?? "");

  const isWhatsApp = conversa?.canal === "whatsapp";
  const hasMensagens = (conversa?.mensagens?.length ?? 0) > 0;

  return (
    <PainelLayout>
      <PageHeader title="Conversas" subtitle={`${conversas.length} sessões registradas`} />
      <div className="p-6">
        <div className="flex gap-4 h-[calc(100vh-140px)]">
          <div className="w-80 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
            <div className="p-3 border-b border-gray-100 space-y-2">
              <p className="text-xs text-gray-400 font-medium uppercase">Sessões</p>
              <div className="flex gap-1">
                {(
                  [
                    { key: "todos", label: "Todos" },
                    { key: "whatsapp", label: "WhatsApp" },
                    { key: "qr_patio", label: "QR Pátio" },
                  ] as { key: Canal; label: string }[]
                ).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => { setCanalFilter(key); setSelectedId(null); }}
                    className={`flex-1 text-[11px] font-medium px-2 py-1 rounded-lg transition-colors ${
                      canalFilter === key
                        ? key === "whatsapp"
                          ? "bg-green-100 text-green-700"
                          : key === "qr_patio"
                          ? "bg-indigo-100 text-indigo-700"
                          : "bg-gray-200 text-gray-700"
                        : "text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {isLoading ? (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Carregando...</div>
            ) : conversas.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm px-4 text-center">
                {canalFilter === "whatsapp"
                  ? "Nenhuma conversa WhatsApp ainda."
                  : canalFilter === "qr_patio"
                  ? "Nenhuma sessão QR Pátio ainda."
                  : "Nenhuma conversa ainda. Os leads aparecem ao escanear QR codes."}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
                {conversas.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full text-left p-3 hover:bg-gray-50 transition-colors ${selectedId === c.id ? "bg-indigo-50 border-l-2 border-indigo-500" : ""}`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {c.veiculo ? `${c.veiculo.marca ?? ""} ${c.veiculo.modelo ?? ""}`.trim() : `Sessão ${c.id.slice(-6)}`}
                      </p>
                      <span className="text-xs text-gray-400 shrink-0">{timeAgo(c.iniciada_em)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <ChannelBadge canal={c.canal} />
                      <p className="text-xs text-gray-400">
                        {c.duracao_segundos ? `${Math.round(c.duracao_segundos / 60)}min` : "em andamento"}
                        {c.resumo_ia ? " · resumo disponível" : ""}
                      </p>
                    </div>
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
                  <p className="text-sm">Selecione uma conversa para ver o histórico</p>
                </div>
              </div>
            ) : (
              <>
                <div className="p-4 border-b border-gray-100 bg-gray-50">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900 text-sm">
                      {conversa?.veiculo ? `${conversa.veiculo.marca ?? ""} ${conversa.veiculo.modelo ?? ""}`.trim() : "Conversa"}
                    </p>
                    <ChannelBadge canal={conversa?.canal} />
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-gray-400">
                      {conversa ? new Date(conversa.iniciada_em).toLocaleString("pt-BR") : ""}
                      {conversa?.duracao_segundos ? ` · ${Math.round(conversa.duracao_segundos / 60)} min` : ""}
                    </p>
                    {isWhatsApp && conversa?.lead?.telefone && (
                      <span className="text-xs text-green-700 font-medium">· {conversa.lead.telefone}</span>
                    )}
                  </div>
                </div>
                <div className={`flex-1 overflow-y-auto p-4 ${isWhatsApp ? "bg-[#ece5dd]" : ""}`}>
                  {conversa?.resumo_ia && (
                    <div className="mb-4 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                      <p className="text-xs font-semibold text-indigo-700 mb-1">Resumo da IA</p>
                      <p className="text-sm text-indigo-800">{conversa.resumo_ia}</p>
                    </div>
                  )}

                  {isWhatsApp ? (
                    hasMensagens ? (
                      <div>
                        {conversa.mensagens!.map((m) => (
                          <ChatBubble
                            key={m.id}
                            papel={m.papel}
                            conteudo={m.conteudo}
                            criadoEm={m.criado_em}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm text-center pt-8">
                        {conversa ? "Nenhuma mensagem registrada nesta conversa" : "Carregando..."}
                      </p>
                    )
                  ) : conversa?.transcricao ? (
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">Transcrição</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{conversa.transcricao}</p>
                    </div>
                  ) : hasMensagens ? (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-3 uppercase">Mensagens</p>
                      {conversa!.mensagens!.map((m) => (
                        <ChatBubble
                          key={m.id}
                          papel={m.papel}
                          conteudo={m.conteudo}
                          criadoEm={m.criado_em}
                        />
                      ))}
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
