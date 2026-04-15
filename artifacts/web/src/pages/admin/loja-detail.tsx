import { useState, useEffect } from "react";
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
  usuarios: Usuario[];
  faturas: Fatura[];
};

const planoColors: Record<string, string> = {
  starter: "bg-gray-700 text-gray-300",
  pro: "bg-blue-900 text-blue-300",
  full: "bg-violet-900 text-violet-300",
};

export default function AdminLojaDetail() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const [loja, setLoja] = useState<LojaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  async function carregar() {
    setLoading(true);
    setErro(null);
    try {
      const resp = await fetch(`/api/admin/lojas/${id}`, { headers });
      if (!resp.ok) throw new Error("Loja não encontrada");
      setLoja(await resp.json());
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
          <Link href="/admin/lojas" className="mt-4 inline-block text-violet-400 hover:text-violet-300 text-sm">← Voltar</Link>
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
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-sm text-gray-400 hover:text-white transition-colors">← Painel</Link>
            <button
              onClick={toggleStatus}
              disabled={toggling}
              className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 ${
                loja.ativo
                  ? "bg-red-900/40 text-red-300 hover:bg-red-900/60 border border-red-800"
                  : "bg-green-900/40 text-green-300 hover:bg-green-900/60 border border-green-800"
              }`}
            >
              {toggling ? "..." : loja.ativo ? "Suspender Loja" : "Reativar Loja"}
            </button>
          </div>
        }
      />

      <div className="p-8 space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <div className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wider">Informações</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Razão Social</span>
                <span className="text-white">{loja.razao_social}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Plano</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${planoColors[loja.plano] ?? "bg-gray-700 text-gray-300"}`}>
                  {loja.plano}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Status</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${loja.ativo ? "bg-green-900 text-green-300" : "bg-red-900 text-red-300"}`}>
                  {loja.ativo ? "Ativa" : "Suspensa"}
                </span>
              </div>
              {loja.cidade && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Cidade</span>
                  <span className="text-white">{loja.cidade}</span>
                </div>
              )}
              {loja.email_contato && (
                <div className="flex justify-between">
                  <span className="text-gray-400">E-mail</span>
                  <span className="text-white text-xs">{loja.email_contato}</span>
                </div>
              )}
              {loja.telefone && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Telefone</span>
                  <span className="text-white">{loja.telefone}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-400">Cadastrado em</span>
                <span className="text-white text-xs">{new Date(loja.criado_em).toLocaleDateString("pt-BR")}</span>
              </div>
            </div>
          </div>

          <div className="col-span-2 grid grid-cols-3 gap-3">
            <MiniStat label="Veículos Ativos" value={loja.veiculos_ativos} icon="🚗" />
            <MiniStat label="Conversas" value={loja.total_conversas} icon="💬" />
            <MiniStat label="Usuários" value={loja.usuarios.length} icon="👤" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800">
              <h3 className="text-sm font-semibold text-white">Equipe</h3>
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

          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800">
              <h3 className="text-sm font-semibold text-white">Faturas Recentes</h3>
            </div>
            {loja.faturas.length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-500 text-sm">Nenhuma fatura gerada</div>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {loja.faturas.map((f) => (
                    <tr key={f.id} className="border-b border-gray-800/50">
                      <td className="px-5 py-3">
                        <div className="text-white text-sm">{f.mes_ref.slice(0, 7)}</div>
                        <div className="text-xs text-gray-500">{f.veiculos_ativos} veíc. × R$ {f.preco_unitario}</div>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="text-white font-medium">R$ {f.valor_total.toLocaleString("pt-BR")}</div>
                        <span className={`text-xs ${f.status === "pago" ? "text-green-400" : f.status === "fechado" ? "text-amber-400" : "text-gray-400"}`}>
                          {f.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
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
