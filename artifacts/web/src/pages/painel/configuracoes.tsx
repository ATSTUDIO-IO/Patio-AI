import { useState } from "react";
import { PainelLayout, PageHeader } from "@/components/painel/layout";
import { useAuth } from "@/hooks/use-auth";
import {
  useUpdateLoja,
  useCreateVendedor,
  useListUsuarios,
  useDeleteUsuario,
  useListFinanciamentos,
  useCreateFinanciamento,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import type { UsuarioPublic } from "@workspace/api-client-react";

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
      <div className="p-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function InputField({
  label,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700 block mb-1">{label}</label>
      <input
        {...props}
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function SelectField({
  label,
  hint,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string }) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700 block mb-1">{label}</label>
      <select
        {...props}
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      >
        {children}
      </select>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function StatusMessage({ msg }: { msg: string | null }) {
  if (!msg) return null;
  const isError = msg.startsWith("Erro");
  return (
    <p className={`text-sm px-3 py-2 rounded-lg ${isError ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}>
      {msg}
    </p>
  );
}

export default function PainelConfiguracoes() {
  const { user, setAuth, token } = useAuth();
  const lojaId = user?.loja_id ?? "";
  const qc = useQueryClient();

  const [lojaForm, setLojaForm] = useState({
    nome_fantasia: user?.loja?.nome_fantasia ?? "",
    telefone: (user?.loja as any)?.telefone ?? "",
    email_contato: (user?.loja as any)?.email_contato ?? "",
    cidade: (user?.loja as any)?.cidade ?? "",
  });

  const [agenteForm, setAgenteForm] = useState({
    nome_agente: (user?.loja as any)?.nome_agente ?? "Agente PátioAI",
    tom_agente: (user?.loja as any)?.tom_agente ?? "amigável e profissional",
  });

  const [vendedorForm, setVendedorForm] = useState({ nome: "", email: "", senha: "" });
  const [lojaStatus, setLojaStatus] = useState<string | null>(null);
  const [agenteStatus, setAgenteStatus] = useState<string | null>(null);
  const [vendedorStatus, setVendedorStatus] = useState<string | null>(null);

  const [financForm, setFinancForm] = useState({
    banco: "",
    modalidade: "CDC" as "CDC" | "consorcio" | "leasing",
    taxa_mensal: "",
    parcelas_min: "12",
    parcelas_max: "60",
    entrada_min_pct: "20",
  });
  const [financStatus, setFinancStatus] = useState<string | null>(null);

  const updateLoja = useUpdateLoja();
  const createVendedor = useCreateVendedor();
  const deleteUsuario = useDeleteUsuario();
  const { data: usuarios = [] } = useListUsuarios(lojaId);
  const { data: financiamentos = [] } = useListFinanciamentos();
  const createFinanciamento = useCreateFinanciamento();

  const setLoja = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setLojaForm((f) => ({ ...f, [k]: e.target.value }));
  const setAgente = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setAgenteForm((f) => ({ ...f, [k]: e.target.value }));
  const setVendedor = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setVendedorForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSaveLoja = async (e: React.FormEvent) => {
    e.preventDefault();
    setLojaStatus(null);
    try {
      await updateLoja.mutateAsync({
        lojaId,
        data: {
          nome_fantasia: lojaForm.nome_fantasia,
          telefone: lojaForm.telefone || undefined,
          email_contato: lojaForm.email_contato || undefined,
          cidade: lojaForm.cidade || undefined,
        },
      });
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

  const handleSaveAgente = async (e: React.FormEvent) => {
    e.preventDefault();
    setAgenteStatus(null);
    try {
      await updateLoja.mutateAsync({
        lojaId,
        data: {
          nome_agente: agenteForm.nome_agente,
          tom_agente: agenteForm.tom_agente,
        },
      });
      setAgenteStatus("Configurações do agente salvas!");
      setTimeout(() => setAgenteStatus(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro";
      setAgenteStatus(`Erro: ${msg.replace(/HTTP \d+: /, "")}`);
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

  const handleCreateFinanciamento = async (e: React.FormEvent) => {
    e.preventDefault();
    setFinancStatus(null);
    try {
      await createFinanciamento.mutateAsync({
        data: {
          banco: financForm.banco,
          modalidade: financForm.modalidade,
          taxa_mensal: parseFloat(financForm.taxa_mensal),
          parcelas_min: parseInt(financForm.parcelas_min),
          parcelas_max: parseInt(financForm.parcelas_max),
          entrada_min_pct: parseFloat(financForm.entrada_min_pct),
          ativo: true,
        },
      });
      qc.invalidateQueries({ queryKey: ["/api/financiamentos"] });
      setFinancForm({ banco: "", modalidade: "CDC", taxa_mensal: "", parcelas_min: "12", parcelas_max: "60", entrada_min_pct: "20" });
      setFinancStatus("Condição adicionada com sucesso!");
      setTimeout(() => setFinancStatus(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro";
      setFinancStatus(`Erro: ${msg.replace(/HTTP \d+: /, "")}`);
    }
  };

  const handleDeleteFinanciamento = async (financId: string) => {
    if (!confirm("Remover esta condição de financiamento?")) return;
    try {
      await fetch(`/api/financiamentos/${financId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      qc.invalidateQueries({ queryKey: ["/api/financiamentos"] });
    } catch {
      alert("Erro ao remover condição");
    }
  };

  const TOM_OPTIONS = [
    "amigável e profissional",
    "formal e técnico",
    "descontraído e jovial",
    "consultivo e paciente",
    "objetivo e direto",
  ];

  return (
    <PainelLayout>
      <PageHeader title="Configurações" subtitle="Gerencie sua loja e equipe" />
      <div className="p-6 space-y-5 max-w-2xl">
        <SectionCard title="Dados da Loja" subtitle="Informações de contato da sua concessionária">
          <form onSubmit={handleSaveLoja} className="space-y-3">
            <InputField
              label="Nome Fantasia"
              value={lojaForm.nome_fantasia}
              onChange={setLoja("nome_fantasia")}
              required
              placeholder="Ex: Pátio dos Sonhos"
            />
            <div className="grid grid-cols-2 gap-3">
              <InputField
                label="Telefone"
                type="tel"
                value={lojaForm.telefone}
                onChange={setLoja("telefone")}
                placeholder="(11) 99999-9999"
              />
              <InputField
                label="Cidade"
                value={lojaForm.cidade}
                onChange={setLoja("cidade")}
                placeholder="São Paulo, SP"
              />
            </div>
            <InputField
              label="E-mail de Contato"
              type="email"
              value={lojaForm.email_contato}
              onChange={setLoja("email_contato")}
              placeholder="contato@sualoja.com.br"
            />
            <StatusMessage msg={lojaStatus} />
            <button
              type="submit"
              disabled={updateLoja.isPending}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              {updateLoja.isPending ? "Salvando..." : "Salvar Dados da Loja"}
            </button>
          </form>
        </SectionCard>

        <SectionCard
          title="Personalização do Agente de Voz"
          subtitle="Configure como o agente IA se apresenta ao comprador"
        >
          <form onSubmit={handleSaveAgente} className="space-y-3">
            <InputField
              label="Nome do Agente"
              value={agenteForm.nome_agente}
              onChange={setAgente("nome_agente")}
              placeholder="Ex: Max, Sofia, Carlos..."
              hint="Este nome será usado pelo agente ao se apresentar ao comprador."
            />
            <SelectField
              label="Tom / Estilo de Comunicação"
              value={agenteForm.tom_agente}
              onChange={setAgente("tom_agente")}
              hint="Define como o agente vai interagir durante a conversa."
            >
              {TOM_OPTIONS.map((tom) => (
                <option key={tom} value={tom}>{tom.charAt(0).toUpperCase() + tom.slice(1)}</option>
              ))}
            </SelectField>
            <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
              <span className="font-semibold">Prévia: </span>
              "Olá! Eu sou o {agenteForm.nome_agente || "Agente"}, seu assistente {agenteForm.tom_agente}. Estou aqui para
              te ajudar a conhecer este veículo. Como posso te ajudar?"
            </div>
            <StatusMessage msg={agenteStatus} />
            <button
              type="submit"
              disabled={updateLoja.isPending}
              className="px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-60"
            >
              {updateLoja.isPending ? "Salvando..." : "Salvar Configurações do Agente"}
            </button>
          </form>
        </SectionCard>

        <SectionCard
          title="Condições de Financiamento"
          subtitle="Tabelas disponíveis para simulação durante a conversa com o comprador"
        >
          <div className="space-y-4">
            <div className="divide-y divide-gray-50 rounded-xl border border-gray-100 overflow-hidden mb-4">
              {financiamentos.length === 0 ? (
                <p className="text-sm text-gray-400 p-3 text-center">Nenhuma condição cadastrada</p>
              ) : (financiamentos as any[]).map((f) => (
                <div key={f.id} className="flex items-center justify-between p-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {f.banco} · <span className="uppercase text-xs font-semibold bg-gray-100 px-1.5 py-0.5 rounded">{f.modalidade}</span>
                    </p>
                    <p className="text-xs text-gray-400">
                      {f.taxa_mensal}% a.m. · {f.parcelas_min}x – {f.parcelas_max}x · entrada mín. {f.entrada_min_pct}%
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteFinanciamento(f.id)}
                    className="text-xs text-red-500 hover:text-red-700 px-2 py-1 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-100 pt-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Adicionar Condição</p>
              <form onSubmit={handleCreateFinanciamento} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <InputField
                    label="Banco / Financeira"
                    value={financForm.banco}
                    onChange={(e) => setFinancForm((f) => ({ ...f, banco: e.target.value }))}
                    required
                    placeholder="Ex: Itaú, Santander, BV"
                  />
                  <SelectField
                    label="Modalidade"
                    value={financForm.modalidade}
                    onChange={(e) => setFinancForm((f) => ({ ...f, modalidade: e.target.value as any }))}
                  >
                    <option value="CDC">CDC (Crédito Direto ao Consumidor)</option>
                    <option value="consorcio">Consórcio</option>
                    <option value="leasing">Leasing</option>
                  </SelectField>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <InputField
                    label="Taxa Mensal (%)"
                    type="number"
                    step="0.01"
                    min="0"
                    value={financForm.taxa_mensal}
                    onChange={(e) => setFinancForm((f) => ({ ...f, taxa_mensal: e.target.value }))}
                    required
                    placeholder="Ex: 1.59"
                  />
                  <InputField
                    label="Parcelas Mín."
                    type="number"
                    min="1"
                    value={financForm.parcelas_min}
                    onChange={(e) => setFinancForm((f) => ({ ...f, parcelas_min: e.target.value }))}
                    required
                    placeholder="12"
                  />
                  <InputField
                    label="Parcelas Máx."
                    type="number"
                    min="1"
                    max="360"
                    value={financForm.parcelas_max}
                    onChange={(e) => setFinancForm((f) => ({ ...f, parcelas_max: e.target.value }))}
                    required
                    placeholder="60"
                  />
                </div>
                <InputField
                  label="Entrada Mínima (%)"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={financForm.entrada_min_pct}
                  onChange={(e) => setFinancForm((f) => ({ ...f, entrada_min_pct: e.target.value }))}
                  required
                  placeholder="20"
                  hint="Percentual mínimo de entrada exigido pela financeira."
                />
                <StatusMessage msg={financStatus} />
                <button
                  type="submit"
                  disabled={createFinanciamento.isPending}
                  className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-colors disabled:opacity-60"
                >
                  {createFinanciamento.isPending ? "Adicionando..." : "Adicionar Condição"}
                </button>
              </form>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Equipe de Vendas" subtitle="Gerencie os usuários que têm acesso ao painel">
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
                  <InputField
                    label="Nome"
                    value={vendedorForm.nome}
                    onChange={setVendedor("nome")}
                    required
                    placeholder="João Silva"
                  />
                  <InputField
                    label="E-mail"
                    type="email"
                    value={vendedorForm.email}
                    onChange={setVendedor("email")}
                    required
                    placeholder="vendedor@loja.com"
                  />
                </div>
                <InputField
                  label="Senha Inicial"
                  type="password"
                  value={vendedorForm.senha}
                  onChange={setVendedor("senha")}
                  required
                  minLength={6}
                  placeholder="Mínimo 6 caracteres"
                />
                <StatusMessage msg={vendedorStatus} />
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
          <p className="font-medium text-gray-700 mb-1">
            Plano Atual: <span className="capitalize">{user?.loja?.plano}</span>
          </p>
          <p className="text-xs">Para alterar o plano, entre em contato com a equipe PátioAI.</p>
        </div>
      </div>
    </PainelLayout>
  );
}
