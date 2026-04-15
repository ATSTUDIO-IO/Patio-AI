import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { PainelLayout, PageHeader } from "@/components/painel/layout";
import { useCreateVeiculo, useUpdateVeiculo, useGetVeiculo } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import type { CreateVeiculoRequest } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";

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
};

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
      });
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

  const isPending = createMutation.isPending || updateMutation.isPending;

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
        <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          {erro && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">{erro}</div>}
          {sucesso && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-green-600 text-sm">Salvo com sucesso! Redirecionando...</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Placa *</label>
                <input type="text" value={form.placa} onChange={set("placa")} required placeholder="ABC-1234" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Cor</label>
                <input type="text" value={form.cor ?? ""} onChange={set("cor")} placeholder="Prata" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Marca *</label>
                <input type="text" value={form.marca} onChange={set("marca")} required placeholder="Toyota" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Modelo *</label>
                <input type="text" value={form.modelo} onChange={set("modelo")} required placeholder="Corolla" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Ano Fabricação *</label>
                <input type="number" value={form.ano_fabricacao} onChange={set("ano_fabricacao")} required min={1990} max={2030} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Ano Modelo *</label>
                <input type="number" value={form.ano_modelo} onChange={set("ano_modelo")} required min={1990} max={2031} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Preço (R$) *</label>
                <input type="number" value={Number(form.preco_venda)} onChange={(e) => setForm(f => ({ ...f, preco_venda: e.target.value }))} required min={0} step={100} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Quilometragem</label>
                <input type="number" value={form.quilometragem} onChange={set("quilometragem")} min={0} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Combustível</label>
                <select value={form.combustivel ?? "flex"} onChange={set("combustivel")} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="flex">Flex</option>
                  <option value="gasolina">Gasolina</option>
                  <option value="etanol">Etanol</option>
                  <option value="diesel">Diesel</option>
                  <option value="eletrico">Elétrico</option>
                  <option value="hibrido">Híbrido</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Câmbio</label>
                <select value={form.cambio ?? "manual"} onChange={set("cambio")} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="manual">Manual</option>
                  <option value="automatico">Automático</option>
                  <option value="cvt">CVT</option>
                  <option value="semi_automatico">Semi-Automático</option>
                </select>
              </div>
            </div>
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
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              {(form.marca || form.modelo) && (
                <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                  <p className="text-xs font-semibold text-indigo-700 mb-2 uppercase tracking-wide">
                    Prévia — Como o agente vai apresentar
                  </p>
                  <p className="text-sm text-indigo-900 leading-relaxed">
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
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${temConsultaDocumental ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                    {temConsultaDocumental ? "Pro / Full" : "Starter"}
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
                      className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-60"
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
                    <p className="text-xs text-gray-400">Disponível nos planos Pro e Full. Faça upgrade para acessar.</p>
                  </div>
                )}
              </div>
            )}
            <button
              type="submit"
              disabled={isPending}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors disabled:opacity-60"
            >
              {isPending ? "Salvando..." : editId ? "Salvar alterações" : "Cadastrar veículo"}
            </button>
          </form>
        </div>
      </div>
    </PainelLayout>
  );
}
