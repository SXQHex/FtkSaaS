import {
  clickWorkspaceLink,
  closeWorkspaceNavigation,
  openWorkspaceNavigation,
  openWorkspaceSearch,
} from "./auth-fixture.js";
import { test, expect } from "./test.js";
import { mockReports } from "./reports-native-fixture.js";
import { requestsFor } from "./pro-completion-fixture.js";
import { studioIds as I } from "./studio-fixture.js";
async function exportForm(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Dışa aktar", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox", { name: "Rapor", exact: true }).selectOption("summary");
  await dialog
    .getByRole("checkbox", {
      name: "Kapsamı ve dışa aktarılacak bilgileri inceledim.",
      exact: true,
    })
    .press("Space");
  return dialog;
}
async function importForm(page: import("@playwright/test").Page) {
  await page.getByRole("tab", { name: "Dosyalar", exact: true }).click();
  await page.getByRole("button", { name: "CSV içe aktar", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "Aktarım türü", exact: true })
    .selectOption("crm_applications");
  await dialog
    .getByRole("textbox", { name: "Kaynak kayıt kümesi", exact: true })
    .fill("e2e-source");
  await dialog.getByLabel("CSV dosyası", { exact: true }).setInputFiles({
    name: "synthetic.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "source_key,display_name,phone,email\r\nsynthetic-1,Birinci sentetik,+905550000001,\r\nsynthetic-2,İkinci sentetik,+905550000002,\r\nsynthetic-3,Hatalı sentetik,bad,\r\n",
    ),
  });
  await dialog.getByRole("button", { name: "Önizle", exact: true }).click();
  return dialog;
}
test("command palette reuses the report and import review forms without starting jobs", async ({
  page,
}) => {
  const f = await mockReports(page);
  const input = page.getByPlaceholder("Sayfa adı ara…");
  await openWorkspaceSearch(page);
  await input.fill("Raporu dışa aktar");
  await page.getByRole("menuitem", { name: "Raporu dışa aktar", exact: true }).click();
  const report = page.getByRole("dialog");
  await expect(report.getByRole("combobox", { name: "Rapor", exact: true })).toBeVisible();
  await report.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await openWorkspaceSearch(page);
  await input.fill("Üyeleri içe aktar");
  await page.getByRole("menuitem", { name: "Üyeleri içe aktar", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByRole("combobox", { name: "Aktarım türü" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tab", { name: "Dosyalar", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const initialDocument = await page.evaluate(() => performance.timeOrigin);
  await clickWorkspaceLink(page, "Üyeler");
  const memberImport = page.getByRole("button", { name: "İçe aktar", exact: true });
  await expect(memberImport).toBeEnabled();
  await memberImport.press("Enter");
  await expect(page).toHaveURL((url) => url.pathname === "/reports" && !url.search);
  await expect(
    page.getByRole("dialog").getByRole("combobox", { name: "Aktarım türü" }),
  ).toHaveValue("students");
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(initialDocument);
  expect(f.writes).toEqual([]);
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page).toHaveURL((url) => url.pathname === "/reports" && !url.search);
  await expect(page.getByRole("tab", { name: "Özet", exact: true })).toBeVisible();
  const navigation = await openWorkspaceNavigation(page);
  const reportsLink = navigation.getByRole("link", { name: "Raporlar", exact: true });
  await expect(reportsLink).toHaveAttribute("aria-current", "page");
  await closeWorkspaceNavigation(page);
  await page.goto("/reports");
  await expect(page).toHaveURL((url) => url.pathname === "/reports");
  await expect(page.getByRole("tab", { name: "Özet", exact: true })).toBeVisible();
});

test("reports bind all real sections, immutable product names, exact currencies and explicit custom dates", async ({
  page,
}) => {
  const f = await mockReports(page);
  await expect(page.getByText(/90\.071\.992\.547\.409,93/).first()).toBeVisible();
  await expect(page.getByText("Değişmez paket adı · TRY", { exact: true })).toBeVisible();
  await expect(page.getByText("Native ders", { exact: true }).first()).toBeVisible();
  await page.getByRole("radio", { name: "Özel aralık", exact: true }).click();
  await page.getByLabel("Başlangıç", { exact: true }).fill("2026-11-01");
  await page.getByLabel("Bitiş", { exact: true }).fill("2026-11-16");
  await expect
    .poll(() => f.requests.filter((row) => row.op === "report_get_v1").at(-1)?.r.filters.interval)
    .toEqual({ starts_at: "2026-10-31T21:00:00Z", ends_at: "2026-11-16T21:00:00Z" });
  await page.getByRole("tab", { name: "Tahsilat ve borç", exact: true }).click();
  await expect(page.getByText("Sentetik tahsilat kişisi", { exact: true })).toBeVisible();
  await expect(page.getByText("TRY ₺30,00", { exact: true })).toBeVisible();
  await expect(page.getByText("TRY ₺20,00", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Eğitmen ve adaylar", exact: true }).click();
  await expect(page.getByText("Native eğitmen · Hakediş", { exact: true })).toBeVisible();
  const funnel = page.locator("dl").filter({ hasText: "Dönüşen aday" });
  await expect(funnel.getByText("2", { exact: true })).toBeVisible();
  await expect(funnel.getByText("5", { exact: true })).toBeVisible();
  await expect(funnel.getByText("%40", { exact: true })).toBeVisible();
  const stages = page.getByRole("region", { name: "Ulaşılan aşamalar", exact: true });
  await expect(stages.getByRole("row").filter({ hasText: "review" })).toContainText("3");
  const sources = page.getByRole("region", { name: "Aday kaynakları", exact: true });
  await expect(
    sources.getByRole("row").filter({ hasText: "Referans" }).getByRole("gridcell"),
  ).toHaveText(["3", "2"]);
  await page.setViewportSize({ width: 320, height: 840 });
  await sources.focus();
  await expect(sources).toBeFocused();
  expect(await page.evaluate("document.documentElement.scrollWidth > innerWidth")).toBe(false);
  expect(
    requestsFor(f.requests, "report_get_v1").find((row) => row.r.report === "crm_conversion")?.r,
  ).toMatchObject({
    include_crm_funnel: true,
    filters: { interval: { starts_at: "2026-10-31T21:00:00Z", ends_at: "2026-11-16T21:00:00Z" } },
  });
  expect(
    f.requests
      .filter((row) => row.op === "report_get_v1")
      .every((row) => row.r.center_id === I.center && row.r.filters.center_ids.length === 1),
  ).toBe(true);
  expect(f.requests.some((row) => row.op === "finance_directory_get_v1")).toBe(true);
});
test("export unknown result replays the frozen key, survives summary refresh and uses a private CSV download", async ({
  page,
}) => {
  const f = await mockReports(page, { unknownExport: true });
  await expect(page.getByText(/90\.071\.992\.547\.409,93/).first()).toBeVisible();
  const dialog = await exportForm(page);
  await dialog.getByRole("button", { name: "Dışa aktarmayı başlat", exact: true }).click();
  await dialog.getByRole("button", { name: "Aynı isteği yeniden dene", exact: true }).click();
  await expect
    .poll(() => f.writes.filter((row) => row.op === "report_export_start_v1").length)
    .toBe(2);
  const writes = requestsFor(f.writes, "report_export_start_v1");
  const exportFilters = writes[0]?.r.filters;
  if (!exportFilters) throw Error("EXPORT_FILTERS_UNAVAILABLE");
  expect(writes[0]!.r.operation_key).toBe(writes[1]!.r.operation_key);
  expect(writes[0]!.r.filters).toEqual(writes[1]!.r.filters);
  await expect(
    dialog.getByRole("button", { name: "Dışa aktarmayı başlat", exact: true }),
  ).toBeDisabled();
  await dialog.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await page.getByRole("tab", { name: "Dosyalar", exact: true }).click();
  const waiting = page.waitForEvent("download");
  await page.getByRole("button", { name: "İndir", exact: true }).click();
  const download = await waiting;
  expect(download.suggestedFilename()).toMatch(/^report-.*\.csv$/);
  expect(await download.failure()).toBeNull();
  const stream = await download.createReadStream();
  let csv = "";
  for await (const chunk of stream) csv += chunk.toString("utf8");
  const lines = csv.trimEnd().split("\r\n");
  expect(lines).toHaveLength(3);
  expect(lines[0]).toBe(
    "group_key,display_name,product_name,period_start,currency,count,amount_minor",
  );
  expect(lines[1]).toBe('"gross_sales:2026-11-09","","","2026-11-09","TRY","2","9007199254740993"');
  expect(lines[2]).toBe('"gross_sales:2026-11-09","","","2026-11-09","EUR","1","1200"');
  expect(
    f.requests.some(
      (row) =>
        row.op === "report_get_v1" &&
        row.r.report === "sales" &&
        JSON.stringify(row.r.filters.interval) === JSON.stringify(exportFilters.interval) &&
        JSON.stringify(row.r.filters.center_ids) === JSON.stringify(exportFilters.center_ids),
    ),
  ).toBe(true);
  expect(
    f.requests
      .filter((row) => row.op === "report_file_get_v1")
      .every((row) => typeof row.r.operation_key === "string"),
  ).toBe(true);
});
test("export ACK with failed readback never redispatches the accepted writer", async ({ page }) => {
  const f = await mockReports(page, { ackUnread: true });
  const dialog = await exportForm(page);
  await dialog.getByRole("button", { name: "Dışa aktarmayı başlat", exact: true }).click();
  await dialog.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "Dışa aktarmayı başlat", exact: true }),
  ).toBeDisabled();
  expect(f.writes.filter((row) => row.op === "report_export_start_v1")).toHaveLength(1);
});
test("file list rereads the same CSV job while its server retry is pending", async ({ page }) => {
  const f = await mockReports(page);
  f.setExportState("retry_wait");
  const dialog = await exportForm(page);
  await dialog.getByRole("button", { name: "Dışa aktarmayı başlat", exact: true }).click();
  await expect(dialog.getByText("İşlem kaydedildi; güncel kayıt okundu.")).toBeVisible();
  await dialog.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await page.getByRole("tab", { name: "Dosyalar", exact: true }).click();
  const files = page.getByRole("tabpanel", { name: "Dosyalar", exact: true });
  await expect(files.getByText("Yeniden denemeyi bekliyor", { exact: true })).toBeVisible();
  await expect(files.getByText(/Sonraki sunucu denemesi/)).toBeVisible();
  await expect(files.getByRole("button", { name: "İndir", exact: true })).toHaveCount(0);
  await expect(files.getByRole("button", { name: "Yeniden başlat", exact: true })).toHaveCount(0);
  const readCount = f.requests.filter((row) => row.op === "job_status_get_v1").length;
  f.setExportState("succeeded");
  await files.getByRole("button", { name: "İş durumunu oku", exact: true }).click();
  await expect(files.getByRole("button", { name: "İndir", exact: true })).toBeEnabled();
  await expect(
    page.getByRole("status").filter({ hasText: "Dışa aktarma durumu: Tamamlandı" }),
  ).toBeVisible();
  const jobReads = f.requests.filter((row) => row.op === "job_status_get_v1");
  expect(jobReads).toHaveLength(readCount + 1);
  expect(jobReads.at(-1)!.r).toMatchObject({
    job_id: f.exportId,
    org_id: I.org,
    center_id: I.center,
  });
  expect(f.writes.filter((row) => row.op === "report_export_start_v1")).toHaveLength(1);
});
test("failed CSV requires confirmation and starts one new job with the original scope", async ({
  page,
}) => {
  const f = await mockReports(page);
  f.setExportState("failed");
  const original = await exportForm(page);
  await original.getByRole("button", { name: "Dışa aktarmayı başlat", exact: true }).click();
  await expect(original.getByText("İşlem kaydedildi; güncel kayıt okundu.")).toBeVisible();
  await original.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await page.getByRole("tab", { name: "Dosyalar", exact: true }).click();
  const files = page.getByRole("tabpanel", { name: "Dosyalar", exact: true });
  await files.getByRole("button", { name: "Yeniden başlat", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Başarısız dışa aktarımı yeniden başlat" });
  const confirm = dialog.getByRole("button", { name: "Yeniden başlat", exact: true });
  await expect(confirm).toBeDisabled();
  await expect(dialog.getByRole("combobox")).toHaveCount(0);
  await dialog.getByRole("checkbox").press("Space");
  await confirm.click();
  await expect(dialog.getByText("İşlem kaydedildi; güncel kayıt okundu.")).toBeVisible();
  await expect(confirm).toBeDisabled();
  const writes = f.writes.filter((row) => row.op === "report_export_start_v1");
  expect(writes).toHaveLength(2);
  expect(writes[1]!.r).toEqual({
    client_api_version: 1,
    request_id: expect.any(String),
    operation_key: expect.any(String),
    org_id: I.org,
    center_id: I.center,
    retry_job_id: f.exportId,
  });
  expect(
    f.requests.some((row) => row.op === "job_status_get_v1" && row.r.job_id === f.retryId),
  ).toBe(true);
});
test("CRM import explicitly selects an off-page row and keeps same-job apply pending until native worker completion on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.emulateMedia({ colorScheme: "dark" });
  const f = await mockReports(page);
  const dialog = await importForm(page);
  await expect(dialog.getByText("Birinci sentetik", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Sonraki sayfa", exact: true }).click();
  await expect(dialog.getByText("İkinci sentetik", { exact: true })).toBeVisible();
  await dialog.getByRole("checkbox", { name: "Satır 2", exact: true }).press("Space");
  await dialog
    .getByRole("checkbox", {
      name: "Seçili satırları ve uyarıları inceledim, içe aktarmayı onaylıyorum.",
      exact: true,
    })
    .press("Space");
  await dialog.getByRole("button", { name: "Seçilen satırları içe aktar", exact: true }).click();
  await expect(dialog.getByText(/İş: pending/)).toBeVisible();
  const applied = f.writes.find((row) => row.op === "import_apply_v1")!;
  expect(applied.r.selected_row_numbers).toEqual([2]);
  expect(f.writes.find((row) => row.op === "import_preview_v1")?.r.mapping.kind).toBe(
    "crm_applications",
  );
  f.releaseApply();
  await dialog.getByRole("button", { name: "İş durumunu oku", exact: true }).click();
  await expect(dialog.getByText(/İş: succeeded/)).toBeVisible();
  await expect(
    dialog.getByRole("status").filter({ hasText: "3 satır · 1 aktarıldı · 2 atlandı" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Satırları gör", exact: true }).click();
  await dialog.getByRole("radio", { name: "Uygulandı", exact: true }).click();
  await expect(dialog.getByText("İkinci sentetik", { exact: true })).toBeVisible();
  await expect(
    dialog.getByRole("status").filter({ hasText: "3 satır · 1 aktarıldı · 2 atlandı" }),
  ).toBeVisible();
  await page.route(
    "**/functions/v1/backend-v1/import_rows_list_v1?download=skipped_csv",
    (route) => {
      expect(route.request().method()).toBe("POST");
      expect(route.request().postDataJSON()).toMatchObject({
        org_id: I.org,
        center_id: I.center,
        job_id: f.jobId,
      });
      expect(route.request().postDataJSON()).not.toHaveProperty("state");
      return route.fulfill({
        contentType: "text/csv",
        body: "row_number,outcome,error_code\r\n1,skipped,\r\n3,skipped,VALIDATION_FAILED\r\n",
      });
    },
  );
  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Aktarılmayan satırları indir (CSV)" }).click();
  expect((await download).suggestedFilename()).toBe(`import-skipped-${f.jobId}.csv`);
  expect(f.writes.filter((row) => row.op === "import_apply_v1")).toHaveLength(1);
  expect(f.requests.some((row) => row.op === "import_rows_process_v1")).toBe(false);
  expect(
    f.requests.some((row) => row.op === "import_rows_list_v1" && row.r.state === "applied"),
  ).toBe(true);
});
test("missing native limits disable upload rather than inventing a client allowance", async ({
  page,
}) => {
  const f = await mockReports(page, { noLimits: true });
  await page.getByRole("tab", { name: "Dosyalar", exact: true }).click();
  await expect(page.getByRole("button", { name: "CSV içe aktar", exact: true })).toBeDisabled();
  expect(f.writes).toEqual([]);
});
test("expired native preview cannot dispatch CRM apply even after row selection and review", async ({
  page,
}) => {
  const f = await mockReports(page, { expiredPreview: true });
  const dialog = await importForm(page);
  await expect(dialog.getByText("Birinci sentetik", { exact: true })).toBeVisible();
  await dialog.getByRole("checkbox", { name: "Satır 1", exact: true }).press("Space");
  await dialog
    .getByRole("checkbox", {
      name: "Seçili satırları ve uyarıları inceledim, içe aktarmayı onaylıyorum.",
      exact: true,
    })
    .press("Space");
  await expect(
    dialog.getByRole("button", { name: "Seçilen satırları içe aktar", exact: true }),
  ).toBeDisabled();
  expect(f.writes.some((row) => row.op === "import_apply_v1")).toBe(false);
});

test("student CSV maps opening rights and currency debts explicitly, previews invalid rows and applies through one native job", async ({
  page,
}) => {
  const f = await mockReports(page);
  await page.getByRole("tab", { name: "Dosyalar", exact: true }).click();
  await page.getByRole("button", { name: "CSV içe aktar", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "Aktarım türü", exact: true })
    .selectOption("students");
  await dialog
    .getByRole("textbox", { name: "Kaynak kayıt kümesi", exact: true })
    .fill("e2e-students");
  await dialog.getByText("CSV sütunlarını eşleştir", { exact: true }).click();
  for (const [label, column] of [
    ["Açılış hakkı", "opening_credits"],
    ["Açılış borcu (alt para birimi)", "opening_debt_minor"],
    ["Para birimi", "currency"],
    ["Paket sürümü referansı", "product_version_ref"],
    ["Asıl paket net değeri (alt para birimi)", "opening_credit_value_minor"],
  ]) {
    await dialog.getByRole("textbox", { name: label, exact: true }).fill(column);
  }
  await dialog.getByLabel("CSV dosyası", { exact: true }).setInputFiles({
    name: "students.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "source_key,display_name,phone,email,opening_credits,opening_debt_minor,currency,product_version_ref,opening_credit_value_minor\r\nstudent-1,Birinci sentetik,+905550000001,,5,12500,TRY," +
        "019ab7b0-0000-7000-8000-000000000060" +
        ",25000\r\nstudent-2,İkinci sentetik,+905550000002,,0,0,TRY,,0\r\nstudent-3,Hatalı sentetik,bad,,0,0,TRY,,0\r\n",
    ),
  });
  await dialog.getByRole("button", { name: "Önizle", exact: true }).click();
  await expect(dialog.getByText("Birinci sentetik", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Açılış borçları: ₺125,00", { exact: true })).toBeVisible();
  await expect(
    dialog.getByText("Asıl paket net değerleri: ₺250,00", { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByText(/Yeni kişi: 2.*Açılış hakkı: 5/)).toBeVisible();
  const preview = f.writes.find((row) => row.op === "import_preview_v1")!.r;
  expect(preview.mapping).toMatchObject({
    kind: "students",
    columns: expect.arrayContaining([
      { source_column: "opening_credits", target: "opening_credits" },
      { source_column: "opening_debt_minor", target: "opening_debt_minor" },
      { source_column: "currency", target: "currency" },
    ]),
  });
  expect(preview.source_namespace).toBe("e2e-students");
  expect(f.writes.some((row) => row.op === "import_apply_v1")).toBe(false);
  await dialog.getByRole("radio", { name: "Hatalı", exact: true }).click();
  await expect(dialog.getByText("Hatalı sentetik", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("row").filter({ hasText: "Hatalı sentetik" })).toContainText(
    "VALIDATION_FAILED",
  );
  await dialog
    .getByRole("checkbox", {
      name: "Seçili satırları ve uyarıları inceledim, içe aktarmayı onaylıyorum.",
      exact: true,
    })
    .press("Space");
  await dialog.getByRole("button", { name: "Seçilen satırları içe aktar", exact: true }).click();
  await expect(dialog.getByText(/İş: pending/)).toBeVisible();
  expect(f.writes.find((row) => row.op === "import_apply_v1")!.r).not.toHaveProperty(
    "selected_row_numbers",
  );
  f.releaseApply();
  await dialog.getByRole("button", { name: "İş durumunu oku", exact: true }).click();
  await expect(dialog.getByText("İş: succeeded · 2 / 2", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Satırları gör", exact: true }).click();
  await dialog.getByRole("radio", { name: "Uygulandı", exact: true }).click();
  await expect(dialog.getByText("Birinci sentetik", { exact: true })).toBeVisible();
  await expect(dialog.getByText("İkinci sentetik", { exact: true })).toBeVisible();
  expect(f.writes.filter((row) => row.op === "import_apply_v1")).toHaveLength(1);
  expect(
    f.requests.some((row) =>
      [
        "person_create_v1",
        "finance_entry_create_v1",
        "sale_commit_v1",
        "import_rows_process_v1",
      ].includes(row.op),
    ),
  ).toBe(false);
});
