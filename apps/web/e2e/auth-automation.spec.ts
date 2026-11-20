import { test, expect } from "./test.js";
import type { Page } from "@playwright/test";
import type {
  AutomationDefinition,
  AutomationJobView,
  SegmentDefinition,
} from "@ftksaas/api-contracts";
import { mockStudio, studioIds as I } from "./studio-fixture.js";
import { origin } from "./auth-fixture.js";
import { at, nativePage } from "./pro-completion-fixture.js";
const autoId = "019ab7b0-0000-7000-8000-000000000201",
  segmentId = "019ab7b0-0000-7000-8000-000000000202",
  jobId = "019ab7b0-0000-7000-8000-000000000203",
  createdId = "019ab7b0-0000-7000-8000-000000000204";
async function fixture(
  page: Page,
  mode: "normal" | "unknown" | "stale" | "segment" | "paged" | "older" | "starter" = "normal",
) {
  await mockStudio(page);
  const state = {
    version: 7,
    definition: {
      name: "Örnek takip",
      segment_id: null,
      trigger: { kind: "entitlement_expiring", offset_days: 3 },
      action: { kind: "create_followup", channel: "in_app", template_key: "Üyeyle görüş" },
      execution_center_ids: [I.center],
      enabled: true,
    } as AutomationDefinition,
    jobs: [
      {
        id: jobId,
        version: 12,
        center_id: I.center,
        person_id: I.self,
        state: "failed",
        attempts: 3,
        next_attempt_at: null,
        safe_error_code: "SERVICE_UNAVAILABLE",
        result_reference: null,
        retry_available: true,
      },
    ] as AutomationJobView[],
    writes: [] as Record<string, unknown>[],
    segment: undefined as { name: string; definition: SegmentDefinition } | undefined,
    created: false,
    reads: 0,
    discoveries: [] as Record<string, unknown>[],
    denied: false,
  };
  if (mode === "segment")
    state.segment = {
      name: "Hakkı azalanlar",
      definition: {
        all: [
          { field: "active_student", operator: "eq", value: true },
          { field: "remaining_credits", operator: "lte", value: 2 },
        ],
      },
    };
  const source = { scope: "center", key: "work-alert", version: 4, center_id: I.center },
    defaults = {
      trigger: { kind: "pending_request", offset_days: 0 },
      action: { kind: "send_reminder", channel: "in_app", template_key: "actual-alert-template" },
    };
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1),
      r = route.request().postDataJSON();
    const send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } });
    if (op === "settings_catalog_get_v1")
      return send({
        scope: "center",
        preparation_templates: {
          automations: [
            { source, template: { key: "work-alert", name: "Bekleyen ders uyarısı", defaults } },
          ],
        },
      });
    if (op === "settings_preparation_resolve_v1") {
      expect(r.source).toEqual(source);
      return send({ kind: "automation", source, defaults });
    }
    if (
      op === "management_state_get_v1" &&
      ["automation_save_v1", "segment_save_v1"].includes(r.operation)
    ) {
      expect(r.selector.key.scope).toEqual({ kind: "center", center_id: I.center });
      if (mode === "starter")
        return route.fulfill({
          status: 403,
          json: {
            ok: false,
            error: { code: "PLAN_FEATURE_UNAVAILABLE", retryable: false, trace_id: I.role },
          },
        });
      if (r.selector.key.discovery) {
        state.discoveries.push(r);
        if (state.denied)
          return route.fulfill({
            status: 403,
            json: { ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: I.role } },
          });
        if (r.selector.key.discovery === "matches")
          return send({
            items: [
              {
                operation: r.operation,
                entity: { type: "people", id: r.page.cursor ? I.instructor : I.self },
                exists: true,
                state: "active",
                versions: [],
                current: null,
                segment_match: {
                  person_id: r.page.cursor ? I.instructor : I.self,
                  display_name: r.page.cursor ? "İkinci örnek üye" : "Örnek eşleşen üye",
                },
              },
            ],
            segment_summary: { audience_count: 24, matched_count: 3, using_automations: 7 },
            next_cursor: r.page.cursor ? null : "segment-next",
            as_of: "2026-11-17T12:00:00Z",
          });
        if (r.selector.key.discovery === "automations")
          return send({
            items: [
              {
                operation: "automation_save_v1",
                entity: { type: "automations", id: autoId },
                exists: true,
                state: "active",
                versions: [{ entity: { type: "automations", id: autoId }, version: state.version }],
                current: null,
                automation_reference: {
                  id: autoId,
                  version: state.version,
                  name: state.definition.name,
                  enabled: state.definition.enabled,
                },
              },
            ],
            next_cursor: null,
            as_of: "2026-11-17T12:00:00Z",
          });
        const jobs = state.jobs.map((job) => ({
          ...job,
          created_at: "2026-11-16T12:00:00.123456Z",
          automation_id: autoId,
          automation_version: state.version,
          automation_name: state.definition.name,
          configuration_creator_person_id: I.self,
          initiator_kind: "automation",
        }));
        return send({
          items: jobs
            .filter((job) => r.selector.key.state === "all" || job.state === r.selector.key.state)
            .map((job) => ({
              operation: r.operation,
              exists: true,
              entity: { type: "outbox_jobs", id: job.id },
              state: job.state,
              versions: [{ entity: { type: "outbox_jobs", id: job.id }, version: job.version }],
              current: null,
              automation_job: job,
            })),
          next_cursor:
            mode === "paged" && !r.page.cursor && !r.selector.key.interval ? "queue-next" : null,
          as_of: "2026-11-17T12:00:00Z",
          automation_queue_summary: {
            total: 90,
            pending: 20,
            running: 10,
            retry_wait: 10,
            succeeded: 30,
            failed: 10,
            cancelled: 10,
            notifications_created: 7,
            followups_created: 8,
            email_delivery: "not_supported",
          },
        });
      }

      expect(r.page.limit).toBe(20);
      const automation = r.operation === "automation_save_v1",
        type = automation ? "automations" : "segments",
        target = automation ? (state.created ? createdId : autoId) : segmentId;
      if (automation && mode === "stale" && r.selector.key.automation_id && !state.writes.length)
        state.version = 8;
      if (automation) state.reads++;
      const rows =
        !automation && !state.segment
          ? []
          : [
              {
                operation: r.operation,
                exists: true,
                entity: { type, id: target },
                state: "active",
                versions: [
                  { entity: { type, id: target }, version: automation ? state.version : 4 },
                ],
                current: {
                  operation: r.operation,
                  values: automation
                    ? {
                        automation_id: target,
                        scope: r.selector.key.scope,
                        definition: state.definition,
                        recent_jobs: mode === "older" ? [] : state.jobs,
                      }
                    : {
                        segment_id: target,
                        scope: r.selector.key.scope,
                        name: state.segment!.name,
                        definition: state.segment!.definition,
                      },
                },
              },
            ];
      return send({ items: rows, next_cursor: null, as_of: "2026-11-16T12:00:00Z" });
    }
    if (op === "automation_save_v1" || op === "segment_save_v1") {
      state.writes.push(r);
      if (op === "automation_save_v1") {
        if (r.automation_id) expect(r.expected_version).toBe(state.version);
        if (r.retry_job) {
          expect(r.retry_job).toEqual({ id: jobId, version: 12 });
          expect(r.definition).toEqual(state.definition);
          state.jobs = [
            {
              ...state.jobs[0]!,
              version: 13,
              state: "pending",
              attempts: 0,
              retry_available: false,
            },
          ];
        } else {
          state.definition = r.definition;
          state.version++;
          if (!r.automation_id) state.created = true;
        }
      } else state.segment = { name: r.name, definition: r.definition };
      if (mode === "unknown") return route.abort("failed");
      return send({
        operation_id: I.role,
        primary_id: op === "segment_save_v1" ? segmentId : state.created ? createdId : autoId,
        version: op === "segment_save_v1" ? 4 : state.version,
        replayed: false,
        related: [],
      });
    }
    if (
      op === "operation_status_get_v1" &&
      ["automation_save_v1", "segment_save_v1"].includes(r.operation)
    )
      return send({
        operation: r.operation,
        key: r.key,
        status: "succeeded",
        result_available: true,
        result_reference: {
          type: r.operation === "segment_save_v1" ? "segments" : "automations",
          id: r.operation === "segment_save_v1" ? segmentId : state.created ? createdId : autoId,
        },
      });
    return route.fallback();
  });
  await page.goto(`${origin}/login`);
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("Fixture123");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/account`);
  await page.goto(`${origin}/o/${I.org}/c/${I.center}/automation`);
  await expect(page.getByRole("heading", { name: "Otomasyon", exact: true })).toBeVisible();
  if (mode !== "starter")
    await expect(page.getByRole("button", { name: "Örnek takip", exact: true })).toBeVisible();
  return state;
}
const saved = (page: Page) =>
  page.getByText("İşlem kaydedildi; güncel kayıt okundu.", { exact: true });
const review = "Tanımı ve etkilerini inceledim, kaydetmeyi onaylıyorum.";
test("Starter keeps automation and segment creation disabled after native plan denial", async ({
  page,
}) => {
  const state = await fixture(page, "starter");
  await expect(page.getByRole("button", { name: "Otomasyon ekle", exact: true })).toBeDisabled();
  await page.getByRole("tab", { name: "Segmentler", exact: true }).click();
  await expect(page.getByRole("button", { name: "Segment ekle", exact: true })).toBeDisabled();
  expect(state.writes).toHaveLength(0);
});
test("automation native directory omits unsupported worker actions and reads the scope queue by default", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 950 });
  const state = await fixture(page);
  await expect(page.getByRole("button", { name: "Elle çalıştır", exact: true })).toHaveCount(0);
  await page.getByRole("tab", { name: "Son işler", exact: true }).click();
  await expect(page.getByRole("grid", { name: "Son işler", exact: true })).toContainText(
    "Başarısız",
  );
  expect(state.discoveries.at(-1)).toMatchObject({
    selector: {
      key: { scope: { kind: "center", center_id: I.center }, discovery: "jobs", state: "all" },
    },
  });
  expect((state.discoveries.at(-1)!.selector as { key: object }).key).not.toHaveProperty(
    "automation_id",
  );
  await page.getByLabel("Son işleri gösterilecek otomasyon", { exact: true }).selectOption(autoId);
  await expect(page.getByRole("grid", { name: "Son işler", exact: true })).toContainText(
    "Başarısız",
  );
  await expect(page.getByRole("grid", { name: "Son işler", exact: true })).toContainText(
    "Uygulanmaz",
  );
  expect(state.writes).toHaveLength(0);
});
test("automation creates an explicitly reviewed low-credit segment without invented match totals", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.getByRole("tab", { name: "Segmentler", exact: true }).click();
  await page.getByRole("button", { name: "Segment ekle", exact: true }).click();
  const d = page.getByRole("dialog");
  await expect(d.getByText("Ad gerekli.", { exact: true })).toHaveCount(0);
  await d.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(d.getByLabel("Segment adı", { exact: true })).toBeFocused();
  await expect(d.getByText("Ad gerekli.", { exact: true })).toBeVisible();
  await d.getByLabel("Segment adı", { exact: true }).fill("Az hak");
  await d.getByLabel("Koşul ekle", { exact: true }).selectOption("remaining");
  await d.getByLabel("Kalan hak", { exact: true }).fill("2");
  await d.getByRole("checkbox", { name: review, exact: true }).press("Space");
  await d.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(saved(page)).toBeVisible();
  expect(state.segment!.definition).toEqual({
    all: [
      { field: "active_student", operator: "eq", value: true },
      { field: "remaining_credits", operator: "lte", value: 2 },
    ],
  });
  await d.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await expect(page.getByRole("grid", { name: "Segmentler", exact: true })).toContainText("Az hak");
});
test("automation saves a native member followup with explicit threshold and leaves it disabled", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.getByRole("button", { name: "Otomasyon ekle", exact: true }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Otomasyon adı", { exact: true }).fill("Yeni takip");
  await d.getByLabel("Segment", { exact: true }).selectOption("__none__");
  await d.getByLabel("Ne zaman", { exact: true }).selectOption("entitlement_expiring");
  await d.getByLabel("Gün eşiği", { exact: true }).fill("3");
  await d.getByLabel("Ne yapar", { exact: true }).selectOption("followup");
  await d.getByLabel("Görev metni", { exact: true }).fill("Üyeyle görüş");
  await d.getByRole("checkbox", { name: review, exact: true }).press("Space");
  await d.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(saved(page)).toBeVisible();
  expect(state.definition).toMatchObject({
    name: "Yeni takip",
    enabled: false,
    trigger: { kind: "entitlement_expiring", offset_days: 3 },
    action: { kind: "create_followup", channel: "in_app", template_key: "Üyeyle görüş" },
  });
  expect(state.writes[0]).not.toHaveProperty("expected_version");
  await expect(d.getByRole("button", { name: "Vazgeç", exact: true })).toBeEnabled();
});
test("automation reviewed disable preserves definition and uses the actual version", async ({
  page,
}) => {
  const state = await fixture(page);
  const original = structuredClone(state.definition);
  await page
    .getByRole("switch", { name: "Örnek takip otomasyonunu aç veya kapat", exact: true })
    .press("Space");
  const d = page.getByRole("alertdialog");
  expect(state.writes).toHaveLength(0);
  await d.getByRole("checkbox").press("Space");
  await d.getByRole("button", { name: "Otomasyonu kapat", exact: true }).click();
  await expect(saved(page)).toBeVisible();
  expect(state.writes[0]).toMatchObject({
    expected_version: 7,
    definition: { ...original, enabled: false },
  });
});
test("automation unknown write recovers via the exact receipt without another effect", async ({
  page,
}) => {
  const state = await fixture(page, "unknown");
  await page
    .getByRole("switch", { name: "Örnek takip otomasyonunu aç veya kapat", exact: true })
    .press("Space");
  const d = page.getByRole("alertdialog");
  await d.getByRole("checkbox").press("Space");
  await d.getByRole("button", { name: "Otomasyonu kapat", exact: true }).click();
  await page.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }).click();
  await expect(saved(page)).toBeVisible();
  expect(state.writes).toHaveLength(1);
});
test("automation stale preflight rejects the reviewed toggle without writing", async ({ page }) => {
  const state = await fixture(page, "stale");
  await page
    .getByRole("switch", { name: "Örnek takip otomasyonunu aç veya kapat", exact: true })
    .press("Space");
  const d = page.getByRole("alertdialog");
  await d.getByRole("checkbox").press("Space");
  await d.getByRole("button", { name: "Otomasyonu kapat", exact: true }).click();
  await expect(d.getByRole("alert")).toBeVisible();
  expect(state.writes).toHaveLength(0);
});
test("automation retry advances only the failed job and keeps the automation version", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.getByRole("tab", { name: "Son işler", exact: true }).click();
  await page.getByLabel("Son işleri gösterilecek otomasyon", { exact: true }).selectOption(autoId);
  await page.getByRole("button", { name: "Yeniden dene", exact: true }).click();
  const d = page.getByRole("alertdialog");
  await d.getByRole("checkbox").press("Space");
  await d.getByRole("button", { name: "Yeniden dene", exact: true }).click();
  await expect(saved(page)).toBeVisible();
  expect(state.version).toBe(7);
  expect(state.jobs[0]).toMatchObject({ version: 13, state: "pending" });
  expect(state.writes[0]).toMatchObject({
    expected_version: 7,
    retry_job: { id: jobId, version: 12 },
  });
  await d.getByRole("button", { name: "Vazgeç", exact: true }).click();
  const grid = page.getByRole("grid", { name: "Son işler", exact: true });
  await expect(grid).toContainText("Bekliyor");
  await expect(grid.getByText("Takip oluşturuldu", { exact: true })).toHaveCount(0);
  const resultId = "019ab7b0-0000-7000-8000-000000000205";
  state.jobs[0] = {
    ...state.jobs[0]!,
    version: 14,
    state: "succeeded",
    attempts: 1,
    safe_error_code: null,
    result_reference: { type: "crm_activities", id: resultId },
  };
  for (let read = 0; read < 2; read++) {
    await page.getByRole("button", { name: "Güncel işleri oku", exact: true }).click();
    await expect(grid.getByText(resultId, { exact: true })).toHaveCount(1);
  }
  await expect(grid.getByRole("row").filter({ hasText: resultId })).toContainText(
    "Takip oluşturuldu",
  );
  expect(state.jobs[0]!.id).toBe(jobId);
  expect(state.writes).toHaveLength(1);

  const reportEndpoint = "**/functions/v1/backend-v1/report_get_v1";
  await page.route(reportEndpoint, (route) => {
    const { report, filters } = route.request().postDataJSON();
    return route.fulfill({
      json: {
        ok: true,
        data: { report_kind: report, filters, rows: nativePage([]), totals: [], as_of: at },
        trace_id: I.role,
      },
    });
  });
  const reportsLink = page.getByRole("link", { name: "Merkez raporları", exact: true });
  await expect(reportsLink).toHaveAttribute("href", "/reports");
  const reportRequest = page.waitForRequest(reportEndpoint);
  await reportsLink.press("Enter");
  await expect(page).toHaveURL(`${origin}/reports`);
  await expect(page.getByRole("tab", { name: "Özet", exact: true })).toBeVisible();
  expect((await reportRequest).postDataJSON()).toMatchObject({
    org_id: I.org,
    center_id: I.center,
    filters: { center_ids: [I.center] },
  });
});
test("automation notification preparation uses the actual template and explicit self recipient", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.getByRole("button", { name: "Otomasyon ekle", exact: true }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Otomasyon adı", { exact: true }).fill("İş uyarısı");
  await d.getByLabel("Segment", { exact: true }).selectOption("__none__");
  await d.getByLabel("Hazırlık şablonu", { exact: true }).selectOption("center:work-alert");
  await expect(d.getByLabel("Gün eşiği", { exact: true })).toBeDisabled();
  await d.getByRole("checkbox", { name: "Bana uyarı gönder", exact: true }).press("Space");
  await d.getByRole("checkbox", { name: review, exact: true }).press("Space");
  await d.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(saved(page)).toBeVisible();
  expect(state.definition).toMatchObject({
    segment_id: null,
    enabled: false,
    trigger: { kind: "pending_request", recipient_person_ids: [I.self] },
    action: { kind: "send_reminder", channel: "in_app", template_key: "actual-alert-template" },
  });
});

test("automation segment insights read saved matches and usage on demand with authoritative totals and cursors", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 950 });
  const state = await fixture(page, "segment");
  expect(state.discoveries).toHaveLength(0);
  await page.getByRole("tab", { name: "Segmentler", exact: true }).click();
  await page.getByRole("button", { name: "Eşleşmeleri göster", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Örnek eşleşen üye");
  await expect(dialog).toContainText("Hedef kitle");
  await expect(dialog.getByText("24", { exact: true })).toBeVisible();
  await expect(dialog.getByText("3", { exact: true })).toBeVisible();
  expect(state.discoveries[0]).toMatchObject({
    selector: {
      operation: "segment_save_v1",
      key: { segment_id: segmentId, discovery: "matches", execution_center_id: I.center },
    },
    page: { limit: 20, sort: "created_at_asc" },
  });
  await dialog.getByRole("button", { name: "Sonraki", exact: true }).click();
  await expect(dialog).toContainText("İkinci örnek üye");
  expect(state.discoveries.at(-1)).toMatchObject({ page: { cursor: "segment-next" } });
  await dialog.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await page.getByRole("button", { name: "Kullanan otomasyonlar", exact: true }).click();
  await expect(dialog).toContainText("Örnek takip");
  expect(state.discoveries.at(-1)).toMatchObject({
    selector: { key: { discovery: "automations", segment_id: segmentId } },
  });
  expect(state.writes).toHaveLength(0);
});
test("automation queue keeps native summary and resets cursor on state filter instead of aggregating a page", async ({
  page,
}) => {
  const state = await fixture(page, "paged");
  await page.getByRole("tab", { name: "Son işler", exact: true }).click();
  await expect(page.getByText("90", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sonraki", exact: true }).click();
  await expect.poll(() => state.discoveries.at(-1)?.page).toMatchObject({ cursor: "queue-next" });
  await page.getByLabel("İş durumu", { exact: true }).selectOption("succeeded");
  await expect
    .poll(() => (state.discoveries.at(-1)?.selector as { key: { state: string } })?.key.state)
    .toBe("succeeded");
  expect(state.discoveries.at(-1)).toMatchObject({ page: { limit: 20, sort: "created_at_desc" } });
  expect(state.discoveries.at(-1)!.page).not.toHaveProperty("cursor");
  await expect(page.getByRole("grid", { name: "Son işler", exact: true })).toContainText(
    "Bu kapsamda görünür kayıt yok.",
  );
  await expect(page.getByText("90", { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(0);
});
test("automation denied insight hides cached members and retries only the read", async ({
  page,
}) => {
  const state = await fixture(page, "segment");
  await page.getByRole("tab", { name: "Segmentler", exact: true }).click();
  await page.getByRole("button", { name: "Eşleşmeleri göster", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Örnek eşleşen üye");
  state.denied = true;
  await dialog.getByRole("button", { name: "Sonraki", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Otomasyon kaynağı okunamadı.");
  await expect(dialog.getByText("Örnek eşleşen üye", { exact: true })).toHaveCount(0);
  state.denied = false;
  await dialog.getByRole("button", { name: "Yeniden dene", exact: true }).click();
  await expect(dialog).toContainText("Örnek eşleşen üye");
  expect(state.writes).toHaveLength(0);
});

test("automation retries an older discovered job outside recent twenty with exact microsecond reads", async ({
  page,
}) => {
  const state = await fixture(page, "older");
  await page.getByRole("tab", { name: "Son işler", exact: true }).click();
  await page.getByRole("button", { name: "Yeniden dene", exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByRole("checkbox").press("Space");
  await dialog.getByRole("button", { name: "Yeniden dene", exact: true }).click();
  await expect(saved(page)).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]).toMatchObject({
    expected_version: 7,
    retry_job: { id: jobId, version: 12 },
  });
  const reads = state.discoveries.filter(
    (r) => (r.selector as { key: { interval?: unknown } }).key.interval,
  );
  expect(reads).toHaveLength(2);
  for (const read of reads)
    expect(read).toMatchObject({
      selector: {
        operation: "automation_save_v1",
        key: {
          automation_id: autoId,
          state: "all",
          interval: {
            starts_at: "2026-11-16T12:00:00.123456Z",
            ends_at: "2026-11-16T12:00:00.123457Z",
          },
        },
      },
    });
});
