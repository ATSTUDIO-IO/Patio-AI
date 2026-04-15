import { useState, useEffect, useRef } from "react";
import { Link, useParams } from "wouter";
import { AdminLayout, AdminPageHeader } from "./layout";
import { useAuth } from "@/hooks/use-auth";

type Usuario = {
  id: string;
  nome: string;
  email: string;
  perfil: string;
  ativo: boolean;
};

type Fatura = {
  id: string;
  mes_ref: string;
  veiculos_ativos: number;
  preco_unitario: number;
  valor_total: number;
  status: string;
  gerado_em: string;
  pago_em: string | null;
};

type Nota = {
  id: string;
  conteudo: string;
  criado_em: string;
  admin_id: string;
};

type InteresseDist = {
  interesse: string;
  total: number;
};

type VeiculoEstoque = {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
  ano_fabricacao: number;
  ano_modelo: number;
  quilometragem: number;
  preco_venda: number;
  status: string;
};

type AnaliseConversas = {
  total: number;
  avg_duracao_segundos: number;
  com_lead_gerado: number;
  taxa_conversao_pct: number;
};

type LojaDetail = {
  id: string;
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  plano: string;
  ativo: boolean;
  cidade: string | null;
  telefone: string | null;
  email_contato: string | null;
  criado_em: string;
  veiculos_ativos: number;
  total_conversas: number;
  total_leads: number;
  leads_30d: number;
  scans_30d: number;
  usuarios: Usuario[];
  faturas: Fatura[];
  notas: Nota[];
  interesse_distribuicao: InteresseDist[];
  estoque: VeiculoEstoque[];
  analise_conversas: AnaliseConversas;
};

const planoColors: Record<string, string> = {
  starter: "bg-gray-700 text-gray-300",
  pro: "bg-blue-900 text-blue-300",
  full: "bg-violet-900 text-violet-300",
};

const statusFaturaColors: Record<string, string> = {
  aberto: "text-amber-400",
  pago: "text-green-400",
  inadimplente: "text-red-400",
};

