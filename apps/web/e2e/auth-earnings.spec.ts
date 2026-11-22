import { checkLockedWorkspaceScope } from "./auth-fixture.js";
import { test, expect } from "./test.js";
import { mockEarnings, fillEarningsPayment, earningsIds } from "./earnings-fixture.js";
import type { DigitalAgreementView } from "@ftksaas/api-contracts";
import { scanAccessibility } from "./accessibility.js";
import { initialAgreement, studioIds as I } from "./studio-fixture.js";
test("manager native directory preserves global currency totals, historical agreement, distinct session counts and cursor filters", async ({
  page,
}) => {
  const f = await mockEarnings(page, { paginate: true });
  await expect(page.getByText("7 tekil kapalı ders seansı", { exact: true })).toBeVisible();
  const row = page.getByRole("row").filter({ hasText: "Örnek Eğitmen" });
  await expect(row.getByRole("gridcell", { name: "3", exact: true })).toBeVisible();
  await expect(page.getByText("₺1.000,00 · €50,00", { exact: true }).first()).toBeVisible();
  await page.getByRole("tab", { name: "Eğitmenler", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Satırlar", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Tango başlangıç", { exact: true })).toBeVisible();
  await expect(page.getByText("Ders anlaşması · Anlaşma v1", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sonraki sayfa", exact: true }).click();
  await expect(page.getByText("Etkinlik hakedişi", { exact: true })).toBeVisible();
  expect(f.reads.at(-1)).toMatchObject({ view: "earnings", page: { cursor: "native-next" } });
  await page.getByRole("combobox", { name: "Eğitmen", exact: true }).selectOption(I.instructor);
  await expect(page.getByText("Tango başlangıç", { exact: true })).toBeVisible();
  expect(f.reads.at(-1)?.page.cursor).toBeUndefined();
  await page.getByRole("tab", { name: "Ödemeler", exact: true }).click();
  await expect(page.getByText("Nakit", { exact: true })).toBeVisible();
});
test("payment refreshes historical period and person cursor pages after native readback", async ({
  page,
}) => {
  const f = await mockEarnings(page, { paginate: true });
  // Historical earning and payment occur in different months. The backend owns
  // period filtering, so both old cursor pages must be read with the old interval.
  f.earning.earning.created_at = "2026-10-10T12:00:00Z";
  await page.getByRole("button", { name: /Ekim 2026/ }).click();
  await page.getByRole("combobox", { name: "Eğitmen", exact: true }).selectOption(I.instructor);
  await page.getByRole("tab", { name: "Satırlar", exact: true }).click();
  await expect(page.getByText("Tango başlangıç", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sonraki sayfa", exact: true }).click();
  await expect(page.getByText("Etkinlik hakedişi", { exact: true })).toBeVisible();
  const oldPeriodReads = () =>
    f.reads.filter(
      (row) =>
        row.view === "earnings" &&
        row.person_id === I.instructor &&
        row.page.cursor === "native-next" &&
        row.interval,
    );
  expect(oldPeriodReads()).toHaveLength(1);
  const historicalInterval = oldPeriodReads()[0]!.interval;

  await page.getByRole("tab", { name: "Eğitmenler", exact: true }).click();
  const dialog = await fillEarningsPayment(page);
  await dialog.getByRole("button", { name: "Ödemeyi kaydet", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByText("Ödeme ve güncel hakediş doğrulandı.", { exact: true }),
  ).toBeVisible();
  expect(f.writes).toHaveLength(1);
  await expect(page.getByText("₺300,00 · €0,00", { exact: true }).first()).toBeVisible();

  await page.getByRole("tab", { name: "Satırlar", exact: true }).click();
  await expect(page.getByText("Tango başlangıç", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sonraki sayfa", exact: true }).click();
  await expect(page.getByText("Etkinlik hakedişi", { exact: true })).toBeVisible();
  await expect.poll(() => oldPeriodReads().length).toBe(2);
  expect(oldPeriodReads()[1]!.interval).toEqual(historicalInterval);
});
test("record payment requires explicit native earning, currency, real reference and center-local instant then rereads all views", async ({
  page,
}) => {
  const f = await mockEarnings(page);
  const dialog = await fillEarningsPayment(page);
  await dialog.getByRole("button", { name: "Ödemeyi kaydet", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(f.writes).toHaveLength(1);
  expect(f.writes[0]).toMatchObject({
    person_id: I.instructor,
    earning_ids: [earningsIds.earning],
    amount_minor: "10000",
    currency: "TRY",
    occurred_at: "2026-11-16T11:00:00Z",
    payment: { method: "bank_transfer", reference: "E2E-TRANSFER" },
  });
  await expect(
    page.getByText("Ödeme ve güncel hakediş doğrulandı.", { exact: true }),
  ).toBeVisible();
  expect(f.committed.size).toBe(1);
});
test("unknown payment freezes the draft and scope and same-key retry creates one native payment", async ({
  page,
}) => {
  const f = await mockEarnings(page, { unknown: true });
  const dialog = await fillEarningsPayment(page);
  await dialog.getByRole("button", { name: "Ödemeyi kaydet", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "Aynı isteği yeniden dene", exact: true }),
  ).toBeVisible();
  await expect(dialog.getByLabel("Tutar · TRY", { exact: true })).toBeDisabled();
  await checkLockedWorkspaceScope(page, async () => {
    await expect(page.locator("[data-workspace-logo]").locator("..")).toBeDisabled();
  });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Aynı isteği yeniden dene", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(f.writes).toHaveLength(2);
  expect(f.writes[1]!.operation_key).toBe(f.writes[0]!.operation_key);
  expect(f.writes[1]!.request_id).not.toBe(f.writes[0]!.request_id);
  expect(f.committed.size).toBe(1);
});
test("an ACK with unavailable readback stays saved-unread and only rereads after recovery", async ({
  page,
}) => {
  const f = await mockEarnings(page, { ackUnread: true });
  const dialog = await fillEarningsPayment(page);
  await dialog.getByRole("button", { name: "Ödemeyi kaydet", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(f.writes).toHaveLength(1);
  expect(f.receipts).toHaveLength(0);
});
test("confirmed earnings payment remains saved-unread when mandatory first-page readback fails", async ({
  page,
}) => {
  const f = await mockEarnings(page, { pageUnread: true });
  const dialog = await fillEarningsPayment(page);
  await dialog.getByRole("button", { name: "Ödemeyi kaydet", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }),
  ).toBeVisible();
  expect(f.writes).toHaveLength(1);
  expect(f.committed.size).toBe(1);

  await dialog.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByText("Ödeme ve güncel hakediş doğrulandı.", { exact: true }),
  ).toBeVisible();
  expect(f.writes).toHaveLength(1);
});
test("correction preserves original payment, uses actual aggregate root version and writes a separate dated delta", async ({
  page,
}) => {
  const f = await mockEarnings(page);
  await page.getByRole("tab", { name: "Ödemeler", exact: true }).click();
  await page.getByRole("button", { name: "Düzelt", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "Düzeltmeyi kaydet", exact: true }),
  ).toBeEnabled();
  await dialog.getByLabel("Fark · TRY", { exact: true }).fill("10,00");
  await dialog.getByLabel("Gerekçe", { exact: true }).fill("Yanlış tutarı düzelt");
  await dialog.getByRole("button", { name: "Düzeltmeyi kaydet", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(f.writes[0]).toMatchObject({
    payment_id: earningsIds.payment,
    expected_version: 1,
    correction: { amount_minor: "1000", currency: "TRY", direction: "decrease" },
    reason: "Yanlış tutarı düzelt",
  });
  expect(f.payments[0]!.amount_minor).toBe("20000");
  expect(f.payments[0]!.version).toBe(2);
  expect(f.payments).toHaveLength(2);
  await expect(
    page.getByRole("gridcell", { name: "Yanlış tutarı düzelt", exact: true }),
  ).toBeVisible();
});
test("native denial does not impersonate self or invent empty zero totals", async ({ page }) => {
  const f = await mockEarnings(page, { denied: true });
  await expect(page.getByText("Finans kayıtları alınamadı.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ödeme kaydet", exact: true })).toBeDisabled();
  await expect(page.getByText("₺0,00", { exact: true })).toHaveCount(0);
  expect(f.writes).toHaveLength(0);
});
test("agreement action reuses the existing native editor for the selected real person and immutable version", async ({
  page,
}) => {
  const f = await mockEarnings(page);
  await page.getByRole("button", { name: "1 etkin anlaşma", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("combobox", { name: "Eğitmen", exact: true })).toHaveValue(
    I.instructor,
  );
  expect(f.studio.reads).toContain("instructor_agreements_list_v1");
  await dialog.getByRole("button", { name: "Kapat", exact: true }).click();
});
test("toolbar starts with an editable instructor choice while financial inputs await native context", async ({
  page,
}) => {
  const f = await mockEarnings(page);
  await page.getByRole("button", { name: "Ödeme kaydet", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  const person = dialog.getByRole("combobox", { name: "Eğitmen", exact: true });
  await expect(person).toBeEnabled();
  await expect(dialog.getByRole("button", { name: "Ödemeyi kaydet", exact: true })).toBeDisabled();
  await person.selectOption(I.instructor);
  await expect(dialog.getByRole("combobox", { name: "Para birimi", exact: true })).toBeEnabled();
  await dialog.getByRole("combobox", { name: "Para birimi", exact: true }).selectOption("TRY");
  await expect(dialog.getByRole("button", { name: "Ödemeyi kaydet", exact: true })).toBeEnabled();
  await dialog.getByRole("button", { name: "Vazgeç", exact: true }).click();
  expect(f.writes).toHaveLength(0);
});
test("a visible instructor outside the first selector page stays explicitly selected in the payment panel", async ({
  page,
}) => {
  const f = await mockEarnings(page, { peoplePagination: true });
  await page.getByRole("button", { name: "Sonraki sayfa", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: "İkinci eğitmen" });
  await row.getByRole("button", { name: "Ödeme kaydet", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("combobox", { name: "Eğitmen", exact: true })).toHaveValue(
    "019a7b00-0000-7000-8000-000000000999",
  );
  await expect(dialog.getByRole("option", { name: "İkinci eğitmen", exact: true })).toHaveCount(1);
  await dialog.getByRole("button", { name: "Vazgeç", exact: true }).click();
  expect(f.writes).toHaveLength(0);
});
test("stale root correction requires a fresh native chain and a new key before the next explicit write", async ({
  page,
}) => {
  const f = await mockEarnings(page, { staleCorrect: true });
  await page.getByRole("tab", { name: "Ödemeler", exact: true }).click();
  await page.getByRole("button", { name: "Düzelt", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "Düzeltmeyi kaydet", exact: true }),
  ).toBeEnabled();
  await dialog.getByLabel("Fark · TRY", { exact: true }).fill("10,00");
  await dialog.getByLabel("Gerekçe", { exact: true }).fill("Güncel sürümü düzelt");
  await dialog.getByRole("button", { name: "Düzeltmeyi kaydet", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "Güncel verileri yükle", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Düzeltmeyi kaydet", exact: true }),
  ).toBeDisabled();
  await dialog.getByRole("button", { name: "Güncel verileri yükle", exact: true }).click();
  await expect(dialog.getByText("Başka işlem", { exact: true })).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Düzeltmeyi kaydet", exact: true }),
  ).toBeEnabled();
  await dialog.getByRole("button", { name: "Düzeltmeyi kaydet", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(f.writes).toHaveLength(2);
  expect(f.writes[0]!.expected_version).toBe(1);
  expect(f.writes[1]!.expected_version).toBe(2);
  expect(f.writes[1]!.operation_key).not.toBe(f.writes[0]!.operation_key);
  expect(f.payments[0]!.amount_minor).toBe("20000");
});
test("write authority loss ends the pending editor, hides financial context and never retries the denied mutation", async ({
  page,
}) => {
  const f = await mockEarnings(page, { denyWrite: true });
  const dialog = await fillEarningsPayment(page);
  await dialog.getByRole("button", { name: "Ödemeyi kaydet", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("Finans kayıtları alınamadı.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ödeme kaydet", exact: true })).toBeDisabled();
  await expect(page.getByRole("gridcell", { name: "Örnek Eğitmen", exact: true })).toHaveCount(0);
  expect(f.writes).toHaveLength(1);
  expect(f.committed.size).toBe(0);
});
test("invalid overpayment preserves a fully accessible dark mobile payment form and never dispatches", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 850 });
  await page.emulateMedia({ colorScheme: "dark" });
  const f = await mockEarnings(page);
  const dialog = await fillEarningsPayment(page);
  await dialog.getByLabel("Tutar · TRY", { exact: true }).fill("800.01");
  await dialog.getByRole("button", { name: "Ödemeyi kaydet", exact: true }).click();
  await expect(
    dialog.getByText(
      "Tutarı, para birimini, tarih/saatini, hakediş seçimini ve ödeme referansını kontrol et.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(dialog.getByLabel("Tutar · TRY", { exact: true })).toBeFocused();
  expect(f.writes).toHaveLength(0);
});

test("manager reads agreement evidence on demand and clears stale status on denial", async ({
  page,
}) => {
  const content = {
    name: "Anlaşma metni",
    language: "tr" as const,
    template_id: "instructor.agreement",
    template_version: "1",
    text: "Sentetik eğitmen anlaşması koşulları.",
  };
  const rendered: NonNullable<DigitalAgreementView["rendered_document"]> = {
    id: earningsIds.earning,
    source_version: I.agreement,
    source_content_hash: "facts",
    content_hash: "body",
    language: "tr",
    created_at: "2026-11-18T00:00:00Z",
    content,
  };
  const accepted: NonNullable<DigitalAgreementView["acceptance"]> = {
    id: earningsIds.payment,
    account_id: earningsIds.created,
    person_id: I.instructor,
    agreement_id: I.agreement,
    accepted_at: "2026-11-18T00:00:00Z",
    rendered_document_id: rendered.id,
    content_hash: rendered.content_hash,
    source_content_hash: rendered.source_content_hash,
    displayed_content: content,
    evidence_kind: "server_document",
  };
  const view: DigitalAgreementView = {
    agreement: initialAgreement,
    source_content_hash: rendered.source_content_hash,
    acceptance: null,
    document_error: "POLICY_NOT_CONFIGURED",
    rendered_document: null,
  };
  let denied = false;
  const fixture = await mockEarnings(page, {
    agreementDocument: () => (denied ? "FORBIDDEN" : view),
  });
  const row = page.getByRole("row").filter({ hasText: "Örnek Eğitmen" });
  const open = row.getByRole("button", { name: "Metin kabul durumunu göster" });
  const refresh = row.getByRole("button", { name: "Metin kabul durumunu yenile" });
  await expect(open).toBeEnabled();
  expect(fixture.agreementReads).toHaveLength(0);
  await open.scrollIntoViewIfNeeded();
  // Establish the grid row focus before moving focus to its action.
  await row.focus();
  await expect(row).toBeFocused();
  await expect(row).toHaveAttribute("tabindex", "0");
  await open.focus();
  await expect(open).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(row.getByRole("status")).toHaveText("Anlaşma v1 · Anlaşma metni yayımlanmadı");
  await expect(refresh).toBeFocused();

  view.rendered_document = rendered;
  view.document_error = null;
  await refresh.click();
  await expect(row.getByRole("status")).toHaveText("Anlaşma v1 · Metin kabulü bekleniyor");

  view.acceptance = { ...accepted, content_hash: "previous-body" };
  await refresh.click();
  await expect(row.getByRole("status")).toHaveText(
    "Anlaşma v1 · Metni yeniden kabul etmesi gerekiyor",
  );

  view.acceptance = { ...accepted, person_id: earningsIds.correction };
  await refresh.click();
  await expect(row.getByRole("status")).toHaveText("Metin kabul durumu doğrulanamadı.");

  view.acceptance = accepted;
  await refresh.click();
  await expect(row.getByRole("status")).toHaveText("Anlaşma v1 · Metin kabul edildi");
  expect((await scanAccessibility(page, "manager-agreement-acceptance")).violations).toEqual([]);

  denied = true;
  await refresh.click();
  await expect(row.getByRole("status")).toHaveText("Metin kabul durumu doğrulanamadı.");
  expect(fixture.agreementReads).toEqual(Array.from({ length: 6 }, () => I.agreement));
});
