import { activate, attemptOutsideDismissal } from "./device-input.js";
import { clickWorkspaceLink } from "./auth-fixture.js";
import { test, expect } from "./test.js";
import { scanAccessibility } from "./accessibility.js";
import { reviewStudioAccessibility } from "./studio-accessibility-review.js";
import { writeFile } from "node:fs/promises";
import { request_management_state_get_v1 } from "@ftksaas/api-contracts/validators";
import { mockStudio, mockStudioCalendar, openStudio, studioIds } from "./studio-fixture.js";
import common from "../src/locales/tr/common.json" with { type: "json" };

async function newRoom(page: import("@playwright/test").Page) {
  await activate(page.getByRole("tab", { name: "Dersler ve salonlar", exact: true }));
  await activate(page.getByRole("button", { name: "Salon ekle", exact: true }));
  return page.getByRole("dialog");
}

async function newRoomClosure(page: import("@playwright/test").Page) {
  await activate(page.getByRole("tab", { name: "Kapanışlar", exact: true }));
  await activate(page.getByRole("button", { name: "Kapanış ekle", exact: true }));
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/Europe\/Istanbul merkez saat dilimine/)).toBeVisible();
  await dialog.locator('[name="target"]').selectOption(studioIds.room);
  await dialog.locator('[name="from"]').fill("2030-06-01");
  await dialog.locator('[name="to"]').fill("2030-06-02");
  await dialog.locator('[name="reason"]').selectOption({ label: "Bakım ya da tadilat" });
  return dialog;
}

function isRoomClosureRead(payload: unknown) {
  return (
    request_management_state_get_v1(payload) &&
    payload.org_id === studioIds.org &&
    payload.center_id === studioIds.center &&
    payload.selector.operation === "availability_exception_save_v1" &&
    (payload.selector.key.resources ?? [payload.selector.key.resource]).some(
      (resource) => resource?.kind === "room" && resource.id === studioIds.room,
    )
  );
}

test("Studio flow: unknown room result replays its key once and preserves zero capacity", async ({
  page,
}) => {
  const state = await mockStudio(page);
  await openStudio(page);
  const dialog = await newRoom(page);
  await dialog
    .getByRole("textbox", { name: "Salon adı", exact: true })
    .fill("Sıfır kontenjanlı salon");
  await dialog.getByRole("spinbutton", { name: "Kontenjan", exact: true }).fill("0");
  state.nextWrite = "unknown";
  await activate(dialog.getByRole("button", { name: "Salonu ekle", exact: true }));
  const retry = dialog.getByRole("button", { name: "Aynı isteği yeniden dene", exact: true });
  await expect(retry).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Vazgeç", exact: true })).toBeDisabled();
  await attemptOutsideDismissal(dialog);
  await expect(dialog).toBeVisible();
  expect((await scanAccessibility(page, "studio-room-unknown")).violations).toEqual([]);
  await activate(retry);
  await expect(dialog).toHaveCount(0);
  const writes = state.writes.filter((write) => write.operation === "room_save_v1");
  expect(writes).toHaveLength(2);
  expect(writes[0]!.key).toBe(writes[1]!.key);
  expect(state.effects.filter((effect) => effect === "room_save_v1")).toHaveLength(1);
  expect(state.rooms.at(-1)).toMatchObject({ name: "Sıfır kontenjanlı salon", capacity: 0 });
  expect(writes[0]!.payload).not.toHaveProperty("expected_version");
});