export default function AdminLojaDetail() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const [loja, setLoja] = useState<LojaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [changingPlano, setChangingPlano] = useState(false);
  const [showPlanoModal, setShowPlanoModal] = useState(false);
  const [novoPlano, setNovoPlano] = useState<"starter" | "pro" | "full">("starter");
  const [novaNota, setNovaNota] = useState("");
  const [savingNota, setSavingNota] = useState(false);
  const [markingPago, setMarkingPago] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);
  const notaRef = useRef<HTMLTextAreaElement>(null);

  const headers = { Authorization: `Bearer ${token}` };

  async function carregar() {
    setLoading(true);
    setErro(null);
    try {
      const resp = await fetch(`/api/admin/lojas/${id}`, { headers });
      if (!resp.ok) throw new Error("Loja não encontrada");
      const data: LojaDetail = await resp.json();
      setLoja(data);
      setNovoPlano(data.plano as "starter" | "pro" | "full");
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, [id]);

  async function toggleStatus() {
    if (!loja) return;
    setToggling(true);
    try {
      const resp = await fetch(`/api/admin/lojas/${loja.id}/status`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: !loja.ativo }),
      });
      if (!resp.ok) throw new Error("Falha ao alterar status");
      await carregar();
    } catch {
      alert("Erro ao alterar status");
    } finally {
      setToggling(false);
    }
  }

  async function alterarPlano() {
    if (!loja) return;
    setChangingPlano(true);
    try {
      const resp = await fetch(`/api/admin/lojas/${loja.id}/plano`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ plano: novoPlano }),
      });
      if (!resp.ok) throw new Error("Falha ao alterar plano");
      setShowPlanoModal(false);
      await carregar();
    } catch {
      alert("Erro ao alterar plano");
    } finally {
      setChangingPlano(false);
    }
  }

  async function marcarPago(cicloId: string) {
    setMarkingPago(cicloId);
    try {
      const resp = await fetch(`/api/admin/billing/${cicloId}/pago`, {
        method: "PATCH",
        headers,
      });
      if (!resp.ok) throw new Error("Falha ao marcar como pago");
      await carregar();
    } catch {
      alert("Erro ao marcar fatura como paga");
    } finally {
      setMarkingPago(null);
    }
  }

  async function adicionarNota() {
    if (!loja || !novaNota.trim()) return;
    setSavingNota(true);
    try {
      const resp = await fetch(`/api/admin/lojas/${loja.id}/notas`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ conteudo: novaNota.trim() }),
      });
      if (!resp.ok) throw new Error("Falha ao salvar nota");
      setNovaNota("");
      await carregar();
    } catch {
      alert("Erro ao salvar nota");
    } finally {
      setSavingNota(false);
    }
  }

  async function exportarCSV() {
    if (!loja) return;
    setExportando(true);
    try {
      const resp = await fetch(`/api/admin/lojas/${loja.id}/exportar`, { headers });
      if (!resp.ok) throw new Error("Falha ao exportar");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `patioai_${loja.nome_fantasia.replace(/\s+/g, "_")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Erro ao exportar dados");
    } finally {
      setExportando(false);
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-24 text-gray-500">Carregando...</div>
      </AdminLayout>
    );
  }

  if (erro || !loja) {
    return (
      <AdminLayout>
        <div className="p-8">
          <div className="p-4 bg-red-900/30 border border-red-800 rounded-xl text-red-300 text-sm">{erro ?? "Loja não encontrada"}</div>
          <Link href="/admin" className="mt-4 inline-block text-violet-400 hover:text-violet-300 text-sm">← Voltar</Link>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <AdminPageHeader
        title={loja.nome_fantasia}
        subtitle={loja.cnpj}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/admin" className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-2">← Painel</Link>
            <button
              onClick={exportarCSV}
              disabled={exportando}
              className="px-3 py-2 text-sm text-gray-300 hover:text-white border border-gray-700 rounded-xl transition-colors disabled:opacity-50"
            >
              {exportando ? "Exportando..." : "Exportar CSV"}
            </button>
            <button
              onClick={() => setShowPlanoModal(true)}
              className="px-3 py-2 text-sm text-blue-300 hover:text-blue-200 border border-blue-800 rounded-xl transition-colors"
            >
              Alterar Plano
            </button>
            <button
              onClick={toggleStatus}
              disabled={toggling}
              className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 ${
                loja.ativo
                  ? "bg-red-900/40 text-red-300 hover:bg-red-900/60 border border-red-800"
                  : "bg-green-900/40 text-green-300 hover:bg-green-900/60 border border-green-800"
              }`}
            >
              {toggling ? "..." : loja.ativo ? "Suspender" : "Reativar"}
            </button>
          </div>
        }
      />

      {showPlanoModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-80 space-y-4">
            <h3 className="text-white font-semibold text-base">Alterar Plano</h3>
            <p className="text-xs text-gray-400">Plano atual: <span className="text-white">{loja.plano}</span></p>
            <select
              value={novoPlano}
              onChange={(e) => setNovoPlano(e.target.value as "starter" | "pro" | "full")}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2 text-sm"
            >
              <option value="starter">Starter — R$ 30/veíc/mês</option>
              <option value="pro">Pro — R$ 50/veíc/mês</option>
              <option value="full">Full — R$ 75/veíc/mês</option>
            </select>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPlanoModal(false)}
                className="flex-1 py-2 text-sm text-gray-400 border border-gray-700 rounded-xl hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={alterarPlano}
                disabled={changingPlano || novoPlano === loja.plano}
                className="flex-1 py-2 text-sm bg-violet-600 hover:bg-violet-700 text-white rounded-xl transition-colors disabled:opacity-50"
              >
                {changingPlano ? "Salvando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="p-8 space-y-6">
        <div className="grid grid-cols-5 gap-4">
          <MiniStat label="Veículos Ativos" value={loja.veiculos_ativos} icon="🚗" />
          <MiniStat label="Total Leads" value={loja.total_leads} icon="👥" />
          <MiniStat label="Leads (30d)" value={loja.leads_30d} icon="📈" />
          <MiniStat label="Conversas (30d)" value={loja.scans_30d} icon="🔊" />
          <MiniStat label="Conversas Total" value={loja.total_conversas} icon="💬" />
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <div className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wider">Informações</div>
            <div className="space-y-2 text-sm">
              <InfoRow label="Razão Social" value={loja.razao_social} />
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Plano</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${planoColors[loja.plano] ?? "bg-gray-700 text-gray-300"}`}>
                  {loja.plano}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Status</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${loja.ativo ? "bg-green-900 text-green-300" : "bg-red-900 text-red-300"}`}>
                  {loja.ativo ? "Ativa" : "Suspensa"}
                </span>
              </div>
              {loja.cidade && <InfoRow label="Cidade" value={loja.cidade} />}
              {loja.email_contato && <InfoRow label="E-mail" value={loja.email_contato} small />}
              {loja.telefone && <InfoRow label="Telefone" value={loja.telefone} />}
              <InfoRow label="Cadastrado em" value={new Date(loja.criado_em).toLocaleDateString("pt-BR")} />
            </div>
          </div>

          <div className="col-span-2 bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Faturas</h3>
              <span className="text-xs text-gray-500">{loja.faturas.length} registros</span>
            </div>
            {loja.faturas.length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-500 text-sm">Nenhuma fatura gerada</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 text-xs">
                    <th className="px-4 py-2 text-left">Mês</th>
                    <th className="px-4 py-2 text-right">Veíc.</th>
                    <th className="px-4 py-2 text-right">Valor</th>
                    <th className="px-4 py-2 text-center">Status</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {loja.faturas.map((f) => (
                    <tr key={f.id} className="border-b border-gray-800/50">
                      <td className="px-4 py-2.5 text-white">{f.mes_ref.slice(0, 7)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-300">{f.veiculos_ativos}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-white">R$ {f.valor_total.toLocaleString("pt-BR")}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`text-xs font-medium ${statusFaturaColors[f.status] ?? "text-gray-400"}`}>
                          {f.status === "aberto" ? "Em aberto" : f.status === "pago" ? "Pago" : "Inadimplente"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {f.status !== "pago" && (
                          <button
                            onClick={() => marcarPago(f.id)}
                            disabled={markingPago === f.id}
                            className="text-xs text-green-400 hover:text-green-300 transition-colors disabled:opacity-50"
                          >
                            {markingPago === f.id ? "..." : "Marcar Pago"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {(loja.interesse_distribuicao ?? []).length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Funil de Leads — Distribuição por Interesse</h3>
            <div className="space-y-2">
              {(() => {
                const total = loja.interesse_distribuicao.reduce((s, i) => s + i.total, 0);
                return loja.interesse_distribuicao.map((item) => {
                  const pct = total > 0 ? Math.round((item.total / total) * 100) : 0;
                  return (
                    <div key={item.interesse}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-300">{item.interesse}</span>
                        <span className="text-gray-500">{item.total} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-violet-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
            {loja.scans_30d > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-800 flex gap-6 text-xs text-gray-400">
                <span>Conversas 30d: <span className="text-white">{loja.scans_30d}</span></span>
                <span>Leads 30d: <span className="text-white">{loja.leads_30d}</span></span>
                <span>
                  Taxa scan→lead:{" "}
                  <span className="text-white">
                    {loja.scans_30d > 0 ? Math.round((loja.leads_30d / loja.scans_30d) * 100) : 0}%
                  </span>
                </span>
              </div>
            )}
          </div>
        )}

        {(loja.estoque ?? []).length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Estoque ({loja.estoque.length})</h3>
            </div>
            <div className="overflow-x-auto max-h-60 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-900">
                  <tr className="border-b border-gray-800 text-gray-400">
                    <th className="px-4 py-2 text-left">Veículo</th>
                    <th className="px-4 py-2 text-right">Km</th>
                    <th className="px-4 py-2 text-right">Preço</th>
                    <th className="px-4 py-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loja.estoque.map((v) => (
                    <tr key={v.id} className="border-b border-gray-800/40">
                      <td className="px-4 py-2">
                        <div className="text-white">{v.marca} {v.modelo}</div>
                        <div className="text-gray-500">{v.ano_fabricacao}/{v.ano_modelo} · {v.placa}</div>
                      </td>
                      <td className="px-4 py-2 text-right text-gray-300">{(v.quilometragem ?? 0).toLocaleString("pt-BR")} km</td>
                      <td className="px-4 py-2 text-right text-white font-medium">R$ {(v.preco_venda ?? 0).toLocaleString("pt-BR")}</td>
                      <td className="px-4 py-2 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          v.status === "ativo" ? "bg-green-900 text-green-300" :
                          v.status === "vendido" ? "bg-gray-700 text-gray-300" : "bg-red-900 text-red-300"
                        }`}>
                          {v.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {loja.analise_conversas && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Análise de Conversas do Agente de Voz</h3>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{loja.analise_conversas.total}</div>
                <div className="text-xs text-gray-400 mt-1">Total de Conversas</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400">
                  {loja.analise_conversas.avg_duracao_segundos > 0
                    ? `${Math.round(loja.analise_conversas.avg_duracao_segundos / 60)}min`
                    : "—"}
                </div>
                <div className="text-xs text-gray-400 mt-1">Duração Média</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">{loja.analise_conversas.com_lead_gerado}</div>
                <div className="text-xs text-gray-400 mt-1">Leads Gerados</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-violet-400">{loja.analise_conversas.taxa_conversao_pct}%</div>
                <div className="text-xs text-gray-400 mt-1">Taxa de Conversão</div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-6">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800">
              <h3 className="text-sm font-semibold text-white">Equipe ({loja.usuarios.length})</h3>
            </div>
            {loja.usuarios.length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-500 text-sm">Nenhum usuário</div>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {loja.usuarios.map((u) => (
                    <tr key={u.id} className="border-b border-gray-800/50">
                      <td className="px-5 py-3">
                        <div className="text-white text-sm">{u.nome}</div>
                        <div className="text-xs text-gray-500">{u.email}</div>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className={`px-2 py-0.5 text-xs rounded font-medium ${
                          u.perfil === "dono" ? "bg-amber-900 text-amber-300" : "bg-gray-700 text-gray-300"
                        }`}>
                          {u.perfil}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-gray-800">
              <h3 className="text-sm font-semibold text-white">Notas Internas ({loja.notas.length})</h3>
            </div>
            <div className="flex-1 overflow-y-auto max-h-48">
              {loja.notas.length === 0 ? (
                <div className="px-5 py-6 text-center text-gray-500 text-sm">Nenhuma nota registrada</div>
              ) : (
                <div className="divide-y divide-gray-800/50">
                  {loja.notas.map((n) => (
                    <div key={n.id} className="px-5 py-3">
                      <p className="text-sm text-gray-200 whitespace-pre-wrap">{n.conteudo}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(n.criado_em).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t border-gray-800">
              <div className="flex gap-2">
                <textarea
                  ref={notaRef}
                  value={novaNota}
                  onChange={(e) => setNovaNota(e.target.value)}
                  placeholder="Adicionar nota interna..."
                  rows={2}
                  className="flex-1 bg-gray-800 border border-gray-700 text-white text-sm rounded-xl px-3 py-2 resize-none focus:outline-none focus:border-violet-600"
                />
                <button
                  onClick={adicionarNota}
                  disabled={savingNota || !novaNota.trim()}
                  className="px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium rounded-xl transition-colors disabled:opacity-50 self-end"
                >
                  {savingNota ? "..." : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

function MiniStat({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center gap-3">
      <span className="text-2xl">{icon}</span>
      <div>
        <div className="text-xl font-bold text-white">{value}</div>
        <div className="text-xs text-gray-400">{label}</div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-400">{label}</span>
      <span className={`text-white ${small ? "text-xs" : ""}`}>{value}</span>
    </div>
  );
}
