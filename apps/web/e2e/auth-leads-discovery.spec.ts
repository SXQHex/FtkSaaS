import { test, expect } from "./test.js";
import { scanAccessibility } from "./accessibility.js";
import { verifyResponsiveLayout } from "./layout.js";
import type { Page } from "@playwright/test";
import type {
  CrmTrialHistoryDiscovery,
  CrmTrialProductDiscovery,
  SessionView,
} from "@ftksaas/api-contracts";
import { mockLeads, openLead, closeLead, leadIds } from "./leads-fixture.js";
import { studioIds as I } from "./studio-fixture.js";
const id = (n: number) => `019a7b00-0000-7000-8000-${String(n).padStart(12, "0")}`;
const saved = "İşlem kaydedildi; güncel kayıt okundu.";
async function trials(page: Page, mode: "ackUnread" | "confirm" | "denied" = "ackUnread") {
  const native = await mockLeads(page);
  const session: SessionView = {
    id: id(970),
    class_id: null,
    discipline_id: I.discipline,
    format: "group",
    starts_at: "2026-11-17T12:00:00Z",
    ends_at: "2026-11-17T13:00:00Z",
    state: "planned",
    attendance_state: "open",
    assignments: [],
    version: 2,
    capacity: {
      total: 12,
      held: 0,
      remaining: 12,
      category_held: { male: 0, female: 0 },
      category_remaining: { male: 6, female: 6 },
      room_capacity: 20,
    },
  };
  const product: CrmTrialProductDiscovery = {
    kind: "trial_product",
    product_version_id: id(971),
    product_name: "Native deneme ürünü",
    price_minor: mode === "confirm" ? "5000" : "0",
    currency: "TRY",
    offer_minutes: 60,
    offer_policy_state: "available",
    confirmation_requires_session: true,
    confirmation_requires_paid_entitlement: mode === "confirm",
  };
  const offers: (CrmTrialHistoryDiscovery & { version: number })[] =
    mode === "confirm"
      ? [
          {
            kind: "trial_offer",
            offer_id: id(972),
            created_at: "2026-11-16T11:00:00Z",
            product_version_id: product.product_version_id,
            session_id: session.id,
            expires_at: "2026-11-17T11:00:00Z",
            state: "active",
            registration_id: null,
            price_minor: product.price_minor,
            currency: product.currency,
            version: 1,
          },
        ]
      : [];
  const historyReads: Record<string, unknown>[] = [],
    writes: Record<string, unknown>[] = [],
    receipts = new Map<string, { operation: string; id: string }>();
  let failRead = false,
    deny = mode === "denied";
  const row = (
    operation: string,
    type: string,
    value: string,
    version: number,
    state: string,
    current: unknown,
    discovery?: unknown,
  ) => ({
    operation,
    exists: true,
    entity: { type, id: value },
    versions: [{ entity: { type, id: value }, version }],
    state,
    current,
    as_of: "2026-11-16T12:00:00Z",
    ...(discovery ? { crm_discovery: discovery } : {}),
  });
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1)!,
      r = route.request().postDataJSON();
    const send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } }),
      list = (items: unknown[]) => ({ items, next_cursor: null, as_of: "2026-11-16T12:00:00Z" });
    if (op === "calendar_get_v1")
      return send(
        list(
          Date.parse(r.interval.starts_at) <= Date.parse(session.starts_at) &&
            Date.parse(r.interval.ends_at) > Date.parse(session.starts_at)
            ? [
                {
                  id: session.id,
                  type: "session",
                  center_id: I.center,
                  title: "Deneme seansı",
                  starts_at: session.starts_at,
                  ends_at: session.ends_at,
                  resources: [],
                },
              ]
            : [],
        ),
      );
    if (op === "session_get_v1" && r.session_id === session.id) return send(session);
    if (
      op === "management_state_get_v1" &&
      ["trial_offer_create_v1", "trial_registration_confirm_v1"].includes(r.operation)
    ) {
      expect(r.org_id).toBe(I.org);
      expect(r.center_id).toBe(I.center);
      if (deny)
        return route.fulfill({
          status: 403,
          json: { ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: I.role } },
        });
      const key = r.selector.key;
      if (key.directory === "products")
        return send(
          list([
            row(
              r.operation,
              "product_versions",
              product.product_version_id,
              1,
              "active",
              null,
              product,
            ),
          ]),
        );
      if (key.directory === "history") {
        historyReads.push(r.page);
        if (failRead) {
          failRead = false;
          return route.abort("failed");
        }
        return send(
          list(
            offers.map(({ version, ...offer }) =>
              row(r.operation, "trial_offers", offer.offer_id, version, offer.state, null, offer),
            ),
          ),
        );
      }
      const offer = offers.find((offer) => offer.offer_id === key.offer_id);
      return send(
        list(
          offer
            ? [
                row(r.operation, "trial_offers", offer.offer_id, offer.version, offer.state, {
                  operation: r.operation,
                  values: { offer_id: offer.offer_id },
                }),
              ]
            : [],
        ),
      );
    }
    if (op === "operation_status_get_v1" && receipts.has(r.key)) {
      expect(r).not.toHaveProperty("center_id");
      const receipt = receipts.get(r.key)!;
      return send({
        operation: receipt.operation,
        key: r.key,
        status: "succeeded",
        result_available: true,
        result_reference: { type: "trial_offers", id: receipt.id },
      });
    }
    if (op === "trial_offer_create_v1" || op === "trial_registration_confirm_v1") {
      writes.push(r);
      expect(r.org_id).toBe(I.org);
      expect(r.center_id).toBe(I.center);
      expect(r).not.toHaveProperty("price_minor");
      let primary: string;
      if (op === "trial_offer_create_v1") {
        expect(r.lead_id).toBe(leadIds.first);
        expect(r.product_version_id).toBe(product.product_version_id);
        expect(r.session_id).toBe(session.id);
        expect(r.booking_category).toBe("female");
        primary = id(972);
        offers.push({
          kind: "trial_offer",
          offer_id: primary,
          created_at: "2026-11-16T12:00:00Z",
          product_version_id: product.product_version_id,
          session_id: session.id,
          expires_at: "2026-11-16T13:00:00Z",
          state: "active",
          registration_id: null,
          price_minor: product.price_minor,
          currency: product.currency,
          version: 1,
        });
        failRead = true;
      } else {
        expect(r.offer_id).toBe(offers[0]!.offer_id);
        primary = r.offer_id;
        offers[0]!.state = "accepted";
        offers[0]!.registration_id = id(973);
        offers[0]!.version++;
      }
      receipts.set(r.operation_key, { operation: op, id: primary });
      if (mode === "confirm") return route.abort("failed");
      return send({ primary_id: primary, versions: [], job_ids: [] });
    }
    return route.fallback();
  });
  return {
    native,
    session,
    product,
    offers,
    historyReads,
    writes,
    setAllowed: () => {
      deny = false;
    },
  };
}
test("native filters and summaries use server scope and explicitly distinguish unassigned", async ({
  page,
}) => {
  const native = await mockLeads(page);
  await page.getByRole("tab", { name: "Liste", exact: true }).click();
  await page.getByRole("combobox", { name: "Sorumlu", exact: true }).selectOption("unassigned");
  await expect(page.getByText("Bu kapsamda aday bulunamadı.", { exact: true })).toBeVisible();
  const grid = page.getByRole("tabpanel", { name: "Liste", exact: true }).getByRole("grid");
  await expect(grid.getByRole("columnheader")).toHaveCount(6);
  await expect(
    grid.getByRole("rowheader", { name: "Bu kapsamda aday bulunamadı.", exact: true }),
  ).toHaveAttribute("colspan", "6");
  await expect(grid.getByRole("gridcell")).toHaveCount(0);
  expect(
    native.reads.filter((row) => row.operation === "leads_list_v1").at(-1)?.request,
  ).toMatchObject({ assigned_to: null, include_details: true, include_summary: true });
  await page.getByRole("combobox", { name: "Sorumlu", exact: true }).selectOption(I.self);
  await expect(page.getByRole("button", { name: "Aday A", exact: true })).toBeVisible();
  await page.getByRole("radio", { name: "Görüşülüyor", exact: true }).click();
  await expect(page.getByRole("button", { name: "Aday A", exact: true })).toHaveCount(0);
  expect(
    native.reads.filter((row) => row.operation === "leads_list_v1").at(-1)?.request,
  ).toMatchObject({ stage_key: "talk", assigned_to: I.self });
  expect(native.writes).toHaveLength(0);
});
test("center followup opens its exact activity and saves a real outcome rather than creating a task", async ({
  page,
}) => {
  const native = await mockLeads(page);
  await page.getByRole("tab", { name: "Takipler", exact: true }).click();
  await page.getByRole("button", { name: "İlk görüşmeyi yap", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Not", { exact: true })).toHaveValue("İlk görüşmeyi yap");
  await dialog.getByLabel("Faaliyet türü", { exact: true }).selectOption("outcome");
  await dialog.getByLabel("Sonuç", { exact: true }).fill("Görüşüldü");
  await dialog.getByRole("checkbox").press("Space");
  await dialog.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  expect(native.writes.at(-1)?.request).toMatchObject({
    activity_id: leadIds.activity,
    expected_version: 2,
    kind: "outcome",
    outcome: "Görüşüldü",
  });
  await closeLead(page);
});
test("native trial creation checks category and ACK unread recovery performs only a result read", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 950 });
  await page.emulateMedia({ colorScheme: "dark" });
  const state = await trials(page);
  const dialog = await openLead(page);
  await dialog.getByRole("button", { name: "Deneme teklif et", exact: true }).click();
  await dialog
    .getByLabel("Deneme ürünü ve sürümü", { exact: true })
    .selectOption(state.product.product_version_id);
  await dialog.getByLabel("Ders günü", { exact: true }).fill("2026-11-17");
  await dialog.getByLabel("Deneme dersi", { exact: true }).selectOption(state.session.id);
  await dialog.getByRole("checkbox").press("Space");
  await dialog.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(dialog.getByLabel("Kategori", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(state.writes).toHaveLength(0);
  expect((await scanAccessibility(page, "trial-invalid-category")).violations).toEqual([]);
  await verifyResponsiveLayout(page);
  await dialog.getByLabel("Kategori", { exact: true }).selectOption("female");
  await dialog.getByRole("checkbox").press("Space");
  await dialog.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(
    dialog.getByText("İşlem kaydedildi; güncel kayıt okunamadı. Yalnız okuma yeniden denenecek.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Kapat", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }).click();
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.native.writes).toHaveLength(0);
  await closeLead(page);
});
test("paid trial confirmation uses immutable offer terms and a real registration after receipt recovery", async ({
  page,
}) => {
  const state = await trials(page, "confirm"),
    dialog = await openLead(page);
  await dialog.getByRole("button", { name: "Deneme kaydını onayla", exact: true }).click();
  await dialog
    .getByLabel("Deneme teklifi", { exact: true })
    .selectOption(state.offers[0]!.offer_id);
  await expect(dialog.getByText(/Kayıt onayı için bu ürün sürümüne ait geçerli/)).toBeVisible();
  expect((await scanAccessibility(page, "trial-paid-confirmation")).violations).toEqual([]);
  await verifyResponsiveLayout(page);
  await dialog.getByRole("checkbox").press("Space");
  await dialog.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(dialog.getByText(/Sonuç bilinmiyor/)).toBeVisible();
  const historyReadsBeforeRecovery = state.historyReads.length;
  await dialog.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }).click();
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  await expect(dialog.getByText("Gerçek ders kaydı oluşturuldu.", { exact: true })).toBeVisible();
  expect(state.historyReads.slice(historyReadsBeforeRecovery)).toHaveLength(1);
  expect(state.historyReads.at(-1)).not.toHaveProperty("cursor");
  expect(state.writes).toHaveLength(1);
  expect(state.native.writes).toHaveLength(0);
  await closeLead(page);
});
test("denied trial history stays unread without a fabricated empty history or writer", async ({
  page,
}) => {
  const state = await trials(page, "denied"),
    dialog = await openLead(page);
  await dialog.getByRole("button", { name: "Deneme kaydını onayla", exact: true }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(
    dialog.getByText("Bu aday için görünür deneme teklifi yok.", { exact: true }),
  ).toHaveCount(0);
  expect(state.writes).toHaveLength(0);
  expect((await scanAccessibility(page, "trial-denied-source")).violations).toEqual([]);
  await verifyResponsiveLayout(page);
  await closeLead(page);
});

test("an authorized assignee change rereads the real source rather than preserving an old display value", async ({
  page,
}) => {
  const native = await mockLeads(page),
    dialog = await openLead(page);
  await expect(dialog.getByLabel("Sorumlu", { exact: true })).toBeEnabled();
  await dialog.getByLabel("Sorumlu", { exact: true }).selectOption("");
  await dialog.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(dialog.getByText(saved, { exact: true })).toBeVisible();
  expect(native.writes.at(-1)?.request).toMatchObject({ assigned_to: null, expected_version: 2 });
  expect(native.leads[0]!.assigned_to).toBeNull();
  await closeLead(page);
});

for (const kind of ["renewal_due", "inactive_student"] as const)
  test(`student followup ${kind} uses native policy membership and opens the scoped person`, async ({
    page,
  }) => {
    const native = await mockLeads(page),
      requests: Record<string, unknown>[] = [];
    native.people.get(leadIds.person)!.relationships = [
      { center_id: I.center, kind: "student", state: "active" },
    ];
    await page.route("**/functions/v1/backend-v1/crm_followup_list_v1", (route) => {
      const r = route.request().postDataJSON();
      requests.push(r);
      return route.fulfill({
        json: {
          ok: true,
          data: {
            items: [
              {
                id: id(980),
                person_id: leadIds.person,
                center_id: I.center,
                lead_id: null,
                assigned_to: null,
                kind: r.kind,
                due_at: "2026-11-18T10:00:00Z",
              },
            ],
            next_cursor: null,
            as_of: "2026-11-16T12:00:00Z",
          },
          trace_id: I.role,
        },
      });
    });
    await page.getByRole("tab", { name: "Takipler", exact: true }).click();
    await page.getByRole("combobox", { name: "Takip kaynağı", exact: true }).selectOption(kind);
    const action = page.getByRole("button", {
      name: kind === "renewal_due" ? "Yenileme zamanı gelenler" : "Hareketsiz öğrenciler",
      exact: true,
    });
    await expect(action).toBeVisible();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ kind, org_id: I.org, center_id: I.center });
    expect(requests[0]).not.toHaveProperty("assigned_to");
    await expect(page.getByRole("combobox", { name: "Sorumlu", exact: true })).toBeDisabled();
    expect((await scanAccessibility(page, `native-${kind}-list`)).violations).toEqual([]);
    await action.click();
    await expect(page).toHaveURL(new RegExp(`/o/${I.org}/c/${I.center}/people/${leadIds.person}$`));
    await expect(page.getByRole("heading", { name: "Aday A", exact: true })).toBeVisible();
    expect(native.writes).toHaveLength(0);
  });

