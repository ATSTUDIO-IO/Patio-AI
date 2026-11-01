import { test, expect, type Page } from "@playwright/test";

// Browser-only API fixtures: these tests never create users or change inventory.
const user = {
  id: "session-test-user", loja_id: "session-test-store", nome: "Teste Sessão",
  email: "session@example.invalid", perfil: "dono",
  loja: { id: "session-test-store", nome_fantasia: "Loja de Teste", plano: "full" },
};
const vehicle = {
  id: "test-vehicle", placa: "TEST123", marca: "Teste", modelo: "Sessão",
  ano_fabricacao: 2026, ano_modelo: 2026, quilometragem: 0, preco_venda: "50000",
  cambio: "manual", combustivel: "flex", cor: "", opcionais: [], status: "ativo",
  tipo_aquisicao: "proprio", descricao_agente: "", despesas: [],
};

async function mockApi(page: Page, options: { expired?: boolean; otherAccount?: boolean; edit?: boolean } = {}) {
  let creates = 0;
  let saved: Record<string, unknown> | null = null;
  const account = options.otherAccount ? { ...user, id: "other-user", loja_id: "other-store", loja: { ...user.loja, id: "other-store" } } : user;
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let status = 200;
    let json: unknown = null;
    if (path === "/api/auth/me") {
      if (options.expired && request.headers().authorization !== "Bearer new-session") {
        status = 401; json = { error: "Token inválido ou expirado" };
      } else {
        json = { usuario: account, loja: account.loja, plano_config: null };
      }
    } else if (path === "/api/auth/login") {
      const body = request.postDataJSON();
      if (body.senha === "wrong-password") {
        status = 401; json = { error: "Email ou senha inválidos" };
      } else {
        json = { token: "new-session", usuario: account };
      }
    } else if (path === "/api/veiculos" && request.method() === "POST") {
      creates++;
      if (creates === 1) {
        status = 401; json = { error: "Token inválido ou expirado" };
      } else {
        saved = request.postDataJSON();
        status = 201; json = { ...vehicle, ...saved };
      }
    } else if (path === "/api/veiculos") {
      json = saved ? [{ ...vehicle, ...saved }] : [];
    } else if (path === "/api/veiculos/test-vehicle") {
      json = vehicle;
    }
    await route.fulfill({ status, json });
  });
  return { saved: () => saved };
}

async function seedSession(page: Page) {
  await page.addInitScript((profile) => {
    // Runs only once per tab; full navigations must not reinstate the old token.
    if (!sessionStorage.getItem("fixture-seeded")) {
      localStorage.setItem("patioai_token", "old-session");
      localStorage.setItem("patioai_user", JSON.stringify(profile));
      sessionStorage.setItem("fixture-seeded", "true");
    }
  }, user);
}

function field(page: Page, text: string) {
  return page.locator("label").filter({ hasText: text }).first().locator("..").locator("input,select,textarea").first();
}

async function login(page: Page, password = "valid-test-password") {
  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}

