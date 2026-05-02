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
import type { UsuarioPublic, FinanciamentoResponse, CreateFinanciamentoRequestModalidade } from "@workspace/api-client-react";

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
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function TextareaField({
  label,
  hint,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string }) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700 block mb-1">{label}</label>
      <textarea
        {...props}
        rows={3}
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
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
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      >
        {children}
      </select>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function ToggleField({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 ${checked ? "bg-blue-600" : "bg-gray-200"}`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition duration-200 ease-in-out ${checked ? "translate-x-5" : "translate-x-0"}`}
        />
      </button>
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

function LockedSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] z-10 rounded-xl flex flex-col items-center justify-center gap-2 pointer-events-none">
        <div className="flex items-center gap-2 bg-gray-900 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg pointer-events-auto">
          <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current flex-shrink-0">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
          </svg>
          {label}
        </div>
      </div>
      <div className="opacity-40 pointer-events-none select-none">{children}</div>
    </div>
  );
}

const TOM_OPTIONS = [
  { value: "profissional_cordial", label: "Profissional e Cordial" },
  { value: "descontraido_amigavel", label: "Descontraído e Amigável" },
  { value: "consultivo_tecnico", label: "Consultivo e Técnico" },
  { value: "direto_objetivo", label: "Direto e Objetivo" },
];

const TOM_DESCRICAO: Record<string, string> = {
  profissional_cordial: "Consultor confiável, linguagem formal mas acessível, transmite segurança.",
  descontraido_amigavel: "Informal e próximo, como um amigo especialista em carros.",
  consultivo_tecnico: "Foca em dados e especificações, ajuda o cliente a decidir com razão.",
  direto_objetivo: "Vai ao ponto, respostas concisas, resolve a necessidade rapidamente.",
};

