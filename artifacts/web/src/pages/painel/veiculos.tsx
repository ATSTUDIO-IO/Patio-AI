import { Link } from "wouter";
import { useState } from "react";
import { PainelLayout, PageHeader } from "@/components/painel/layout";
import { useListVeiculos, usePatchVeiculoStatus } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ativo: { label: "Ativo", color: "bg-green-100 text-green-700" },
  pausado: { label: "Pausado", color: "bg-yellow-100 text-yellow-700" },
  vendido: { label: "Vendido", color: "bg-gray-100 text-gray-600" },
};

const COMB_LABELS: Record<string, string> = {
  flex: "Flex", gasolina: "Gasolina", etanol: "Etanol", diesel: "Diesel", eletrico: "Elétrico", hibrido: "Híbrido"
};

const PLANO_LABELS: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  full: "Full",
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

function UsageBadge({ atual, limite, plano }: { atual: number; limite: number; plano: string }) {
  const pct = Math.min((atual / limite) * 100, 100);
  const cor = pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-yellow-400" : "bg-blue-500";
  return (
    <div className="flex items-center gap-2">
      <div className="text-xs text-gray-500">
        <span className={`font-semibold ${pct >= 100 ? "text-red-600" : "text-gray-700"}`}>{atual}</span>
        <span className="text-gray-400">/{limite} veículos ativos</span>
        <span className="ml-1 text-gray-400">· Plano {PLANO_LABELS[plano] ?? plano}</span>
      </div>
      <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${cor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function UpgradeBanner({ plano, limite }: { plano: string; limite: number }) {
  return (
    <div className="mx-6 mb-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-amber-800">Limite de {limite} veículos atingido</p>
        <p className="text-xs text-amber-600 mt-0.5">
          {plano === "starter" && "Faça upgrade para o plano Pro e tenha até 50 veículos com agente ativo."}
          {plano === "pro" && "Faça upgrade para o plano Full e tenha até 100 veículos com agente ativo."}
          {plano === "full" && "Você atingiu o limite máximo de veículos com agente ativo no plano Full."}
        </p>
      </div>
      {plano !== "full" && (
        <div className="flex-shrink-0 px-4 py-2 bg-amber-600 text-white text-xs font-semibold rounded-xl hover:bg-amber-700 transition-colors cursor-default">
          Fale com o suporte
        </div>
      )}
    </div>
  );
}

export default function PainelVeiculos() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [statusFiltro, setStatusFiltro] = useState<string>("todos");
  const [busca, setBusca] = useState("");

  const { data: veiculos = [], isLoading } = useListVeiculos();
  const patchStatus = usePatchVeiculoStatus();

  const plano = user?.loja?.plano ?? "starter";
  const planoConfig = user?.plano_config;
  const veiculosAtivosAgente = veiculos.filter(v => v.ativo_agente === true).length;
  const limiteAtingido = planoConfig ? veiculosAtivosAgente >= planoConfig.veiculos_max : false;

  const handlePatch = async (veiculoId: string, status: string) => {
    await patchStatus.mutateAsync({ veiculoId, data: { status: status as "ativo" | "pausado" | "vendido" } });
    qc.invalidateQueries({ queryKey: ["/veiculos"] });
  };

  const filtrado = veiculos
    .filter((v) => {
      const matchStatus = statusFiltro === "todos" || v.status === statusFiltro;
      const matchBusca = !busca || `${v.marca} ${v.modelo} ${v.placa ?? ""}`.toLowerCase().includes(busca.toLowerCase());
      return matchStatus && matchBusca;
    })
    .sort((a, b) => (b.qr_code?.total_scans ?? 0) - (a.qr_code?.total_scans ?? 0));

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

      {planoConfig && (
        <div className="px-6 pb-2">
          <UsageBadge atual={veiculosAtivosAgente} limite={planoConfig.veiculos_max} plano={plano} />
        </div>
      )}

      {limiteAtingido && planoConfig && (
        <UpgradeBanner plano={plano} limite={planoConfig.veiculos_max} />
      )}

      <div className="p-6">
        <div className="flex gap-3 mb-4">
          <input
            type="text"
            placeholder="Buscar por marca, modelo ou placa..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  return (
                    <tr key={v.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{v.marca} {v.modelo}</p>
                        <p className="text-gray-400 text-xs">{v.ano_fabricacao}/{v.ano_modelo} · {v.placa ?? "—"}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        <p>{v.combustivel ? COMB_LABELS[v.combustivel] ?? v.combustivel : "—"}</p>
                        <p className="text-xs">{v.quilometragem?.toLocaleString("pt-BR")} km</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="font-semibold text-gray-900">{formatBRL(Number(v.preco_venda))}</p>
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
