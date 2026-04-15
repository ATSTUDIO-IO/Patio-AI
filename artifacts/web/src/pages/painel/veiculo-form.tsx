import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { PainelLayout, PageHeader } from "@/components/painel/layout";
import { useCreateVeiculo, useUpdateVeiculo, useGetVeiculo } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import type { CreateVeiculoRequest } from "@workspace/api-client-react";

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
  const [form, setForm] = useState(EMPTY);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

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
                <input type="text" value={form.placa} onChange={set("placa")} required placeholder="ABC-1234" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Cor</label>
                <input type="text" value={form.cor ?? ""} onChange={set("cor")} placeholder="Prata" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Marca *</label>
                <input type="text" value={form.marca} onChange={set("marca")} required placeholder="Toyota" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Modelo *</label>
                <input type="text" value={form.modelo} onChange={set("modelo")} required placeholder="Corolla" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Ano Fabricação *</label>
                <input type="number" value={form.ano_fabricacao} onChange={set("ano_fabricacao")} required min={1990} max={2030} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Ano Modelo *</label>
                <input type="number" value={form.ano_modelo} onChange={set("ano_modelo")} required min={1990} max={2031} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Preço (R$) *</label>
                <input type="number" value={Number(form.preco_venda)} onChange={(e) => setForm(f => ({ ...f, preco_venda: e.target.value }))} required min={0} step={100} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Quilometragem</label>
                <input type="number" value={form.quilometragem} onChange={set("quilometragem")} min={0} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Combustível</label>
                <select value={form.combustivel ?? "flex"} onChange={set("combustivel")} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
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
                <select value={form.cambio ?? "manual"} onChange={set("cambio")} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="manual">Manual</option>
                  <option value="automatico">Automático</option>
                  <option value="cvt">CVT</option>
                  <option value="semi_automatico">Semi-Automático</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Descrição para o Agente IA</label>
              <textarea
                value={form.descricao_agente ?? ""}
                onChange={set("descricao_agente")}
                rows={4}
                placeholder="Descreva os detalhes que o agente deve mencionar: revisão em dia, único dono, garantia de fábrica, etc."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
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
