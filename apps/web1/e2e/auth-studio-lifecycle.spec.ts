import { test, expect } from "./test.js";
import { scanAccessibility } from "./accessibility.js";
import { mockStudio, openStudio, studioIds as I } from "./studio-fixture.js";

test("Studio lifecycle: explicit last-rule retirement, same-key recovery, versioned closure cancellation and AA", async ({
  page,
}) => {
  const state = await mockStudio(page);
  const closureId = "019a7b00-0000-7000-8000-000000000050";
  state.closures.push({
    id: closureId,
    state: "active",
    resource: { kind: "room", id: I.room },
    interval: { starts_at: "2026-11-20T00:00:00Z", ends_at: "2026-11-21T00:00:00Z" },
  });
  const originalRule = structuredClone(state.rules[0]!.rule);
  const originalClosure = structuredClone(state.closures[0]!.interval);
  await openStudio(page);
  await page.getByRole("tab", { name: "Uygunluk", exact: true }).click();
  await page.getByLabel("Kaynak", { exact: true }).selectOption(I.instructor);
  await page
    .getByLabel("Geçerlilik dönemi", { exact: true })
    .selectOption(JSON.stringify(["2026-11-01", null]));
  await page.getByRole("button", { name: "Kalıcı kuralı kapat", exact: true }).click();
  await page
    .getByRole("menuitem")
    .filter({ hasText: /18:00:00/ })
    .click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByRole("button", { name: "Vazgeç", exact: true })).toBeFocused();
  await expect(dialog.getByText(/Pazartesi, Çarşamba/)).toBeVisible();
  await dialog.getByLabel("İşlem gerekçesi", { exact: false }).fill("Son kural kontrollü kapatma");
  state.nextWrite = "unknown";
  await dialog.getByRole("button", { name: "Kalıcı kuralı kapat", exact: true }).click();
  await expect(dialog.getByRole("button", { name: /Aynı isteği/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Vazgeç", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: /Aynı isteği/ }).click();
  await expect(
    dialog.getByText("İşlem kaydedildi; güncel bilgiler yüklendi.", { exact: true }),
  ).toBeVisible();
  const retireWrites = state.writes.filter((write) => write.payload.action === "retire");
  expect(retireWrites).toHaveLength(2);
  expect(retireWrites[0]?.key).toBe(retireWrites[1]?.key);
  expect(state.rules[0]?.version).toBe(4);
  expect(state.rules[0]?.active).toBe(false);
  expect(state.rules[0]?.rule).toEqual(originalRule);
  expect((await scanAccessibility(page, "studio-retired-rule-result")).violations).toEqual([]);
  await dialog.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await expect(page.getByRole("button", { name: "Kalıcı kuralı kapat", exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("tab", { name: "Kapanışlar", exact: true }).click();
  const row = page
    .getByRole("grid", { name: "Kapanışlar ve izinler", exact: true })
    .getByRole("row")
    .filter({ hasText: /20\.11\.2026/ });
  await row.getByRole("button").click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Kapanışı iptal et", exact: true })
    .click();
  await expect(dialog.getByRole("button", { name: "Vazgeç", exact: true })).toBeFocused();
  await dialog.getByLabel("İşlem gerekçesi", { exact: false }).fill("Kapanış kontrollü iptal");
  await page.setViewportSize({ width: 320, height: 900 });
  await page.emulateMedia({ colorScheme: "dark" });
  expect(await page.evaluate<boolean>("document.documentElement.scrollWidth > innerWidth")).toBe(
    false,
  );
  expect((await scanAccessibility(page, "studio-cancel-closure-mobile-dark")).violations).toEqual(
    [],
  );
  await dialog.getByRole("button", { name: "Kapanışı iptal et", exact: true }).click();
  await expect(
    dialog.getByText("İşlem kaydedildi; güncel bilgiler yüklendi.", { exact: true }),
  ).toBeVisible();
  const cancelWrites = state.writes.filter((write) => write.payload.action === "cancel");
  expect(cancelWrites).toHaveLength(1);
  expect(cancelWrites[0]?.payload.expected_version).toBe(7);
  expect(state.centerVersion).toBe(8);
  expect(state.closures[0]?.state).toBe("cancelled");
  expect(state.closures[0]?.interval).toEqual(originalClosure);
  await dialog.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await expect(
    page
      .getByRole("grid", { name: "Kapanışlar ve izinler", exact: true })
      .getByText("İptal edildi", { exact: true }),
  ).toBeVisible();
  expect(state.effects.filter((operation) => operation === "session_cancel_apply_v1")).toHaveLength(
    0,
  );
});
