import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("account access confirmation is keyboard accessible and reflows at 320px with 200% text", async ({
  page,
}) => {
  const domainRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/functions/v1/")) domainRequests.push(request.url());
  });
  await page.setViewportSize({ width: 320, height: 950 });
  await page.goto("/tasarim/ogrenciler");
  await page.getByRole("button", { name: /Deniz Örnek/ }).click();
  const detail = page.getByRole("dialog");
  const links = detail.getByRole("region", { name: "Hesap bağlantıları", exact: true });
  const remove = links.getByRole("button", { name: "Hesap bağlantısını kaldır", exact: true });
  await remove.focus();
  await page.keyboard.press("Enter");
  await links.getByLabel("Kaldırma gerekçesi").fill("Örnek bağlantı düzeltmesi");
  await page.evaluate(async () => {
    document.documentElement.style.fontSize = "200%";
    await document.fonts.ready;
  });
  expect(await detail.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await links.getByRole("button", { name: "Kaldırmayı onayla" }).click();
  await expect(
    detail
      .getByRole("region", { name: "Hesap bağlantıları", exact: true })
      .getByText("İptal edilmiş", { exact: true }),
  ).toBeVisible();
  await expect(
    detail.getByRole("button", { name: "Hesap bağlantısını kaldır", exact: true }),
  ).toHaveCount(0);
  const invitations = detail.getByRole("region", { name: "Hesap davetleri", exact: true });
  await invitations.getByRole("button", { name: "Daveti iptal et", exact: true }).click();
  await expect(invitations.getByRole("button", { name: "İptali onayla" })).toBeEnabled();
  expect(await detail.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(domainRequests).toEqual([]);
});
