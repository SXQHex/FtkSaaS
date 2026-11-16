import { test, expect } from "./test.js";
import type { Page } from "@playwright/test";
import type {
  AutomationDefinition,
  AutomationJobView,
  SegmentDefinition,
} from "../src/lib/api-contracts/generated.js";
import { mockStudio, studioIds as I } from "./studio-fixture.js";
import { origin } from "./auth-fixture.js";
const autoId = "019ab7b0-0000-7000-8000-000000000201",
  segmentId = "019ab7b0-0000-7000-8000-000000000202",
  jobId = "019ab7b0-0000-7000-8000-000000000203",
  createdId = "019ab7b0-0000-7000-8000-000000000204";
async function fixture(page: Page, mode: "normal" | "unknown" | "stale" = "normal") {
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
                        recent_jobs: state.jobs,
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
  await expect(page.getByRole("button", { name: "Örnek takip", exact: true })).toBeVisible();
  return state;
}
const saved = (page: Page) =>
  page.getByText("İşlem kaydedildi; güncel kayıt okundu.", { exact: true });
const review = "Tanımı ve etkilerini inceledim, kaydetmeyi onaylıyorum.";
test("automation native directory keeps unavailable worker actions disabled and jobs scoped to an explicit selection", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 950 });
  const state = await fixture(page);
  await expect(page.getByRole("button", { name: "Elle çalıştır", exact: true })).toBeDisabled();
  await page.getByRole("tab", { name: "Son işler", exact: true }).click();
  await expect(
    page.getByText("Son işleri görmek için bir otomasyon seç.", { exact: true }),
  ).toBeVisible();
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
