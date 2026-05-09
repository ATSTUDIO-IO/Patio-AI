import { useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { PainelLayout, PageHeader } from "@/components/painel/layout";
import {
  useGetVeiculo,
  useListLeads,
  useListConversas,
} from "@workspace/api-client-react";

const COMB_LABELS: Record<string, string> = {
  flex: "Flex",
  gasolina: "Gasolina",
  etanol: "Etanol",
  diesel: "Diesel",
  eletrico: "Elétrico",
  hibrido: "Híbrido",
};

const CAMBIO_LABELS: Record<string, string> = {
  manual: "Manual",
  automatico: "Automático",
  cvt: "CVT",
};

const CATEGORIA_LABELS: Record<string, string> = {
  manutencao_mecanica: "Mecânica",
  manutencao_estetica: "Estética",
  documentacao: "Documentação",
  outros: "Outros",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ativo: { label: "Ativo", color: "bg-green-100 text-green-700" },
  pausado: { label: "Pausado", color: "bg-yellow-100 text-yellow-700" },
  vendido: { label: "Vendido", color: "bg-gray-100 text-gray-600" },
};

const LEAD_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  novo: { label: "Novo", color: "bg-orange-100 text-orange-700" },
  em_contato: { label: "Em contato", color: "bg-yellow-100 text-yellow-700" },
  ganho: { label: "Ganho", color: "bg-green-100 text-green-700" },
  perdido: { label: "Perdido", color: "bg-red-100 text-red-700" },
};

const INTERESSE_LABELS: Record<string, { label: string; color: string }> = {
  alto: { label: "Alto", color: "text-green-600 font-semibold" },
  medio: { label: "Médio", color: "text-yellow-600" },
  baixo: { label: "Baixo", color: "text-gray-400" },
};

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

function timeAgo(dateStr: string | Date | null | undefined) {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

function SectionCard({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  color = "text-gray-900",
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function DiasPatioBadge({ dias, status }: { dias?: number | null; status: string }) {
  if (status !== "ativo" || dias == null)
    return <span className="text-gray-400 text-sm">—</span>;
  if (dias >= 90) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-700">
        <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
        {dias} dias
      </span>
    );
  }
  if (dias >= 60) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-semibold bg-yellow-100 text-yellow-700">
        <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
        {dias} dias
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-medium bg-green-50 text-green-700">
      <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
      {dias} dias
    </span>
  );
}