export default function PainelConfiguracoes() {
  const { user, setAuth, token } = useAuth();
  const lojaId = user?.loja_id ?? "";
  const planoConfig = user?.plano_config;
  const temPersonalizacaoAvancada = planoConfig?.personalizacao_avancada ?? true;
  const temFinanciamento = planoConfig?.assistente_financiamento ?? true;
  const qc = useQueryClient();

  const [lojaForm, setLojaForm] = useState({
    nome_fantasia: user?.loja?.nome_fantasia ?? "",
    telefone: user?.loja?.telefone ?? "",
    email_contato: user?.loja?.email_contato ?? "",
    cidade: user?.loja?.cidade ?? "",
  });

  const [agenteForm, setAgenteForm] = useState({
    nome_agente: user?.loja?.nome_agente ?? "Agente PátioAI",
    tom_agente: user?.loja?.tom_agente ?? "profissional_cordial",
    horario_atendimento: user?.loja?.horario_atendimento ?? "",
    instrucoes_especificas: user?.loja?.instrucoes_especificas ?? "",
    aceita_troca: user?.loja?.aceita_troca ?? true,
    descricao_garantia: user?.loja?.descricao_garantia ?? "",
    bancos_parceiros: user?.loja?.bancos_parceiros ?? "",
    mencionar_tempo_patio: user?.loja?.mencionar_tempo_patio ?? false,
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
  const setAgente = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
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
          telefone: lojaForm.telefone || null,
          email_contato: lojaForm.email_contato || undefined,
          cidade: lojaForm.cidade || null,
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
          nome_agente: agenteForm.nome_agente || null,
          tom_agente: agenteForm.tom_agente || null,
          horario_atendimento: agenteForm.horario_atendimento || null,
          instrucoes_especificas: agenteForm.instrucoes_especificas || null,
          aceita_troca: agenteForm.aceita_troca,
          descricao_garantia: agenteForm.descricao_garantia || null,
          bancos_parceiros: agenteForm.bancos_parceiros || null,
          mencionar_tempo_patio: agenteForm.mencionar_tempo_patio,
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

  const tomAtual = TOM_OPTIONS.find((t) => t.value === agenteForm.tom_agente);

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
          subtitle="Configure identidade, comportamento e informações que o agente usa nas conversas"
        >
          <form onSubmit={handleSaveAgente} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <InputField
                label="Nome do Agente"
                value={agenteForm.nome_agente}
                onChange={setAgente("nome_agente")}
                placeholder="Ex: Max, Sofia, Carlos..."
                hint="Nome pelo qual o agente se apresenta."
              />
              <SelectField
                label="Perfil de Comportamento"
                value={agenteForm.tom_agente}
                onChange={setAgente("tom_agente")}
                hint={tomAtual ? TOM_DESCRICAO[tomAtual.value] : undefined}
              >
                {TOM_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </SelectField>
            </div>

            <InputField
              label="Horário de Atendimento"
              value={agenteForm.horario_atendimento}
              onChange={setAgente("horario_atendimento")}
              placeholder="Ex: Seg a Sex das 8h às 18h, Sáb das 9h às 13h"
              hint="O agente informa ao lead quando a loja está disponível."
            />

            {temPersonalizacaoAvancada ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <ToggleField
                    label="Aceita Troca de Veículo"
                    hint="O agente menciona essa possibilidade ao lead."
                    checked={agenteForm.aceita_troca}
                    onChange={(val) => setAgenteForm((f) => ({ ...f, aceita_troca: val }))}
                  />
                  <ToggleField
                    label="Mencionar Tempo no Pátio"
                    hint="O agente usa o tempo de estoque (90+ dias) para criar senso de oportunidade ao negociar, quando relevante."
                    checked={agenteForm.mencionar_tempo_patio}
                    onChange={(val) => setAgenteForm((f) => ({ ...f, mencionar_tempo_patio: val }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <InputField
                    label="Bancos Parceiros"
                    value={agenteForm.bancos_parceiros}
                    onChange={setAgente("bancos_parceiros")}
                    placeholder="Ex: Itaú, Santander, BV Financeira"
                    hint="Listados ao simular financiamento."
                  />
                </div>
                <TextareaField
                  label="Descrição da Garantia"
                  value={agenteForm.descricao_garantia}
                  onChange={setAgente("descricao_garantia")}
                  placeholder="Ex: 90 dias de garantia legal + 6 meses de garantia da loja para motor e câmbio."
                  hint="O agente usa essa descrição ao responder sobre garantia."
                />
                <TextareaField
                  label="Instruções Especiais"
                  value={agenteForm.instrucoes_especificas}
                  onChange={setAgente("instrucoes_especificas")}
                  placeholder="Ex: Sempre pergunte se o cliente já possui financiamento pré-aprovado. Destaque o programa de revisão gratuita nos primeiros 3 meses."
                  hint="Orientações extras que o agente deve seguir em todas as conversas."
                />
              </>
            ) : (
              <>
                <ToggleField
                  label="Aceita Troca de Veículo"
                  hint="O agente menciona essa possibilidade ao lead."
                  checked={agenteForm.aceita_troca}
                  onChange={(val) => setAgenteForm((f) => ({ ...f, aceita_troca: val }))}
                />
                <LockedSection label="Disponível no plano Pro e Full">
                  <div className="space-y-4">
                    <InputField
                      label="Bancos Parceiros"
                      value=""
                      onChange={() => {}}
                      placeholder="Ex: Itaú, Santander, BV Financeira"
                      hint="Listados ao simular financiamento."
                    />
                    <TextareaField
                      label="Descrição da Garantia"
                      value=""
                      onChange={() => {}}
                      placeholder="Ex: 90 dias de garantia legal + 6 meses de garantia da loja para motor e câmbio."
                      hint="O agente usa essa descrição ao responder sobre garantia."
                    />
                    <TextareaField
                      label="Instruções Especiais"
                      value=""
                      onChange={() => {}}
                      placeholder="Ex: Sempre pergunte se o cliente já possui financiamento pré-aprovado."
                      hint="Orientações extras que o agente deve seguir em todas as conversas."
                    />
                  </div>
                </LockedSection>
              </>
            )}

            <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
              <span className="font-semibold">Prévia da apresentação: </span>
              "Olá! Eu sou {agenteForm.nome_agente || "o Agente"}, da {user?.loja?.nome_fantasia ?? "nossa loja"}!
              {agenteForm.aceita_troca ? " Aceitamos troca de veículos." : ""} Como posso te ajudar?"
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
          subtitle={temFinanciamento ? "Tabelas disponíveis para simulação durante a conversa com o comprador" : "Disponível nos planos Pro e Full"}
        >
          {!temFinanciamento ? (
            <LockedSection label="Disponível no plano Pro e Full">
              <div className="space-y-4">
                <div className="divide-y divide-gray-50 rounded-xl border border-gray-100 overflow-hidden mb-4">
                  <p className="text-sm text-gray-400 p-3 text-center">Nenhuma condição cadastrada</p>
                </div>
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-sm font-medium text-gray-700 mb-3">Adicionar Condição</p>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <InputField label="Banco / Financeira" value="" onChange={() => {}} placeholder="Ex: Itaú, Santander, BV" />
                      <InputField label="Modalidade" value="" onChange={() => {}} placeholder="CDC, Consórcio, Leasing" />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <InputField label="Taxa Mensal (%)" value="" onChange={() => {}} type="number" placeholder="1.59" />
                      <InputField label="Parcelas Mín." value="" onChange={() => {}} type="number" placeholder="12" />
                      <InputField label="Parcelas Máx." value="" onChange={() => {}} type="number" placeholder="60" />
                    </div>
                    <InputField label="Entrada Mínima (%)" value="" onChange={() => {}} type="number" placeholder="20" />
                  </div>
                </div>
              </div>
            </LockedSection>
          ) : (
          <div className="space-y-4">
            <div className="divide-y divide-gray-50 rounded-xl border border-gray-100 overflow-hidden mb-4">
              {financiamentos.length === 0 ? (
                <p className="text-sm text-gray-400 p-3 text-center">Nenhuma condição cadastrada</p>
              ) : (financiamentos as FinanciamentoResponse[]).map((f) => (
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
                    onChange={(e) => setFinancForm((f) => ({ ...f, modalidade: e.target.value as CreateFinanciamentoRequestModalidade }))}
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
          )}
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
