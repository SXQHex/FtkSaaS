import { test, expect } from "./test.js";
test("public application preserves full form but cannot collect or submit without published target and consent", async ({
  page,
}) => {
  const mutations: string[] = [];
  await page.route("**/api/public/application", async (route) => {
    mutations.push(route.request().url());
    await route.abort();
  });
  await page.route("**/auth/v1/**", () => {
    throw new Error("Anonymous form must not initialize Auth");
  });
  await page.route("**/functions/v1/backend-v1/**", () => {
    throw new Error("Anonymous form must not use native management API");
  });
  await page.goto("/public/test-studio/apply");
  await expect(page.getByRole("heading", { name: "Başvur", exact: true })).toBeVisible();
  await expect(
    page.getByText("Başvuru formu henüz kullanılamıyor.", { exact: true }),
  ).toBeVisible();
  for (const label of ["Ad soyad (zorunlu)", "E-posta", "Telefon", "Ne ilgini çekiyor?", "Mesaj"])
    await expect(page.getByLabel(label, { exact: true })).toBeDisabled();
  await expect(page.getByRole("checkbox")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Başvuruyu gönder", exact: true })).toBeDisabled();
  await expect(
    page
      .getByRole("navigation", { name: "Sayfa menüsü", exact: true })
      .getByRole("link", { name: "Program", exact: true }),
  ).toHaveAttribute("href", "/public/test-studio/calendar");
  expect(mutations).toHaveLength(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "Başvuruyu gönder", exact: true })).toBeDisabled();
});
