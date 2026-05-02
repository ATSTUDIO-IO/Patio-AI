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

const COMB_LABELS: Record<string, string> = {
  flex: "Flex", gasolina: "Gasolina", etanol: "Etanol", diesel: "Diesel", eletrico: "Elétrico", hibrido: "Híbrido"
};

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function AgenteStatus({ temDescricao }: { temDescricao: boolean }) {
  if (temDescricao) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
        Pronto
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
      <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" />
      Incompleto
    </span>
  );
}

function DiasPatioBadge({ dias, status }: { dias?: number; status: string }) {
  if (status !== "ativo" || dias == null) return <span className="text-gray-300 text-xs">—</span>;
  if (dias >= 90) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700" title={`${dias} dias no pátio`}>
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
        {dias}d
      </span>
    );
  }
  if (dias >= 60) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700" title={`${dias} dias no pátio`}>
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block" />
        {dias}d
      </span>
    );
  }
  return <span className="text-gray-500 text-xs">{dias}d</span>;
}

export default function PainelVeiculos() {
  const qc = useQueryClient();
  const [statusFiltro, setStatusFiltro] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const [alertaPatioFiltro, setAlertaPatioFiltro] = useState(false);

  const { data: veiculos = [], isLoading } = useListVeiculos();
  const patchStatus = usePatchVeiculoStatus();

  const handlePatch = async (veiculoId: string, status: string) => {
    await patchStatus.mutateAsync({ veiculoId, data: { status: status as "ativo" | "pausado" | "vendido" } });
    qc.invalidateQueries({ queryKey: ["/veiculos"] });
  };

  const filtrado = veiculos
    .filter((v) => {
      const matchStatus = statusFiltro === "todos" || v.status === statusFiltro;
      const matchBusca = !busca || `${v.marca} ${v.modelo} ${v.placa ?? ""}`.toLowerCase().includes(busca.toLowerCase());
      const matchAlerta = !alertaPatioFiltro || v.alerta_patio === true;
      return matchStatus && matchBusca && matchAlerta;
    })
    .sort((a, b) => (b.qr_code?.total_scans ?? 0) - (a.qr_code?.total_scans ?? 0));

  const totalAlerta = veiculos.filter(v => v.alerta_patio && v.status === "ativo").length;

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
        <div className="flex flex-wrap gap-3 mb-4">
          <input
            type="text"
            placeholder="Buscar por marca, modelo ou placa..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="flex-1 min-w-[180px] border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={statusFiltro}
            onChange={(e) => setStatusFiltro(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="todos">Todos</option>
            <option value="ativo">Ativos</option>
            <option value="pausado">Pausados</option>
            <option value="vendido">Vendidos</option>
          </select>
          <button
            onClick={() => setAlertaPatioFiltro((p) => !p)}
            className={`px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${alertaPatioFiltro ? "bg-orange-100 border-orange-300 text-orange-700" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}
            title="Filtrar veículos com alerta de tempo no pátio"
          >
            ⚠ Pátio {totalAlerta > 0 && <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${alertaPatioFiltro ? "bg-orange-200" : "bg-orange-100 text-orange-700"}`}>{totalAlerta}</span>}
          </button>
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
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Info</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Preço</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Pátio</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Scans</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Agente</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 font-medium text-gray-500">QR</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtrado.map((v) => {
                  const scans = v.qr_code?.total_scans ?? 0;
                  const temQr = !!v.qr_code?.slug;
                  const temDescricao = !!v.descricao_agente;
                  const consignado = v.tipo_aquisicao === "consignado";
                  return (
                    <tr key={v.id} className={`hover:bg-gray-50 ${v.alerta_patio && v.status === "ativo" ? "bg-orange-50/30" : ""}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-1.5">
                          <div>
                            <p className="font-medium text-gray-900">{v.marca} {v.modelo}</p>
                            <p className="text-gray-400 text-xs">{v.ano_fabricacao}/{v.ano_modelo} · {v.placa ?? "—"}</p>
                            {consignado && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">Consignado</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        <p>{v.combustivel ? COMB_LABELS[v.combustivel] ?? v.combustivel : "—"}</p>
                        <p className="text-xs">{v.quilometragem?.toLocaleString("pt-BR")} km</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="font-semibold text-gray-900">{formatBRL(Number(v.preco_venda))}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <DiasPatioBadge dias={v.dias_no_patio} status={v.status} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-semibold ${scans > 0 ? "text-indigo-600" : "text-gray-400"}`}>
                          {scans}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <AgenteStatus temDescricao={temDescricao} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_LABELS[v.status]?.color ?? "bg-gray-100 text-gray-600"}`}>
                          {STATUS_LABELS[v.status]?.label ?? v.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {temQr ? (
                          <Link href={`/painel/veiculos/${v.id}/qr`} title="Ver QR Code">
                            <div className="w-8 h-8 bg-gray-900 rounded flex items-center justify-center hover:bg-gray-700 transition-colors cursor-pointer">
                              <svg viewBox="0 0 24 24" className="w-5 h-5 text-white fill-current">
                                <path d="M3 3h7v7H3V3zm2 2v3h3V5H5zm7-2h7v7h-7V3zm2 2v3h3V5h-3zM3 13h7v7H3v-7zm2 2v3h3v-3H5zm11-2h2v2h-2v-2zm-4 0h2v2h-2v-2zm6 4h2v2h-2v-2zm-6 0h2v2h-2v-2zm4-4h2v4h-2v-4zm-4 4h2v4h-2v-4z"/>
                              </svg>
                            </div>
                          </Link>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <Link href={`/painel/veiculos/${v.id}/editar`} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
                            <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828zM5 12v3h3l-3-3zm-2 4h14v2H3v-2z"/></svg>
                          </Link>
                          {v.status === "ativo" && (
                            <button onClick={() => handlePatch(v.id, "pausado")} className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors text-xs font-medium" title="Pausar">⏸</button>
                          )}
                          {v.status === "pausado" && (
                            <button onClick={() => handlePatch(v.id, "ativo")} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors text-xs font-medium" title="Ativar">▶</button>
                          )}
                          {v.status !== "vendido" && (
                            <button onClick={() => handlePatch(v.id, "vendido")} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-xs font-medium" title="Vendido">✓</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PainelLayout>
  );
}
