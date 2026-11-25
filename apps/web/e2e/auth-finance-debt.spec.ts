import { activate, attemptOutsideDismissal } from "./device-input.js";
import { test, expect } from "./test.js";
import type { Page } from "@playwright/test";
import { mockStudio, studioIds as I } from "./studio-fixture.js";
import { origin } from "./auth-fixture.js";
import { scanAccessibility } from "./accessibility.js";
const debtId = "019a7b00-0000-7000-8000-000000000062",
  factId = "019a7b00-0000-7000-8000-000000000067";
async function setup(
  page: Page,
  action: "offset" | "adjust",
  options: { denied?: boolean; unknown?: boolean; stale?: boolean } = {},
) {
  await mockStudio(page);
  const writes: Record<string, unknown>[] = [],
    authorities: Record<string, unknown>[] = [];
  let saved = false,
    version = 2;
  const operation = action === "offset" ? "student_credit_offset_v1" : "debt_adjust_v1";
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1),
      req = route.request().postDataJSON();
    const send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } });
    const reject = (code: string) =>
      route.fulfill({ json: { ok: false, error: { code, retryable: false, trace_id: I.role } } });
    if (op === "management_state_get_v1" && req.operation === "collection_record_v1")
      return reject("FORBIDDEN");
    if (op === "finance_directory_get_v1") return reject("FORBIDDEN");
    if (op === "finance_get_v1")
      return send({
        person_id: I.instructor,
        currency: "TRY",
        credit_available_minor: saved && action === "offset" ? "10000" : "20000",
        debts: [
          {
            id: debtId,
            center_id: I.center,
            version,
            remaining_minor: saved ? "50000" : "60000",
            due_at: "2026-11-15T00:00:00Z",
          },
        ],
        movements: { items: [], next_cursor: null, as_of: new Date().toISOString() },
      });
    if (op === "management_state_get_v1" && req.operation === operation) {
      authorities.push(req);
      expect(req.selector).toEqual({
        operation,
        key:
          action === "offset" ? { debt_id: debtId, person_id: I.instructor } : { debt_id: debtId },
      });
      if (options.denied) return reject("FORBIDDEN");
      return send({
        items: [
          {
            entity: { type: "debts", id: debtId },
            exists: true,
            state: "open",
            versions: [{ entity: { type: "debts", id: debtId }, version }],
            current: { operation, values: req.selector.key },
          },
        ],
        next_cursor: null,
        as_of: new Date().toISOString(),
      });
    }
    if (op === operation) {
      writes.push(req);
      expect(req.debt_id).toBe(debtId);
      expect(req.amount_minor).toBe("10000");
      for (const field of ["payment", "occurred_at", "preview"])
        expect(req).not.toHaveProperty(field);
      if (action === "offset") {
        expect(req.expected_version).toBe(saved ? writes[0]!.expected_version : version);
        expect(req.person_id).toBe(I.instructor);
        expect(req.currency).toBe("TRY");
        expect(req).not.toHaveProperty("reason");
      } else {
        expect(req.direction).toBe("decrease");
        expect(req.reason).toBe("Synthetic debt correction");
        expect(req).not.toHaveProperty("expected_version");
        expect(req).not.toHaveProperty("currency");
      }
      if (options.stale && writes.length === 1) {
        version++;
        return reject("VERSION_CONFLICT");
      }
      if (!saved) {
        saved = true;
        version++;
      }
      if (options.unknown && writes.length === 1) return route.abort("failed");
      return send({ primary_id: factId, changed: [], jobs: [] });
    }
    if (op === "operation_status_get_v1") return reject("NOT_FOUND");
    return route.fallback();
  });
  await page.goto(origin + "/login");
  await page.getByLabel("E-posta", { exact: true }).fill("synthetic@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("synthetic-password");
  await activate(page.getByRole("button", { name: "Giriş yap", exact: true }));
  await expect(page).toHaveURL(origin + "/account");
  await expect(page.getByRole("heading", { name: "Hesabım", exact: true })).toBeVisible();
  await page.goto(`${origin}/o/${I.org}/c/${I.center}/finance`);
  await activate(page.getByRole("button", { name: "Üye bazlı finans", exact: true }));
  await page.getByLabel("Üye", { exact: true }).selectOption(I.instructor);
  await page.getByLabel("Para birimi", { exact: true }).fill("TRY");
  await activate(page.getByRole("button", { name: "Finansı getir", exact: true }));
  await activate(page.getByRole("tab", { name: /Açık borçlar/ }));
  await activate(
    page.getByRole("button", {
      name: action === "offset" ? "Borca mahsup" : "Borç düzelt",
      exact: true,
    }),
  );
  const panel = page.getByRole("dialog");
  await expect(panel).toHaveAccessibleName(action === "offset" ? "Borca mahsup" : "Borcu düzelt");
  await panel.getByLabel("Tutar (para biriminin alt birimi)", { exact: true }).fill("10000");
  if (action === "adjust")
    await panel.getByLabel("Gerekçe", { exact: true }).fill("Synthetic debt correction");
  return { panel, writes, authorities };
}
for (const action of ["offset", "adjust"] as const)
  test(`mobile ${action} reviews native debt and rereads its newer projection without cash history`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 950 });
    const { panel, writes } = await setup(page, action);
    if (action === "offset") {
      await expect(panel.getByLabel("Not", { exact: true })).toHaveCount(0);
      await expect(panel.getByLabel("Gerekçe", { exact: true })).toHaveCount(0);
    }
    expect((await scanAccessibility(page, `debt-${action}-editor`)).violations).toEqual([]);
    await activate(panel.getByRole("button", { name: "Etkiyi incele", exact: true }));
    const apply = panel.getByRole("button", {
      name: action === "offset" ? "Mahsup et" : "Düzeltmeyi kaydet",
      exact: true,
    });
    await expect(apply).toBeDisabled();
    expect(writes).toHaveLength(0);
    await activate(panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }), "Space");
    await expect(panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true })).toBeChecked();
    expect((await scanAccessibility(page, `debt-${action}-review`)).violations).toEqual([]);
    await activate(apply);
    await expect(
      panel.getByText("Borç işlemi alındı; güncel borç ve alacak okundu.", { exact: true }),
    ).toBeVisible();
    expect(writes).toHaveLength(1);
    await activate(panel.getByRole("button", { name: "Kapat", exact: true }));
    await expect(
      page
        .getByRole("grid", { name: "Açık borçlar", exact: true })
        .getByText("₺500,00", { exact: true }),
    ).toBeVisible();
    await activate(page.getByRole("tab", { name: /Hareketler/ }));
    await expect(
      page
        .getByRole("grid", { name: "Hareketler", exact: true })
        .getByText("₺100,00", { exact: true }),
    ).toHaveCount(0);
    expect(await page.evaluate("document.documentElement.scrollWidth>innerWidth")).toBe(false);
  });