test("automation followups open the exact generated activities for members and candidates", async ({
  page,
}) => {
  const native = await mockLeads(page);
  const memberActivity = id(981);
  const kinds: string[] = [];
  const selectors: Record<string, unknown>[] = [];
  const due = "2026-11-18T10:00:00Z";
  let permitted = false;
  await page.route("**/functions/v1/backend-v1/*", (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1);
    const request = route.request().postDataJSON();
    const send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } });
    if (op === "crm_followup_list_v1") {
      kinds.push(request.kind);
      expect(request).toMatchObject({ org_id: I.org, center_id: I.center });
      const source = {
        kind: "automation_followup",
        center_id: I.center,
        assigned_to: null,
        due_at: due,
      };
      return send({
        items: [
          { ...source, id: memberActivity, lead_id: null, person_id: I.self },
          { ...source, id: leadIds.activity, lead_id: leadIds.first, person_id: leadIds.person },
        ],
        as_of: due,
        next_cursor: null,
      });
    }
    if (op === "management_state_get_v1" && request.operation === "crm_activity_save_v1") {
      const key = request.selector.key;
      if (key.activity_id) selectors.push(key);
      if (key.person_id === I.self) {
        expect(key).toEqual({ person_id: I.self, activity_id: memberActivity });
        if (!permitted)
          return route.fulfill({
            status: 403,
            json: { ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: I.role } },
          });
        const entity = { type: "crm_activities", id: memberActivity };
        return send({
          items: [
            {
              operation: "crm_activity_save_v1",
              entity,
              exists: true,
              state: "open",
              versions: [{ entity, version: 1 }],
              current: {
                operation: "crm_activity_save_v1",
                values: {
                  person_id: I.self,
                  lead_id: null,
                  activity_id: memberActivity,
                  kind: "followup",
                  due_at: due,
                  note: "Sunucunun oluşturduğu takip notu",
                  outcome: null,
                },
              },
            },
          ],
          as_of: due,
          next_cursor: null,
        });
      }
    }
    return route.fallback();
  });
  await page.getByRole("tab", { name: "Takipler", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Takip kaynağı", exact: true })
    .selectOption("automation_followup");
  const member = page.getByRole("row").filter({ hasText: "Örnek sorumlu" }).getByRole("button");
  await member.click();
  const dialog = page.getByRole("dialog", { name: "Otomasyon takipleri", exact: true });
  await expect(dialog.getByText("Otomasyon takibinin güncel kaydı okunamadı.")).toBeVisible();
  permitted = true;
  await dialog.getByRole("button", { name: "Yeniden dene", exact: true }).click();
  await expect(dialog.getByText("Sunucunun oluşturduğu takip notu", { exact: true })).toBeVisible();
  expect((await scanAccessibility(page, "automation-followup-source")).violations).toEqual([]);
  const close = dialog.getByRole("button", { name: "Kapat", exact: true });
  await close.focus();
  await expect(close).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(member).toBeFocused();
  await page.getByRole("row").filter({ hasText: "Aday A" }).getByRole("button").click();
  await expect(page.getByRole("dialog").getByLabel("Not", { exact: true })).toHaveValue(
    "İlk görüşmeyi yap",
  );
  await closeLead(page);
  expect(kinds).toEqual(["automation_followup"]);
  expect(selectors).toEqual([
    { person_id: I.self, activity_id: memberActivity },
    { person_id: I.self, activity_id: memberActivity },
    { lead_id: leadIds.first, activity_id: leadIds.activity },
  ]);
  expect(native.writes).toHaveLength(0);
});

test("student followup policy failure remains unread and recovers through an explicit source read", async ({
  page,
}) => {
  const native = await mockLeads(page);
  let denied = true;
  await page.route("**/functions/v1/backend-v1/crm_followup_list_v1", (route) =>
    route.fulfill(
      denied
        ? {
            status: 403,
            json: {
              ok: false,
              error: { code: "POLICY_NOT_CONFIGURED", retryable: false, trace_id: I.role },
            },
          }
        : {
            json: {
              ok: true,
              data: { items: [], next_cursor: null, as_of: "2026-11-16T12:00:00Z" },
              trace_id: I.role,
            },
          },
    ),
  );
  await page.getByRole("tab", { name: "Takipler", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Takip kaynağı", exact: true })
    .selectOption("renewal_due");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByText("Gösterilecek takip veya faaliyet yok.", { exact: true }),
  ).toHaveCount(0);
  denied = false;
  await page
    .getByRole("tabpanel", { name: "Takipler", exact: true })
    .getByRole("button", { name: "Güncel durumu oku", exact: true })
    .click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(
    page.getByText("Gösterilecek takip veya faaliyet yok.", { exact: true }),
  ).toBeVisible();
  expect(native.writes).toHaveLength(0);
});