test("Studio flow: acknowledged room never writes again after a failed summary read", async ({
  page,
}) => {
  const state = await mockStudio(page);
  await openStudio(page);
  const dialog = await newRoom(page);
  await dialog
    .getByRole("textbox", { name: "Salon adı", exact: true })
    .fill("Okuma yeniden deneme salonu");
  await dialog.getByRole("spinbutton", { name: "Kontenjan", exact: true }).fill("12");
  state.failedReads.add("management_state_get_v1");
  await activate(dialog.getByRole("button", { name: "Salonu ekle", exact: true }));
  await expect(dialog.getByText(/Değişiklik kaydedildi; güncel liste okunamadı/)).toBeVisible();
  expect(state.effects).toEqual(["room_save_v1"]);
  expect((await scanAccessibility(page, "studio-room-ack-read-failure")).violations).toEqual([]);
  state.failedReads.clear();
  const accountReadsBeforeRetry = state.native.account;
  const retryReads: string[] = [];
  const observeReadback = (request: import("@playwright/test").Request) => {
    if (request.method() !== "POST") return;
    const path = new URL(request.url()).pathname;
    if (path === "/functions/v1/backend-v1/account_get_v1") retryReads.push("account_get_v1");
    if (path !== "/functions/v1/backend-v1/management_state_get_v1") return;
    const payload: unknown = request.postDataJSON();
    if (
      typeof payload === "object" &&
      payload !== null &&
      "operation" in payload &&
      payload.operation === "room_save_v1"
    )
      retryReads.push("room_save_v1");
  };
  page.on("request", observeReadback);
  await activate(dialog.getByRole("button", { name: "Listeyi yeniden yükle", exact: true }));
  await expect(dialog).toHaveCount(0);
  page.off("request", observeReadback);
  expect(state.native.account).toBeGreaterThan(accountReadsBeforeRetry);
  // The plan callback runs after these snapshot sources. Its strict account
  // read alone must not satisfy the mandatory room readback's identity check.
  const firstRoomRead = retryReads.indexOf("room_save_v1");
  expect(firstRoomRead).toBeGreaterThan(-1);
  expect(retryReads.slice(0, firstRoomRead)).toContain("account_get_v1");
  expect(state.writes).toHaveLength(1);
  await expect(
    page.getByRole("button", { name: "Okuma yeniden deneme salonu", exact: true }),
  ).toBeVisible();
});

test("Studio flow: stale room version needs an explicit fresh read and new intent", async ({
  page,
}) => {
  const state = await mockStudio(page);
  await openStudio(page);
  await activate(page.getByRole("tab", { name: "Dersler ve salonlar", exact: true }));
  await activate(page.getByRole("button", { name: "Ana salon", exact: true }));
  const dialog = page.getByRole("dialog");
  const name = dialog.getByRole("textbox", { name: "Salon adı", exact: true });
  await expect(name).toBeEditable();
  await name.fill("Yerel taslak");
  state.rooms[0]!.version = 3;
  state.rooms[0]!.name = "Sunucudaki son ad";
  await activate(dialog.getByRole("button", { name: "Kaydet", exact: true }));
  await expect(dialog.getByText(/Kayıt başka bir işlemle değişti/)).toBeVisible();
  await expect(name).toHaveValue("Yerel taslak");
  await activate(dialog.getByRole("button", { name: "Güncel kaydı yükle", exact: true }));
  await expect(name).toHaveValue("Sunucudaki son ad");
  await name.fill("Son sürümle kayıt");
  await activate(dialog.getByRole("button", { name: "Kaydet", exact: true }));
  await expect(dialog).toHaveCount(0);
  expect(state.writes.map((write) => write.payload.expected_version)).toEqual([2, 3]);
  expect(new Set(state.writes.map((write) => write.key)).size).toBe(2);
  expect(state.effects).toEqual(["room_save_v1"]);
});

test("Studio flow: closure appends using the center version and inclusive local days", async ({
  page,
}) => {
  const state = await mockStudio(page);
  await openStudio(page);
  const dialog = await newRoomClosure(page);
  let roomClosureReads = 0;
  page.on("request", (request) => {
    if (!request.url().endsWith("/backend-v1/management_state_get_v1")) return;
    if (isRoomClosureRead(request.postDataJSON())) roomClosureReads++;
  });
  await activate(dialog.getByRole("button", { name: "Kapanışı kaydet", exact: true }));
  await expect(dialog).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]!.payload).toMatchObject({
    expected_version: 7,
    resource: { kind: "room", id: studioIds.room },
    interval: { starts_at: "2030-05-31T21:00:00Z", ends_at: "2030-06-02T21:00:00Z" },
  });
  expect(state.closures).toHaveLength(1);
  expect(state.effects).toEqual(["availability_exception_save_v1"]);
  expect(roomClosureReads).toBe(1);
});

