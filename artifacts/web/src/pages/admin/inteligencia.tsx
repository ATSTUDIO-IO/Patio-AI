import { useState, useEffect } from "react";
import { Link } from "wouter";
import { AdminLayout, AdminPageHeader } from "./layout";
import { useAuth } from "@/hooks/use-auth";

type ScoreSaude = {
  loja_id: string;
  nome_fantasia: string;
  plano: string;
  cidade: string | null;
  score: number;
  risco_churn: "alto" | "medio" | "baixo";
  veiculos_ativos: number;
  leads_30d: number;
  scans_30d: number;
  total_leads: number;
  pagamento_em_dia: boolean;
  elegivel_upsell: boolean;
  mrr_potencial_upsell: number;
};

type PerformanceCidade = {
  cidade: string;
  lojas: number;
  leads_30d: number;
  scans_30d: number;
  media_leads_por_loja: number;
  taxa_conversao_pct: number;
  duracao_media_segundos: number;
};

type JornadaLead = {
  interesse: string;
  total: number;
  avg_duracao_segundos: number;
};

type BenchmarksMercado = {
  ticket_medio_ativo: number;
  marcas_mais_cadastradas: { marca: string; total: number }[];
};

type Resumo = {
  total_lojas: number;
  risco_alto: number;
  risco_medio: number;
  risco_baixo: number;
  total_elegivel_upsell: number;
};

type InteligenciaData = {
  scores_saude: ScoreSaude[];
  sinais_upsell: ScoreSaude[];
  performance_por_cidade: PerformanceCidade[];
  benchmarks_mercado: BenchmarksMercado;
  jornada_lead: JornadaLead[];
  resumo: Resumo;
};

const riscoConfig = {
  alto: { label: "Alto", color: "bg-red-900/40 text-red-300 border border-red-800", dot: "bg-red-500", emoji: "🔴" },
  medio: { label: "Médio", color: "bg-amber-900/40 text-amber-300 border border-amber-800", dot: "bg-amber-500", emoji: "🟡" },
  baixo: { label: "Baixo", color: "bg-green-900/40 text-green-300 border border-green-800", dot: "bg-green-500", emoji: "🟢" },
};

const planoColors: Record<string, string> = {
  starter: "bg-gray-700 text-gray-300",
  pro: "bg-blue-900 text-blue-300",
  full: "bg-violet-900 text-violet-300",
};

function formatDuracao(segundos: number): string {
  if (!segundos) return "—";
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return m > 0 ? `${m}m${s}s` : `${s}s`;
}

