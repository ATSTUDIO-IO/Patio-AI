import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { PainelLayout, PageHeader } from "@/components/painel/layout";
import { useListVeiculos, useListAlertas, useGetFaturaAtual, useListLeads } from "@workspace/api-client-react";

type Metricas = {
  scans_hoje: number;
  scans_semana: Array<{ data: string; scans: number }>;
};

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color ?? "text-gray-900"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function MiniBarChart({ dados }: { dados: Array<{ data: string; scans: number }> }) {
  const max = Math.max(...dados.map((d) => d.scans), 1);
  const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <div className="flex items-end gap-1 h-20 pt-2">
      {dados.map((d, i) => {
        const pct = Math.round((d.scans / max) * 100);
        const dow = new Date(d.data + "T12:00:00").getDay();
        const isHoje = i === dados.length - 1;
        return (
          <div key={d.data} className="flex flex-col items-center gap-1 flex-1">
            <span className="text-xs text-gray-400">{d.scans > 0 ? d.scans : ""}</span>
            <div className="w-full flex flex-col justify-end" style={{ height: "48px" }}>
              <div
                className={`w-full rounded-t-sm transition-all ${isHoje ? "bg-blue-500" : "bg-blue-200"}`}
                style={{ height: `${Math.max(pct, d.scans > 0 ? 8 : 2)}%` }}
              />
            </div>
            <span className={`text-xs ${isHoje ? "text-blue-600 font-semibold" : "text-gray-400"}`}>
              {diasSemana[dow]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const TIPO_COLORS: Record<string, string> = {
  lead_novo: "bg-blue-50 text-blue-700 border-blue-200",
  lead_quente: "bg-yellow-50 text-yellow-700 border-yellow-200",
  agente_erro: "bg-red-50 text-red-700 border-red-200",
  fatura_pendente: "bg-orange-50 text-orange-700 border-orange-200",
};

export default function PainelDashboard() {
  const { user, token } = useAuth();
  const [metricas, setMetricas] = useState<Metricas | null>(null);

  const { data: veiculos = [] } = useListVeiculos();
  const { data: alertas = [] } = useListAlertas();
  const { data: fatura } = useGetFaturaAtual();
  const { data: leads = [] } = useListLeads();

  useEffect(() => {
    if (!token) return;
    fetch("/api/dashboard/metricas", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setMetricas(data))
      .catch(() => {});
  }, [token]);

  const veiculosAtivos = veiculos.filter((v) => v.status === "ativo").length;
  const leadsNovos = leads.filter((l) => l.status_crm === "novo").length;

  const veiculosMaisConsultados = [...veiculos]
    .sort((a, b) => (b.qr_code?.total_scans ?? 0) - (a.qr_code?.total_scans ?? 0))
    .slice(0, 5);

  const totalScansSemana = metricas?.scans_semana?.reduce((acc, d) => acc + d.scans, 0) ?? 0;

  return (
    <PainelLayout>
      <PageHeader
        title={`Bom dia, ${user?.nome?.split(" ")[0] ?? ""}!`}
        subtitle={user?.loja?.nome_fantasia}
      />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Veículos Ativos" value={veiculosAtivos} sub="na plataforma" color="text-blue-600" />
          <StatCard label="Leads Novos" value={leadsNovos} sub="aguardando contato" color="text-green-600" />
          <StatCard
            label="Scans Hoje"
            value={metricas?.scans_hoje ?? "—"}
            sub={`${totalScansSemana} na semana`}
            color="text-indigo-600"
          />
          <StatCard
            label="Fatura Estimada"
            value={fatura ? `R$ ${fatura.valor_total.toFixed(2)}` : "—"}
            sub={fatura ? `${fatura.conversas_usadas}/${fatura.conversas_incluidas} conversas este mês` : "carregando..."}
            color="text-orange-600"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Scans por Dia — Últimos 7 dias</h2>
            </div>
            <div className="p-4">
              {metricas?.scans_semana ? (
                <MiniBarChart dados={metricas.scans_semana} />
              ) : (
                <div className="h-20 flex items-center justify-center text-gray-400 text-sm">Carregando...</div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Alertas Recentes</h2>
            </div>
            <div className="p-3 space-y-1.5 max-h-52 overflow-y-auto">
              {alertas.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">Nenhum alerta</p>
              ) : alertas.slice(0, 6).map((a, i) => (
                <div key={i} className={`flex flex-col p-2 rounded-lg border text-xs ${TIPO_COLORS[a.tipo] ?? "bg-gray-50 text-gray-700 border-gray-200"}`}>
                  <span className="font-semibold">{a.titulo}</span>
                  <span className="text-opacity-80">{a.descricao}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Veículos Mais Consultados</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {veiculosMaisConsultados.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">Nenhum veículo cadastrado</p>
            ) : veiculosMaisConsultados.map((v, i) => (
              <div key={v.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-gray-400 text-sm font-medium w-5">{i + 1}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{v.marca} {v.modelo}</p>
                    <p className="text-xs text-gray-400">{v.ano_fabricacao}/{v.ano_modelo} · {v.status}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">
                    {Number(v.preco_venda).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </p>
                  <p className="text-xs text-gray-400">{v.qr_code?.total_scans ?? 0} scans</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PainelLayout>
  );
}