test("Studio flow: an acknowledged closure missing from the fresh source only retries reads", async ({
  page,
}) => {
  const state = await mockStudio(page);
  await openStudio(page);
  const dialog = await newRoomClosure(page);
  let roomClosureReads = 0;
  await page.route("**/functions/v1/backend-v1/management_state_get_v1", (route) => {
    if (!isRoomClosureRead(route.request().postDataJSON())) return route.fallback();
    roomClosureReads++;
    if (roomClosureReads > 1) return route.fallback();
    return route.fulfill({
      json: {
        ok: true,
        trace_id: studioIds.role,
        data: { items: [], next_cursor: null, as_of: "2026-11-18T12:00:00Z" },
      },
    });
  });
  await activate(dialog.getByRole("button", { name: "Kapanışı kaydet", exact: true }));
  await expect(dialog.getByRole("status")).toContainText(common.studio.closureSavedUnread);
  const retry = dialog.getByRole("button", { name: common.studio.retryRead, exact: true });
  await expect(retry).toBeEnabled();
  expect(roomClosureReads).toBe(1);
  await activate(retry);
  await expect(dialog).toHaveCount(0);
  expect(roomClosureReads).toBe(2);
  expect(state.writes).toHaveLength(1);
  expect(state.effects).toEqual(["availability_exception_save_v1"]);
});

test("Studio flow: replacement terms reset approval and unknown publication never duplicates", async ({
  page,
}) => {
  const state = await mockStudio(page);
  state.roles[0]!.accountAccessGranted = true;
  state.agreements[0]!.valid.ends_at = "2029-12-31T00:00:00Z";
  const historical = structuredClone(state.agreements[0]!);
  const selectedAgreements: (string | null)[] = [];
  await mockStudioCalendar(page);
  await page.route("**/functions/v1/backend-v1/program_preview_v1", async (route) => {
    const request = route.request().postDataJSON();
    expect(request).toMatchObject({
      org_id: studioIds.org,
      center_id: studioIds.center,
      class_id: studioIds.lesson,
    });
    // The browser must request native resolution instead of pinning an obsolete agreement.
    expect(request.schedule.assignments).toEqual([
      { person_id: studioIds.instructor, duty: "instructor" },
    ]);
    const current = state.agreements.length > 1 ? state.agreements.at(-1)! : null;
    selectedAgreements.push(current?.id ?? null);
    return route.fulfill({
      json: {
        ok: true,
        trace_id: studioIds.role,
        data: {
          id: "019a7b00-0000-7000-8000-000000000950",
          token: "synthetic-program-review",
          scope_hash: "synthetic-scope",
          expires_at: "2035-01-01T00:00:00Z",
          dependencies: {
            versions: current
              ? [
                  {
                    entity: { type: "instructor_agreements", id: current.id },
                    version: current.version,
                  },
                ]
              : [],
            policy_hashes: [],
            permission_hash: "synthetic-permission",
          },
          effects: [],
          blockers: current
            ? []
            : [{ code: "POLICY_NOT_CONFIGURED", retryable: false, trace_id: studioIds.role }],
          sessions: [
            {
              session_id: "019a7b00-0000-7000-8000-000000000951",
              interval: { starts_at: "2030-01-07T08:17:00Z", ends_at: "2030-01-07T08:47:00Z" },
              assignments: current
                ? [
                    {
                      person_id: studioIds.instructor,
                      duty: "instructor",
                      agreement_id: current.id,
                    },
                  ]
                : [],
            },
          ],
        },
      },
    });
  });
  async function programReview(blocked: boolean) {
    await clickWorkspaceLink(page, "Ders programı");
    await activate(page.getByRole("button", { name: "Seans ekle", exact: true }));
    const panel = page.getByRole("dialog");
    await activate(panel.getByRole("radio", { name: "Haftalık seri", exact: true }));
    await panel.locator("#schedule-create-class").selectOption(studioIds.lesson);
    await panel.locator("#schedule-create-instructor").selectOption(studioIds.instructor);
    await panel.locator("#schedule-create-room").selectOption(studioIds.room);
    await panel.locator("#schedule-create-capacity").fill("2");
    await panel.locator("#schedule-create-date").fill("2030-01-07");
    await panel.locator("#schedule-create-time").fill("11:17");
    await panel.locator("#schedule-create-duration").fill("30");
    await panel.locator("#schedule-create-weeks").fill("1");
    await activate(panel.getByRole("button", { name: "Pzt", exact: true }));
    await activate(panel.getByRole("button", { name: "Seansları önizle", exact: true }));
    if (blocked) {
      await expect(panel.getByRole("alert")).toHaveText(common.schedule.errors.configuration);
      await expect(panel.getByRole("button", { name: "Seriyi oluştur", exact: true })).toHaveCount(
        0,
      );
    } else {
      await expect(
        panel.getByRole("button", { name: "Seriyi oluştur", exact: true }),
      ).toBeVisible();
      await expect(panel.getByRole("alert")).toHaveCount(0);
    }
    await activate(panel.getByRole("button", { name: "Vazgeç", exact: true }));
    await clickWorkspaceLink(page, "Stüdyo");
  }
  await openStudio(page);
  const documentTime = await page.evaluate(() => performance.timeOrigin);
  await programReview(true);
  expect(state.writes).toHaveLength(0);
  await activate(page.getByRole("tab", { name: "Anlaşmalar", exact: true }));
  await activate(page.getByRole("button", { name: /Örnek Eğitmen/ }));
  const dialog = page.getByRole("dialog");
  const amount = dialog.getByLabel("Tutar (en küçük para birimi)", { exact: true });
  await expect(amount).toHaveValue("12550");
  await amount.fill("25000");
  await dialog.locator("#agreement-from").fill("2030-01-01T09:00");
  await dialog.locator("#agreement-until").fill("2031-01-01T09:00");
  await dialog.locator("#agreement-reason").fill("Fixture ileri yürürlük sürümü");
  const approval = dialog.getByRole("checkbox");
  await activate(approval, "Space");
  await expect(approval).toBeChecked();
  await amount.fill("26000");
  await expect(approval).not.toBeChecked();
  await activate(approval, "Space");
  state.nextWrite = "unknown";
  await activate(dialog.getByRole("button", { name: "Yeni sürümü yayınla", exact: true }));
  const retry = dialog.getByRole("button", { name: "Aynı isteği yeniden dene", exact: true });
  await expect(retry).toBeVisible();
  expect((await scanAccessibility(page, "studio-agreement-unknown")).violations).toEqual([]);
  await activate(retry);
  await expect(dialog).toHaveCount(0);
  expect(state.writes).toHaveLength(2);
  expect(state.writes[0]!.key).toBe(state.writes[1]!.key);
  expect(state.effects).toEqual(["instructor_agreement_publish_v1"]);
  expect(state.agreements).toHaveLength(2);
  expect(state.agreements[0]!.terms.components[0]!.amount_minor).toBe("12550");
  expect(state.agreements[1]).toMatchObject({
    supersedes_id: studioIds.agreement,
    version: 2,
    terms: { components: [{ kind: "session_fixed", amount_minor: "26000" }] },
  });
  expect(state.agreements[0]).toEqual(historical);
  await programReview(false);
  expect(selectedAgreements).toEqual([null, state.agreements[1]!.id]);
  expect(state.effects).toEqual(["instructor_agreement_publish_v1"]);
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(documentTime);
});