export default function VeiculoDetalhe() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const veiculoId = params.id ?? "";

  const { data: veiculo, isLoading } = useGetVeiculo(veiculoId);
  const { data: leads = [] } = useListLeads({ veiculo_id: veiculoId, limit: 50 });
  const { data: conversas = [] } = useListConversas({ veiculo_id: veiculoId, limit: 50 });

  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <PainelLayout>
        <PageHeader title="Ficha do Veículo" />
        <div className="flex items-center justify-center py-24 text-gray-400">
          Carregando...
        </div>
      </PainelLayout>
    );
  }

  if (!veiculo) {
    return (
      <PainelLayout>
        <PageHeader title="Veículo não encontrado" />
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <p className="text-gray-400">Este veículo não foi encontrado.</p>
          <button
            onClick={() => setLocation("/painel/veiculos")}
            className="px-4 py-2 bg-orange-600 text-white text-sm font-semibold rounded-xl hover:bg-orange-700"
          >
            Voltar para Veículos
          </button>
        </div>
      </PainelLayout>
    );
  }

  const titulo = `${veiculo.marca} ${veiculo.modelo}`;
  const subtitulo = `${veiculo.ano_fabricacao}/${veiculo.ano_modelo} · ${veiculo.placa ?? "Sem placa"}`;

  const valorAquisicao = parseFloat(veiculo.valor_aquisicao ?? "0");
  const custoTotal = veiculo.custo_total ?? valorAquisicao;
  const precoVenda = parseFloat(veiculo.preco_venda ?? "0");
  const precoSugerido = veiculo.preco_sugerido ?? null;
  const despesas = veiculo.despesas ?? [];
  const totalDespesas = despesas.reduce((acc, d) => acc + parseFloat(d.valor), 0);

  const margemAtual =
    custoTotal > 0 && precoVenda > 0
      ? ((precoVenda - custoTotal) / custoTotal) * 100
      : null;

  const scans = veiculo.qr_code?.total_scans ?? 0;
  const qr = veiculo.qr_code;

  const handleDownloadQr = () => {
    if (!qr?.imagem_qr) return;
    const link = document.createElement("a");
    link.href = qr.imagem_qr;
    link.download = `qr-${veiculo.marca}-${veiculo.modelo}-${veiculo.ano_fabricacao}.png`;
    link.click();
  };

  return (
    <PainelLayout>
      <PageHeader
        title={titulo}
        subtitle={subtitulo}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLocation("/painel/veiculos")}
              className="px-3 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
            >
              ← Voltar
            </button>
            <Link
              href={`/painel/veiculos/${veiculoId}/editar`}
              className="px-4 py-2 bg-orange-600 text-white text-sm font-semibold rounded-xl hover:bg-orange-700 transition-colors"
            >
              Editar Veículo
            </Link>
          </div>
        }
      />

      <div className="p-6 space-y-5 max-w-5xl">
        {/* Performance metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard
            label="Scans do QR"
            value={scans}
            sub="pessoas escanearam"
            color={scans > 0 ? "text-orange-600" : "text-gray-400"}
          />
          <MetricCard
            label="Leads gerados"
            value={leads.length}
            sub="contatos identificados"
            color={leads.length > 0 ? "text-orange-600" : "text-gray-400"}
          />
          <MetricCard
            label="Conversas"
            value={conversas.length}
            sub="sessões com o agente"
            color={conversas.length > 0 ? "text-purple-600" : "text-gray-400"}
          />
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Tempo no pátio</p>
            <DiasPatioBadge dias={veiculo.dias_no_patio} status={veiculo.status} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Vehicle data */}
          <SectionCard title="Dados do Veículo">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Status</span>
                <span
                  className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_LABELS[veiculo.status]?.color ?? "bg-gray-100 text-gray-600"}`}
                >
                  {STATUS_LABELS[veiculo.status]?.label ?? veiculo.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Placa</span>
                <span className="text-sm font-medium text-gray-900 font-mono">
                  {veiculo.placa ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Cor</span>
                <span className="text-sm text-gray-700">{veiculo.cor ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Quilometragem</span>
                <span className="text-sm text-gray-700">
                  {veiculo.quilometragem?.toLocaleString("pt-BR")} km
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Combustível</span>
                <span className="text-sm text-gray-700">
                  {COMB_LABELS[veiculo.combustivel ?? ""] ?? veiculo.combustivel ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Câmbio</span>
                <span className="text-sm text-gray-700">
                  {CAMBIO_LABELS[veiculo.cambio ?? ""] ?? veiculo.cambio ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Entrada no pátio</span>
                <span className="text-sm text-gray-700">
                  {formatDate(veiculo.data_entrada_patio as string | null)}
                </span>
              </div>
              {veiculo.status === "vendido" && veiculo.vendido_em && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Vendido em</span>
                  <span className="text-sm text-gray-700">
                    {formatDate(veiculo.vendido_em as string)}
                  </span>
                </div>
              )}
              {veiculo.tipo_aquisicao === "consignado" && (
                <div className="mt-2 pt-2 border-t border-gray-50">
                  <span className="inline-block px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-xs font-medium mb-2">
                    Consignado
                  </span>
                  {veiculo.consignado_proprietario_nome && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Proprietário</span>
                      <span className="text-sm text-gray-700">
                        {veiculo.consignado_proprietario_nome}
                      </span>
                    </div>
                  )}
                  {veiculo.comissao_consignado_pct && (
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-500">Comissão loja</span>
                      <span className="text-sm text-gray-700">
                        {veiculo.comissao_consignado_pct}%
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </SectionCard>

          {/* Stock cost */}
          <SectionCard title="Custo de Estoque">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Tipo de aquisição</span>
                <span className="text-sm text-gray-700 capitalize">
                  {veiculo.tipo_aquisicao === "proprio" ? "Próprio" : "Consignado"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Valor de aquisição</span>
                <span className="text-sm font-medium text-gray-900">
                  {formatBRL(valorAquisicao)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  Despesas ({despesas.length})
                </span>
                <span className="text-sm font-medium text-orange-600">
                  + {formatBRL(totalDespesas)}
                </span>
              </div>
              <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700">Custo total</span>
                <span className="text-base font-bold text-gray-900">
                  {formatBRL(custoTotal)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Preço de venda</span>
                <span className="text-sm font-medium text-gray-900">
                  {formatBRL(precoVenda)}
                </span>
              </div>
              {precoSugerido !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Preço sugerido (+20%)</span>
                  <span className="text-sm text-orange-600 font-medium">
                    {formatBRL(precoSugerido)}
                  </span>
                </div>
              )}
              {margemAtual !== null && (
                <div
                  className={`mt-2 p-3 rounded-xl text-sm font-medium ${
                    margemAtual < 0
                      ? "bg-red-50 text-red-700"
                      : margemAtual < 10
                        ? "bg-yellow-50 text-yellow-700"
                        : "bg-green-50 text-green-700"
                  }`}
                >
                  {margemAtual < 0
                    ? `⚠ Preço abaixo do custo (${margemAtual.toFixed(1)}%)`
                    : `Margem atual: ${margemAtual.toFixed(1)}%`}
                </div>
              )}
              {veiculo.status === "vendido" && veiculo.valor_venda_real != null && (
                <div className="mt-2 p-3 rounded-xl bg-green-50">
                  <p className="text-xs text-gray-500 mb-0.5">Valor de venda real</p>
                  <p className="text-base font-bold text-green-700">
                    {formatBRL(Number(veiculo.valor_venda_real))}
                  </p>
                  {(() => {
                    const lucro = Number(veiculo.valor_venda_real) - custoTotal;
                    const margem =
                      Number(veiculo.valor_venda_real) > 0
                        ? (lucro / Number(veiculo.valor_venda_real)) * 100
                        : null;
                    return (
                      <p className={`text-xs mt-0.5 ${lucro >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {lucro >= 0 ? "+" : ""}
                        {formatBRL(lucro)}
                        {margem !== null ? ` · ${margem.toFixed(1)}% margem` : ""}
                      </p>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Expense breakdown */}
            {despesas.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-50">
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                  Histórico de Despesas
                </p>
                <div className="space-y-1.5">
                  {despesas.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50"
                    >
                      <div>
                        <p className="text-xs font-medium text-gray-700">
                          {d.descricao || CATEGORIA_LABELS[d.categoria] || d.categoria}
                        </p>
                        <p className="text-xs text-gray-400">
                          {CATEGORIA_LABELS[d.categoria] ?? d.categoria} ·{" "}
                          {formatDate(d.data)}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-orange-600">
                        {formatBRL(parseFloat(d.valor))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </SectionCard>
        </div>

        {/* QR Code */}
        <SectionCard
          title="QR Code"
          action={
            qr ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadQr}
                  disabled={!qr.imagem_qr}
                  className="text-xs px-3 py-1.5 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-40"
                >
                  Baixar PNG
                </button>
                <Link
                  href={`/painel/veiculos/${veiculoId}/qr`}
                  className="text-xs px-3 py-1.5 border border-gray-200 text-gray-600 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Ver página QR
                </Link>
              </div>
            ) : undefined
          }
        >
          {qr ? (
            <div className="flex flex-col sm:flex-row items-start gap-6">
              {qr.imagem_qr && (
                <img
                  src={qr.imagem_qr}
                  alt="QR Code"
                  className="w-32 h-32 rounded-xl border border-gray-100 flex-shrink-0"
                />
              )}
              <div className="space-y-2 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Total de scans</span>
                  <span className={`text-lg font-bold ${scans > 0 ? "text-orange-600" : "text-gray-400"}`}>
                    {scans}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Status</span>
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${qr.ativo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                  >
                    {qr.ativo ? "Ativo" : "Inativo"}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Link público</p>
                  <a
                    href={qr.url_publica}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-orange-600 hover:underline break-all"
                  >
                    {qr.url_publica}
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">QR Code não disponível para este veículo.</p>
          )}
        </SectionCard>

        {/* Leads */}
        <SectionCard
          title={`Leads gerados (${leads.length})`}
          action={
            leads.length > 0 ? (
              <Link
                href={`/painel/leads`}
                className="text-xs text-orange-600 hover:underline"
              >
                Ver todos os leads →
              </Link>
            ) : undefined
          }
        >
          {leads.length === 0 ? (
            <p className="text-sm text-gray-400">
              Nenhum lead gerado ainda. Os leads aparecem após interações com o agente.
            </p>
          ) : (
            <div className="space-y-2">
              {leads.map((lead) => {
                const status = LEAD_STATUS_LABELS[lead.status_crm] ?? {
                  label: lead.status_crm,
                  color: "bg-gray-100 text-gray-600",
                };
                const interesse = INTERESSE_LABELS[lead.interesse ?? ""] ?? {
                  label: lead.interesse ?? "—",
                  color: "text-gray-400",
                };
                const isExpanded = expandedLeadId === lead.id;
                return (
                  <div
                    key={lead.id}
                    className="border border-gray-100 rounded-xl overflow-hidden"
                  >
                    <button
                      onClick={() =>
                        setExpandedLeadId(isExpanded ? null : lead.id)
                      }
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-500">
                          {(lead.nome ?? "?").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {lead.nome ?? "Lead anônimo"}
                          </p>
                          <p className="text-xs text-gray-400">
                            {lead.telefone ?? lead.email ?? "Sem contato"} ·{" "}
                            {timeAgo(lead.criado_em?.toString())}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs ${interesse.color}`}>
                          {interesse.label}
                        </span>
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}
                        >
                          {status.label}
                        </span>
                        <svg
                          viewBox="0 0 20 20"
                          className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 border-t border-gray-50 bg-gray-50/50 grid grid-cols-2 gap-2 text-xs">
                        {lead.pediu_financiamento && (
                          <span className="px-2 py-1 bg-orange-50 text-orange-700 rounded-lg font-medium">
                            💰 Pediu financiamento
                          </span>
                        )}
                        {lead.pediu_test_drive && (
                          <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded-lg font-medium">
                            🚗 Pediu test drive
                          </span>
                        )}
                        {lead.email && (
                          <div className="col-span-2">
                            <span className="text-gray-400">Email: </span>
                            <span className="text-gray-700">{lead.email}</span>
                          </div>
                        )}
                        {lead.telefone && (
                          <div className="col-span-2">
                            <span className="text-gray-400">Tel: </span>
                            <span className="text-gray-700">{lead.telefone}</span>
                          </div>
                        )}
                        {lead.origem && (
                          <div className="col-span-2">
                            <span className="text-gray-400">Origem: </span>
                            <span className="text-gray-700">{lead.origem}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* Conversations */}
        <SectionCard
          title={`Conversas com o agente (${conversas.length})`}
          action={
            conversas.length > 0 ? (
              <Link
                href={`/painel/conversas`}
                className="text-xs text-orange-600 hover:underline"
              >
                Ver todas →
              </Link>
            ) : undefined
          }
        >
          {conversas.length === 0 ? (
            <p className="text-sm text-gray-400">
              Nenhuma conversa registrada. As sessões aparecem após interações via QR code.
            </p>
          ) : (
            <div className="space-y-2">
              {conversas.map((c) => {
                const duracaoMin =
                  c.duracao_segundos != null
                    ? Math.ceil(c.duracao_segundos / 60)
                    : null;
                return (
                  <div
                    key={c.id}
                    className="border border-gray-100 rounded-xl px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-gray-400">
                            {timeAgo(c.iniciada_em)}
                          </span>
                          {duracaoMin !== null && (
                            <span className="text-xs text-gray-400">
                              · {duracaoMin}min
                            </span>
                          )}
                          {c.simulacao_realizada && (
                            <span className="text-xs px-2 py-0.5 bg-orange-50 text-orange-600 rounded-full font-medium">
                              Simulação
                            </span>
                          )}
                        </div>
                        {c.resumo_ia ? (
                          <p className="text-sm text-gray-700 leading-snug line-clamp-2">
                            {c.resumo_ia}
                          </p>
                        ) : (
                          <p className="text-sm text-gray-400 italic">
                            Sem resumo disponível
                          </p>
                        )}
                      </div>
                      {c.lead && (
                        <div className="flex-shrink-0 text-right">
                          <p className="text-xs font-medium text-gray-700">
                            {c.lead.nome ?? "Anônimo"}
                          </p>
                          <p className="text-xs text-gray-400 capitalize">
                            Interesse {c.lead.interesse}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>
    </PainelLayout>
  );
}
