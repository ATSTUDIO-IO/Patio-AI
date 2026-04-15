import { Link } from "wouter";
import { useState } from "react";
import { PainelLayout, PageHeader } from "@/components/painel/layout";
import { useListVeiculos, usePatchVeiculoStatus } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ativo: { label: "Ativo", color: "bg-green-100 text-green-700" },
  pausado: { label: "Pausado", color: "bg-yellow-100 text-yellow-700" },
  vendido: { label: "Vendido", color: "bg-gray-100 text-gray-600" },
};

const CAMBIO_LABELS: Record<string, string> = {
  manual: "Manual", automatico: "Automático", cvt: "CVT", semi_automatico: "Semi-Auto"
};

const COMB_LABELS: Record<string, string> = {
  flex: "Flex", gasolina: "Gasolina", etanol: "Etanol", diesel: "Diesel", eletrico: "Elétrico", hibrido: "Híbrido"
};

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function PainelVeiculos() {
  const qc = useQueryClient();
  const [statusFiltro, setStatusFiltro] = useState<string>("todos");
  const [busca, setBusca] = useState("");

  const { data: veiculos = [], isLoading } = useListVeiculos();
  const patchStatus = usePatchVeiculoStatus();

  const handlePatch = async (veiculoId: string, status: string) => {
    await patchStatus.mutateAsync({ veiculoId, data: { status: status as "ativo" | "pausado" | "vendido" } });
    qc.invalidateQueries({ queryKey: ["/veiculos"] });
  };

  const filtrado = veiculos.filter((v) => {
    const matchStatus = statusFiltro === "todos" || v.status === statusFiltro;
    const matchBusca = !busca || `${v.marca} ${v.modelo} ${v.placa ?? ""}`.toLowerCase().includes(busca.toLowerCase());
    return matchStatus && matchBusca;
  });

  return (
    <PainelLayout>
      <PageHeader
        title="Veículos"
        subtitle={`${veiculos.filter(v => v.status === "ativo").length} ativos`}
        actions={
          <Link href="/painel/veiculos/novo" className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors">
            + Novo Veículo
          </Link>
        }
      />

      <div className="p-6">
        <div className="flex gap-3 mb-4">
          <input
            type="text"
            placeholder="Buscar por marca, modelo ou placa..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={statusFiltro}
            onChange={(e) => setStatusFiltro(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="todos">Todos</option>
            <option value="ativo">Ativos</option>
            <option value="pausado">Pausados</option>
            <option value="vendido">Vendidos</option>
          </select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">Carregando...</div>
        ) : filtrado.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 text-lg">Nenhum veículo encontrado</p>
            <Link href="/painel/veiculos/novo" className="mt-3 inline-block px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700">Cadastrar primeiro veículo</Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Veículo</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Detalhes</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Preço</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">KM</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtrado.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{v.marca} {v.modelo}</p>
                      <p className="text-gray-400 text-xs">{v.ano_fabricacao}/{v.ano_modelo} · {v.placa}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      <p>{v.combustivel ? COMB_LABELS[v.combustivel] ?? v.combustivel : "—"} · {v.cambio ? CAMBIO_LABELS[v.cambio] ?? v.cambio : "—"}</p>
                      <p className="text-xs">{v.cor ?? ""}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-semibold text-gray-900">{formatBRL(Number(v.preco_venda))}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-gray-700">{v.quilometragem?.toLocaleString("pt-BR")} km</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_LABELS[v.status]?.color ?? "bg-gray-100 text-gray-600"}`}>
                        {STATUS_LABELS[v.status]?.label ?? v.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Link href={`/painel/veiculos/${v.id}/editar`} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">✏️</Link>
                        <Link href={`/painel/veiculos/${v.id}/qr`} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="QR Code">📱</Link>
                        {v.status === "ativo" && (
                          <button onClick={() => handlePatch(v.id, "pausado")} className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors" title="Pausar">⏸️</button>
                        )}
                        {v.status === "pausado" && (
                          <button onClick={() => handlePatch(v.id, "ativo")} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Ativar">▶️</button>
                        )}
                        {v.status !== "vendido" && (
                          <button onClick={() => handlePatch(v.id, "vendido")} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Marcar vendido">✅</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PainelLayout>
  );
}