test("Studio flow: scoped setup distinguishes ready documents and missing confirmed delivery", async ({
  page,
}) => {
  const state = await mockStudio(page);
  state.setupStatus = {
    document_published: true,
    member_invitation_sent: false,
    as_of: "2026-11-14T12:00:00Z",
  };
  const setupRequests: Record<string, unknown>[] = [];
  page.on("request", (request) => {
    if (
      new URL(request.url()).pathname.endsWith("/centers_list_v1") &&
      request.method() === "POST"
    ) {
      const body = request.postDataJSON();
      if (body.include_setup_status) setupRequests.push(body);
    }
  });
  await openStudio(page);
  await expect(
    page.getByText("Yürürlükte, dosyası hazır bir belge yayını var.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Bu merkezde sağlayıcı onaylı hesap daveti gönderimi yok.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "62.5");
  expect(setupRequests.length).toBeGreaterThan(0);
  expect(
    setupRequests.every(
      (request) => request.org_id === studioIds.org && request.center_id === studioIds.center,
    ),
  ).toBe(true);
  expect(state.writes).toEqual([]);
});

test("Studio flow: a verified active assignment cannot submit a duplicate grant", async ({
  page,
}) => {
  const state = await mockStudio(page);
  state.accountLinked = true;
  state.roles[0]!.accountAccessGranted = true;
  await openStudio(page);
  await activate(page.getByRole("button", { name: "Eğitmen ekle", exact: true }));
  let dialog = page.getByRole("dialog");
  await activate(dialog.getByRole("radio", { name: "Mevcut kişi", exact: true }));
  await activate(dialog.getByRole("button", { name: "Kişi ara", exact: true }));
  await dialog.locator("#existing-instructor-person").selectOption(studioIds.instructor);
  await activate(dialog.getByRole("button", { name: "Kuruluma devam et", exact: true }));
  dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText("Doğrulanmış hesaba eğitmen yetkisi bağlı", { exact: true }),
  ).toBeVisible();
  await expect(dialog.locator("#instructor-role-grant")).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: "Bağlı hesaba rolü uygula", exact: true }),
  ).toHaveCount(0);
  expect(state.writes).toEqual([]);
  state.roles[0]!.accountAccessGranted = false;
  await activate(dialog.getByRole("button", { name: "Hesap bağını kontrol et", exact: true }));
  await expect(dialog.getByText("Görev etkin", { exact: true })).toBeVisible();
  await expect(dialog.locator("#instructor-role-grant")).toBeVisible();
  await expect(dialog.getByRole("checkbox")).not.toBeChecked();
  const review = await reviewStudioAccessibility(page, "studio-verified-binding-grant-label");
  expect(review.violations).toEqual([]);
  await writeFile(".tmp/e12-grant-manual-review.json", JSON.stringify(review, null, 2));
  expect(state.writes).toEqual([]);
});

