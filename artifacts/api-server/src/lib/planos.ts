export type PlanoKey = "starter" | "pro" | "full";

export interface PlanoConfig {
  precoUnitario: number;
  veiculosMax: number;
  vendedoresMax: number;
  personalizacaoAvancada: boolean;
  assistenteFinanciamento: boolean;
  consultaDocumental: boolean;
  crmRetencaoDias: number | null;
}

export const PLANOS_CONFIG: Record<PlanoKey, PlanoConfig> = {
  starter: {
    precoUnitario: 36.93,
    veiculosMax: 15,
    vendedoresMax: 1,
    personalizacaoAvancada: false,
    assistenteFinanciamento: false,
    consultaDocumental: false,
    crmRetencaoDias: 1,
  },
  pro: {
    precoUnitario: 53.69,
    veiculosMax: 50,
    vendedoresMax: 5,
    personalizacaoAvancada: true,
    assistenteFinanciamento: true,
    consultaDocumental: true,
    crmRetencaoDias: 30,
  },
  full: {
    precoUnitario: 73.69,
    veiculosMax: 100,
    vendedoresMax: 10,
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

export function serializarPlanoConfig(cfg: PlanoConfig) {
  return {
    preco_unitario: cfg.precoUnitario,
    veiculos_max: cfg.veiculosMax,
    vendedores_max: cfg.vendedoresMax,
    personalizacao_avancada: cfg.personalizacaoAvancada,
    assistente_financiamento: cfg.assistenteFinanciamento,
    consulta_documental: cfg.consultaDocumental,
    crm_retencao_dias: cfg.crmRetencaoDias,
  };
}
