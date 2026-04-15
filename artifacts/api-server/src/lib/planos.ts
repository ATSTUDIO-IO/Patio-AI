export type PlanoKey = "starter" | "pro" | "full";

export interface PlanoConfig {
  precoUnitario: number;
  conversasIncluidas: number;
  bufferExcedente: number;
  precoExcedente: number;
  personalizacaoAvancada: boolean;
  assistenteFinanciamento: boolean;
  consultaDocumental: boolean;
  crmRetencaoDias: number | null;
}

export const BUFFER_EXCEDENTE = 20;
export const PRECO_EXCEDENTE = 0.75;

export const PLANOS_CONFIG: Record<PlanoKey, PlanoConfig> = {
  starter: {
    precoUnitario: 129.90,
    conversasIncluidas: 60,
    bufferExcedente: BUFFER_EXCEDENTE,
    precoExcedente: PRECO_EXCEDENTE,
    personalizacaoAvancada: false,
    assistenteFinanciamento: false,
    consultaDocumental: false,
    crmRetencaoDias: 1,
  },
  pro: {
    precoUnitario: 249.90,
    conversasIncluidas: 200,
    bufferExcedente: BUFFER_EXCEDENTE,
    precoExcedente: PRECO_EXCEDENTE,
    personalizacaoAvancada: true,
    assistenteFinanciamento: true,
    consultaDocumental: true,
    crmRetencaoDias: 30,
  },
  full: {
    precoUnitario: 449.90,
    conversasIncluidas: 500,
    bufferExcedente: BUFFER_EXCEDENTE,
    precoExcedente: PRECO_EXCEDENTE,
    personalizacaoAvancada: true,
    assistenteFinanciamento: true,
    consultaDocumental: true,
    crmRetencaoDias: null,
  },
};

export function getPlanoConfig(plano: string): PlanoConfig {
  return PLANOS_CONFIG[plano as PlanoKey] ?? PLANOS_CONFIG.starter;
}

export function getCrmDataSince(plano: string): Date | null {
  const cfg = getPlanoConfig(plano);
  if (cfg.crmRetencaoDias === null) return null;
  const d = new Date();
  if (plano === "starter") {
    return new Date(d.getTime() + 1);
  }
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getInicioMesAtual(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function serializarPlanoConfig(cfg: PlanoConfig) {
  return {
    preco_unitario: cfg.precoUnitario,
    conversas_incluidas: cfg.conversasIncluidas,
    buffer_excedente: cfg.bufferExcedente,
    preco_excedente: cfg.precoExcedente,
    personalizacao_avancada: cfg.personalizacaoAvancada,
    assistente_financiamento: cfg.assistenteFinanciamento,
    consulta_documental: cfg.consultaDocumental,
    crm_retencao_dias: cfg.crmRetencaoDias,
  };
}
