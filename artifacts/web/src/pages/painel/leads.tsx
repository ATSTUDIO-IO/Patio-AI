import { useState } from "react";
import { Link } from "wouter";
import { PainelLayout, PageHeader } from "@/components/painel/layout";
import { useListLeads, usePatchLeadStatus } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const STATUS_INFO: Record<string, { label: string; color: string }> = {
  novo: { label: "Novo", color: "bg-orange-100 text-orange-700" },
  em_contato: { label: "Em contato", color: "bg-yellow-100 text-yellow-700" },
  ganho: { label: "Ganho", color: "bg-green-100 text-green-700" },
  perdido: { label: "Perdido", color: "bg-red-100 text-red-700" },
};

const ORIGEM_INFO: Record<string, { label: string; color: string }> = {
  whatsapp: { label: "WhatsApp", color: "bg-green-100 text-green-700" },
  qr_patio: { label: "QR Pátio", color: "bg-orange-100 text-orange-700" },
  landing: { label: "Landing", color: "bg-purple-100 text-purple-700" },
};

const INTERESSE_INFO: Record<string, { label: string; color: string }> = {
  alto: { label: "Alto", color: "text-green-600" },
  medio: { label: "Médio", color: "text-yellow-600" },
  baixo: { label: "Baixo", color: "text-gray-400" },
};

function timeAgo(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

export default function PainelLeads() {
  const qc = useQueryClient();
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [busca, setBusca] = useState("");

  const { data: leads = [], isLoading } = useListLeads();
  const patchMutation = usePatchLeadStatus();

  const handlePatch = async (leadId: string, status: string) => {
    await patchMutation.mutateAsync({
      leadId,
      data: { status: status as "novo" | "em_contato" | "perdido" | "ganho" },
    });
    qc.invalidateQueries({ queryKey: ["/leads"] });
  };

  const filtrado = leads.filter((l) => {
    const matchStatus = statusFiltro === "todos" || l.status_crm === statusFiltro;
    const matchBusca = !busca || `${l.nome ?? ""} ${l.telefone ?? ""} ${l.email ?? ""}`.toLowerCase().includes(busca.toLowerCase());
    return matchStatus && matchBusca;
  });

  return (
    <PainelLayout>
      <PageHeader
        title="Leads"
        subtitle={`${leads.filter(l => l.status_crm === "novo").length} novos`}
      />
      <div className="p-6">
        <div className="flex gap-3 mb-4">
          <input
            type="text"
            placeholder="Buscar por nome, telefone ou e-mail..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <select
            value={statusFiltro}
            onChange={(e) => setStatusFiltro(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="todos">Todos</option>
            {Object.entries(STATUS_INFO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-gray-400">Carregando...</div>
        ) : filtrado.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg">Nenhum lead encontrado</p>
            <p className="text-sm mt-2">Os leads aparecem quando um cliente escaneia o QR code</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Lead</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Veículo</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Origem</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Interesse</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Quando</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtrado.map((l) => {
                  const origem = l.origem ?? undefined;
                  const origemInfo = origem ? (ORIGEM_INFO[origem] ?? { label: origem, color: "bg-gray-100 text-gray-600" }) : null;
                  return (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{l.nome ?? "Anônimo"}</p>
                      <p className="text-gray-400 text-xs">{l.telefone ?? l.email ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {l.veiculo ? `${l.veiculo.marca ?? ""} ${l.veiculo.modelo ?? ""}`.trim() || "—" : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {origemInfo && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${origemInfo.color}`}>
                          {origemInfo.label}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-medium ${INTERESSE_INFO[l.interesse]?.color ?? "text-gray-500"}`}>
                        {INTERESSE_INFO[l.interesse]?.label ?? l.interesse}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <select
                        value={l.status_crm}
                        onChange={(e) => handlePatch(l.id, e.target.value)}
                        className={`text-xs font-medium px-2 py-1 rounded-full border-0 focus:outline-none cursor-pointer ${STATUS_INFO[l.status_crm]?.color ?? "bg-gray-100 text-gray-600"}`}
                      >
                        {Object.entries(STATUS_INFO).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400 text-xs">
                      {timeAgo(l.criado_em)}
                    </td>
                    <td className="px-4 py-3">
                      <Link href="/painel/conversas" className="text-xs text-orange-600 hover:underline font-medium">Ver conversa</Link>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PainelLayout>
  );
}
