import { activate } from "./device-input.js";
import { test, expect } from "./test.js";
import type { Page } from "@playwright/test";
import type { ManagementWorkView } from "@ftksaas/api-contracts";
import { mockSessionDetail, sessionIds as S } from "./session-detail-fixture.js";
import { studioIds as I } from "./studio-fixture.js";
import { origin } from "./auth-fixture.js";
const id = (n: number) => `019ab7b0-0000-7000-8000-${String(n).padStart(12, "0")}`;
const at = "2026-11-16T12:00:00Z",
  activityId = id(790),
  applicationId = id(791);
async function setup(page: Page, mode: "normal" | "retry" | "receipt" | "ackUnread" = "normal") {
  const native = await mockSessionDetail(page, { existing: true, allowEditor: true });
  await page.clock.setFixedTime(new Date(at));
  native.session.starts_at = "2026-11-16T13:00:00Z";
  native.session.ends_at = "2026-11-16T14:00:00Z";
  const tasks: ManagementWorkView[] = [
    {
      id: S.session,
      kind: "lesson_attendance",
      title: "Açık ders yoklaması",
      version: native.session.version,
      created_at: at,
      person_id: null,
      person_name: null,
      due_at: null,
      target: { operation: "session_get_v1", session_id: S.session },
    },
    {
      id: activityId,
      kind: "crm_followup",
      title: "Merkez takip kaydı",
      version: 2,
      created_at: at,
      person_id: I.self,
      person_name: "Örnek üye",
      due_at: "2026-11-16T13:00:00Z",
      target: {
        operation: "management_state_get_v1",
        selector: {
          operation: "crm_activity_save_v1",
          key: { activity_id: activityId, person_id: I.self },
        },
      },
    },
    {
      id: applicationId,
      kind: "application_review",
      title: "Bekleyen örnek başvuru",
      version: 2,
      created_at: at,
      person_id: null,
      person_name: null,
      due_at: null,
      target: {
        operation: "management_state_get_v1",
        selector: {
          operation: "public_application_review_v1",
          key: { application_id: applicationId },
        },
      },
    },
  ];
  let denied = false,
    sourceDenied = false,
    completed = false,
    appClosed = false,
    dropped = false,
    unread = false,
    globalTotal = 3;
  const lists: Record<string, unknown>[] = [],
    writes: Record<string, unknown>[] = [];
  let applicationResultReads = 0;
  const receipts = new Map<string, { id: string; type: string; operation: string }>();
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const operation = new URL(route.request().url()).pathname.split("/").at(-1)!,
      req = route.request().postDataJSON();
    const send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } });
    const fail = () =>
      route.fulfill({
        status: 403,
        json: { ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: I.role } },
      });
    if (operation === "management_work_list_v1") {
      lists.push(req);
      expect(req).toMatchObject({
        org_id: I.org,
        center_id: I.center,
        kind: "all",
        page: { limit: 20, sort: "created_at_asc" },
      });
      if (denied) return fail();
      const items = req.page.cursor
        ? []
        : tasks.filter(
            (row) =>
              !(completed && row.id === activityId) && !(appClosed && row.id === applicationId),
          );
      const total = globalTotal === 0 ? 0 : globalTotal - Number(completed) - Number(appClosed);
      return send({
        items: total ? items : [],
        next_cursor: !req.page.cursor && total ? "second" : null,
        as_of: at,
        summary: {
          total,
          lesson_request: 0,
          lesson_attendance: total ? total - Number(!completed) - Number(!appClosed) : 0,
          event_attendance: 0,
          crm_followup: total ? Number(!completed) : 0,
          application_review: total ? Number(!appClosed) : 0,
        },
      });
    }
    if (
      operation === "management_state_get_v1" &&
      ["crm_activity_save_v1", "public_application_review_v1"].includes(req.operation)
    ) {
      if (sourceDenied) return fail();
      if (unread) {
        unread = false;
        return route.abort();
      }
      const app = req.operation === "public_application_review_v1",
        rowId = app ? applicationId : activityId,
        type = app ? "public_applications" : "crm_activities",
        version = app ? 2 + Number(appClosed) : 2 + Number(completed);
      const entity = { type, id: rowId };
      if (app && appClosed) applicationResultReads++;
      return send({
        items: [
          {
            operation: req.operation,
            exists: true,
            entity,
            state: app ? (appClosed ? "closed" : "pending") : completed ? "completed" : "active",
            versions: [{ entity, version }],
            as_of: at,
            current: {
              operation: req.operation,
              values: app
                ? {
                    application_id: applicationId,
                    person_id: null,
                    center_id: I.center,
                    intake: {
                      display_name: "Başvuran Örnek",
                      phone: "+905550000000",
                      email: null,
                      interest: "Tango",
                      message: "Akşam grubu",
                      consents: [],
                    },
                    phone_matches: [],
                    phone_matches_truncated: false,
                  }
                : {
                    activity_id: activityId,
                    person_id: I.self,
                    lead_id: null,
                    kind: completed ? "outcome" : "followup",
                    note: "Özgün takip notu",
                    due_at: "2026-11-16T13:00:00Z",
                    outcome: completed ? "Görüşüldü" : null,
                  },
            },
          },
        ],
        next_cursor: null,
        as_of: at,
      });
    }
    if (operation === "crm_activity_save_v1" || operation === "public_application_review_v1") {
      writes.push(req);
      if (mode === "retry" && !dropped) {
        dropped = true;
        return route.abort();
      }
      const app = operation === "public_application_review_v1",
        rowId = app ? applicationId : activityId;
      if (app) {
        expect(req.action).toBe("close");
        appClosed = true;
      } else {
        expect(req).toMatchObject({
          activity_id: activityId,
          person_id: I.self,
          lead_id: null,
          expected_version: 2,
          kind: "outcome",
          outcome: "Görüşüldü",
          note: "Özgün takip notu",
          due_at: "2026-11-16T13:00:00Z",
        });
        completed = true;
      }
      const type = app ? "public_applications" : "crm_activities";
      receipts.set(req.operation_key, { id: rowId, type, operation });
      if (mode === "receipt" && !dropped) {
        dropped = true;
        return route.abort();
      }
      if (mode === "ackUnread") unread = true;
      return send({
        operation_id: id(792),
        primary_id: rowId,
        version: 3,
        related: [{ type, id: rowId }],
        replayed: false,
      });
    }
    if (operation === "operation_status_get_v1" && receipts.has(req.key)) {
      const receipt = receipts.get(req.key)!;
      return send({
        operation: receipt.operation,
        key: req.key,
        status: "succeeded",
        result_available: true,
        result_reference: { id: receipt.id, type: receipt.type },
      });
    }
    return route.fallback();
  });
  await page.goto(`${origin}/o/${I.org}/c/${I.center}/overview`);
  const card = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByRole("heading", { name: "Bekleyen işler", exact: true }) });
  await expect(card.getByText("Merkez takip kaydı", { exact: true })).toBeVisible();
  return {
    native,
    card,
    tasks,
    lists,
    writes,
    applicationResultReads: () => applicationResultReads,
    setDenied: () => {
      denied = true;
    },
    setSourceDenied: () => {
      sourceDenied = true;
    },
    setEmpty: () => {
      denied = false;
      globalTotal = 0;
    },
  };
}
test("center work uses real global counts, cursor back navigation and a real attendance source", async ({
  page,
}) => {
  const state = await setup(page);
  await expect(state.card.getByRole("status")).toHaveText("Seçili merkezde 3 yetkili bekleyen iş");
  await activate(state.card.getByRole("button", { name: "Sonraki", exact: true }));
  await expect(
    state.card.getByText("Bu sayfada bekleyen yönetim işi yok.", { exact: true }),
  ).toBeVisible();
  await expect(
    state.card.getByText("Bu kapsamda bekleyen yönetim işi yok.", { exact: true }),
  ).toHaveCount(0);
  await activate(state.card.getByRole("button", { name: "Önceki", exact: true }));
  await activate(
    state.card
      .getByRole("listitem")
      .filter({ hasText: "Açık ders yoklaması" })
      .getByRole("button", { name: "İşi aç", exact: true }),
  );
  await activate(
    page.getByRole("dialog").getByRole("link", { name: "İlgili akışı aç", exact: true }),
  );
  await expect(page).toHaveURL(new RegExp(`/sessions/${S.session}\\?tab=attendance$`));
  await expect(page.getByRole("tab", { name: "Yoklama", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(state.writes).toHaveLength(0);
  expect(state.lists.some((r) => (r.page as { cursor?: string }).cursor === "second")).toBe(true);
});
test("denied work source hides its old details and reload distinguishes denial from actual emptiness", async ({
  page,
}) => {
  const state = await setup(page);
  state.setSourceDenied();
  await activate(
    state.card
      .getByRole("listitem")
      .filter({ hasText: "Merkez takip kaydı" })
      .getByRole("button", { name: "İşi aç", exact: true }),
  );
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("alert")).toContainText("İş kaynağı okunamadı");
  await expect(dialog.getByText("Özgün takip notu", { exact: true })).toHaveCount(0);
  state.setDenied();
  const readsBeforeClose = state.lists.length;
  await activate(dialog.getByRole("button", { name: "Vazgeç", exact: true }));
  await expect(dialog).toHaveCount(0);
  await expect(state.card.getByText("Merkez takip kaydı", { exact: true })).toBeVisible();
  expect(state.lists).toHaveLength(readsBeforeClose);
  await activate(
    state.card.getByRole("button", { name: "İş listesini yeniden oku", exact: true }).last(),
  );
  await expect(state.card.getByRole("alert")).toBeVisible();
  await expect(state.card.getByText("Merkez takip kaydı", { exact: true })).toHaveCount(0);
  state.setEmpty();
  await activate(
    state.card.getByRole("button", { name: "İş listesini yeniden oku", exact: true }).last(),
  );
  await expect(
    state.card.getByText("Bu kapsamda bekleyen yönetim işi yok.", { exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(0);
});
for (const mode of ["retry", "receipt", "ackUnread"] as const)
  test(`native leadless followup ${mode} recovers without a new work record`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.setViewportSize({ width: 320, height: 950 });
    const state = await setup(page, mode);
    await activate(
      state.card
        .getByRole("listitem")
        .filter({ hasText: "Merkez takip kaydı" })
        .getByRole("button", { name: "İşi aç", exact: true }),
    );
    let dialog = page.getByRole("dialog");
    await dialog
      .getByRole("textbox", { name: "Takip sonucunu kaydet", exact: true })
      .fill("Görüşüldü");
    await activate(dialog.getByRole("button", { name: "Sonucu incele", exact: true }));
    dialog = page.getByRole("dialog");
    await activate(dialog.getByRole("checkbox"), "Space");
    await activate(
      dialog.getByRole("button", { name: "Onaylanan değişiklikleri uygula", exact: true }),
    );
    if (mode === "ackUnread") {
      await expect(
        dialog.getByText(
          "İşlem kaydedildi, güncel sonuç henüz okunamadı. Yalnız sonucu yeniden oku.",
          { exact: true },
        ),
      ).toBeVisible();
      await expect(
        dialog.getByRole("button", { name: "Aynı isteği yeniden dene", exact: true }),
      ).toHaveCount(0);
    } else
      await expect(
        dialog.getByText(
          "Sonuç bilinmiyor. Alanlar kilitli; önce işlem sonucunu kontrol et veya aynı işlemi tekrar dene.",
          { exact: true },
        ),
      ).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Vazgeç", exact: true })).toBeDisabled();
    await activate(
      dialog.getByRole("button", {
        name: mode === "retry" ? "Aynı isteği yeniden dene" : "İşlem sonucunu kontrol et",
        exact: true,
      }),
    );
    await expect(
      dialog.getByText("İşlem kaydedildi; güncel kayıt okundu.", { exact: true }),
    ).toBeVisible();
    await activate(dialog.getByRole("button", { name: "Vazgeç", exact: true }));
    await expect(state.card.getByText("Merkez takip kaydı", { exact: true })).toHaveCount(0);
    await expect(state.card.getByRole("status")).toHaveText(
      "Seçili merkezde 2 yetkili bekleyen iş",
    );
    expect(state.writes).toHaveLength(mode === "retry" ? 2 : 1);
    expect(new Set(state.writes.map((r) => r.operation_key)).size).toBe(1);
    expect(state.native.writes).toHaveLength(0);
  });
test("application work opens the existing review writer and rereads the queue after explicit closure", async ({
  page,
}) => {
  const state = await setup(page);
  await activate(
    state.card
      .getByRole("listitem")
      .filter({ hasText: "Bekleyen örnek başvuru" })
      .getByRole("button", { name: "İşi aç", exact: true }),
  );
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Başvuru işlemi", { exact: true }).selectOption("close");
  await activate(
    dialog.getByRole("checkbox", { name: "İşlemi ve etkilerini inceledim.", exact: true }),
    "Space",
  );
  await activate(dialog.getByRole("button", { name: "Kaydet", exact: true }));
  await expect(
    dialog.getByText("İşlem kaydedildi; güncel kayıt okundu.", { exact: true }),
  ).toBeVisible();
  await activate(dialog.getByRole("button", { name: "Kapat", exact: true }));
  await expect(state.card.getByText("Bekleyen örnek başvuru", { exact: true })).toHaveCount(0);
  expect(state.applicationResultReads()).toBe(1);
  expect(state.writes).toHaveLength(1);
});
