import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { authenticatedFetch, customFetch, setAuthTokenGetter, setUnauthorizedHandler } from "../../../../lib/api-client-react/src/custom-fetch";
import { loginRedirect, safeAuthReturnTo } from "./auth-navigation";
import { readVehicleDraft, vehicleDraftKey } from "./vehicle-draft";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  setAuthTokenGetter(null);
  setUnauthorizedHandler(null);
});

function response(status: number) {
  return new Response(JSON.stringify({ error: "Token inválido ou expirado" }), {
    status, headers: { "content-type": "application/json" },
  });
}

test("generated requests report the rejected token, preserving the API error", async () => {
  const rejected: string[] = [];
  setAuthTokenGetter(() => "old-session");
  setUnauthorizedHandler((token) => rejected.push(token));
  globalThis.fetch = async (_, init) => {
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer old-session");
    return response(401);
  };
  await assert.rejects(customFetch("/api/veiculos", { method: "POST", body: "{}" }), { status: 401 });
  assert.deepEqual(rejected, ["old-session"]);
});

test("manual authenticated requests keep their response body available", async () => {
  let rejected = "";
  setUnauthorizedHandler((token) => { rejected = token; });
  globalThis.fetch = async () => response(401);
  const result = await authenticatedFetch("/api/veiculos/id/despesas", {
    headers: { Authorization: "Bearer explicit-session" },
  });
  assert.equal(rejected, "explicit-session");
  assert.equal((await result.json()).error, "Token inválido ou expirado");
});

test("login failures, 403s and unauthenticated requests do not expire a session", async () => {
  const rejected: string[] = [];
  setUnauthorizedHandler((token) => rejected.push(token));
  setAuthTokenGetter(() => "stored");
  globalThis.fetch = async () => response(401);
  await authenticatedFetch("/api/auth/login?source=panel", { method: "POST" });
  await authenticatedFetch("/api/auth/register", { method: "POST" });
  setAuthTokenGetter(null);
  await authenticatedFetch("/api/veiculos");
  globalThis.fetch = async () => response(403);
  await authenticatedFetch("/api/veiculos", { headers: { Authorization: "Bearer stored" } });
  assert.deepEqual(rejected, []);
});

test("successful authenticated requests remain successful", async () => {
  setAuthTokenGetter(async () => "current-session");
  setUnauthorizedHandler(() => assert.fail("must not expire"));
  globalThis.fetch = async (_, init) => {
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer current-session");
    return new Response(JSON.stringify({ id: "new-vehicle" }), {
      status: 201, headers: { "content-type": "application/json" },
    });
  };
  assert.deepEqual(await customFetch("/api/veiculos", { method: "POST", body: "{}" }), { id: "new-vehicle" });
});

test("network failures do not invalidate credentials", async () => {
  setAuthTokenGetter(() => "current-session");
  setUnauthorizedHandler(() => assert.fail("must not expire"));
  globalThis.fetch = async () => { throw new TypeError("Network error"); };
  await assert.rejects(authenticatedFetch("/api/veiculos"), /Network error/);
});

test("return destinations are internal protected routes", () => {
  for (const path of ["https://evil.example", "//evil.example", "/painel/login", "/painel/cadastro?x=1", "/painel\\evil", "/v/demo", ""]) {
    assert.equal(safeAuthReturnTo(path), null, path);
  }
  const path = "/painel/veiculos/novo";
  const redirect = new URL(loginRedirect(path, true), "https://app.example");
  assert.equal(redirect.pathname, "/painel/login");
  assert.equal(redirect.searchParams.get("returnTo"), path);
  assert.equal(redirect.searchParams.get("reason"), "session-expired");
});

test("vehicle drafts round-trip and are isolated by account/store/vehicle", () => {
  const key = vehicleDraftKey("user-1", "store-1");
  assert.notEqual(key, vehicleDraftKey("user-2", "store-1"));
  assert.notEqual(key, vehicleDraftKey("user-1", "store-2"));
  assert.notEqual(key, vehicleDraftKey("user-1", "store-1", "vehicle-1"));
  const value = { form: { placa: "TEST123", marca: "Teste", modelo: "Modelo" },
    expense: { categoria: "outros", descricao: "Rascunho", valor: "50", data: "2026-11-01" } };
  const values = new Map([[key, JSON.stringify(value)]]);
  const storage = { getItem: (name: string) => values.get(name) ?? null } as Storage;
  assert.deepEqual(readVehicleDraft(storage, key), value);
  assert.equal(readVehicleDraft(storage, vehicleDraftKey("user-2", "store-1")), null);
  values.set(key, "{malformed");
  assert.equal(readVehicleDraft(storage, key), null);
  values.set(key, JSON.stringify({ form: {} }));
  assert.equal(readVehicleDraft(storage, key), null);
});
