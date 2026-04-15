import { useState } from "react";
import { PainelLayout, PageHeader } from "@/components/painel/layout";
import { useAuth } from "@/hooks/use-auth";
import { useUpdateLoja, useCreateVendedor, useListUsuarios, useDeleteUsuario } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import type { UsuarioPublic } from "@workspace/api-client-react";

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
      <div className="p-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export default function PainelConfiguracoes() {
  const { user, setAuth, token } = useAuth();
  const lojaId = user?.loja_id ?? "";
  const qc = useQueryClient();

  const [lojaForm, setLojaForm] = useState({
    nome_fantasia: user?.loja?.nome_fantasia ?? "",
    cidade: "",
  });
  const [vendedorForm, setVendedorForm] = useState({ nome: "", email: "", senha: "" });
  const [lojaStatus, setLojaStatus] = useState<string | null>(null);
  const [vendedorStatus, setVendedorStatus] = useState<string | null>(null);

  const updateLoja = useUpdateLoja();
  const createVendedor = useCreateVendedor();
  const deleteUsuario = useDeleteUsuario();
  const { data: usuarios = [] } = useListUsuarios(lojaId);

  const setLoja = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setLojaForm((f) => ({ ...f, [k]: e.target.value }));
  const setVendedor = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setVendedorForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSaveLoja = async (e: React.FormEvent) => {
    e.preventDefault();
    setLojaStatus(null);
    try {
      await updateLoja.mutateAsync({ lojaId, data: { nome_fantasia: lojaForm.nome_fantasia, cidade: lojaForm.cidade || undefined } });
      if (user && token) {
        setAuth(token, { ...user, loja: { ...user.loja!, nome_fantasia: lojaForm.nome_fantasia } });
      }
      setLojaStatus("Salvo com sucesso!");
      setTimeout(() => setLojaStatus(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar";
      setLojaStatus(`Erro: ${msg.replace(/HTTP \d+: /, "")}`);
    }
  };

  const handleCreateVendedor = async (e: React.FormEvent) => {
    e.preventDefault();
    setVendedorStatus(null);
    try {
      await createVendedor.mutateAsync({ lojaId, data: vendedorForm });
      qc.invalidateQueries({ queryKey: [`/lojas/${lojaId}/usuarios`] });
      setVendedorForm({ nome: "", email: "", senha: "" });
      setVendedorStatus("Vendedor criado com sucesso!");
      setTimeout(() => setVendedorStatus(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro";
      setVendedorStatus(`Erro: ${msg.replace(/HTTP \d+: /, "")}`);
    }
  };

  const handleDeleteUsuario = async (usuarioId: string) => {
    if (!confirm("Deseja remover este usuário?")) return;
    await deleteUsuario.mutateAsync({ lojaId, usuarioId });
    qc.invalidateQueries({ queryKey: [`/lojas/${lojaId}/usuarios`] });
  };

  return (
    <PainelLayout>
      <PageHeader title="Configurações" subtitle="Gerencie sua loja e equipe" />
      <div className="p-6 space-y-5 max-w-2xl">
        <SectionCard title="Dados da Loja">
          <form onSubmit={handleSaveLoja} className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Nome da Loja</label>
              <input
                type="text"
                value={lojaForm.nome_fantasia}
                onChange={setLoja("nome_fantasia")}
                required
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Cidade</label>
              <input
                type="text"
                value={lojaForm.cidade}
                onChange={setLoja("cidade")}
                placeholder="Ex: São Paulo, SP"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {lojaStatus && (
              <p className={`text-sm ${lojaStatus.startsWith("Erro") ? "text-red-600" : "text-green-600"}`}>{lojaStatus}</p>
            )}
            <button
              type="submit"
              disabled={updateLoja.isPending}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              {updateLoja.isPending ? "Salvando..." : "Salvar Configurações"}
            </button>
          </form>
        </SectionCard>

        <SectionCard title="Equipe de Vendas">
          <div className="space-y-4">
            <div className="divide-y divide-gray-50 rounded-xl border border-gray-100 overflow-hidden mb-4">
              {usuarios.length === 0 ? (
                <p className="text-sm text-gray-400 p-3 text-center">Nenhum usuário cadastrado</p>
              ) : (usuarios as UsuarioPublic[]).map((u) => (
                <div key={u.id} className="flex items-center justify-between p-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{u.nome}</p>
                    <p className="text-xs text-gray-400">{u.email} · <span className="capitalize">{u.perfil}</span></p>
                  </div>
                  {u.id !== user?.id ? (
                    <button
                      onClick={() => handleDeleteUsuario(u.id)}
                      className="text-xs text-red-500 hover:text-red-700 px-2 py-1 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      Remover
                    </button>
                  ) : (
                    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-lg">Você</span>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t border-gray-100 pt-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Convidar Vendedor</p>
              <form onSubmit={handleCreateVendedor} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Nome</label>
                    <input type="text" value={vendedorForm.nome} onChange={setVendedor("nome")} required placeholder="João Silva" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">E-mail</label>
                    <input type="email" value={vendedorForm.email} onChange={setVendedor("email")} required placeholder="vendedor@loja.com" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Senha Inicial</label>
                  <input type="password" value={vendedorForm.senha} onChange={setVendedor("senha")} required minLength={6} placeholder="Mínimo 6 caracteres" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                {vendedorStatus && (
                  <p className={`text-sm ${vendedorStatus.startsWith("Erro") ? "text-red-600" : "text-green-600"}`}>{vendedorStatus}</p>
                )}
                <button
                  type="submit"
                  disabled={createVendedor.isPending}
                  className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-colors disabled:opacity-60"
                >
                  {createVendedor.isPending ? "Criando..." : "Convidar Vendedor"}
                </button>
              </form>
            </div>
          </div>
        </SectionCard>

        <div className="bg-gray-50 rounded-2xl p-4 text-sm text-gray-500">
          <p className="font-medium text-gray-700 mb-1">Plano Atual: <span className="capitalize">{user?.loja?.plano}</span></p>
          <p className="text-xs">Para alterar o plano, entre em contato com a equipe PátioAI.</p>
        </div>
      </div>
    </PainelLayout>
  );
}
