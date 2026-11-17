import { test, expect } from "./test.js";
import type { Page } from "@playwright/test";
import type {
  LessonRequestView,
  ManagementStateView,
  SessionView,
} from "../src/lib/api-contracts/generated.js";
import { mockStudio, studioIds as I } from "./studio-fixture.js";
import { origin } from "./auth-fixture.js";
const requestId = "019a7b00-0000-7000-8000-000000000070";
async function fixture(page: Page, mode: "normal" | "unknown" | "denied" | "directory" = "normal") {
  await mockStudio(page);
  const detail: LessonRequestView = {
    id: requestId,
    center_id: I.center,
    person_id: I.self,
    discipline_id: I.discipline,
    format: "private",
    requested_start: "2026-12-01T09:00:00Z",
    duration_minutes: 60,
    preferred_instructor_id: null,
    created_at: "2026-11-16T00:00:00Z",
    expires_at: null,
    state: "pending",
    version: 1,
    alternatives: [],
    reservation_id: null,
  };
  const writes: Record<string, unknown>[] = [],
    reads: Record<string, unknown>[] = [];
  const changedKeys = new Set<string>();
  const session: SessionView = {
    id: I.lesson,
    class_id: null,
    discipline_id: I.discipline,
    format: "private",
    state: "planned",
    attendance_state: "open",
    version: 1,
    starts_at: detail.requested_start,
    ends_at: "2026-12-01T10:00:00Z",
    assignments: [{ person_id: I.instructor, duty: "instructor" }],
    capacity: {
      total: 1,
      held: 0,
      remaining: 1,
      category_held: null,
      category_remaining: null,
      room_capacity: 20,
    },
  };

  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1);
    const req = route.request().postDataJSON();
    const send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } });
    if (op === "management_state_get_v1" && String(req.operation).startsWith("lesson_request_")) {
      reads.push(req);
      if (mode === "denied")
        return route.fulfill({
          status: 403,
          json: { ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: I.role } },
        });
      if (req.selector.key.catalog)
        return send({
          items: [
            {
              operation: req.operation,
              exists: true,
              entity: { type: "people", id: I.instructor },
              state: "active",
              versions: [],
              current: {
                operation: req.operation,
                values: { preferred_instructor_id: I.instructor, display_name: "Sentetik Eğitmen" },
              },
              as_of: detail.created_at,
            },
          ],
          next_cursor: null,
          as_of: detail.created_at,
        });
      const row: ManagementStateView = {
        operation: req.operation,
        exists: true,
        entity: { type: "lesson_requests", id: requestId },
        state: detail.state,
        current: null,
        as_of: detail.created_at,
        request_detail: detail,
        versions: [{ entity: { type: "lesson_requests", id: requestId }, version: detail.version }],
      };
      if (req.operation !== "lesson_request_create_v1")
        return send({ items: [row], next_cursor: null, as_of: detail.created_at });
      const status = req.selector.key.status;
      expect(req.selector.key.include_summary).toBe(true);
      const states =
        mode === "directory"
          ? ([
              "pending",
              "pending",
              "alternative_offered",
              "approved",
              "rejected",
              "withdrawn",
              "expired",
            ] as const)
          : [detail.state];
      const entries = states
        .map((state, index) => ({
          ...row,
          entity: {
            type: "lesson_requests",
            id:
              mode === "directory"
                ? `019a7b00-0000-7000-8000-${String(80 + index).padStart(12, "0")}`
                : detail.id,
          },
          state,
          request_detail: {
            ...detail,
            state,
            id:
              mode === "directory"
                ? `019a7b00-0000-7000-8000-${String(80 + index).padStart(12, "0")}`
                : detail.id,
          },
          versions: [
            {
              entity: {
                type: "lesson_requests",
                id:
                  mode === "directory"
                    ? `019a7b00-0000-7000-8000-${String(80 + index).padStart(12, "0")}`
                    : detail.id,
              },
              version: detail.version,
            },
          ],
        }))
        .filter(
          (entry) =>
            status === "all" ||
            (status === "resolved"
              ? ["approved", "rejected", "withdrawn", "expired"].includes(entry.state)
              : entry.state === status),
        );
      const offset = req.page.cursor ? 1 : 0;
      return send({
        items: mode === "directory" ? entries.slice(offset, offset + 1) : entries,
        next_cursor:
          mode === "directory" && offset === 0 && entries.length > 1 ? `${status}:next` : null,
        as_of: detail.created_at,
        lesson_request_summary:
          mode === "directory"
            ? { pending: 25, alternative_offered: 12, approved: 9, rejected: 4 }
            : {
                pending: detail.state === "pending" ? 1 : 0,
                alternative_offered: detail.state === "alternative_offered" ? 1 : 0,
                approved: detail.state === "approved" ? 1 : 0,
                rejected: detail.state === "rejected" ? 1 : 0,
              },
      });
    }
    if (op === "person_get_v1" && req.person_id === I.self)
      return send({
        id: I.self,
        display_name: "Sentetik Talep Üyesi",
        version: 1,
        relationships: [],
        discipline_relationships: [],
        member_summary: {
          as_of: detail.created_at,
          rights: {
            status: "available",
            available_credits: "9007199254740993",
            available_timed_packages: 1,
          },
          debt: { status: "restricted" },
          next_lesson: { status: "restricted" },
        },
      });
    if (op === "session_get_v1") return send(session);
    if (op === "calendar_get_v1")
      return send({
        as_of: detail.created_at,
        next_cursor: null,
        items: [
          {
            id: session.id,
            type: "session",
            center_id: I.center,
            starts_at: session.starts_at,
            ends_at: session.ends_at,
            title: "Sentetik özel ders",
          },
        ],
      });
    if (op === "reservation_list_v1")
      return send({
        as_of: detail.created_at,
        next_cursor: null,
        items: detail.reservation_id
          ? [
              {
                id: detail.reservation_id,
                session_id: session.id,
                person_id: I.self,
                version: 1,
                state: "active",
                mode: "flexible",
              },
            ]
          : [],
      });
    if (op === "entitlements_get_v1")
      return route.fulfill({
        status: 403,
        json: { ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: I.role } },
      });
    if (op === "lesson_request_approve_v1") {
      writes.push(req);
      expect(req.expected_version).toBe(detail.version);
      expect(req.lesson_request_id).toBe(detail.id);
      detail.state = "approved";
      detail.version++;
      detail.reservation_id = I.role;
      return send({ primary_id: detail.id, changed: [], jobs: [] });
    }
    if (op === "lesson_request_reject_v1" || op === "lesson_request_offer_alternative_v1") {
      writes.push(req);
      expect(req.expected_version).toBe(1);
      expect(req.lesson_request_id).toBe(requestId);
      if (!changedKeys.has(req.operation_key)) {
        changedKeys.add(req.operation_key);
        detail.version++;
        detail.state = op === "lesson_request_reject_v1" ? "rejected" : "alternative_offered";
        if (op === "lesson_request_offer_alternative_v1")
          detail.alternatives = [
            {
              id: I.role,
              request_id: requestId,
              version: 1,
              state: "offered",
              created_at: detail.created_at,
              ...req.alternatives[0].interval,
              instructor_id: req.alternatives[0].instructor_id ?? null,
            },
          ];
        if (mode === "unknown") return route.abort();
      }
      return send({ primary_id: requestId, changed: [], jobs: [] });
    }
    if (op === "operation_status_get_v1" && req.operation.startsWith("lesson_request_"))
      return send({
        operation: req.operation,
        key: req.key,
        status: "succeeded",
        result_reference: { type: "lesson_requests", id: requestId },
      });
    return route.fallback();
  });
  await page.goto(`${origin}/login`);
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("Fixture123");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/account`);
  await page.goto(`${origin}/o/${I.org}/c/${I.center}/requests`);
  await expect(
    page.getByRole("heading", { name: "Özel ders talepleri", exact: true }),
  ).toBeVisible();
  return { writes, reads, detail };
}
async function open(page: Page) {
  await page.getByRole("row", { name: /Sentetik Talep Üyesi/ }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("button", { name: "Reddet", exact: true })).toBeEnabled();
  return sheet;
}
test("native request list preserves exact credits and uses scoped status and summary", async ({
  page,
}) => {
  const state = await fixture(page);
  await expect(
    page.getByText("9007199254740993 kredi · 1 süreli paket", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("radio", { name: "Bekleyen", exact: true })).toBeEnabled();
  expect(
    state.reads.some(
      (row) =>
        JSON.stringify(row.selector) ===
        JSON.stringify({
          operation: "lesson_request_create_v1",
          key: { status: "pending", include_summary: true },
        }),
    ),
  ).toBe(true);
  await open(page);
  await expect(
    page.getByRole("dialog").getByText("Not bilgisi bu kaynakta paylaşılmıyor."),
  ).toBeVisible();
  expect(state.writes).toHaveLength(0);
});
test("request rejection requires reason then rereads native state", async ({ page }) => {
  const state = await fixture(page);
  const sheet = await open(page);
  await sheet.getByRole("button", { name: "Reddet", exact: true }).click();
  await sheet.getByRole("button", { name: "Reddi gönder", exact: true }).click();
  expect(state.writes).toHaveLength(0);
  await sheet.getByLabel("Ret gerekçesi", { exact: true }).fill("Saat uygun değil");
  await sheet.getByRole("button", { name: "Reddi gönder", exact: true }).click();
  await expect(
    sheet.getByText("İşlem kaydedildi ve güncel talep okundu.", { exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]?.reason).toBe("Saat uygun değil");
  await expect(sheet.getByText("Reddedilen", { exact: true })).toBeVisible();
});
test("unknown request outcome locks closing and recovers receipt without another writer", async ({
  page,
}) => {
  const state = await fixture(page, "unknown");
  const sheet = await open(page);
  await sheet.getByRole("button", { name: "Reddet", exact: true }).click();
  await sheet.getByLabel("Ret gerekçesi", { exact: true }).fill("Uygun değil");
  await sheet.getByRole("button", { name: "Reddi gönder", exact: true }).click();
  await expect(
    sheet.getByRole("button", { name: "Aynı işlemi tekrar dene", exact: true }),
  ).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Kapat", exact: true })).toBeDisabled();
  await sheet.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }).click();
  await expect(
    sheet.getByText("İşlem kaydedildi ve güncel talep okundu.", { exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
});
test("alternative submission uses center timezone and never approves automatically", async ({
  page,
}) => {
  const state = await fixture(page);
  const sheet = await open(page);
  await sheet.getByRole("button", { name: "Alternatif öner", exact: true }).click();
  expect(state.writes).toHaveLength(0);
  await sheet.getByLabel("Gün", { exact: true }).fill("2026-12-02");
  await sheet.getByLabel("Başlangıç", { exact: true }).fill("13:00");
  await sheet.getByRole("button", { name: "Alternatifi gönder", exact: true }).click();
  await expect(
    sheet.getByText("İşlem kaydedildi ve güncel talep okundu.", { exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]?.alternatives).toEqual([
    { interval: { starts_at: "2026-12-02T10:00:00Z", ends_at: "2026-12-02T11:00:00Z" } },
  ]);
  expect(state.detail.reservation_id).toBeNull();
  await sheet.getByRole("button", { name: "Güncel talebi oku", exact: true }).click();
  await expect(
    sheet.getByRole("heading", { name: "Sentetik Talep Üyesi özel ders talebi", exact: true }),
  ).toBeVisible();
  await expect(sheet.getByText("Alternatif önerildi", { exact: true })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Onayla", exact: true })).toBeDisabled();
  expect(state.writes).toHaveLength(1);
});
test("forbidden request directory stays unread instead of claiming empty success", async ({
  page,
}) => {
  await fixture(page, "denied");
  await expect(
    page.getByText("Talep veya işlem kaynağı okunamadı. Güncel yetkili kaynağı yeniden oku.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("Bu filtrede görünür talep yok.", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Listeyi yeniden oku", exact: true }),
  ).toBeEnabled();
});

for (const mode of ["existing", "create"] as const) {
  test(`request approval ${mode} requires review and confirms native reservation without inventing rights`, async ({
    page,
  }) => {
    const state = await fixture(page);
    const sheet = await open(page);
    await sheet.getByRole("button", { name: "Onayla", exact: true }).click();
    const submit = sheet.getByRole("button", {
      name: "Onayla ve rezervasyon oluştur",
      exact: true,
    });
    await expect(submit).toBeDisabled();
    expect(state.writes).toHaveLength(0);
    if (mode === "existing") {
      await sheet.getByLabel("Mevcut özel ders seansı", { exact: true }).selectOption(I.lesson);
    } else {
      await sheet.getByLabel("Onay yolu", { exact: true }).selectOption("create");
      await sheet.getByLabel("Salon", { exact: true }).selectOption(I.room);
      await sheet.getByLabel("Eğitmen", { exact: true }).selectOption(I.instructor);
      await sheet.getByLabel("Kontenjan", { exact: true }).fill("1");
    }
    await sheet
      .getByRole("checkbox", {
        name: "Seansı ve onay yolunu kontrol ettim. Kesin rezervasyon oluşturulmasını onaylıyorum.",
        exact: true,
      })
      .press("Space");
    await submit.click();
    await expect(
      sheet.getByText("İşlem kaydedildi ve güncel talep okundu.", { exact: true }),
    ).toBeVisible();
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0]).toMatchObject(
      mode === "existing"
        ? { session_id: I.lesson }
        : {
            session: {
              format: "private",
              discipline_id: I.discipline,
              capacity: { total: 1 },
              resources: [{ kind: "room", id: I.room }],
              assignments: [{ person_id: I.instructor, duty: "instructor" }],
            },
          },
    );
    await sheet.getByRole("button", { name: "Geri", exact: true }).click();
    await expect(
      sheet.getByText("Güncel rezervasyon ve seans okundu.", { exact: true }),
    ).toBeVisible();
    await expect(sheet.getByText("Bu ayrıntıyı görme yetkisi yok.", { exact: true })).toBeVisible();
  });
}

test("status change resets native cursor and keeps server counters independent of the visible row", async ({
  page,
}) => {
  const state = await fixture(page, "directory");
  await expect(page.getByText("25", { exact: true })).toBeVisible();
  await expect(page.getByText("12", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sonraki", exact: true }).click();
  await expect
    .poll(() => state.reads.some((r) => (r.page as { cursor?: string })?.cursor === "pending:next"))
    .toBe(true);
  await page.getByRole("radio", { name: "Sonuçlanan", exact: true }).click();
  await expect(page.getByRole("gridcell", { name: "Onaylanan", exact: true })).toBeVisible();
  const resolved = state.reads.filter(
    (r) => (r.selector as { key: { status?: string } }).key.status === "resolved",
  );
  expect(resolved.at(-1)).toMatchObject({
    selector: { key: { status: "resolved", include_summary: true } },
    page: { sort: "created_at_asc", limit: 20 },
  });
  expect(resolved.at(-1)!.page).not.toHaveProperty("cursor");
  await expect(page.getByText("25", { exact: true })).toBeVisible();
  await page.getByRole("radio", { name: "Alternatif önerildi", exact: true }).click();
  await expect(
    page.getByRole("gridcell", { name: "Alternatif önerildi", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Önceki", exact: true })).toBeDisabled();
  await page.getByRole("radio", { name: "Tümü", exact: true }).click();
  await expect
    .poll(() =>
      state.reads.some((r) => (r.selector as { key: { status?: string } }).key.status === "all"),
    )
    .toBe(true);
});
