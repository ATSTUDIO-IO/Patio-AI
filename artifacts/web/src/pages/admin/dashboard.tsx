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
  total_conversas: number;
  total_leads: number;
  total_usuarios: number;
  ultima_fatura_status: string | null;
};

type Stats = {
  total_lojas_ativas: number;
  total_veiculos_ativos: number;
  total_conversas: number;
  receita_total: number;
  mrr_mes_atual: number;
};

export default function AdminDashboard() {
  const { token } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<"todas" | "ativas" | "inativas">("todas");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const headers = { Authorization: `Bearer ${token}` };

  async function carregar() {
    setLoading(true);
    setErro(null);
    try {
      const [statsResp, lojasResp] = await Promise.all([
        fetch("/api/admin/stats", { headers }),
        fetch("/api/admin/lojas", { headers }),
      ]);
      if (!statsResp.ok || !lojasResp.ok) throw new Error("Erro ao carregar dados");
      const [statsData, lojasData] = await Promise.all([statsResp.json(), lojasResp.json()]);
      setStats(statsData);
      setLojas(lojasData);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, []);

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

  const lojasFiltered = lojas.filter((l) => {
    if (filtro === "ativas") return l.ativo;
    if (filtro === "inativas") return !l.ativo;
    return true;
  });

  const planoColors: Record<string, string> = {
    starter: "bg-gray-700 text-gray-300",
    pro: "bg-blue-900 text-blue-300",
    full: "bg-violet-900 text-violet-300",
  };

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
        {loading && !stats ? (
          <div className="flex items-center justify-center py-24 text-gray-500">Carregando...</div>
        ) : erro ? (
          <div className="p-4 bg-red-900/30 border border-red-800 rounded-xl text-red-300 text-sm">{erro}</div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-4">
              <StatCard label="Lojas Ativas" value={stats?.total_lojas_ativas ?? 0} icon="🏪" color="violet" />
              <StatCard label="Veículos Ativos" value={stats?.total_veiculos_ativos ?? 0} icon="🚗" color="blue" />
              <StatCard label="Conversas" value={stats?.total_conversas ?? 0} icon="💬" color="green" />
              <StatCard
                label="MRR (Mês Atual)"
                value={`R$ ${(stats?.mrr_mes_atual ?? 0).toLocaleString("pt-BR")}`}
                icon="💰"
                color="amber"
              />
            </div>
            <div className="flex justify-end">
              <Link
                href="/admin/inteligencia"
                className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
              >
                Ver análise de risco de churn e inteligência →
              </Link>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-white">Lojas</h2>
                <div className="flex gap-2">
                  {(["todas", "ativas", "inativas"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFiltro(f)}
                      className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                        filtro === f
                          ? "bg-violet-600 text-white"
                          : "text-gray-400 hover:text-white border border-gray-700"
                      }`}
                    >
                      {f === "todas" ? "Todas" : f === "ativas" ? "Ativas" : "Inativas"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-400 text-xs">
                      <th className="text-left px-5 py-3 font-medium">Loja</th>
                      <th className="text-left px-5 py-3 font-medium">Plano</th>
                      <th className="text-right px-5 py-3 font-medium">Veículos</th>
                      <th className="text-right px-5 py-3 font-medium">Conversas</th>
                      <th className="text-right px-5 py-3 font-medium">Usuários</th>
                      <th className="text-center px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lojasFiltered.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-gray-500">Nenhuma loja encontrada</td>
                      </tr>
                    ) : (
                      lojasFiltered.map((loja) => (
                        <tr key={loja.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="font-medium text-white">{loja.nome_fantasia}</div>
                            <div className="text-xs text-gray-500">{loja.cnpj}</div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${planoColors[loja.plano] ?? "bg-gray-700 text-gray-300"}`}>
                              {loja.plano}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right text-gray-300">{loja.veiculos_ativos}</td>
                          <td className="px-5 py-3.5 text-right text-gray-300">{loja.total_conversas}</td>
                          <td className="px-5 py-3.5 text-right text-gray-300">{loja.total_usuarios}</td>
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
                                  loja.ativo
                                    ? "text-red-400 hover:text-red-300"
                                    : "text-green-400 hover:text-green-300"
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
