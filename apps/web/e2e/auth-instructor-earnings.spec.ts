import { test, expect } from "./test.js";
import type { Page } from "@playwright/test";
import { mockSessionDetail } from "./session-detail-fixture.js";
import { studioIds as I } from "./studio-fixture.js";
import { origin } from "./auth-fixture.js";
const id = (n: number) => `019a7b00-0000-7000-8000-${String(n).padStart(12, "0")}`;
test("own earnings preserves cursor scope and currency alongside native summaries and payment history", async ({
  page,
  browserName,
  isMobile,
}) => {
  const state = await mockSessionDetail(page, { existing: true, instructor: true });
  await mockAccount(page);
  await page.clock.setFixedTime(new Date("2026-11-16T12:00:00Z"));
  let releaseEarnings!: () => void;
  const earningsGate = new Promise<void>((resolve) => {
    releaseEarnings = resolve;
  });
  const requests: {
    person_id: string;
    center_id: string;
    interval?: { starts_at: string; ends_at: string };
    page: { cursor?: string };
  }[] = [];
  await page.route("**/functions/v1/backend-v1/instructor_account_get_v1", async (route) => {
    const req = route.request().postDataJSON();
    if (req.view !== "earnings") return route.fallback();
    requests.push(req);
    expect(req.include_session_context).toBe(true);
    expect(req.person_id).toBe(I.instructor);
    expect(req.center_id).toBe(I.center);
    await earningsGate;
    const row = {
      id: id(req.page.cursor ? 992 : 991),
      person_id: req.interval ? I.instructor : id(998),
      center_id: I.center,
      session_id: I.lesson,
      event_assignment_id: null,
      amount_minor: req.page.cursor ? "100" : "9007199254740993",
      paid_minor: "0",
      remaining_minor: "0",
      currency: req.page.cursor ? "USD" : "TRY",
      direction: req.page.cursor ? "subtract" : "add",
      previous_id: req.page.cursor ? id(991) : null,
      closure_id: null,
      created_at: req.interval?.starts_at ?? "2019-01-01T00:00:00Z",
      version: 1,
      session_context: {
        title: req.page.cursor ? null : "Kapanıştaki Tango dersi",
        scheduled_duration_seconds: req.page.cursor ? null : 5400,
        attended_count: req.page.cursor ? 0 : 7,
        agreement_version: req.page.cursor ? null : 3,
      },
      basis: {
        source: "agreement_fixed",
        currency: req.page.cursor ? "USD" : "TRY",
        quantity: 1,
        excluded_blocked: 0,
      },
    };
    await route.fulfill({
      json: {
        ok: true,
        data: {
          view: "earnings",
          totals: [],
          items: [row],
          next_cursor: req.page.cursor ? null : "second",
          as_of: "2026-11-16T12:00:00Z",
        },
        trace_id: I.role,
      },
    });
  });
  await page.goto(`${origin}/instructor/earnings?org=${I.org}&center=${I.center}`);
  await expect(page).toHaveTitle("Hakedişim · Fethiye Tango");
  const lines = page.getByRole("tabpanel", { name: "Seans satırları", exact: true });
  try {
    await expect(lines.getByRole("status")).toHaveText("Hakedişler okunuyor…");
    await expect(lines.locator('[data-slot="skeleton"]')).toHaveCount(1);
    await expect(lines.getByText("Güncel hakediş satırları okunamadı.")).toHaveCount(0);
    await expect(page.getByText("Bu dönemde parasal kayıt yok.", { exact: true })).toHaveCount(3);
  } finally {
    releaseEarnings();
  }
  await expect(page.getByRole("gridcell", { name: /90.071.992.547.409,93/ })).toBeVisible();
  await expect(lines.getByText("Kapanıştaki Tango dersi", { exact: true })).toBeVisible();
  await expect(lines.getByText("Planlanan süre 90 dk.", { exact: true })).toBeVisible();
  await expect(lines.getByText("Katılan kişi sayısı 7", { exact: true })).toBeVisible();
  await expect(lines.getByText("Anlaşma sürümü 3", { exact: true })).toBeVisible();
  await expect(lines.locator('[data-slot="skeleton"]')).toHaveCount(0);
  await expect(page.getByText("Kalan yok", { exact: true })).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(requests[0]).not.toHaveProperty("interval");
  await expect(page.getByRole("combobox", { name: "Dönem", exact: true })).toHaveValue("all");
  await expect(page.getByText(/2019/).first()).toBeVisible();
  await page.getByRole("button", { name: "Sonraki", exact: true }).click();
  await expect(page.getByText("Düzeltme", { exact: true })).toBeVisible();
  await expect(lines.getByText("Seans hakedişi", { exact: true })).toBeVisible();
  await expect(lines.getByText("Katılan kişi sayısı 0", { exact: true })).toBeVisible();
  await expect(lines.getByText(/Planlanan süre|Anlaşma sürümü/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sonraki", exact: true })).toBeDisabled();
  expect(requests[1]!.page.cursor).toBe("second");
  await page.getByRole("combobox", { name: "Dönem", exact: true }).selectOption("2026-10");
  await expect.poll(() => requests.length).toBe(3);
  expect(requests[2]!.page.cursor).toBeUndefined();
  expect(requests[2]!.interval).toEqual({
    starts_at: "2026-09-30T21:00:00Z",
    ends_at: "2026-10-31T21:00:00Z",
  });
  await page.getByRole("tab", { name: "Ödemeler", exact: true }).click();
  await expect(page.getByText("Bu dönemde ödeme yok.", { exact: true })).toBeVisible();
  await expect(page.getByText("Güncel ödeme geçmişi okunamadı.", { exact: true })).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
  await page.getByRole("tab", { name: "Seans satırları", exact: true }).click();
  await page.getByRole("combobox", { name: "Dönem", exact: true }).selectOption("2026-11");
  await expect
    .poll(() => requests.at(-1)?.interval)
    .toEqual({ starts_at: "2026-10-31T21:00:00Z", ends_at: "2026-11-30T21:00:00Z" });
  await page.setViewportSize({ width: 320, height: 950 });
  await expect(page.getByText("Kalan yok", { exact: true })).toBeVisible();
  const tableRegion = page.getByRole("region", { name: "Seans satırları", exact: true });
  await expect(tableRegion).toHaveAttribute("tabindex", "0");
  await tableRegion.focus();
  if (browserName === "webkit" && isMobile) {
    // iPhone emulation has no keyboard scrolling path, so scroll programmatically.
    await tableRegion.evaluate((element) => element.scrollBy(40, 0));
  } else {
    await tableRegion.press("ArrowRight");
  }
  await expect.poll(() => tableRegion.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  expect(await page.evaluate("document.documentElement.scrollWidth > innerWidth")).toBe(false);
});
test("own earnings denied read stays unknown until explicit retry", async ({ page }) => {
  await mockSessionDetail(page, { existing: true, instructor: true });
  await mockAccount(page);
  let denied = true,
    reads = 0;
  await page.route("**/functions/v1/backend-v1/instructor_account_get_v1", async (route) => {
    if (route.request().postDataJSON().view !== "earnings") return route.fallback();
    reads++;
    await route.fulfill(
      denied
        ? {
            status: 403,
            json: { ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: I.role } },
          }
        : {
            json: {
              ok: true,
              data: {
                view: "earnings",
                totals: [],
                items: [],
                next_cursor: null,
                as_of: "2026-11-16T12:00:00Z",
              },
              trace_id: I.role,
            },
          },
    );
  });
  await page.goto(`${origin}/instructor/earnings?org=${I.org}&center=${I.center}`);
  await expect(page.getByText("Güncel hakediş satırları okunamadı.").first()).toBeVisible();
  await expect(page.getByText("Bu dönemde hakediş satırı yok.", { exact: true })).toHaveCount(0);
  expect(reads).toBe(1);
  denied = false;
  await page.getByRole("button", { name: "Yeniden oku", exact: true }).click();
  await expect(page.getByText("Bu dönemde hakediş satırı yok.", { exact: true })).toBeVisible();
  expect(reads).toBe(2);
});

async function mockAccount(page: Page, populated = false) {
  const requests: Record<string, unknown>[] = [];
  const agreement = {
    id: id(800),
    version: 4,
    person_id: I.instructor,
    center_id: I.center,
    discipline_id: I.discipline,
    format: "group",
    valid: { starts_at: "2026-01-01T00:00:00Z", ends_at: null },
    supersedes_id: null,
    published_at: "2026-01-01T00:00:00Z",
    terms: {
      model: "session_fixed",
      currency: "TRY",
      components: [{ kind: "session_fixed", amount_minor: "50000" }],
      room_fee: { kind: "free", order: "before_instructor_share" },
    },
  };
  await page.route("**/functions/v1/backend-v1/instructor_account_get_v1", async (route) => {
    const req = route.request().postDataJSON();
    requests.push(req);
    expect(req.person_id).toBe(I.instructor);
    expect(req.center_id).toBe(I.center);
    expect(req.page.limit).toBe(20);
    const correction = !!req.page.cursor;
    const items =
      req.view === "earnings"
        ? []
        : req.view === "agreements"
          ? populated
            ? [agreement, { ...agreement, id: id(801), version: 5, person_id: id(999) }]
            : []
          : populated
            ? [
                {
                  id: id(correction ? 812 : 811),
                  root_payment_id: id(811),
                  version: correction ? 2 : 7,
                  direction: correction ? "decrease" : "increase",
                  amount_minor: correction ? "100" : "9007199254740993",
                  currency: correction ? "USD" : "TRY",
                  occurred_at: "2026-11-05T10:00:00Z",
                  method: correction ? null : "bank_transfer",
                  previous_id: correction ? id(811) : null,
                },
              ]
            : [];
    await route.fulfill({
      json: {
        ok: true,
        data: {
          view: req.view,
          items,
          next_cursor: req.view === "payments" && populated && !correction ? "payments-next" : null,
          as_of: "2026-11-16T12:00:00Z",
          totals: populated
            ? [
                {
                  currency: "TRY",
                  earned_minor: "1500",
                  paid_minor: "9007199254740993",
                  remaining_minor: "700",
                  overpaid_minor: "200",
                },
                {
                  currency: "USD",
                  earned_minor: "200",
                  paid_minor: "-100",
                  remaining_minor: "0",
                  overpaid_minor: "0",
                },
              ]
            : [],
        },
        trace_id: I.role,
      },
    });
  });
  return requests;
}
test("own account payments use actual totals, independent cursor and unbounded native all-period selection", async ({
  page,
}) => {
  await mockSessionDetail(page, { existing: true, instructor: true });
  await page.clock.setFixedTime(new Date("2026-11-16T12:00:00Z"));
  const requests = await mockAccount(page, true);
  await page.route("**/functions/v1/backend-v1/earnings_list_v1", (route) =>
    route.fulfill({
      json: {
        ok: true,
        data: { items: [], next_cursor: null, as_of: "2026-11-16T12:00:00Z" },
        trace_id: I.role,
      },
    }),
  );
  await page.goto(`${origin}/instructor/earnings?org=${I.org}&center=${I.center}`);
  await expect(page.getByText("₺7,00 · $0,00", { exact: true })).toBeVisible();
  await expect(page.getByText(/90.071.992.547.409,93/).first()).toBeVisible();
  await page.getByRole("tab", { name: "Ödemeler", exact: true }).click();
  await expect(page.getByRole("grid", { name: "Ödemeler", exact: true })).toContainText(
    "Banka havalesi",
  );
  await page.getByRole("button", { name: "Sonraki", exact: true }).click();
  await expect(page.getByRole("grid", { name: "Ödemeler", exact: true })).toContainText("Düzeltme");
  await expect(page.getByRole("grid", { name: "Ödemeler", exact: true })).toContainText(
    "Yöntem kaydedilmemiş",
  );
  await expect(page.getByRole("grid", { name: "Ödemeler", exact: true })).toContainText("-$1,00");
  await page.getByRole("combobox", { name: "Dönem", exact: true }).selectOption("2026-11");
  await expect(page.getByRole("grid", { name: "Ödemeler", exact: true })).toContainText(
    "Banka havalesi",
  );
  await page.getByRole("combobox", { name: "Dönem", exact: true }).selectOption("all");
  await expect(page.getByRole("grid", { name: "Ödemeler", exact: true })).toContainText(
    "Banka havalesi",
  );
  const all = requests.filter(
    (r) => r.view === "payments" && !("interval" in r) && !(r.page as { cursor?: string }).cursor,
  );
  expect(all).toHaveLength(1);
  expect(all[0]!.page).toEqual({ limit: 20 });
  expect(
    requests.filter((r) => r.view === "earnings" && (r.page as { cursor?: string }).cursor),
  ).toEqual([]);
  await page.setViewportSize({ width: 320, height: 950 });
});
test("own current agreements render native read-only terms and retain an authorized historical person alias", async ({
  page,
}) => {
  const state = await mockSessionDetail(page, { existing: true, instructor: true });
  await page.clock.setFixedTime(new Date("2026-11-16T12:00:00Z"));
  await mockAccount(page, true);
  await page.route("**/functions/v1/backend-v1/earnings_list_v1", (route) =>
    route.fulfill({
      json: {
        ok: true,
        data: { items: [], next_cursor: null, as_of: "2026-11-16T12:00:00Z" },
        trace_id: I.role,
      },
    }),
  );
  await page.goto(`${origin}/instructor/earnings?org=${I.org}&center=${I.center}`);
  await page.getByRole("combobox", { name: "Geçerli anlaşman", exact: true }).selectOption(id(801));
  await expect(page.getByText(/Sürüm 5 ·/)).toBeVisible();
  await page.getByText("Anlaşma koşulları", { exact: true }).click();
  await expect(page.getByLabel("Para birimi (ISO 4217)", { exact: true })).toBeDisabled();
  await expect(page.getByLabel("Para birimi (ISO 4217)", { exact: true })).toHaveValue("TRY");
  expect(state.writes).toHaveLength(0);
});