test("debt action denial never becomes an enabled approval from finance read", async ({ page }) => {
  const { panel, writes } = await setup(page, "adjust", { denied: true });
  await activate(panel.getByRole("button", { name: "Etkiyi incele", exact: true }));
  await expect(
    panel.getByText("Bu borç işlemi için yetki doğrulanamadı.", { exact: true }),
  ).toBeVisible();
  await expect(panel.getByRole("checkbox")).toHaveCount(0);
  expect(writes).toHaveLength(0);
});
test("unknown offset preserves frozen version and key after receipt read fails", async ({
  page,
}) => {
  const { panel, writes } = await setup(page, "offset", { unknown: true });
  await activate(panel.getByRole("button", { name: "Etkiyi incele", exact: true }));
  await activate(panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }), "Space");
  await activate(panel.getByRole("button", { name: "Mahsup et", exact: true }));
  const retry = panel.getByRole("button", { name: "Aynı işlemi tekrar dene", exact: true });
  await expect(retry).toBeVisible();
  await activate(panel.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }));
  await expect(retry).toBeEnabled();
  await attemptOutsideDismissal(panel);
  await expect(panel).toBeVisible();
  await activate(retry);
  await expect(
    panel.getByText("Borç işlemi alındı; güncel borç ve alacak okundu.", { exact: true }),
  ).toBeVisible();
  expect(writes).toHaveLength(2);
  const [a, b] = writes;
  expect({ ...a, request_id: null }).toEqual({ ...b, request_id: null });
  expect(a!.request_id).not.toBe(b!.request_id);
});
test("stale offset requires a fresh debt version and a new explicit approval", async ({ page }) => {
  const { panel, writes, authorities } = await setup(page, "offset", { stale: true });
  await activate(panel.getByRole("button", { name: "Etkiyi incele", exact: true }));
  await activate(panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }), "Space");
  await activate(panel.getByRole("button", { name: "Mahsup et", exact: true }));
  await expect(
    panel.getByText("Borç işlemi uygulanamadı. Güncel kaydı yeniden incele.", { exact: true }),
  ).toBeVisible();
  await expect(panel.getByRole("button", { name: "Mahsup et", exact: true })).toBeDisabled();
  await activate(panel.getByRole("button", { name: "Geri", exact: true }));
  await activate(panel.getByRole("button", { name: "Etkiyi incele", exact: true }));
  await expect(
    panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }),
  ).not.toBeChecked();
  await activate(panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }), "Space");
  await activate(panel.getByRole("button", { name: "Mahsup et", exact: true }));
  await expect(
    panel.getByText("Borç işlemi alındı; güncel borç ve alacak okundu.", { exact: true }),
  ).toBeVisible();
  expect(authorities).toHaveLength(2);
  expect(writes.map((x) => x.expected_version)).toEqual([2, 3]);
  expect(writes[0]!.operation_key).not.toBe(writes[1]!.operation_key);
});
