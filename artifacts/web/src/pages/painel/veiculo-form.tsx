import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { PainelLayout, PageHeader } from "@/components/painel/layout";
import { useCreateVeiculo, useUpdateVeiculo, useGetVeiculo } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import type { CreateVeiculoRequest, VeiculoDespesa, CategoriaDespesaVeiculo } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";

const CATEGORIA_LABELS: Record<CategoriaDespesaVeiculo, string> = {
  manutencao_mecanica: "Manutenção Mecânica",
  manutencao_estetica: "Manutenção Estética",
  documentacao: "Documentação",
  outros: "Outros",
};

const EMPTY: Omit<CreateVeiculoRequest, "loja_id"> = {
  placa: "",
  marca: "",
  modelo: "",
  ano_fabricacao: new Date().getFullYear(),
  ano_modelo: new Date().getFullYear(),
  quilometragem: 0,
  preco_venda: "0",
  cor: "",
  cambio: "manual",
  combustivel: "flex",
  descricao_agente: "",
  opcionais: [],
  tipo_aquisicao: "proprio",
  valor_aquisicao: null,
  consignado_proprietario_nome: null,
  consignado_proprietario_telefone: null,
  comissao_consignado_pct: null,
  data_entrada_patio: new Date().toISOString().slice(0, 10),
};

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function VeiculoForm() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id?: string }>();
  const editId = params.id;
  const qc = useQueryClient();
  const { user, token } = useAuth();
  const planoConfig = user?.plano_config;
  const temConsultaDocumental = planoConfig?.consulta_documental ?? false;
  const [form, setForm] = useState(EMPTY);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [consultaStatus, setConsultaStatus] = useState<string | null>(null);
  const [consultaLoading, setConsultaLoading] = useState(false);

  // Despesas state (only for edit mode)
  const [despesas, setDespesas] = useState<VeiculoDespesa[]>([]);
  const [novaDespesaCategoria, setNovaDespesaCategoria] = useState<CategoriaDespesaVeiculo>("manutencao_mecanica");
  const [novaDespesaDescricao, setNovaDespesaDescricao] = useState("");
  const [novaDespesaValor, setNovaDespesaValor] = useState("");
  const [novaDespesaData, setNovaDespesaData] = useState(new Date().toISOString().slice(0, 10));
  const [addingDespesa, setAddingDespesa] = useState(false);
  const [despesaErro, setDespesaErro] = useState<string | null>(null);

  const { data: veiculo } = useGetVeiculo(editId ?? "");
  const createMutation = useCreateVeiculo();
  const updateMutation = useUpdateVeiculo();

  useEffect(() => {
    if (veiculo) {
      setForm({
        placa: veiculo.placa,
        marca: veiculo.marca,
        modelo: veiculo.modelo,
        ano_fabricacao: veiculo.ano_fabricacao,
        ano_modelo: veiculo.ano_modelo,
        quilometragem: veiculo.quilometragem,
        preco_venda: veiculo.preco_venda,
        cor: veiculo.cor ?? "",
        cambio: (veiculo.cambio ?? "manual") as CreateVeiculoRequest["cambio"],
        combustivel: (veiculo.combustivel ?? "flex") as CreateVeiculoRequest["combustivel"],
        descricao_agente: veiculo.descricao_agente ?? "",
        opcionais: veiculo.opcionais ?? [],
        tipo_aquisicao: veiculo.tipo_aquisicao ?? "proprio",
        valor_aquisicao: veiculo.valor_aquisicao != null ? Number(veiculo.valor_aquisicao) : null,
        consignado_proprietario_nome: veiculo.consignado_proprietario_nome ?? null,
        consignado_proprietario_telefone: veiculo.consignado_proprietario_telefone ?? null,
        comissao_consignado_pct: veiculo.comissao_consignado_pct != null ? Number(veiculo.comissao_consignado_pct) : null,
        data_entrada_patio: veiculo.data_entrada_patio ?? new Date().toISOString().slice(0, 10),
      });
      setDespesas(veiculo.despesas ?? []);
    }
  }, [veiculo]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const val = e.target.type === "number" ? Number(e.target.value) : e.target.value;
    setForm((f) => ({ ...f, [k]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    try {
      if (editId) {
        await updateMutation.mutateAsync({ veiculoId: editId, data: form });
      } else {
        await createMutation.mutateAsync({ data: form });
      }
      qc.invalidateQueries({ queryKey: ["/veiculos"] });
      setSucesso(true);
      setTimeout(() => setLocation("/painel/veiculos"), 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar";
      setErro(msg.replace(/HTTP \d+: /, ""));
    }
  };

  const handleAddDespesa = async () => {
    if (!editId) return;
    if (!novaDespesaDescricao.trim() || !novaDespesaValor || !novaDespesaData) {
      setDespesaErro("Preencha todos os campos da despesa.");
      return;
    }
    setAddingDespesa(true);
    setDespesaErro(null);
    try {
      const resp = await fetch(`/api/veiculos/${editId}/despesas`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          categoria: novaDespesaCategoria,
          descricao: novaDespesaDescricao.trim(),
          valor: Number(novaDespesaValor),
          data: novaDespesaData,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) { setDespesaErro(data.error ?? "Erro ao salvar despesa"); return; }
      setDespesas((prev) => [...prev, data as VeiculoDespesa]);
      setNovaDespesaDescricao("");
      setNovaDespesaValor("");
      setNovaDespesaData(new Date().toISOString().slice(0, 10));
      qc.invalidateQueries({ queryKey: [`/veiculos/${editId}`] });
    } catch {
      setDespesaErro("Erro ao conectar com o servidor.");
    } finally {
      setAddingDespesa(false);
    }
  };

  const handleDeleteDespesa = async (despesaId: string) => {
    if (!editId) return;
    try {
      const resp = await fetch(`/api/veiculos/${editId}/despesas/${despesaId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        setDespesas((prev) => prev.filter((d) => d.id !== despesaId));
        qc.invalidateQueries({ queryKey: [`/veiculos/${editId}`] });
      }
    } catch {
      // silently ignore
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isConsignado = form.tipo_aquisicao === "consignado";

  const totalDespesas = despesas.reduce((acc, d) => acc + Number(d.valor), 0);
  const custoTotal = (Number(form.valor_aquisicao ?? 0)) + totalDespesas;
  const precoSugerido = custoTotal > 0 ? custoTotal * 1.2 : null;

  return (
    <PainelLayout>
      <PageHeader
        title={editId ? "Editar Veículo" : "Novo Veículo"}
        subtitle={editId ? `${veiculo?.marca ?? ""} ${veiculo?.modelo ?? ""}` : "Cadastrar novo veículo"}
        actions={
          <button onClick={() => setLocation("/painel/veiculos")} className="px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50">
            Cancelar
          </button>
        }
      />
      <div className="p-6">
        <div className="max-w-2xl mx-auto space-y-5">
          {erro && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">{erro}</div>}
          {sucesso && <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-600 text-sm">Salvo com sucesso! Redirecionando...</div>}

          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">Dados do Veículo</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Placa *</label>
                <input type="text" value={form.placa} onChange={set("placa")} required placeholder="ABC-1234" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Cor</label>
                <input type="text" value={form.cor ?? ""} onChange={set("cor")} placeholder="Prata" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Marca *</label>
                <input type="text" value={form.marca} onChange={set("marca")} required placeholder="Toyota" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Modelo *</label>
                <input type="text" value={form.modelo} onChange={set("modelo")} required placeholder="Corolla" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Ano Fabricação *</label>
                <input type="number" value={form.ano_fabricacao} onChange={set("ano_fabricacao")} required min={1990} max={2030} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Ano Modelo *</label>
                <input type="number" value={form.ano_modelo} onChange={set("ano_modelo")} required min={1990} max={2031} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Preço de Venda (R$) *</label>
                <input type="number" value={Number(form.preco_venda)} onChange={(e) => setForm(f => ({ ...f, preco_venda: e.target.value }))} required min={0} step={100} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Quilometragem</label>
                <input type="number" value={form.quilometragem} onChange={set("quilometragem")} min={0} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Combustível</label>
                <select value={form.combustivel ?? "flex"} onChange={set("combustivel")} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500">
                  <option value="flex">Flex</option>
                  <option value="gasolina">Gasolina</option>
                  <option value="diesel">Diesel</option>
                  <option value="eletrico">Elétrico</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Câmbio</label>
                <select value={form.cambio ?? "manual"} onChange={set("cambio")} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500">
                  <option value="manual">Manual</option>
                  <option value="automatico">Automático</option>
                  <option value="cvt">CVT</option>
                </select>
              </div>
            </div>

            {/* ERP — Aquisição */}
            <div className="border-t border-gray-100 pt-4 space-y-4">
              <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">Gestão de Estoque (ERP)</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Tipo de Aquisição</label>
                  <select value={form.tipo_aquisicao ?? "proprio"} onChange={set("tipo_aquisicao")} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500">
                    <option value="proprio">Próprio</option>
                    <option value="consignado">Consignado</option>
                  </select>
                </div>
                {!isConsignado && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Valor de Aquisição (R$)</label>
                    <input type="number" value={form.valor_aquisicao ?? ""} onChange={(e) => setForm(f => ({ ...f, valor_aquisicao: e.target.value ? Number(e.target.value) : null }))} min={0} step={100} placeholder="0,00" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Data de Entrada no Pátio</label>
                  <input type="date" value={form.data_entrada_patio ?? ""} onChange={set("data_entrada_patio")} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
              </div>

              {isConsignado && (
                <div className="bg-purple-50 rounded-xl p-4 border border-purple-100 space-y-3">
                  <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Dados do Consignante</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Nome do Proprietário</label>
                      <input type="text" value={form.consignado_proprietario_nome ?? ""} onChange={set("consignado_proprietario_nome")} placeholder="Nome completo" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Telefone do Proprietário</label>
                      <input type="text" value={form.consignado_proprietario_telefone ?? ""} onChange={set("consignado_proprietario_telefone")} placeholder="(11) 99999-9999" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Comissão da Loja (%)</label>
                      <input type="number" value={form.comissao_consignado_pct ?? ""} onChange={(e) => setForm(f => ({ ...f, comissao_consignado_pct: e.target.value ? Number(e.target.value) : null }))} min={0} max={100} step={0.5} placeholder="Ex: 10" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500" />
                    </div>
                  </div>
                </div>
              )}

              {/* Custo total preview */}
              {Number(form.valor_aquisicao ?? 0) > 0 && (
                <div className={`rounded-xl p-4 border ${Number(form.preco_venda) > 0 && Number(form.preco_venda) < custoTotal ? "bg-red-50 border-red-200" : "bg-orange-50 border-orange-100"}`}>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Valor de aquisição</span>
                    <span className="font-medium">{formatBRL(Number(form.valor_aquisicao ?? 0))}</span>
                  </div>
                  {totalDespesas > 0 && (
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-gray-600">Despesas registradas</span>
                      <span className="font-medium">{formatBRL(totalDespesas)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-semibold text-orange-700 mt-2 border-t border-orange-200 pt-2">
                    <span>Custo total</span>
                    <span>{formatBRL(custoTotal)}</span>
                  </div>
                  {precoSugerido && (
                    <div className="flex justify-between text-sm mt-1 text-green-700">
                      <span>Preço sugerido (+20%)</span>
                      <span className="font-semibold">{formatBRL(precoSugerido)}</span>
                    </div>
                  )}
                  {Number(form.preco_venda) > 0 && Number(form.preco_venda) < custoTotal && (
                    <div className="mt-3 flex items-start gap-2 bg-red-100 rounded-lg px-3 py-2">
                      <span className="text-red-500 text-base leading-none mt-0.5">⚠</span>
                      <p className="text-xs text-red-700 font-medium">
                        Preço de venda ({formatBRL(Number(form.preco_venda))}) está <strong>abaixo do custo total</strong> ({formatBRL(custoTotal)}). Você estará vendendo com prejuízo de {formatBRL(custoTotal - Number(form.preco_venda))}.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Descrição para o agente */}
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Descrição para o Agente IA
                </label>
                <p className="text-xs text-gray-400 mb-2">
                  Informe tudo que o agente deve saber: diferenciais, revisão em dia, garantia, histórico, etc.
                </p>
                <textarea
                  value={form.descricao_agente ?? ""}
                  onChange={set("descricao_agente")}
                  rows={4}
                  placeholder="Ex: Único dono, revisão feita em junho/2024 na concessionária, 4 pneus novos, IPVA 2025 pago, garantia de fábrica até 2026, sem multas..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                />
              </div>
              {(form.marca || form.modelo) && (
                <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
                  <p className="text-xs font-semibold text-orange-700 mb-2 uppercase tracking-wide">
                    Prévia — Como o agente vai apresentar
                  </p>
                  <p className="text-sm text-gray-900 leading-relaxed">
                    "Olá! Estou aqui para te apresentar{" "}
                    {form.marca && form.modelo ? (
                      <>o <strong>{form.marca} {form.modelo}</strong></>
                    ) : (
                      "este veículo"
                    )}
                    {form.ano_fabricacao ? ` ${form.ano_fabricacao}` : ""}
                    {form.cor ? ` na cor ${form.cor}` : ""}
                    {form.preco_venda && Number(form.preco_venda) > 0
                      ? `, por ${Number(form.preco_venda).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
                      : ""
                    }
                    {form.quilometragem ? ` com ${form.quilometragem.toLocaleString("pt-BR")} km rodados` : ""}.
                    {form.descricao_agente
                      ? ` ${form.descricao_agente.slice(0, 120)}${form.descricao_agente.length > 120 ? "..." : ""}`
                      : " Como posso te ajudar?"}
                    "
                  </p>
                </div>
              )}
            </div>

            {editId && (
              <div className="border border-dashed border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Consulta Documental</p>
                    <p className="text-xs text-gray-400 mt-0.5">Verifica pendências, multas e restrições do veículo.</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${temConsultaDocumental ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-500"}`}>
                    {temConsultaDocumental ? "Habilitado" : "Full"}
                  </span>
                </div>
                {temConsultaDocumental ? (
                  <>
                    <button
                      type="button"
                      disabled={consultaLoading}
                      onClick={async () => {
                        setConsultaLoading(true);
                        setConsultaStatus(null);
                        try {
                          const resp = await fetch(`/api/veiculos/${editId}/consulta-documental`, {
                            method: "GET",
                            headers: { Authorization: `Bearer ${token}` },
                          });
                          const data = await resp.json();
                          if (!resp.ok) setConsultaStatus(`Erro: ${data.error ?? "Falha na consulta"}`);
                          else setConsultaStatus(data.mensagem ?? "Consulta realizada com sucesso.");
                        } catch {
                          setConsultaStatus("Erro ao conectar com o servidor.");
                        } finally {
                          setConsultaLoading(false);
                        }
                      }}
                      className="px-4 py-2 bg-orange-600 text-white text-sm font-semibold rounded-xl hover:bg-orange-700 transition-colors disabled:opacity-60"
                    >
                      {consultaLoading ? "Consultando..." : "Consultar Documentação"}
                    </button>
                    {consultaStatus && (
                      <p className={`mt-2 text-xs px-3 py-2 rounded-lg ${consultaStatus.startsWith("Erro") ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}>{consultaStatus}</p>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-2 mt-1">
                    <svg viewBox="0 0 20 20" className="w-4 h-4 text-gray-400 fill-current flex-shrink-0">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
                    </svg>
                    <p className="text-xs text-gray-400">Disponível no plano Full. Faça upgrade para acessar.</p>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold text-sm transition-colors disabled:opacity-60"
            >
              {isPending ? "Salvando..." : editId ? "Salvar alterações" : "Cadastrar veículo"}
            </button>
          </form>

          {/* Despesas — só no modo edição */}
          {editId && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">Despesas</h3>
                {totalDespesas > 0 && (
                  <span className="text-sm font-semibold text-gray-700">{formatBRL(totalDespesas)}</span>
                )}
              </div>

              {despesas.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-2">Nenhuma despesa registrada.</p>
              ) : (
                <div className="space-y-1">
                  {despesas.map((d) => (
                    <div key={d.id} className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-gray-50 group">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 truncate">{d.descricao}</p>
                        <p className="text-xs text-gray-400">{CATEGORIA_LABELS[d.categoria as CategoriaDespesaVeiculo] ?? d.categoria} · {d.data}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <span className="text-sm font-medium text-gray-700">{formatBRL(Number(d.valor))}</span>
                        <button
                          onClick={() => handleDeleteDespesa(d.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 rounded transition-all"
                          title="Remover"
                        >
                          <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Adicionar nova despesa */}
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Adicionar Despesa</p>
                {despesaErro && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{despesaErro}</p>}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Categoria</label>
                    <select value={novaDespesaCategoria} onChange={(e) => setNovaDespesaCategoria(e.target.value as CategoriaDespesaVeiculo)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500">
                      <option value="manutencao_mecanica">Manutenção Mecânica</option>
                      <option value="manutencao_estetica">Manutenção Estética</option>
                      <option value="documentacao">Documentação</option>
                      <option value="outros">Outros</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Data</label>
                    <input type="date" value={novaDespesaData} onChange={(e) => setNovaDespesaData(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Descrição</label>
                    <input type="text" value={novaDespesaDescricao} onChange={(e) => setNovaDespesaDescricao(e.target.value)} placeholder="Ex: Troca de óleo" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Valor (R$)</label>
                    <input type="number" value={novaDespesaValor} onChange={(e) => setNovaDespesaValor(e.target.value)} min={0} step={10} placeholder="0,00" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAddDespesa}
                  disabled={addingDespesa}
                  className="w-full py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-medium text-sm transition-colors disabled:opacity-60"
                >
                  {addingDespesa ? "Salvando..." : "+ Adicionar Despesa"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PainelLayout>
  );
}
