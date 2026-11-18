import { test, expect } from "./test.js";
import type { Page } from "@playwright/test";
import { mockOrganizationLifecycle } from "./organization-lifecycle-fixture.js";
import { studioIds as I } from "./studio-fixture.js";
async function preview(page: Page, kind: "close" | "delete" | "resume" = "close") {
  await page
    .getByRole("button", {
      name:
        kind === "close"
          ? "Kapanış önizlemesi"
          : kind === "delete"
            ? "Silme önizlemesi"
            : "Aynı isteği sürdür",
      exact: true,
    })
    .click();
  const sheet = page.getByRole("dialog");
  if (kind !== "resume")
    await sheet
      .getByRole("textbox", { name: "İşlem gerekçesi", exact: true })
      .fill("Sentetik organizasyon işlemi");
  if (kind !== "close")
    await sheet.getByRole("textbox", { name: "Onaylamak için SİL yaz", exact: true }).fill("SİL");
  await sheet.getByRole("button", { name: "Etkileri incele", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Onaylanan değişiklikleri uygula", exact: true }),
  ).toBeVisible();
  return page.getByRole("dialog");
}
async function apply(page: Page) {
  const review = page.getByRole("dialog");
  await review
    .getByRole("checkbox", {
      name: "Kapsamı ve güncel etkileri okudum, bu değişikliği onaylıyorum.",
      exact: true,
    })
    .press("Space");
  await review
    .getByRole("button", { name: "Onaylanan değişiklikleri uygula", exact: true })
    .click();
  return review;
}
test("organization close uses current org version, explicit impact review and same-key lost-ACK recovery", async ({
  page,
}) => {
  const f = await mockOrganizationLifecycle(page, { unknownClose: true });
  const review = await preview(page);
  await expect(review.getByRole("button", { name: "Vazgeç", exact: true })).toBeFocused();
  await expect(review).toContainText("Aktif rezervasyonlar");
  expect(f.writes).toHaveLength(0);
  await apply(page);
  await expect(page.getByRole("combobox", { name: "Ayar kapsamı", exact: true })).toBeDisabled();
  await review.getByRole("button", { name: "Aynı isteği yeniden dene", exact: true }).click();
  await expect.poll(() => f.writes.length).toBe(2);
  expect(f.writes[0]!.r.operation_key).toBe(f.writes[1]!.r.operation_key);
  expect(f.writes[0]!.r).toMatchObject({ org_id: I.org, expected_version: 4 });
  expect(f.writes[0]!.r).not.toHaveProperty("center_id");
  expect(f.effects()).toBe(1);
  await expect(
    page.getByText("Organizasyon kapatıldı; güncel durum ve kapalı erişim modu doğrulandı.", {
      exact: true,
    }),
  ).toBeVisible();
});
test("close ACK with unread result offers only rereading and preserves its one native write", async ({
  page,
}) => {
  const f = await mockOrganizationLifecycle(page, { ackUnreadClose: true });
  await preview(page);
  const review = await apply(page);
  await review.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }).click();
  await expect(
    page.getByText("Organizasyon kapatıldı; güncel durum ve kapalı erişim modu doğrulandı.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(f.writes).toHaveLength(1);
});
test("changed organization version requires a new preview and explicit approval instead of overwriting", async ({
  page,
}) => {
  const f = await mockOrganizationLifecycle(page, { staleClose: true });
  await preview(page);
  const first = await apply(page);
  await first.getByRole("button", { name: "Güncel verileri yükle", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Etkileri incele", exact: true })
    .click();
  await apply(page);
  await expect.poll(() => f.writes.length).toBe(2);
  expect(f.writes[1]!.r.expected_version).toBe(5);
  expect(f.writes[1]!.r.operation_key).not.toBe(f.writes[0]!.r.operation_key);
  expect(f.writes[1]!.r.preview.id).not.toBe(f.writes[0]!.r.preview.id);
  expect(f.effects()).toBe(1);
});
test("owner-only preview denial remains an error without an empty safe impact or apply action", async ({
  page,
}) => {
  const f = await mockOrganizationLifecycle(page, { denied: true });
  await page.getByRole("button", { name: "Kapanış önizlemesi", exact: true }).click();
  const sheet = page.getByRole("dialog");
  await sheet
    .getByRole("textbox", { name: "İşlem gerekçesi", exact: true })
    .fill("Sentetik gerekçe");
  await sheet.getByRole("button", { name: "Etkileri incele", exact: true }).click();
  await expect(sheet.getByText(/İşlem hazırlanamadı/)).toBeVisible();
  await expect(
    sheet.getByRole("button", { name: "Onaylanan değişiklikleri uygula", exact: true }),
  ).toHaveCount(0);
  expect(f.writes).toHaveLength(0);
});
test("expired lifecycle preview cannot dispatch a close even when its separate review is checked", async ({
  page,
}) => {
  const f = await mockOrganizationLifecycle(page, { expired: true });
  const review = await preview(page);
  await review
    .getByRole("checkbox", {
      name: "Kapsamı ve güncel etkileri okudum, bu değişikliği onaylıyorum.",
      exact: true,
    })
    .press("Space");
  await expect(
    review.getByRole("button", { name: "Onaylanan değişiklikleri uygula", exact: true }),
  ).toBeDisabled();
  expect(f.writes).toHaveLength(0);
});
test("organization deletion recovers a lost ACK after reload with its exact intent and reports partial privacy, never completed erasure", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 950 });
  const f = await mockOrganizationLifecycle(page, { unknownDelete: true });
  await preview(page, "delete");
  const review = await apply(page);
  await expect(review.getByText(/Yanıt alınamadı/)).toBeVisible();
  page.on("dialog", (dialog) => void dialog.accept());
  await page.reload();
  await page
    .getByRole("combobox", { name: "Ayar kapsamı", exact: true })
    .selectOption("organization");
  await page.getByRole("tab", { name: "Plan", exact: true }).click();
  expect(f.writes).toHaveLength(1);
  const previews = f.requests.filter((row) => row.op === "organization_delete_preview_v1").length;
  await preview(page, "resume");
  await apply(page);
  await expect(page.getByText("Silme süreci kısmen tamamlandı.", { exact: true })).toBeVisible();
  expect(f.writes).toHaveLength(2);
  expect(f.writes[1]!.r).toMatchObject({
    operation_key: f.writes[0]!.r.operation_key,
    preview: f.writes[0]!.r.preview,
    all_data: true,
  });
  expect(f.writes[1]!.r.reauth).toBeTruthy();
  expect(f.writes[1]!.r).not.toHaveProperty("center_id");
  expect(f.requests.filter((row) => row.op === "organization_delete_preview_v1")).toHaveLength(
    previews,
  );
  expect(f.effects()).toBe(1);
  await expect(
    page.getByText("Silme talebinin tamamlanması bildirildi.", { exact: true }),
  ).toHaveCount(0);
});
test("deletion ACK retains its native job ID before failed readback and reload resumes only job reads", async ({
  page,
}) => {
  const f = await mockOrganizationLifecycle(page, { ackUnreadDelete: true });
  await preview(page, "delete");
  await apply(page);
  await expect(
    page.getByRole("button", { name: "İşlem sonucunu kontrol et", exact: true }),
  ).toBeVisible();
  page.on("dialog", (dialog) => void dialog.accept());
  await page.reload();
  await page
    .getByRole("combobox", { name: "Ayar kapsamı", exact: true })
    .selectOption("organization");
  await page.getByRole("tab", { name: "Plan", exact: true }).click();
  await page.getByRole("button", { name: "Durumu yenile", exact: true }).click();
  await expect(page.getByText("Silme süreci kısmen tamamlandı.", { exact: true })).toBeVisible();
  expect(f.writes).toHaveLength(1);
});
