import { test, expect } from "./test.js";
import { mockReports } from "./reports-native-fixture.js";
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
  await expect(page.getByText("Dönüşen aday", { exact: true })).toBeVisible();
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
  const dialog = await exportForm(page);
  await dialog.getByRole("button", { name: "Dışa aktarmayı başlat", exact: true }).click();
  await dialog.getByRole("button", { name: "Aynı isteği yeniden dene", exact: true }).click();
  await expect
    .poll(() => f.writes.filter((row) => row.op === "report_export_start_v1").length)
    .toBe(2);
  const writes = f.writes.filter((row) => row.op === "report_export_start_v1");
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
  await dialog.getByRole("button", { name: "Satırları gör", exact: true }).click();
  await dialog.getByRole("radio", { name: "Uygulandı", exact: true }).click();
  await expect(dialog.getByText("İkinci sentetik", { exact: true })).toBeVisible();
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
