import { test, expect } from "./test.js";
import type { Page } from "@playwright/test";
import type { EntitlementView, PersonView } from "../src/lib/api-contracts/generated.js";
import { mockOwnReservations } from "./member-reservations-fixture.js";
import { studioIds as I } from "./studio-fixture.js";
import { origin } from "./auth-fixture.js";
const id = (n: number) => `019a7b00-0000-7000-8000-${String(n).padStart(12, "0")}`;
async function fixture(
  page: Page,
  options: { two?: boolean; denied?: boolean; emptyDebt?: boolean } = {},
) {
  await mockOwnReservations(page);
  await expect(page.getByText("Sentetik gelecek ders", { exact: true })).toBeVisible();
  let denied = Boolean(options.denied);
  const reads: { operation: string; request: Record<string, unknown> }[] = [];
  const rights: EntitlementView[] = [
    {
      sale_id: id(980),
      person_id: I.self,
      kind: "credits",
      booking_mode: "flexible",
      product_version_id: id(970),
      state: "active",
      sale_state: "active",
      start_date: "2026-11-01",
      end_date: "2026-11-30",
      timezone: "Europe/Istanbul",
      available: 3,
      reserved: 2,
      consumed: 3,
      deficit: 0,
      quotas: [],
      deficit_scopes: [],
      version: 1,
    },
  ];
  if (options.two)
    rights.push({
      ...rights[0]!,
      sale_id: id(981),
      state: "closed",
      sale_state: "expired",
      start_date: "2026-10-01",
      end_date: "2026-10-31",
    });
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const operation = new URL(route.request().url()).pathname.split("/").at(-1)!,
      req = route.request().postDataJSON();
    reads.push({ operation, request: req });
    const send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } });
    const reject = () =>
      route.fulfill({
        status: 403,
        json: { ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: I.role } },
      });
    if (operation === "entitlements_get_v1") {
      expect(req.person_id).toBe(I.self);
      expect(req.center_id).toBe(I.center);
      if (denied) return reject();
      if (!req.ledger_sale_id) return send(rights);
      expect(rights.some((row) => row.sale_id === req.ledger_sale_id)).toBe(true);
      return send(
        rights.map((row) =>
          row.sale_id === req.ledger_sale_id
            ? {
                ...row,
                movements: {
                  items: [
                    {
                      id: id(req.ledger_page.cursor ? 991 : 990),
                      created_at: "2026-11-16T12:00:00Z",
                      kind: req.ledger_page.cursor ? "consume" : "reserve",
                      quantity: 1,
                      balance_delta: req.ledger_page.cursor ? -1 : 0,
                      previous_id: null,
                      source: { type: "reservations", id: id(960) },
                    },
                  ],
                  next_cursor: req.ledger_page.cursor ? null : "second-ledger",
                  as_of: "2026-11-16T12:00:00Z",
                },
              }
            : row,
        ),
      );
    }
    if (operation === "person_get_v1" && req.include_member_summary) {
      expect(req.person_id).toBe(I.self);
      expect(req.center_id).toBe(I.center);
      if (denied) return reject();
      const person: PersonView = {
        id: I.self,
        display_name: "Sentetik kişi",
        version: 1,
        relationships: [],
        discipline_relationships: [],
        contacts: [],
        member_summary: {
          as_of: "2026-11-16T12:00:00Z",
          rights: { status: "available", available_credits: "3" },
          debt: {
            status: "available",
            by_currency: options.emptyDebt
              ? []
              : [
                  { currency: "TRY", remaining_minor: "9007199254740993" },
                  { currency: "USD", remaining_minor: "100" },
                ],
          },
          next_lesson: { status: "available", lesson: null },
        },
      };
      return send(person);
    }
    return route.fallback();
  });
  await page.goto(`${origin}/member/entitlements?org=${I.org}&center=${I.center}`);
  await expect(page.getByRole("heading", { name: "Haklarım", exact: true })).toBeVisible();
  return {
    reads,
    setDenied: (value: boolean) => {
      denied = value;
    },
  };
}
test("own rights show native counts, exact separate debt currencies and a cursor ledger without a fictional total", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 950 });
  const state = await fixture(page);
  await expect(page.getByText(/90.071.992.547.409,93.*borç/)).toBeVisible();
  await expect(page.getByText(/1,00.*borç/)).toBeVisible();
  await expect(
    page.getByText("Sağdaki değer ders bakiyesindeki değişimdir.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Hak ayırma|Ayırma/)).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await expect(page.getByText("Ödeme hareketi yok.", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Sonraki", exact: true }).click();
  await expect.poll(() => state.reads.filter((row) => row.request.ledger_sale_id).length).toBe(2);
  expect(state.reads.filter((row) => row.request.ledger_sale_id).at(-1)!.request).toMatchObject({
    ledger_sale_id: id(980),
    ledger_page: { cursor: "second-ledger" },
  });
  await expect(page.getByRole("button", { name: "Sonraki", exact: true })).toBeDisabled();
  expect(
    state.reads.filter((row) =>
      ["products_list_v1", "finance_get_v1", "finance_directory_get_v1"].includes(row.operation),
    ),
  ).toHaveLength(0);
  await expect(page.getByText(id(960), { exact: false })).toHaveCount(0);
});
test("multiple owned packages require explicit selection and reset the ledger cursor on change", async ({
  page,
}) => {
  const state = await fixture(page, { two: true });
  await expect(page.getByRole("combobox", { name: "Paket seç", exact: true })).toBeVisible();
  expect(state.reads.filter((row) => row.request.ledger_sale_id)).toHaveLength(0);
  await page.getByRole("combobox", { name: "Paket seç", exact: true }).selectOption(id(980));
  await expect.poll(() => state.reads.filter((row) => row.request.ledger_sale_id).length).toBe(1);
  await page.getByRole("button", { name: "Sonraki", exact: true }).click();
  await expect.poll(() => state.reads.filter((row) => row.request.ledger_sale_id).length).toBe(2);
  await page.getByRole("combobox", { name: "Paket seç", exact: true }).selectOption(id(981));
  await expect.poll(() => state.reads.filter((row) => row.request.ledger_sale_id).length).toBe(3);
  const latest = state.reads.filter((row) => row.request.ledger_sale_id).at(-1)!.request;
  expect(latest.ledger_sale_id).toBe(id(981));
  expect(latest.ledger_page).not.toHaveProperty("cursor");
  await expect(page.getByText("Önceki paketler", { exact: true })).toBeVisible();
});
test("native no outstanding debt never claims there is no credit or no payment history", async ({
  page,
}) => {
  await fixture(page, { emptyDebt: true });
  await expect(page.getByText("Bu merkezde açık borcun yok.", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Alacak ve ödeme geçmişi kaynağı okunamadı.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Ödeme geçmişi okunamadı.", { exact: true })).toBeVisible();
});
test("unread rights and balance remain unknown until an explicit retry", async ({ page }) => {
  const state = await fixture(page, { denied: true });
  await expect(page.getByText("Güncel hak veya bakiye kaynağı okunamadı.").first()).toBeVisible();
  await expect(page.getByText("Bu merkezde açık paket kaydı yok.", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Bu merkezde açık borcun yok.", { exact: true })).toHaveCount(0);
  state.setDenied(false);
  await page.getByRole("button", { name: "Yeniden oku", exact: true }).click();
  await expect(page.getByText(/90.071.992.547.409,93.*borç/)).toBeVisible();
});
