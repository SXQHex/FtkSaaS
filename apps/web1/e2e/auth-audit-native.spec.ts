import { test, expect } from "./test.js";
import { mockCompletion, completionUrl, nativePage, uid, at } from "./pro-completion-fixture.js";
import { studioIds as I } from "./studio-fixture.js";
const record = {
  id: uid(1),
  action: "person_update_v1",
  subject: { type: "people", id: I.instructor },
  actor_display: "Sentetik yönetici",
  created_at: at,
  reason: "Sentetik gerekçe",
  diff: {
    changes: [
      {
        field: "display_name",
        old_value: "Eski sentetik ad",
        new_value: "<script>sentetik</script>",
      },
    ],
  },
  module: "M03",
  result: "recorded",
  operation_id: null,
  subject_title: "Sentetik kişi",
  operation_state: null,
};
const tracking = {
  kind: "job",
  id: uid(2),
  created_at: at,
  operation: "report_build_v1",
  state: "retry_wait",
  expires_at: null,
  progress_count: 3,
  total_count: null,
  safe_error_code: "TEMPORARY_FAILURE",
  next_attempt_at: "2026-11-18T12:00:00Z",
  result_reference: null,
};
const summary = {
  total: 19,
  previews: 6,
  operations: 8,
  jobs: 5,
  attention: 7,
  running: 2,
  retry: 3,
  completed: 8,
};
test("audit uses native module/search/cursor and escaped source detail, with keyboard access", async ({
  page,
}) => {
  const f = await mockCompletion(page, async ({ op, r, send }) => {
    if (op === "audit_list_v1")
      await send(
        nativePage(
          [
            {
              ...record,
              id: r.page.cursor ? uid(3) : record.id,
              subject_title: r.page.cursor ? "İkinci sentetik kişi" : record.subject_title,
            },
          ],
          r.page.cursor ? null : "audit-next",
        ),
      );
  });
  await page.goto(completionUrl("audit"));
  const row = page.getByRole("row").filter({ hasText: "Sentetik kişi" });
  await expect(row).toBeVisible();
  await page.getByRole("button", { name: "person_update_v1", exact: true }).focus();
  await page.keyboard.press("Enter");
  const detail = page.getByRole("dialog");
  await expect(detail).toContainText("<script>sentetik</script>");
  await expect(detail).toContainText("Kişiler ve üyelik ilişkileri");
  await expect(detail.locator("script")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.getByRole("combobox", { name: "Modül", exact: true }).selectOption({
    label: "Kişiler ve üyelik ilişkileri",
  });
  await page.getByRole("textbox", { name: "Denetim kaydında ara", exact: true }).fill("Sentetik");
  await expect
    .poll(() => f.requests.filter((row) => row.op === "audit_list_v1").at(-1)?.r.query)
    .toBe("Sentetik");
  await page.getByRole("button", { name: "Sonraki sayfa", exact: true }).click();
  await expect(page.getByText("İkinci sentetik kişi", { exact: true })).toBeVisible();
  const last = f.requests.filter((row) => row.op === "audit_list_v1").at(-1)!.r;
  expect(last).toMatchObject({ module: "M03", query: "Sentetik", page: { cursor: "audit-next" } });
  expect(last).not.toHaveProperty("subject");
  await expect(page.getByRole("button", { name: "Kaydı dışa aktar", exact: true })).toHaveCount(0);
});
test("tracking preserves native global counters, nullable denominator, filters and read-only refresh on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.emulateMedia({ colorScheme: "dark" });
  const f = await mockCompletion(page, async ({ op, r, send }) => {
    if (op === "audit_list_v1") await send(nativePage([]));
    if (op === "tracking_directory_get_v1")
      await send({
        items: r.page.cursor
          ? [
              {
                ...tracking,
                id: uid(4),
                state: "running",
                progress_count: 3,
                total_count: 9,
                safe_error_code: null,
                next_attempt_at: null,
              },
            ]
          : [tracking],
        summary,
        as_of: at,
        next_cursor: r.page.cursor ? null : "tracking-next",
      });
  });
  await page.goto(completionUrl("audit"));
  await page.getByRole("radio", { name: "Tümü", exact: true }).click();
  await page.getByRole("tab", { name: /^İşlemler/ }).click();
  await expect(page.getByText("report_build_v1", { exact: true })).toBeVisible();
  await expect(page.getByText("3", { exact: true })).toBeVisible();
  await expect(page.getByRole("listitem")).toContainText("Yeniden deneme bekliyor");
  await expect(page.getByRole("listitem")).toContainText("3 kayıt işlendi");
  await expect(page.getByRole("listitem")).toContainText("Sonraki deneme");
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await page.getByRole("button", { name: "Sonraki sayfa", exact: true }).click();
  await expect(page.getByRole("listitem")).toContainText("Çalışıyor");
  await expect(page.getByRole("listitem")).toContainText("9 kaydın 3 tanesi işlendi");
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "3");
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "9");
  await page.getByRole("button", { name: "Önceki sayfa", exact: true }).click();
  await page.getByRole("combobox", { name: "Kayıt türü", exact: true }).selectOption("job");
  await page
    .getByRole("textbox", { name: "Durum kodu (isteğe bağlı)", exact: true })
    .fill("retry_wait");
  await expect
    .poll(() => f.requests.filter((row) => row.op === "tracking_directory_get_v1").at(-1)?.r.state)
    .toBe("retry_wait");
  await page.getByRole("button", { name: "Durumu güncelle", exact: true }).click();
  await expect(page.getByRole("listitem")).toContainText("Yeniden deneme bekliyor");
  expect(f.requests.filter((row) => !/(_get_v1|_list_v1)$/.test(row.op))).toEqual([]);
  const native = f.requests.filter((row) => row.op === "tracking_directory_get_v1").at(-1)!.r;
  expect(native).toMatchObject({ kind: "job", state: "retry_wait" });
  expect(native).not.toHaveProperty("interval");
});
test("denied audit source does not become an empty successful table or reveal cached detail", async ({
  page,
}) => {
  await mockCompletion(page, async ({ op, fail }) => {
    if (op === "audit_list_v1") await fail("FORBIDDEN");
  });
  await page.goto(completionUrl("audit"));
  await expect(
    page
      .locator('[data-slot="alert-description"]')
      .filter({ hasText: "Bu kapsamın kayıtları henüz okunamadı." }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "person_update_v1" })).toHaveCount(0);
});
