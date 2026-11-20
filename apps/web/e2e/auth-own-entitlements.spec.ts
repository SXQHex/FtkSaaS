import { test, expect } from "./test.js";
import type { Page } from "@playwright/test";
import type {
  EntitlementLedgerItem,
  EntitlementView,
  EventRegistrationView,
  PersonView,
} from "@ftksaas/api-contracts";
import { mockOwnReservations } from "./member-reservations-fixture.js";
import { mockEventDetail, detailIds } from "./event-detail-fixture.js";
import { studioIds as I } from "./studio-fixture.js";
import { origin } from "./auth-fixture.js";
const id = (n: number) => `019a7b00-0000-7000-8000-${String(n).padStart(12, "0")}`;
async function fixture(
  page: Page,
  options: {
    two?: boolean;
    denied?: boolean;
    emptyDebt?: boolean;
    noCurrencies?: boolean;
    currencyDenied?: boolean;
    paymentGate?: Promise<void>;
    eventRegistration?: EventRegistrationView;
  } = {},
) {
  const plan = { starter: false };
  const reservations = await mockOwnReservations(page, plan);
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
      purchase_summary: { product_name: "Satın alınan sabit Tango paketi", initial_credits: 8 },
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
      purchase_summary: { product_name: "Önceki Tango paketi", initial_credits: 10 },
    });
  const assignedEvent = options.eventRegistration;
  const eventReserve: EntitlementLedgerItem | undefined = assignedEvent && {
    id: id(992),
    created_at: "2026-11-14T12:00:00Z",
    kind: "reserve",
    quantity: 1,
    balance_delta: 0,
    previous_id: null,
    source: { type: "event_registrations", id: assignedEvent.id },
  };
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
    if (operation === "member_finance_currencies_get_v1") {
      if (denied || options.currencyDenied) return reject();
      return send({
        person_id: I.self,
        currencies: options.noCurrencies ? [] : ["TRY", "USD"],
        as_of: "2026-11-16T12:00:00Z",
      });
    }
    if (operation === "finance_get_v1") {
      expect(req.person_id).toBe(I.self);
      expect(req.center_id).toBe(I.center);
      if (denied) return reject();
      await options.paymentGate;
      return send({
        person_id: I.self,
        currency: req.currency,
        debts: [],
        credit_available_minor: req.currency === "USD" ? "100" : "0",
        movements: {
          items: [
            {
              id: id(req.page.cursor ? 997 : 996),
              kind: req.page.cursor ? "refund" : "collection",
              amount_minor: req.page.cursor ? "100" : "5000",
              currency: req.currency,
              occurred_at: "2026-11-16T12:00:00Z",
              center_id: I.center,
            },
          ],
          next_cursor: req.page.cursor ? null : "next-payment",
          as_of: "2026-11-16T12:00:00Z",
        },
      });
    }
    if (operation === "entitlements_get_v1") {
      expect(req.person_id).toBe(I.self);
      expect(req.center_id).toBe(I.center);
      if (denied) return reject();
      const eventCancelled = assignedEvent?.state === "cancelled";
      const current =
        eventCancelled || reservations.reservations[0]?.state === "cancelled"
          ? rights.map((row, index) =>
              index === 0 ? { ...row, available: 4, reserved: 1, version: 2 } : row,
            )
          : rights;
      if (!req.ledger_sale_id) return send(current);
      expect(rights.some((row) => row.sale_id === req.ledger_sale_id)).toBe(true);
      return send(
        current.map((row) =>
          row.sale_id === req.ledger_sale_id
            ? {
                ...row,
                movements: {
                  items: [
                    ...(eventReserve
                      ? [
                          eventReserve,
                          ...(eventCancelled
                            ? [
                                {
                                  ...eventReserve,
                                  id: id(993),
                                  kind: "release",
                                  created_at: "2026-11-15T19:00:00Z",
                                } satisfies EntitlementLedgerItem,
                              ]
                            : []),
                        ]
                      : []),
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
    reservations,
    reads,
    enterStarterPeriod: () => {
      plan.starter = true;
    },
    setDenied: (value: boolean) => {
      denied = value;
    },
  };
}
test("a reservation cancellation refreshes the warm rights panel on return", async ({ page }) => {
  const state = await fixture(page);
  const available = page.getByText("Kullanılabilir bakiye", { exact: true }).locator("..");
  const track = page.getByRole("progressbar").locator('[data-slot="progress-track"]');
  await expect(available.getByText("3", { exact: true })).toBeVisible();
  await expect(track).toHaveCSS("background-image", /37\.5%.*62\.5%/);
  const nav = page.getByRole("navigation");
  await nav.getByRole("link", { name: "Rezervasyonlarım", exact: true }).click();
  await expect(page.getByText("Sentetik gelecek ders", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^İptal et —/ }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByLabel("Gerekçe", { exact: true }).fill("Sentetik iptal");
  await dialog.getByRole("button", { name: "İptal et", exact: true }).click();
  await expect(
    dialog.getByText("Rezervasyon iptal edildi; güncel rezervasyon, seans ve haklar okundu.", {
      exact: true,
    }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Kapat", exact: true }).click();
  await nav.getByRole("link", { name: "Haklarım", exact: true }).click();
  await expect(available.getByText("4", { exact: true })).toBeVisible();
  await expect(track).toHaveCSS("background-image", /37\.5%.*50%/);
  await expect(page.getByText(/1,00.*borç/)).toBeVisible();
  expect(state.reservations.writes).toHaveLength(1);
});

test("event cancellation restores the same purchased right and shows one release on member reload", async ({
  page,
}) => {
  const operator = await page.context().browser()!.newPage();
  try {
    const registration: EventRegistrationView = {
      id: detailIds.registration,
      person_id: I.self,
      display_name: "Sentetik üye",
      state: "active",
      attendance_result: "unmarked",
      version: 1,
    };
    const state = await mockEventDetail(operator);
    state.event.registrations!.push(registration);
    state.cancellationEffects.push({
      entity: { type: "entitlement_allocations", id: id(994) },
      action: "release",
      quantity: 1,
    });
    const member = await fixture(page, { eventRegistration: registration });
    const available = page.getByText("Kullanılabilir bakiye", { exact: true }).locator("..");
    const released = page.getByRole("listitem").filter({ hasText: "Ayrılan hakkı bırakma" });
    await expect(available.getByText("3", { exact: true })).toBeVisible();
    await expect(page.getByText(/Hak ayırma/).first()).toBeVisible();
    await expect(released).toHaveCount(0);

    await operator.getByRole("button", { name: "Etkinliği iptal et", exact: true }).click();
    const confirmation = operator.getByRole("alertdialog");
    await confirmation
      .getByLabel("Gerekçe (zorunlu, geçmişe yazılır)", { exact: true })
      .fill("Sentetik paketli etkinlik iptali");
    const checked = confirmation.getByRole("checkbox", {
      name: "İşlemi ve etkilerini inceledim, onaylıyorum.",
      exact: true,
    });
    await checked.press("Space");
    await confirmation.getByRole("button", { name: "İptal etkilerini oku", exact: true }).click();
    await expect(confirmation.getByText("Serbest bırakma · 1", { exact: true })).toBeVisible();
    expect(state.writes).toHaveLength(0);
    expect(registration.state).toBe("active");
    await checked.press("Space");
    await confirmation.getByRole("button", { name: "Etkinliği iptal et", exact: true }).click();
    await expect(
      confirmation.getByText("İşlem kaydedildi; güncel kayıt okundu.", { exact: true }),
    ).toBeVisible();
    expect(registration.state).toBe("cancelled");

    const ledgerRead = page.waitForResponse(
      (response) =>
        response.url().endsWith("/entitlements_get_v1") &&
        response.request().postDataJSON().ledger_sale_id === id(980),
    );
    await page.reload();
    const result = await (await ledgerRead).json();
    expect(result.data).toMatchObject([
      {
        sale_id: id(980),
        available: 4,
        reserved: 1,
        movements: {
          items: expect.arrayContaining([
            {
              id: id(993),
              kind: "release",
              source: { type: "event_registrations", id: registration.id },
              quantity: 1,
              balance_delta: 0,
              created_at: "2026-11-15T19:00:00Z",
              previous_id: null,
            },
          ]),
        },
      },
    ]);
    await expect(available.getByText("4", { exact: true })).toBeVisible();
    await expect(released).toHaveCount(1);
    await expect(released).toContainText("Ayrılan hakkı bırakma");
    await page.reload();
    await expect(available.getByText("4", { exact: true })).toBeVisible();
    await expect(released).toHaveCount(1);
    expect(state.writes.map(({ op }) => op)).toEqual(["event_cancel_apply_v1"]);
    expect(member.reservations.writes).toHaveLength(0);
  } finally {
    await operator.close();
  }
});
test("Starter period keeps the same confirmed reservations, attendance, purchased rights and debt", async ({
  page,
}) => {
  const state = await fixture(page);
  const navigation = page.getByRole("navigation", { name: "Üye menüsü", exact: true });
  const reservations = navigation.getByRole("link", { name: "Rezervasyonlarım", exact: true });
  const rights = navigation.getByRole("link", { name: "Haklarım", exact: true });

  async function expectHistoricalRights() {
    await expect(page.getByText("Satın alınan sabit Tango paketi", { exact: true })).toBeVisible();
    await expect(page.getByText("3 / 8 ders kullanıldı", { exact: true })).toBeVisible();
    await expect(page.getByText(/90.071.992.547.409,93.*borç/)).toBeVisible();
    await expect(page.getByText(/1,00.*borç/)).toBeVisible();
  }

  async function expectHistoricalReservations() {
    await expect(page.getByText("Sentetik gelecek ders", { exact: true })).toBeVisible();
    await expect(page.getByText("Sentetik geçmiş ders", { exact: true })).toBeVisible();
    await expect(page.getByRole("grid", { name: "Geçmiş", exact: true })).toContainText("Geldi");
    await expect(page.getByText("Başka üyenin gizli adı", { exact: true })).toHaveCount(0);
  }

  await expectHistoricalRights();
  await reservations.click();
  await expectHistoricalReservations();
  const records = structuredClone(state.reservations.reservations);
  const previousReads = state.reads.length;

  state.enterStarterPeriod();
  const roleRead = page.waitForResponse((response) =>
    new URL(response.url()).pathname.endsWith("/roles_list_v1"),
  );
  await page.reload();
  expect(await (await roleRead).json()).toMatchObject({
    ok: false,
    error: { code: "PLAN_FEATURE_UNAVAILABLE" },
  });
  await expectHistoricalReservations();
  await expect(
    page.getByText("Güncel bekleme listesi ve teklifler okunamadı.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Bekleme listesinde değilsin.", { exact: true })).toHaveCount(0);
  await rights.click();
  await expectHistoricalRights();

  const after = state.reads.slice(previousReads);
  expect(after).toContainEqual(
    expect.objectContaining({
      operation: "reservation_list_v1",
      request: expect.objectContaining({
        person_id: I.self,
        center_id: I.center,
        time_filter: "past",
      }),
    }),
  );
  expect(after).toContainEqual(
    expect.objectContaining({
      operation: "entitlements_get_v1",
      request: expect.objectContaining({
        person_id: I.self,
        center_id: I.center,
        include_purchase_summary: true,
      }),
    }),
  );
  expect(state.reservations.reservations).toEqual(records);
  expect(state.reservations.writes).toHaveLength(0);
});

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
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "8");
  await expect(page.getByText("3 / 8 ders kullanıldı", { exact: true })).toBeVisible();
  await expect(page.getByText("Satın alınan sabit Tango paketi", { exact: true })).toBeVisible();
  await expect(page.getByText("Ödeme hareketi yok.", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Sonraki", exact: true }).first().click();
  await expect.poll(() => state.reads.filter((row) => row.request.ledger_sale_id).length).toBe(2);
  expect(state.reads.filter((row) => row.request.ledger_sale_id).at(-1)!.request).toMatchObject({
    ledger_sale_id: id(980),
    ledger_page: { cursor: "second-ledger" },
  });
  await expect(page.getByRole("button", { name: "Sonraki", exact: true }).first()).toBeDisabled();
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
  await expect(
    page.getByText("Hak hareketlerini görmek için bir paket seç.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Hak hareketleri okunamadı.", { exact: true })).toHaveCount(0);
  expect(state.reads.filter((row) => row.request.ledger_sale_id)).toHaveLength(0);
  await page.getByRole("combobox", { name: "Paket seç", exact: true }).selectOption(id(980));
  await expect.poll(() => state.reads.filter((row) => row.request.ledger_sale_id).length).toBe(1);
  await page.getByRole("button", { name: "Sonraki", exact: true }).first().click();
  await expect.poll(() => state.reads.filter((row) => row.request.ledger_sale_id).length).toBe(2);
  await page.getByRole("combobox", { name: "Paket seç", exact: true }).selectOption(id(981));
  await expect.poll(() => state.reads.filter((row) => row.request.ledger_sale_id).length).toBe(3);
  const latest = state.reads.filter((row) => row.request.ledger_sale_id).at(-1)!.request;
  expect(latest.ledger_sale_id).toBe(id(981));
  expect(latest.ledger_page).not.toHaveProperty("cursor");
  const progress = page.getByRole("progressbar");
  await expect(progress).toHaveAttribute("aria-valuemax", "10");
  await expect(progress.locator('[data-slot="progress-track"]')).toHaveCSS(
    "background-image",
    "none",
  );
  await expect(page.getByText("Önceki paketler", { exact: true })).toBeVisible();
});
test("native no outstanding debt never claims there is no credit or no payment history", async ({
  page,
}) => {
  await fixture(page, { emptyDebt: true });
  await expect(page.getByText("Bu merkezde açık borcun yok.", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Ödeme geçmişini görmek için bir para birimi seç.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Ödeme geçmişi okunamadı.", { exact: true })).toHaveCount(0);
  await expect(
    page.getByText("Alacak ve ödeme geçmişi kaynağı okunamadı.", { exact: true }),
  ).toHaveCount(0);
});
test("payment Skeleton is limited to the pending native read and keeps the confirmed balance", async ({
  page,
}) => {
  let releasePayment!: () => void;
  const paymentGate = new Promise<void>((resolve) => {
    releasePayment = resolve;
  });
  try {
    const state = await fixture(page, { emptyDebt: true, paymentGate });
    await expect(
      page.getByText("Ödeme geçmişini görmek için bir para birimi seç.", { exact: true }),
    ).toBeVisible();
    expect(state.reads.filter(({ operation }) => operation === "finance_get_v1")).toHaveLength(0);
    await page
      .getByRole("combobox", { name: "Ödeme para birimi seç", exact: true })
      .selectOption("USD");
    const loading = page.getByRole("status").filter({ hasText: "Ödeme geçmişi okunuyor…" });
    await expect(loading).toBeAttached();
    await expect(page.getByText("Bu merkezde açık borcun yok.", { exact: true })).toBeVisible();
    await expect(page.getByText("Ödeme geçmişi okunamadı.", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("grid", { name: "Ödemelerim", exact: true })).toHaveCount(0);
    releasePayment();
    await expect(page.getByRole("grid", { name: "Ödemelerim", exact: true })).toContainText(
      "50,00",
    );
    await expect(loading).toHaveCount(0);
  } finally {
    releasePayment();
  }
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

test("historical payment currencies and native credit remain separate with independent cursor reset", async ({
  page,
}) => {
  const state = await fixture(page, { emptyDebt: true });
  await page
    .getByRole("combobox", { name: "Ödeme para birimi seç", exact: true })
    .selectOption("USD");
  const payments = page.getByRole("grid", { name: "Ödemelerim", exact: true });
  await expect(payments).toContainText("50,00");
  await expect(page.getByText(/Kullanılabilir alacağın:.*1,00/)).toBeVisible();
  const pages = page.getByRole("group", { name: "Ödemelerim", exact: true });
  await pages.getByRole("button", { name: "Sonraki", exact: true }).click();
  await expect(payments).toContainText("Nakit iade");
  expect(state.reads.filter((r) => r.operation === "finance_get_v1").at(-1)?.request).toMatchObject(
    { currency: "USD", page: { cursor: "next-payment" } },
  );
  await page
    .getByRole("combobox", { name: "Ödeme para birimi seç", exact: true })
    .selectOption("TRY");
  await expect(payments).toContainText("50,00");
  const latest = state.reads.filter((r) => r.operation === "finance_get_v1").at(-1)!.request;
  expect(latest.currency).toBe("TRY");
  expect(latest.page).not.toHaveProperty("cursor");
});
test("an empty native currency directory is actual absence, while denied discovery stays unread", async ({
  page,
}) => {
  await fixture(page, { noCurrencies: true, emptyDebt: true });
  await expect(page.getByText("Bu merkezde finans hareketin yok.", { exact: true })).toBeVisible();
  await expect(page.getByText("Ödeme hareketi yok.", { exact: true })).toBeVisible();
});
test("currency discovery failure never falls back to debt currencies or TRY", async ({ page }) => {
  const state = await fixture(page, { currencyDenied: true });
  await expect(page.getByText("Ödeme geçmişi okunamadı.", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Ödeme para birimi seç", exact: true }),
  ).toHaveCount(0);
  expect(state.reads.filter((r) => r.operation === "finance_get_v1")).toHaveLength(0);
});