test("expired save returns to login, restores vehicle and saves with the new session", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const api = await mockApi(page);
  await seedSession(page);
  await page.goto("/painel/veiculos/novo");
  await field(page, "Placa").fill("TEST123");
  await field(page, "Marca").fill("Teste");
  await field(page, "Modelo *").fill("Sessão");
  await field(page, "Preço de Venda").fill("50000");
  await field(page, "Descrição para o Agente").fill("Descrição que não pode ser perdida");
  await field(page, "Tipo de Aquisição").selectOption("consignado");
  await field(page, "Nome do Proprietário").fill("Consignante de Teste");
  await field(page, "Telefone do Proprietário").fill("11999990000");
  await field(page, "Comissão da Loja").fill("12.5");
  await page.getByRole("button", { name: "Cadastrar veículo", exact: true }).click();
  await expect(page).toHaveURL(/\/painel\/login\?/);
  const redirect = new URL(page.url());
  expect(redirect.searchParams.get("returnTo")).toBe("/painel/veiculos/novo");
  expect(redirect.searchParams.get("reason")).toBe("session-expired");
  await expect(page.getByRole("status")).toContainText("Sua sessão expirou");
  expect(await page.evaluate(() => localStorage.getItem("patioai_token"))).toBeNull();
  await login(page, "wrong-password");
  await expect(page.getByText(/Email ou senha inválidos/)).toBeVisible();
  await login(page);
  await expect(page).toHaveURL(/\/painel\/veiculos\/novo$/);
  await expect(field(page, "Placa")).toHaveValue("TEST123");
  await expect(field(page, "Marca")).toHaveValue("Teste");
  await expect(field(page, "Modelo *")).toHaveValue("Sessão");
  await expect(field(page, "Preço de Venda")).toHaveValue("50000");
  await expect(field(page, "Descrição para o Agente")).toHaveValue("Descrição que não pode ser perdida");
  await expect(field(page, "Nome do Proprietário")).toHaveValue("Consignante de Teste");
  await expect(field(page, "Comissão da Loja")).toHaveValue("12.5");
  await expect(page.getByRole("status")).toContainText("Rascunho restaurado");
  await page.screenshot({ path: testInfo.outputPath("restored-form.jpg"), fullPage: true });
  await page.getByRole("button", { name: "Cadastrar veículo", exact: true }).click();
  await expect(page).toHaveURL(/\/painel\/veiculos$/);
  expect(api.saved()).toMatchObject({
    placa: "TEST123", marca: "Teste", modelo: "Sessão",
    consignado_proprietario_nome: "Consignante de Teste", comissao_consignado_pct: 12.5,
  });
  await expect(page.getByText("Teste Sessão", { exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("patioai_token"))).toBe("new-session");
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter((key) => key.startsWith("patioai:vehicle-draft:")))).toEqual([]);
  expect(errors).toEqual([]);
});

test("stored rejected session redirects on startup and another account cannot read its draft", async ({ page }) => {
  await mockApi(page, { expired: true, otherAccount: true });
  await seedSession(page);
  await page.addInitScript(() => {
    sessionStorage.setItem("patioai:vehicle-draft:session-test-user:session-test-store:new", JSON.stringify({
      form: { placa: "PRIVATE", marca: "Outra conta", modelo: "Não mostrar" },
      expense: { categoria: "outros", descricao: "", valor: "", data: "2026-11-01" },
    }));
  });
  await page.goto("/painel/veiculos/novo");
  await expect(page).toHaveURL(/reason=session-expired/);
  await login(page);
  await expect(page).toHaveURL(/\/painel\/veiculos\/novo$/);
  await expect(field(page, "Placa")).toHaveValue("");
  await expect(page.getByText("Rascunho restaurado.", { exact: false })).toHaveCount(0);
});

test("an edit draft survives a fresh vehicle read instead of being overwritten", async ({ page }) => {
  await mockApi(page, { edit: true });
  await seedSession(page);
  await page.addInitScript((baseVehicle) => {
    sessionStorage.setItem("patioai:vehicle-draft:session-test-user:session-test-store:test-vehicle", JSON.stringify({
      form: { ...baseVehicle, modelo: "Edição preservada", preco_venda: "65000" },
      expense: { categoria: "outros", descricao: "Despesa pendente", valor: "120", data: "2026-11-01" },
    }));
  }, vehicle);
  await page.goto("/painel/veiculos/test-vehicle/editar");
  await expect(field(page, "Modelo *")).toHaveValue("Edição preservada");
  await expect(field(page, "Preço de Venda")).toHaveValue("65000");
  await expect(page.locator('input[value="Despesa pendente"]')).toBeVisible();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page).toHaveURL(/\/painel\/veiculos$/);
  expect(await page.evaluate(() => sessionStorage.getItem("patioai:vehicle-draft:session-test-user:session-test-store:test-vehicle"))).toBeNull();
});
