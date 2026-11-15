import { test, expect } from "./test.js";
import type { Page } from "@playwright/test";
import { mockStudio, studioIds as I } from "./studio-fixture.js";
import { origin } from "./auth-fixture.js";
import { scanAccessibility } from "./accessibility.js";
const refundId = "019a7b00-0000-7000-8000-000000000065";
async function setup(
  page: Page,
  options: { denied?: boolean; unknown?: boolean; race?: boolean } = {},
) {
  await mockStudio(page);
  const writes: Record<string, unknown>[] = [];
  let saved = false;
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1),
      req = route.request().postDataJSON();
    const send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } });
    const reject = (code: string, retryable = false) =>
      route.fulfill({ json: { ok: false, error: { code, retryable, trace_id: I.role } } });
    if (op === "finance_get_v1") {
      expect(req.person_id).toBe(I.instructor);
      expect(req.currency).toBe("TRY");
      return send({
        person_id: I.instructor,
        currency: "TRY",
        credit_available_minor: saved ? "20000" : "30000",
        debts: [],
        movements: {
          items: saved
            ? [
                {
                  id: refundId,
                  kind: "refund",
                  amount_minor: "10000",
                  currency: "TRY",
                  occurred_at: "2026-11-15T12:00:00+00:00",
                  center_id: I.center,
                  payment: null,
                  previous_id: null,
                },
              ]
            : [],
          next_cursor: null,
          as_of: new Date().toISOString(),
        },
      });
    }
    if (
      op === "management_state_get_v1" &&
      ["student_credit_refund_v1", "collection_record_v1"].includes(req.operation)
    ) {
      expect(req.selector).toEqual({ operation: req.operation, key: { person_id: I.instructor } });
      if (options.denied && req.operation === "student_credit_refund_v1")
        return reject("FORBIDDEN");
      return send({
        items: [
          {
            entity: { type: "people", id: I.instructor },
            exists: true,
            state: null,
            versions: [],
            current: { operation: req.operation, values: { person_id: I.instructor } },
          },
        ],
        next_cursor: null,
        as_of: new Date().toISOString(),
      });
    }
    if (op === "student_credit_refund_v1") {
      writes.push(req);
      expect(req).toMatchObject({
        person_id: I.instructor,
        currency: "TRY",
        amount_minor: "10000",
        reason: "Synthetic cash refund",
        occurred_at: "2026-11-15T12:00:00Z",
      });
      for (const field of ["payment", "debt_id", "preview"]) expect(req).not.toHaveProperty(field);
      if (options.race) return reject("INSUFFICIENT_STUDENT_CREDIT");
      saved = true;
      if (options.unknown && writes.length === 1) return route.abort("failed");
      return send({ primary_id: refundId, changed: [], jobs: [] });
    }
    if (op === "operation_status_get_v1") return reject("NOT_FOUND");
    return route.fallback();
  });
  await page.goto(origin + "/login");
  await page.getByLabel("E-posta", { exact: true }).fill("synthetic@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("synthetic-password");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(origin + "/account");
  await page.goto(`${origin}/o/${I.org}/c/${I.center}/finance`);
  await page.getByLabel("Üye", { exact: true }).selectOption(I.instructor);
  await page.getByLabel("Para birimi", { exact: true }).fill("TRY");
  await page.getByRole("button", { name: "Finansı getir", exact: true }).click();
  await page.getByRole("tab", { name: /Alacaklar/ }).click();
  await page.getByRole("button", { name: "Nakit iade", exact: true }).click();
  const panel = page.getByRole("dialog");
  await expect(panel).toHaveAccessibleName("Nakit iade");
  await panel.getByLabel("Tutar (para biriminin alt birimi)", { exact: true }).fill("10000");
  await panel.getByLabel("İşlem tarihi ve saati", { exact: true }).fill("2026-11-15T15:00");
  await panel.getByLabel("Gerekçe", { exact: true }).fill("Synthetic cash refund");
  return { writes, panel };
}
test("mobile cash refund reviews current credit, records one native refund and rereads credit", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 950 });
  const { writes, panel } = await setup(page);
  await panel.getByLabel("Tutar (para biriminin alt birimi)", { exact: true }).fill("40000");
  await panel.getByRole("button", { name: "Etkiyi incele", exact: true }).click();
  await expect(
    panel.getByText("Üye alacağı iade tutarı için yetersiz.", { exact: true }),
  ).toBeVisible();
  expect(writes).toHaveLength(0);
  await panel.getByLabel("Tutar (para biriminin alt birimi)", { exact: true }).fill("10000");
  expect((await scanAccessibility(page, "credit-refund-editor")).violations).toEqual([]);
  await panel.getByRole("button", { name: "Etkiyi incele", exact: true }).click();
  await expect(panel.getByRole("button", { name: "İadeyi kaydet", exact: true })).toBeDisabled();
  await expect(panel.getByText("₺300,00", { exact: true })).toBeVisible();
  expect(writes).toHaveLength(0);
  await panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }).press("Space");
  await expect(panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true })).toBeChecked();
  expect((await scanAccessibility(page, "credit-refund-review")).violations).toEqual([]);
  await panel.getByRole("button", { name: "İadeyi kaydet", exact: true }).click();
  await expect(
    panel.getByText("Nakit iade hareketi ve güncel alacak doğrulandı.", { exact: true }),
  ).toBeVisible();
  expect(writes).toHaveLength(1);
  await panel.getByRole("button", { name: "Kapat", exact: true }).click();
  await expect(
    page
      .getByRole("grid", { name: "Alacaklar", exact: true })
      .getByText("₺200,00", { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate("document.documentElement.scrollWidth>innerWidth")).toBe(false);
});
test("finance read or collection permission cannot authorize cash refund", async ({ page }) => {
  const { writes, panel } = await setup(page, { denied: true });
  await panel.getByRole("button", { name: "Etkiyi incele", exact: true }).click();
  await expect(
    panel.getByText("Bu kişi için nakit iade yetkisi doğrulanamadı.", { exact: true }),
  ).toBeVisible();
  await expect(panel.getByRole("checkbox")).toHaveCount(0);
  expect(writes).toHaveLength(0);
});
test("unknown refund preserves its frozen key after receipt failure and cannot dismiss", async ({
  page,
}) => {
  const { writes, panel } = await setup(page, { unknown: true });
  await panel.getByRole("button", { name: "Etkiyi incele", exact: true }).click();
  await panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }).press("Space");
  await panel.getByRole("button", { name: "İadeyi kaydet", exact: true }).click();
  const retry = panel.getByRole("button", { name: "Aynı işlemi tekrar dene", exact: true });
  await expect(retry).toBeVisible();
  await panel.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }).click();
  await expect(retry).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(panel).toBeVisible();
  await retry.click();
  await expect(
    panel.getByText("Nakit iade hareketi ve güncel alacak doğrulandı.", { exact: true }),
  ).toBeVisible();
  expect(writes).toHaveLength(2);
  const [a, b] = writes;
  expect(a!.request_id).not.toBe(b!.request_id);
  expect({ ...a, request_id: null }).toEqual({ ...b, request_id: null });
});
test("credit consumed after review is a native rejection without optimistic refund success", async ({
  page,
}) => {
  const { writes, panel } = await setup(page, { race: true });
  await panel.getByRole("button", { name: "Etkiyi incele", exact: true }).click();
  await panel.getByRole("checkbox", { name: "Etkiyi okudum", exact: true }).press("Space");
  await panel.getByRole("button", { name: "İadeyi kaydet", exact: true }).click();
  await expect(
    panel.getByText("İade uygulanamadı. Güncel alacağı kontrol edip yeniden incele.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(panel.getByRole("button", { name: "İadeyi kaydet", exact: true })).toBeDisabled();
  expect(writes).toHaveLength(1);
  await panel.getByRole("button", { name: "Kapat", exact: true }).click();
  await expect(
    page
      .getByRole("grid", { name: "Alacaklar", exact: true })
      .getByText("₺300,00", { exact: true }),
  ).toBeVisible();
});
