import type { CreateVeiculoRequest } from "@workspace/api-client-react";

export type VehicleFormData = Omit<CreateVeiculoRequest, "loja_id">;
export type VehicleDraft = {
  form: VehicleFormData;
  expense: { categoria: string; descricao: string; valor: string; data: string };
};

export function vehicleDraftKey(userId: string, lojaId: string, vehicleId?: string): string {
  return `patioai:vehicle-draft:${userId}:${lojaId}:${vehicleId ?? "new"}`;
}

export function readVehicleDraft(storage: Storage, key: string): VehicleDraft | null {
  try {
    const value = JSON.parse(storage.getItem(key) ?? "null");
    if (!value?.form || typeof value.form.placa !== "string" ||
        typeof value.form.marca !== "string" || typeof value.form.modelo !== "string" ||
        !value.expense || typeof value.expense.descricao !== "string") return null;
    return value as VehicleDraft;
  } catch {
    return null;
  }
}