test("Studio agreement: explicit new instructor/discipline/format terms create an independent immutable version", async ({
  page,
}) => {
  const state = await mockStudio(page);
  const original = structuredClone(state.agreements[0]);
  await openStudio(page);
  await activate(page.getByRole("tab", { name: "Anlaşmalar", exact: true }));
  await activate(page.getByRole("button", { name: "Anlaşma hazırla", exact: true }));
  const panel = page.getByRole("dialog", { name: "Anlaşma hazırla", exact: true });
  await expect(panel.locator("#agreement-person")).toBeEnabled();
  await panel.locator("#agreement-person").selectOption(studioIds.instructor);
  await panel.locator("#agreement-discipline").selectOption(studioIds.discipline);
  await panel.locator("#agreement-format").selectOption("private");
  await activate(panel.getByRole("radio", { name: "Seans başı", exact: true }), "Space");
  await panel.locator("#agreement-currency").fill("TRY");
  await panel
    .locator('select[id^="agreement-general-"][id$="-kind"]')
    .selectOption("session_fixed");
  await panel.getByLabel("Tutar (en küçük para birimi)", { exact: true }).fill("25000");
  await panel.locator("#agreement-room-kind").selectOption("free");
  await panel.locator("#agreement-room-order").selectOption("before_instructor_share");
  await panel.locator("#agreement-from").fill("2030-01-01T09:00");
  await panel.locator("#agreement-until").fill("2031-01-01T09:00");
  await panel.locator("#agreement-reason").fill("Kontrollü yeni özel ders anlaşması");
  expect(state.writes).toHaveLength(0);
  await activate(panel.getByRole("checkbox"), "Space");
  await activate(panel.getByRole("button", { name: "Yeni sürümü yayınla", exact: true }));
  await expect(panel).toHaveCount(0);
  expect(state.effects).toEqual(["instructor_agreement_publish_v1"]);
  expect(state.agreements).toHaveLength(2);
  expect(state.agreements[0]).toEqual(original);
  expect(state.agreements[1]).toMatchObject({
    person_id: studioIds.instructor,
    discipline_id: studioIds.discipline,
    center_id: studioIds.center,
    format: "private",
    supersedes_id: null,
    version: 1,
    valid: { starts_at: "2030-01-01T09:00:00Z", ends_at: "2031-01-01T09:00:00Z" },
    terms: {
      model: "session_fixed",
      currency: "TRY",
      components: [{ kind: "session_fixed", amount_minor: "25000" }],
    },
  });
  await activate(page.getByRole("button", { name: /Örnek Eğitmen/ }).last());
  await expect(page.getByRole("dialog").locator("#agreement-format")).toHaveValue("private");
  await expect(
    page.getByRole("dialog").getByLabel("Tutar (en küçük para birimi)", { exact: true }),
  ).toHaveValue("25000");
});
