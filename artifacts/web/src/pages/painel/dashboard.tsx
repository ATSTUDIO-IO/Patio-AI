import { useAuth } from "@/hooks/use-auth";
import { PainelLayout, PageHeader } from "@/components/painel/layout";
import { useListVeiculos, useListAlertas, useGetFaturaAtual, useListLeads } from "@workspace/api-client-react";

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color ?? "text-gray-900"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
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
  const { user } = useAuth();

  const { data: veiculos = [] } = useListVeiculos();
  const { data: alertas = [] } = useListAlertas();
  const { data: fatura } = useGetFaturaAtual();
  const { data: leads = [] } = useListLeads();

  const veiculosAtivos = veiculos.filter((v) => v.status === "ativo").length;
  const leadsNovos = leads.filter((l) => l.status_crm === "novo").length;
  const veiculosMaisConsultados = [...veiculos]
    .sort((a, b) => (b.ano_fabricacao ?? 0) - (a.ano_fabricacao ?? 0))
    .slice(0, 5);

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
          <StatCard label="Total de Leads" value={leads.length} sub="todas as sessões" color="text-indigo-600" />
          <StatCard
            label="Fatura Estimada"
            value={fatura ? `R$ ${fatura.valor_total.toFixed(2)}` : "—"}
            sub={fatura ? `${fatura.veiculos_ativos} veíc. × R$ ${fatura.preco_unitario}/mês` : "carregando..."}
            color="text-orange-600"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Alertas Recentes</h2>
            </div>
            <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
              {alertas.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">Nenhum alerta</p>
              ) : alertas.slice(0, 8).map((a, i) => (
                <div key={i} className={`flex items-start gap-2 p-2.5 rounded-lg border text-xs ${TIPO_COLORS[a.tipo] ?? "bg-gray-50 text-gray-700 border-gray-200"}`}>
                  <span className="font-semibold">{a.titulo}</span>
                  <span className="text-gray-500">{a.descricao}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Veículos Cadastrados</h2>
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
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PainelLayout>
  );
}
