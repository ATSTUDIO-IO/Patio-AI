import { useState, useEffect } from "react";
import { Link } from "wouter";
import { AdminLayout, AdminPageHeader } from "./layout";
import { useAuth } from "@/hooks/use-auth";

type Loja = {
  id: string;
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  plano: string;
  ativo: boolean;
  criado_em: string;
  cidade: string | null;
  veiculos_ativos: number;
  leads_30d: number;
  scans_30d: number;
  mrr: number;
  status_fatura: string | null;
};

type MRR = {
  total: number;
  novo: number;
  expandido: number;
  perdido: number;
};

type HistoricoItem = {
  mes_ref: string;
  total: number;
};

type DashboardData = {
  mrr: MRR;
  historico_mrr: HistoricoItem[];
  historico_lojas: HistoricoItem[];
  historico_veiculos: HistoricoItem[];
  total_lojas_ativas: number;
  total_veiculos_ativos: number;
  total_conversas: number;
  lojas: Loja[];
};

function formatMes(mesRef: string): string {
  const [ano, mes] = mesRef.split("-");
  const nomes = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${nomes[parseInt(mes, 10) - 1]}/${ano.slice(2)}`;
}

export default function AdminDashboard() {
  const { token } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [churnData, setChurnData] = useState<{ risco_alto: number; risco_medio: number; risco_baixo: number } | null>(null);

  const [filtroStatus, setFiltroStatus] = useState<"todas" | "ativa" | "inativa">("todas");
  const [filtroPlano, setFiltroPlano] = useState<"" | "starter" | "pro" | "full">("");
  const [filtroCidade, setFiltroCidade] = useState("");
  const [filtroAtividade, setFiltroAtividade] = useState<"" | "ativa" | "inativa">("");

  const headers = { Authorization: `Bearer ${token}` };

  async function carregar() {
    setLoading(true);
    setErro(null);
    try {
      const params = new URLSearchParams();
      if (filtroStatus !== "todas") params.set("status", filtroStatus);
      if (filtroPlano) params.set("plano", filtroPlano);
      if (filtroCidade.trim()) params.set("cidade", filtroCidade.trim());
      if (filtroAtividade) params.set("atividade", filtroAtividade);

      const [dashResp, lojasResp, intResp] = await Promise.all([
        fetch("/api/admin/dashboard", { headers }),
        fetch(`/api/admin/lojas?${params.toString()}`, { headers }),
        fetch("/api/admin/inteligencia", { headers }),
      ]);
      if (!dashResp.ok) throw new Error("Erro ao carregar dashboard");
      const [dashData, lojasData, intData] = await Promise.all([dashResp.json(), lojasResp.json(), intResp.ok ? intResp.json() : null]);
      setData({ ...dashData, lojas: lojasData });
      if (intData?.resumo) setChurnData(intData.resumo);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, [filtroStatus, filtroPlano, filtroAtividade]);

  function aplicarFiltroCidade() { carregar(); }

  async function toggleStatus(lojaId: string, ativo: boolean) {
    setTogglingId(lojaId);
    try {
      const resp = await fetch(`/api/admin/lojas/${lojaId}/status`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ ativo }),
      });
      if (!resp.ok) throw new Error("Falha ao alterar status");
      await carregar();
    } catch {
      alert("Erro ao alterar status da loja");
    } finally {
      setTogglingId(null);
    }
  }

  const planoColors: Record<string, string> = {
    starter: "bg-gray-700 text-gray-300",
    pro: "bg-blue-900 text-blue-300",
    full: "bg-violet-900 text-violet-300",
  };

  const statusFaturaColors: Record<string, string> = {
    aberto: "text-yellow-400",
    pago: "text-green-400",
    inadimplente: "text-red-400",
  };

  const mrr = data?.mrr;

  return (
    <AdminLayout>
      <AdminPageHeader
        title="Visão Geral"
        subtitle="Plataforma PátioAI"
        actions={
          <button
            onClick={carregar}
            className="px-3 py-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 rounded-lg transition-colors"
          >
            Atualizar
          </button>
        }
      />

      <div className="p-8 space-y-8">
        {loading && !data ? (
          <div className="flex items-center justify-center py-24 text-gray-500">Carregando...</div>
        ) : erro ? (
          <div className="p-4 bg-red-900/30 border border-red-800 rounded-xl text-red-300 text-sm">{erro}</div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4">
              <StatCard label="Lojas Ativas" value={data?.total_lojas_ativas ?? 0} icon="🏪" color="violet" />
              <StatCard label="Veículos Ativos" value={data?.total_veiculos_ativos ?? 0} icon="🚗" color="blue" />
              <StatCard label="Conversas" value={data?.total_conversas ?? 0} icon="💬" color="green" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-white">MRR — Mês Atual</h2>
                  <Link href="/admin/inteligencia" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
                    Ver inteligência →
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <MRRCard label="Total" value={mrr?.total ?? 0} color="text-white" />
                  <MRRCard label="Novo" value={mrr?.novo ?? 0} color="text-green-400" prefix="+" />
                  <MRRCard label="Expansão" value={mrr?.expandido ?? 0} color="text-blue-400" prefix="+" />
                  <MRRCard label="Perdido" value={mrr?.perdido ?? 0} color="text-red-400" prefix="-" />
                </div>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-white">Risco de Churn</h2>
                  <Link href="/admin/inteligencia" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
                    Detalhes →
                  </Link>
                </div>
                {churnData ? (
                  <div className="space-y-3">
                    <ChurnRiskRow label="Risco Alto" value={churnData.risco_alto} color="text-red-400" icon="🔴" total={data?.total_lojas_ativas ?? 1} />
                    <ChurnRiskRow label="Risco Médio" value={churnData.risco_medio} color="text-yellow-400" icon="🟡" total={data?.total_lojas_ativas ?? 1} />
                    <ChurnRiskRow label="Risco Baixo" value={churnData.risco_baixo} color="text-green-400" icon="🟢" total={data?.total_lojas_ativas ?? 1} />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-16 text-gray-600 text-sm">Carregando...</div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <BarChart
                title="MRR — Últimos 6 Meses (R$)"
                data={data?.historico_mrr ?? []}
                color="bg-violet-500"
                formatValue={(v) => `R$ ${v.toLocaleString("pt-BR")}`}
              />
              <BarChart
                title="Lojas Ativas — Histórico"
                data={data?.historico_lojas ?? []}
                color="bg-blue-500"
                formatValue={(v) => `${v} lojas`}
              />
              <BarChart
                title="Veículos Cadastrados — Histórico"
                data={data?.historico_veiculos ?? []}
                color="bg-green-500"
                formatValue={(v) => `${v} veíc.`}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-white">Lojas</h2>
                <div className="flex items-center gap-3 flex-wrap justify-end">
                  <select
                    value={filtroStatus}
                    onChange={(e) => setFiltroStatus(e.target.value as "todas" | "ativa" | "inativa")}
                    className="px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded-lg text-gray-300 focus:outline-none"
                  >
                    <option value="todas">Todas</option>
                    <option value="ativa">Ativas</option>
                    <option value="inativa">Inativas</option>
                  </select>
                  <select
                    value={filtroPlano}
                    onChange={(e) => setFiltroPlano(e.target.value as "" | "starter" | "pro" | "full")}
                    className="px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded-lg text-gray-300 focus:outline-none"
                  >
                    <option value="">Todos os planos</option>
                    <option value="starter">Starter</option>
                    <option value="pro">Pro</option>
                    <option value="full">Full</option>
                  </select>
                  <select
                    value={filtroAtividade}
                    onChange={(e) => setFiltroAtividade(e.target.value as "" | "ativa" | "inativa")}
                    className="px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded-lg text-gray-300 focus:outline-none"
                  >
                    <option value="">Qualquer atividade</option>
                    <option value="ativa">Com atividade recente</option>
                    <option value="inativa">Sem atividade</option>
                  </select>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      placeholder="Filtrar por cidade..."
                      value={filtroCidade}
                      onChange={(e) => setFiltroCidade(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && aplicarFiltroCidade()}
                      className="px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded-lg text-gray-300 placeholder-gray-600 focus:outline-none focus:border-violet-600 w-40"
                    />
                    <button onClick={aplicarFiltroCidade} className="px-2 py-1 text-xs text-violet-400 hover:text-violet-300">
                      OK
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-400 text-xs">
                      <th className="text-left px-5 py-3 font-medium">Loja</th>
                      <th className="text-left px-5 py-3 font-medium">Plano</th>
                      <th className="text-right px-5 py-3 font-medium">Veículos</th>
                      <th className="text-right px-5 py-3 font-medium">Leads 30d</th>
                      <th className="text-right px-5 py-3 font-medium">Scans 30d</th>
                      <th className="text-center px-5 py-3 font-medium">Fatura</th>
                      <th className="text-center px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.lojas ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-gray-500">Nenhuma loja encontrada</td>
                      </tr>
                    ) : (
                      (data?.lojas ?? []).map((loja) => (
                        <tr key={loja.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="font-medium text-white">{loja.nome_fantasia}</div>
                            <div className="text-xs text-gray-500">{loja.cidade ?? loja.cnpj}</div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${planoColors[loja.plano] ?? "bg-gray-700 text-gray-300"}`}>
                              {loja.plano}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right text-gray-300">{loja.veiculos_ativos}</td>
                          <td className="px-5 py-3.5 text-right text-gray-300">{loja.leads_30d}</td>
                          <td className="px-5 py-3.5 text-right text-gray-300">{loja.scans_30d}</td>
                          <td className="px-5 py-3.5 text-center">
                            <span className={`text-xs font-medium ${statusFaturaColors[loja.status_fatura ?? ""] ?? "text-gray-500"}`}>
                              {loja.status_fatura ?? "—"}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${loja.ativo ? "bg-green-900 text-green-300" : "bg-red-900 text-red-300"}`}>
                              {loja.ativo ? "Ativa" : "Suspensa"}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2 justify-end">
                              <Link
                                href={`/admin/lojas/${loja.id}`}
                                className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                              >
                                Detalhes
                              </Link>
                              <button
                                onClick={() => toggleStatus(loja.id, !loja.ativo)}
                                disabled={togglingId === loja.id}
                                className={`text-xs transition-colors ${
                                  loja.ativo ? "text-red-400 hover:text-red-300" : "text-green-400 hover:text-green-300"
                                } disabled:opacity-50`}
                              >
                                {togglingId === loja.id ? "..." : loja.ativo ? "Suspender" : "Ativar"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number | string; icon: string; color: string }) {
  const colors: Record<string, string> = {
    violet: "border-violet-800/40 bg-violet-900/20",
    blue: "border-blue-800/40 bg-blue-900/20",
    green: "border-green-800/40 bg-green-900/20",
    amber: "border-amber-800/40 bg-amber-900/20",
  };
  return (
    <div className={`rounded-2xl border p-5 ${colors[color] ?? ""}`}>
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-sm text-gray-400 mt-1">{label}</div>
    </div>
  );
}

function MRRCard({ label, value, color, prefix = "" }: { label: string; value: number; color: string; prefix?: string }) {
  return (
    <div className="text-center">
      <div className={`text-xl font-bold ${color}`}>
        {prefix}R$ {value.toLocaleString("pt-BR")}
      </div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

function ChurnRiskRow({ label, value, color, icon, total }: { label: string; value: number; color: string; icon: string; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm">{icon}</span>
      <div className="flex-1">
        <div className="flex justify-between text-xs mb-0.5">
          <span className={color}>{label}</span>
          <span className="text-gray-400">{value} lojas ({pct}%)</span>
        </div>
        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${icon === "🔴" ? "bg-red-500" : icon === "🟡" ? "bg-yellow-500" : "bg-green-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function BarChart({
  title,
  data,
  color,
  formatValue,
}: {
  title: string;
  data: { mes_ref: string; total: number }[];
  color: string;
  formatValue: (v: number) => string;
}) {
  const max = Math.max(...data.map((d) => d.total), 1);
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <h3 className="text-xs font-semibold text-gray-400 mb-4 uppercase tracking-wide">{title}</h3>
      {data.length === 0 ? (
        <div className="flex items-end gap-1 h-24 items-center justify-center text-gray-600 text-xs">Sem dados</div>
      ) : (
        <div className="flex items-end gap-1.5 h-24">
          {data.map((d) => {
            const heightPct = Math.max((d.total / max) * 100, 4);
            return (
              <div key={d.mes_ref} className="flex-1 flex flex-col items-center gap-1 group relative">
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-700 text-white text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                  {formatValue(d.total)}
                </div>
                <div className="w-full rounded-t" style={{ height: `${heightPct}%`, backgroundColor: color.replace("bg-", "").replace("-500", "") }}>
                  <div className={`w-full h-full rounded-t ${color} opacity-80`} />
                </div>
                <span className="text-gray-600 text-[9px] leading-none">{formatMes(d.mes_ref)}</span>
              </div>
            );
          })}
        </div>
      )}
      {data.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-800 flex justify-between">
          <span className="text-xs text-gray-600">Atual</span>
          <span className="text-xs font-medium text-white">{formatValue(data[data.length - 1]?.total ?? 0)}</span>
        </div>
      )}
    </div>
  );
}