export default function AdminInteligencia() {
  const { token } = useAuth();
  const [dados, setDados] = useState<InteligenciaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtroRisco, setFiltroRisco] = useState<"todos" | "alto" | "medio" | "baixo">("todos");

  const headers = { Authorization: `Bearer ${token}` };

  async function carregar() {
    setLoading(true);
    setErro(null);
    try {
      const resp = await fetch("/api/admin/inteligencia", { headers });
      if (!resp.ok) throw new Error("Erro ao carregar dados de inteligência");
      setDados(await resp.json());
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  const scoresFiltrados = dados?.scores_saude.filter((s) =>
    filtroRisco === "todos" ? true : s.risco_churn === filtroRisco
  ) ?? [];

  return (
    <AdminLayout>
      <AdminPageHeader
        title="Inteligência de Dados"
        subtitle="Saúde da base, risco de churn e sinais de upsell"
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
        {loading ? (
          <div className="flex items-center justify-center py-24 text-gray-500">Calculando scores...</div>
        ) : erro ? (
          <div className="p-4 bg-red-900/30 border border-red-800 rounded-xl text-red-300 text-sm">{erro}</div>
        ) : dados ? (
          <>
            <div className="grid grid-cols-4 gap-4">
              <StatCard label="Total Lojas Ativas" value={dados.resumo.total_lojas} color="violet" />
              <div className="rounded-2xl border border-red-800/40 bg-red-900/20 p-5">
                <div className="text-2xl mb-2">🔴</div>
                <div className="text-2xl font-bold text-white">{dados.resumo.risco_alto}</div>
                <div className="text-sm text-gray-400 mt-1">Risco Alto</div>
              </div>
              <div className="rounded-2xl border border-amber-800/40 bg-amber-900/20 p-5">
                <div className="text-2xl mb-2">🟡</div>
                <div className="text-2xl font-bold text-white">{dados.resumo.risco_medio}</div>
                <div className="text-sm text-gray-400 mt-1">Risco Médio</div>
              </div>
              <div className="rounded-2xl border border-green-800/40 bg-green-900/20 p-5">
                <div className="text-2xl mb-2">🟢</div>
                <div className="text-2xl font-bold text-white">{dados.resumo.risco_baixo}</div>
                <div className="text-sm text-gray-400 mt-1">Risco Baixo</div>
              </div>
            </div>

            {dados.sinais_upsell.length > 0 && (
              <div className="bg-blue-900/20 border border-blue-800/40 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xl">⬆️</span>
                  <h2 className="text-base font-semibold text-white">Sinais de Upsell</h2>
                  <span className="ml-auto text-xs text-blue-400">{dados.sinais_upsell.length} loja(s) elegível(is)</span>
                </div>
                <p className="text-xs text-gray-400 mb-4">Lojas no plano Starter com +20 leads/mês — candidatas a upgrade Pro</p>
                <div className="grid grid-cols-2 gap-3">
                  {dados.sinais_upsell.map((s) => (
                    <div key={s.loja_id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <Link href={`/admin/lojas/${s.loja_id}`} className="text-sm font-medium text-white hover:text-blue-300 transition-colors">
                          {s.nome_fantasia}
                        </Link>
                        <p className="text-xs text-gray-400 mt-0.5">{s.leads_30d} leads/mês · {s.veiculos_ativos} veíc. ativos</p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-blue-400">+R$ {((50 - 30) * s.veiculos_ativos).toLocaleString("pt-BR")}</div>
                        <div className="text-xs text-gray-500">MRR potencial</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-6">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-800">
                  <h3 className="text-sm font-semibold text-white">Performance por Cidade</h3>
                </div>
                {dados.performance_por_cidade.length === 0 ? (
                  <div className="px-5 py-8 text-center text-gray-500 text-sm">Nenhum dado disponível</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-400 text-xs">
                        <th className="px-4 py-2 text-left">Cidade</th>
                        <th className="px-4 py-2 text-right">Lojas</th>
                        <th className="px-4 py-2 text-right">Leads 30d</th>
                        <th className="px-4 py-2 text-right">Méd/Loja</th>
                        <th className="px-4 py-2 text-right">Dur. Média</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dados.performance_por_cidade.map((c) => (
                        <tr key={c.cidade} className="border-b border-gray-800/50">
                          <td className="px-4 py-2.5 text-white">{c.cidade}</td>
                          <td className="px-4 py-2.5 text-right text-gray-400">{c.lojas}</td>
                          <td className="px-4 py-2.5 text-right text-gray-300">{c.leads_30d}</td>
                          <td className="px-4 py-2.5 text-right">
                            <span className={`text-xs font-medium ${c.media_leads_por_loja >= 10 ? "text-green-400" : c.media_leads_por_loja >= 5 ? "text-amber-400" : "text-gray-400"}`}>
                              {c.media_leads_por_loja}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right text-gray-400 text-xs">{formatDuracao(c.duracao_media_segundos)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4">Distribuição por Risco de Churn</h3>
                <div className="space-y-3">
                  {(["alto", "medio", "baixo"] as const).map((r) => {
                    const total = dados.resumo.total_lojas || 1;
                    const valor = dados.resumo[`risco_${r}` as keyof Resumo] as number;
                    const pct = Math.round((valor / total) * 100);
                    const cfg = riscoConfig[r];
                    return (
                      <div key={r}>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-gray-400">{cfg.emoji} Risco {cfg.label}</span>
                          <span className="text-white font-medium">{valor} ({pct}%)</span>
                        </div>
                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${cfg.dot}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg">🗺️</span>
                  <h3 className="text-sm font-semibold text-white">Jornada do Lead por Interesse</h3>
                </div>
                <p className="text-xs text-gray-500 mb-4">Duração média das conversas por nível de interesse declarado</p>
                {dados.jornada_lead.length === 0 ? (
                  <div className="py-8 text-center text-gray-600 text-sm">Sem dados de jornada ainda</div>
                ) : (
                  <div className="space-y-3">
                    {dados.jornada_lead.map((j) => {
                      const maxTotal = Math.max(...dados.jornada_lead.map((x) => x.total), 1);
                      const pct = Math.round((j.total / maxTotal) * 100);
                      const interesColor = j.interesse === "alto" ? "bg-green-500" : j.interesse === "medio" ? "bg-amber-500" : "bg-gray-500";
                      return (
                        <div key={j.interesse} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-300 capitalize">{j.interesse}</span>
                            <div className="flex gap-3 text-gray-500">
                              <span>{j.total} leads</span>
                              <span className="text-violet-400">{formatDuracao(j.avg_duracao_segundos)}</span>
                            </div>
                          </div>
                          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${interesColor}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg">📊</span>
                  <h3 className="text-sm font-semibold text-white">Benchmarks de Mercado</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-xl">
                    <div>
                      <div className="text-xs text-gray-400">Ticket Médio (veículos ativos)</div>
                      <div className="text-lg font-bold text-white mt-0.5">
                        R$ {dados.benchmarks_mercado.ticket_medio_ativo.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </div>
                    </div>
                    <div className="text-2xl">💰</div>
                  </div>

                  {dados.benchmarks_mercado.marcas_mais_cadastradas.length > 0 && (
                    <div>
                      <div className="text-xs text-gray-400 mb-2">Marcas mais cadastradas</div>
                      <div className="space-y-1.5">
                        {dados.benchmarks_mercado.marcas_mais_cadastradas.slice(0, 5).map((m, idx) => {
                          const maxM = dados.benchmarks_mercado.marcas_mais_cadastradas[0].total;
                          const pct = Math.round((m.total / maxM) * 100);
                          return (
                            <div key={m.marca} className="flex items-center gap-2">
                              <span className="text-xs text-gray-500 w-4">{idx + 1}</span>
                              <div className="flex-1">
                                <div className="flex justify-between text-xs mb-0.5">
                                  <span className="text-gray-300">{m.marca}</span>
                                  <span className="text-gray-500">{m.total}</span>
                                </div>
                                <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                                  <div className="h-full bg-violet-500 rounded-full" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-white">Score de Saúde por Loja</h2>
                <div className="flex gap-2">
                  {(["todos", "alto", "medio", "baixo"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFiltroRisco(f)}
                      className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                        filtroRisco === f
                          ? "bg-violet-600 text-white"
                          : "text-gray-400 hover:text-white border border-gray-700"
                      }`}
                    >
                      {f === "todos" ? "Todos" : riscoConfig[f].emoji + " " + riscoConfig[f].label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-400 text-xs">
                      <th className="px-5 py-3 text-left">Loja</th>
                      <th className="px-5 py-3 text-left">Plano</th>
                      <th className="px-5 py-3 text-right">Score</th>
                      <th className="px-5 py-3 text-right">Leads 30d</th>
                      <th className="px-5 py-3 text-right">Scans 30d</th>
                      <th className="px-5 py-3 text-right">Veículos</th>
                      <th className="px-5 py-3 text-center">Risco</th>
                      <th className="px-5 py-3 text-center">Pgto</th>
                      <th className="px-5 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {scoresFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-gray-500">Nenhuma loja com esse nível de risco</td>
                      </tr>
                    ) : (
                      scoresFiltrados.map((s) => (
                        <tr key={s.loja_id} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="font-medium text-white">{s.nome_fantasia}</div>
                            {s.cidade && <div className="text-xs text-gray-500">{s.cidade}</div>}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${planoColors[s.plano] ?? "bg-gray-700 text-gray-300"}`}>
                              {s.plano}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${s.score >= 60 ? "bg-green-500" : s.score >= 30 ? "bg-amber-500" : "bg-red-500"}`}
                                  style={{ width: `${Math.min(s.score, 100)}%` }}
                                />
                              </div>
                              <span className="text-white font-medium w-6 text-right">{s.score}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-right text-gray-300">{s.leads_30d}</td>
                          <td className="px-5 py-3.5 text-right text-gray-300">{s.scans_30d}</td>
                          <td className="px-5 py-3.5 text-right text-gray-300">{s.veiculos_ativos}</td>
                          <td className="px-5 py-3.5 text-center">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${riscoConfig[s.risco_churn].color}`}>
                              {riscoConfig[s.risco_churn].label}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <span className={`text-xs ${s.pagamento_em_dia ? "text-green-400" : "text-red-400"}`}>
                              {s.pagamento_em_dia ? "✓" : "✗"}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <Link href={`/admin/lojas/${s.loja_id}`} className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
                              Ver
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </AdminLayout>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    violet: "border-violet-800/40 bg-violet-900/20",
    blue: "border-blue-800/40 bg-blue-900/20",
  };
  return (
    <div className={`rounded-2xl border p-5 ${colors[color] ?? ""}`}>
      <div className="text-2xl mb-2">🏪</div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-sm text-gray-400 mt-1">{label}</div>
    </div>
  );
}
