import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("document publication approval is keyboard accessible and reflows at narrow enlarged text", async ({
  page,
}) => {
  const domainRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/functions/v1/") || request.url().includes("/storage/v1/"))
      domainRequests.push(request.url());
  });
  await page.setViewportSize({ width: 320, height: 950 });
  await page.goto("/tasarim/belgeler");
  await page.getByLabel("Sürüm etiketi").fill("2026.11");
  await page.getByLabel("Yoklama", { exact: true }).check();
  await page.getByRole("button", { name: "Yayın etkisini incele" }).press("Enter");
  const approval = page.getByRole("checkbox", { name: /Bu sürümün kapsamını/ });
  await expect(approval).toBeFocused();
  await expect(page.getByRole("button", { name: "Sürümü yayımla" })).toBeDisabled();
  await page.evaluate(async () => {
    document.documentElement.style.fontSize = "200%";
    await document.fonts.ready;
  });
  expect(await page.locator("main").evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(
    true,
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await approval.press("Space");
  await page.getByRole("button", { name: "Sürümü yayımla" }).press("Enter");
  await expect(
    page.getByText("Örnek yayın onayı alındı; gerçek dosya veya kayıt değiştirilmedi."),
  ).toBeVisible();
  expect(domainRequests).toEqual([]);
});

test("private document reader supports keyboard, safe download and narrow enlarged text without domain writes", async ({
  page,
}) => {
  const domainRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/functions/v1/") || request.url().includes("/storage/v1/"))
      domainRequests.push(request.url());
  });
  await page.setViewportSize({ width: 320, height: 950 });
  await page.goto("/tasarim/belgeler");
  const open = page.getByRole("button", { name: "Örnek katılım koşulları belgesini aç" });
  await open.press("Enter");
  await expect(page.getByRole("article")).toContainText(
    "Sentetik belge. Okumak veya indirmek kabul kaydı oluşturmaz.",
  );
  await expect(page.getByRole("article").getByRole("heading")).toBeFocused();
  await expect(page.getByRole("link", { name: "Dosyayı indir" })).toHaveAttribute("href", /^blob:/);
  await expect(page.getByRole("button", { name: /Kabul et|Onayla/ })).toHaveCount(0);
  await page.evaluate(async () => {
    document.documentElement.style.fontSize = "200%";
    await document.fonts.ready;
  });
  expect(await page.locator("main").evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(
    true,
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Belgeyi kapat" }).press("Enter");
  await expect(open).toBeFocused();
  await expect(page.getByRole("link", { name: "Dosyayı indir" })).toHaveCount(0);
  expect(domainRequests).toEqual([]);
});
