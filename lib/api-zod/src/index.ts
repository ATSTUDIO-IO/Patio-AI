import * as schemas from "./generated/api";
import type * as models from "./generated/types";

export * from "./generated/api";
export * from "./generated/types";

// Orval emits these names both as runtime schemas and as TypeScript models.
// Explicit merged exports retain both APIs without ambiguous wildcard exports.
export const FecharBillingResponse = schemas.FecharBillingResponse;
export type FecharBillingResponse = models.FecharBillingResponse;
export const PatchAdminLojasLojaIdPlanoBody = schemas.PatchAdminLojasLojaIdPlanoBody;
export type PatchAdminLojasLojaIdPlanoBody = models.PatchAdminLojasLojaIdPlanoBody;
export const PatchAdminLojasLojaIdStatusBody = schemas.PatchAdminLojasLojaIdStatusBody;
export type PatchAdminLojasLojaIdStatusBody = models.PatchAdminLojasLojaIdStatusBody;
export const PatchLeadStatusResponse = schemas.PatchLeadStatusResponse;
export type PatchLeadStatusResponse = models.PatchLeadStatusResponse;
export const PostAdminLojasLojaIdNotasBody = schemas.PostAdminLojasLojaIdNotasBody;
export type PostAdminLojasLojaIdNotasBody = models.PostAdminLojasLojaIdNotasBody;
export const SimularFinanciamentoResponse = schemas.SimularFinanciamentoResponse;
export type SimularFinanciamentoResponse = models.SimularFinanciamentoResponse;
