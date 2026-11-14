import type { FailureEnvelope } from "../src/lib/api-contracts/generated.js";
import { test, expect } from "./test.js";
import { scanAccessibility } from "./accessibility.js";
import { origin, captureAuth, mockNative } from "./auth-fixture.js";

test("native recovery callback survives URL cleaning, reload and password save", async ({
  page,
}, testInfo) => {
  const calls = await mockNative(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/forgot-password");
  await captureAuth(page, "e04", testInfo);
  await page.getByLabel("E-posta").fill("fixture@example.invalid");
  await page.getByRole("button", { name: "Bağlantı gönder" }).click();
  await expect(page.getByRole("heading", { name: "E-postanı kontrol et" })).toBeVisible();
  expect(calls.recover).toBe(1);
  await page.goto("/auth/callback?code=fixture-recovery-code&next=/reset-password");
  await expect(page).toHaveURL(`${origin}/reset-password`);
  await page.reload();
  await expect(page.getByLabel("Yeni parola")).toBeVisible();
  const otherTab = await page.context().newPage();
  await otherTab.bringToFront();
  await page.bringToFront();
  await otherTab.close();
  await captureAuth(page, "e05", testInfo);
  await page.getByLabel("Yeni parola").fill("fixture-new-password");
  await page.getByLabel("Parola tekrar").fill("different-password");
  await page.getByRole("button", { name: "Parolayı kaydet" }).click();
  await expect(page.getByText("Parolalar eşleşmiyor.")).toBeVisible();
  expect(calls.password).toBe(0);
  await page.getByLabel("Parola tekrar").fill("fixture-new-password");
  await page.getByRole("button", { name: "Parolayı kaydet" }).click();
  await expect(page.getByRole("status")).toHaveText("Parolan kaydedildi.");
  expect(calls.exchange).toBe(1);
  expect(calls.password).toBe(1);
  expect(errors).toEqual([]);
  await page.goto("/reset-password");
  await expect(page).toHaveURL(`${origin}/forgot-password`);
});

test("native OAuth callback exchanges once and enters the protected account", async ({ page }) => {
  const calls = await mockNative(page);
  await page.goto("/login");
  await page.getByRole("button", { name: "Google ile devam et" }).click();
  await expect(page).toHaveURL(`${origin}/account`);
  await expect(page.getByRole("heading", { name: "Hesabım", exact: true })).toBeVisible();
  expect(calls.exchange).toBe(1);
});

test("resending confirmation is explicit and does not claim email verification", async ({
  page,
}, testInfo) => {
  const calls = await mockNative(page);
  await page.goto("/verify-email");
  await captureAuth(page, "e03", testInfo);
  expect(calls.resend).toBe(0);
  await page.getByRole("button", { name: "Yeniden gönder" }).click();
  expect(calls.resend).toBe(0);
  await page.getByLabel("E-posta").fill("fixture@example.invalid");
  await page.getByRole("button", { name: "Yeniden gönder" }).click();
  await expect(page.getByRole("status")).toContainText("Uygun bir kayıt varsa");
  await expect(page.getByRole("heading", { name: "E-postan doğrulandı" })).toHaveCount(0);
  expect(calls.resend).toBe(1);
});

test("native TOTP keeps the protected target closed until verification and AAL2 reread", async ({
  page,
}, testInfo) => {
  const calls = await mockNative(page, true);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/mfa");
  await expect(page).toHaveURL(`${origin}/login`);
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/mfa`);
  await page.reload();
  await captureAuth(page, "e06", testInfo);
  expect(calls.account).toBe(0);
  const code = page.getByLabel("Doğrulama kodu");
  await code.fill("000000");
  await code.press("Enter");
  await expect(page.getByText("Kod doğrulanamadı. Güncel kodla yeniden dene.")).toBeVisible();
  await expect(page).toHaveURL(`${origin}/mfa`);
  expect(calls.account).toBe(0);
  await code.fill("123456");
  await code.press("Enter");
  await expect(page).toHaveURL(`${origin}/account`);
  await expect(page.getByRole("heading", { name: "Hesabım", exact: true })).toBeVisible();
  expect(calls.challenge).toBe(2);
  expect(calls.verify).toBe(2);
  expect(calls.account).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("native TOTP enrollment cancels safely then verifies and rereads without repeating the code", async ({
  page,
}, testInfo) => {
  const calls = await mockNative(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/login");
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/account`);
  await page.getByRole("tab", { name: "Güvenlik" }).click();
  await expect(page.getByRole("button", { name: "Kur", exact: true })).toBeVisible();
  await captureAuth(page, "e10-security", testInfo);
  await page.getByRole("button", { name: "Kur", exact: true }).click();
  await expect(page.getByLabel("Uygulamadaki 6 haneli kod")).toBeVisible();
  await captureAuth(page, "e10-totp-dialog", testInfo);
  await page.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(calls.enroll).toBe(1);
  expect(calls.remove).toBe(0);
  await page.getByRole("button", { name: "Kaldır", exact: true }).click();
  expect(calls.remove).toBe(0);
  await page.getByRole("button", { name: "Uygulamayı kaldır", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(calls.remove).toBe(1);
  await page.getByRole("button", { name: "Kur", exact: true }).click();
  await page.getByLabel("Uygulamadaki 6 haneli kod").fill("123456");
  calls.rejectNextAccount = true;
  await page.getByRole("button", { name: "Kodu doğrula", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("İşlem sonrasında güvenlik bilgileri yenilenemedi.")).toBeVisible();
  await expect(page.getByText("Doğrulama uygulaması etkinleştirildi")).toBeVisible();
  await page.getByRole("button", { name: "Yeniden dene", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Güvenlik bilgileri yenilendi.");
  expect(calls.verify).toBe(1);
  expect(calls.enroll).toBe(2);
  await expect(page.getByText("SYNTHETIC-TEST-KEY")).toHaveCount(0);
  await page.reload();
  await page.getByRole("tab", { name: "Güvenlik" }).click();
  await expect(page.getByText("Doğrulanmış uygulama")).toBeVisible();
  expect(errors).toEqual([]);
});

test("session pages preserve provider IDs, label intent retries and selected revocation boundaries", async ({
  page,
}, testInfo) => {
  const calls = await mockNative(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/login");
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/account`);
  await page.getByRole("tab", { name: "Oturumlar", exact: true }).click();
  await expect(page.getByText("Chromium, fixture desktop")).toBeVisible();
  await expect(page.getByRole("button", { name: "Oturumu kapat", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Daha fazla", exact: true }).click();
  await expect(page.getByText("Firefox, fixture phone")).toBeVisible();
  await captureAuth(page, "e10-sessions", testInfo);
  await page
    .getByRole("button", { name: "Firefox, fixture phone etiketini düzenle", exact: true })
    .click();
  await page.getByLabel("Oturum etiketi", { exact: true }).fill("Fixture phone label");
  calls.rejectNextLabel = true;
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(page.getByText("Etiket kaydedilemedi.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Fixture phone label", { exact: true })).toBeVisible();
  expect(calls.labelKeys).toHaveLength(2);
  expect(calls.labelKeys[1]).toBe(calls.labelKeys[0]);
  await page
    .getByRole("button", { name: "Fixture phone label etiketini düzenle", exact: true })
    .click();
  await page.getByLabel("Oturum etiketi", { exact: true }).fill("Conflicting label");
  calls.conflictNextLabel = true;
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("Oturum etiketi başka bir yerde değişti.", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Updated in another tab etiketini düzenle", exact: true })
    .click();
  await expect(page.getByLabel("Oturum etiketi", { exact: true })).toHaveValue(
    "Updated in another tab",
  );
  await page.getByLabel("Oturum etiketi", { exact: true }).fill("Final fixture phone");
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Final fixture phone", { exact: true })).toBeVisible();
  expect(calls.labelKeys).toHaveLength(4);
  expect(calls.labelKeys[3]).not.toBe(calls.labelKeys[2]);
  calls.rejectNextRevoke = true;
  await page.getByRole("button", { name: "Oturumu kapat", exact: true }).click();
  await expect(page.getByText("Oturum kapatma doğrulanamadı.", { exact: false })).toBeVisible();
  await expect(page.getByText("Final fixture phone", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Oturumu kapat", exact: true }).click();
  await expect(page.getByText("Final fixture phone", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Chromium, fixture desktop")).toBeVisible();
  expect(calls.revokeKeys).toHaveLength(2);
  expect(calls.revokeKeys[1]).toBe(calls.revokeKeys[0]);
  expect(errors).toEqual([]);
});

test("fresh native password session is adopted and exact proof survives others retry", async ({
  page,
}, testInfo) => {
  const calls = await mockNative(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/login");
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/account`);
  await page.getByRole("tab", { name: "Oturumlar", exact: true }).click();
  await page.getByRole("button", { name: "Diğerlerini kapat", exact: true }).click();
  await captureAuth(page, "e10-others-fresh", testInfo);
  await page.getByLabel("Parola", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Devam et", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Diğer oturumları kapat", exact: true }),
  ).toBeVisible();
  await captureAuth(page, "e10-others-confirm", testInfo);
  expect(calls.othersKeys).toHaveLength(0);
  calls.rejectNextOthers = true;
  await page.getByRole("button", { name: "Diğer oturumları kapat", exact: true }).click();
  await expect(page.getByText("Oturum kapatma doğrulanamadı.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Diğer oturumları kapat", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Bu cihaz", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Daha fazla", exact: true })).toHaveCount(0);
  expect(calls.othersKeys).toHaveLength(2);
  expect(calls.othersKeys[1]).toBe(calls.othersKeys[0]);
  expect(calls.othersProofs[1]).toBe(calls.othersProofs[0]);
  expect(errors).toEqual([]);
});

test("fresh password requiring TOTP uses the canonical MFA route before others confirmation", async ({
  page,
}) => {
  const calls = await mockNative(page, true);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/login");
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/mfa`);
  await page.getByLabel("Doğrulama kodu").fill("123456");
  await page.getByRole("button", { name: "Doğrula", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/account`);
  await page.getByRole("tab", { name: "Oturumlar", exact: true }).click();
  await page.getByRole("button", { name: "Diğerlerini kapat", exact: true }).click();
  await page.getByLabel("Parola", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Devam et", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/mfa`);
  expect(calls.othersKeys).toHaveLength(0);
  await page.getByLabel("Doğrulama kodu").fill("123456");
  await page.getByRole("button", { name: "Doğrula", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/account`);
  await page.getByRole("tab", { name: "Oturumlar", exact: true }).click();
  await page.getByRole("button", { name: "Diğerlerini kapat", exact: true }).click();
  await page.getByRole("button", { name: "Yeni giriş yaptım", exact: true }).click();
  await page.getByRole("button", { name: "Diğer oturumları kapat", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(calls.othersKeys).toHaveLength(1);
  expect(errors).toEqual([]);
});

test("profile uses management versions, preserves conflicting drafts and retries reads after a confirmed write", async ({
  page,
}, testInfo) => {
  const calls = await mockNative(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/login");
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/account`);
  const name = page.getByLabel("Görünen ad", { exact: true });
  await expect(name).toHaveValue("Fixture Account");
  await captureAuth(page, "e10-profile-text", testInfo);
  await name.fill("First draft");
  calls.rejectNextProfile = true;
  await page.getByRole("button", { name: "Değişiklikleri kaydet", exact: true }).click();
  await expect(page.getByText("Kaydetme doğrulanamadı.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Değişiklikleri kaydet", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Değişiklikler kaydedildi.");
  expect(calls.profileKeys[1]).toBe(calls.profileKeys[0]);
  await name.fill("Conflicting draft");
  calls.conflictNextProfile = true;
  await page.getByRole("button", { name: "Değişiklikleri kaydet", exact: true }).click();
  await expect(page.getByText("Profil başka bir yerde değişti.", { exact: false })).toBeVisible();
  await expect(name).toHaveValue("Conflicting draft");
  await page.getByRole("button", { name: "Güncel verileri yükle", exact: true }).click();
  await expect(name).toHaveValue("Remote profile");
  await name.fill("Final draft");
  calls.blockProfileReads = true;
  await page.getByRole("button", { name: "Değişiklikleri kaydet", exact: true }).click();
  await expect(page.getByText("Profil kaydedildi. Güncel bilgiler yenilenemedi.")).toBeVisible();
  await expect(name).toBeDisabled();
  const writes = calls.profileKeys.length;
  calls.blockProfileReads = false;
  await page.getByRole("button", { name: "Yeniden dene", exact: true }).click();
  await expect(name).toBeEnabled();
  await expect(name).toHaveValue("Final draft");
  expect(calls.profileKeys).toHaveLength(writes);
  await page.reload();
  await expect(name).toHaveValue("Final draft");
  await expect(page.getByLabel("E-posta", { exact: false })).toHaveValue("fixture@example.invalid");
  expect(errors).toEqual([]);
});

test("private photo stays a profile draft until save, reloads through authenticated media and removes explicitly", async ({
  page,
}, testInfo) => {
  const calls = await mockNative(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/login");
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/account`);
  const file = page.locator('input[type="file"]');
  await file.setInputFiles({
    name: "invalid.png",
    mimeType: "image/png",
    buffer: Buffer.from("invalid image"),
  });
  await expect(page.getByText("Fotoğraf okunamadı. Geçerli bir görsel seç.")).toBeVisible();
  expect(calls.photoWrites).toHaveLength(0);
  await file.setInputFiles("e2e/fixtures/profile-photo.png");
  const image = page.locator('[data-slot="avatar-image"]');
  await expect(image).toHaveAttribute("data-state", "loaded");
  expect(calls.photoWrites).toHaveLength(0);
  await page.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await expect(image).toHaveCount(0);
  await file.setInputFiles("e2e/fixtures/profile-photo.png");
  await expect(image).toHaveAttribute("data-state", "loaded");
  await page.getByLabel("Ad", { exact: true }).fill("Photo draft");
  calls.rejectNextProfile = true;
  await page.getByRole("button", { name: "Değişiklikleri kaydet", exact: true }).click();
  await expect(page.getByText("Kaydetme doğrulanamadı.", { exact: false })).toBeVisible();
  await expect(image).toHaveAttribute("data-state", "loaded");
  await page.getByRole("button", { name: "Değişiklikleri kaydet", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Değişiklikler kaydedildi.");
  await expect(image).toHaveAttribute("data-state", "loaded");
  expect(calls.profileKeys[1]).toBe(calls.profileKeys[0]);
  await page.reload();
  await expect(image).toHaveAttribute("data-state", "loaded");
  await expect(page.getByLabel("Ad", { exact: true })).toHaveValue("Photo draft");
  expect(calls.mediaReads).toBeGreaterThan(0);
  await captureAuth(page, "e10-profile-photo", testInfo);
  calls.rejectNextMedia = true;
  await page.reload();
  await expect(page.getByText("Profil fotoğrafı okunamadı.", { exact: false })).toBeVisible();
  await expect(image).toHaveCount(0);
  await page.getByRole("button", { name: "Yeniden dene", exact: true }).click();
  await expect(image).toHaveAttribute("data-state", "loaded");
  await page.getByRole("button", { name: "Kaldır", exact: true }).click();
  await expect(image).toHaveCount(0);
  expect(calls.photoWrites).toHaveLength(1);
  await page.getByRole("button", { name: "Değişiklikleri kaydet", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Değişiklikler kaydedildi.");
  await page.reload();
  await expect(image).toHaveCount(0);
  expect(calls.photoWrites[1]).toBeNull();
  expect(errors).toEqual([]);
});

test("account password change handles native current-password and old-session nonce errors without automatic mail", async ({
  page,
}, testInfo) => {
  const calls = await mockNative(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/login");
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/account`);
  await page.getByRole("tab", { name: "Güvenlik", exact: true }).click();
  await page.getByRole("button", { name: "Parolayı değiştir", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const submit = dialog.getByRole("button", { name: "Parolayı değiştir", exact: true });
  await captureAuth(page, "e10-password-sheet", testInfo);
  await page.getByLabel("Mevcut parola", { exact: true }).fill("fixture-current-password");
  await page.getByLabel("Yeni parola", { exact: true }).fill("fixture-new-password");
  await page.getByLabel("Yeni parola tekrar", { exact: true }).fill("mismatch");
  await page.getByLabel("Yeni parola tekrar", { exact: true }).press("Tab");
  await expect(submit).toBeDisabled();
  await expect(page.getByText("Parolalar eşleşmiyor.")).toBeVisible();
  expect(calls.password).toBe(0);
  await page.getByLabel("Yeni parola tekrar", { exact: true }).fill("fixture-new-password");
  calls.rejectCurrentPassword = true;
  await submit.click();
  await expect(page.getByText("Mevcut parola eksik veya hatalı.", { exact: false })).toBeVisible();
  expect(calls.passwordCodeSends).toBe(0);
  calls.passwordNeedsCode = true;
  await submit.click();
  await expect(page.getByLabel("Güvenlik kodu", { exact: true })).toBeVisible();
  expect(calls.passwordCodeSends).toBe(0);
  await page.getByRole("button", { name: "Kod gönder", exact: true }).click();
  await expect(page.getByText("Kod gönderme isteği kabul edildi. Gelen kodu yaz.")).toBeVisible();
  await page.getByLabel("Güvenlik kodu", { exact: true }).fill("invalid-nonce");
  calls.rejectPasswordCode = true;
  await submit.click();
  await expect(
    page.getByText("Kod geçersiz, süresi dolmuş veya kullanılmış. Yeni kod iste."),
  ).toBeVisible();
  await expect(page.getByLabel("Güvenlik kodu", { exact: true })).toHaveValue("");
  expect(calls.passwordCodeSends).toBe(1);
  await page.getByRole("button", { name: "Kod gönder", exact: true }).click();
  await page.getByLabel("Güvenlik kodu", { exact: true }).fill("valid-nonce");
  await submit.click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(`${origin}/account`);
  await page.getByRole("tab", { name: "Oturumlar", exact: true }).click();
  await expect(page.getByText("Bu cihaz", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Daha fazla", exact: true })).toHaveCount(0);
  expect(calls.passwordCodeSends).toBe(2);
  expect(errors).toEqual([]);
});

test("native Google linking returns through the existing callback and selected unlink keeps a truthful read-error state", async ({
  page,
}, testInfo) => {
  const calls = await mockNative(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/login");
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/account`);
  await page.getByRole("tab", { name: "Güvenlik", exact: true }).click();
  calls.rejectNextIdentityLink = true;
  await page.getByRole("button", { name: "Google ile bağla", exact: true }).click();
  await expect(
    page.getByText("Google hesabı bağlama başlatılamadı.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Yeniden dene", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/account`);
  await page.getByRole("tab", { name: "Güvenlik", exact: true }).click();
  await expect(page.getByText("google@example.invalid", { exact: true })).toBeVisible();
  expect(calls.identityLink).toBe(2);
  expect(calls.exchange).toBe(2);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Bağlantıyı kaldır", exact: true }).hover();
  await captureAuth(page, "e10-google-linked", testInfo);
  await page.getByRole("button", { name: "Bağlantıyı kaldır", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByText("google@example.invalid", { exact: false }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Google bağlantısını kaldır", exact: true })
    .hover();
  await captureAuth(page, "e10-google-unlink", testInfo);
  await page.getByRole("button", { name: "Vazgeç", exact: true }).click();
  expect(calls.identityUnlink).toBe(0);
  await page.getByRole("button", { name: "Bağlantıyı kaldır", exact: true }).click();
  calls.rejectNextIdentityUnlink = true;
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Google bağlantısını kaldır", exact: true })
    .click();
  await expect(page.getByText("Bağlantı kaldırma doğrulanamadı.", { exact: false })).toBeVisible();
  calls.blockIdentityReads = true;
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Google bağlantısını kaldır", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Bağlı giriş yöntemleri okunamadı.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Google ile bağla", exact: true })).toBeDisabled();
  await expect(page.getByText("Bağlı", { exact: true })).toHaveCount(0);
  const removals = calls.identityUnlink;
  calls.blockIdentityReads = false;
  await page
    .getByRole("alert")
    .filter({ hasText: "Bağlı giriş yöntemleri okunamadı." })
    .getByRole("button", { name: "Yeniden dene", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "Google ile bağla", exact: true })).toBeEnabled();
  expect(calls.identityUnlink).toBe(removals);
  calls.identityEmail = `${"a".repeat(63)}@${"b".repeat(50)}.example.invalid`;
  calls.onlyGoogleIdentity = true;
  await page.reload();
  await page.getByRole("tab", { name: "Güvenlik", exact: true }).click();
  await expect(page.getByRole("button", { name: "Bağlantıyı kaldır", exact: true })).toBeDisabled();
  await captureAuth(page, "e10-google-last-long-email", testInfo);
  expect(errors).toEqual([]);
});

test("native email request preserves profile drafts and separates pending/no-code confirmation from a completed PKCE exchange", async ({
  page,
}, testInfo) => {
  const calls = await mockNative(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/login");
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/account`);
  await page.getByLabel("Görünen ad", { exact: true }).fill("Unsaved profile draft");
  await page.getByRole("button", { name: "E-postayı değiştir", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const request = dialog.getByRole("button", { name: "Değişim isteği gönder", exact: true });
  await expect(page.getByLabel("Güncel e-posta", { exact: true })).toHaveValue(
    "fixture@example.invalid",
  );
  await captureAuth(page, "e10-email-new", testInfo);
  await page.getByLabel("Yeni e-posta", { exact: true }).fill("invalid");
  await request.click();
  await expect(page.getByText("Geçerli bir e-posta adresi gir.")).toBeVisible();
  expect(calls.emailUpdate).toBe(0);
  await page.getByLabel("Yeni e-posta", { exact: true }).fill("next@example.invalid");
  calls.rejectNextEmailUpdate = true;
  await request.click();
  await expect(page.getByText("E-posta işlemi doğrulanamadı.", { exact: false })).toBeVisible();
  await expect(page.getByLabel("Yeni e-posta", { exact: true })).toHaveValue(
    "next@example.invalid",
  );
  await expect(request).toBeEnabled();
  calls.blockProfileReads = true;
  await request.click();
  await expect(page.getByText("İstek işlendi. Güncel hesap bilgileri yenilenemedi.")).toBeVisible();
  await expect(request).toBeDisabled();
  const writes = calls.emailUpdate;
  calls.blockProfileReads = false;
  await dialog.getByRole("button", { name: "Yeniden dene", exact: true }).click();
  await expect(page.getByLabel("Güncel e-posta", { exact: true })).toHaveValue(
    "fixture@example.invalid",
  );
  await expect(page.getByLabel("Bekleyen e-posta", { exact: true })).toHaveValue(
    "next@example.invalid",
  );
  expect(calls.emailUpdate).toBe(writes);
  await captureAuth(page, "e10-email-pending", testInfo);
  await dialog.getByRole("button", { name: "Bekleyen adrese yeniden gönder", exact: true }).click();
  await expect(
    page.getByText("Yeniden gönderme isteği işlendi. Onay iletisini kontrol et."),
  ).toBeVisible();
  expect(calls.emailResend).toBe(1);
  await dialog.getByLabel("Kapat", { exact: true }).click();
  await expect(page.getByLabel("Görünen ad", { exact: true })).toHaveValue("Unsaved profile draft");
  expect(calls.profileKeys).toHaveLength(0);
  await page.goto("/auth/callback?message=email_change_confirmation_sent");
  await expect(page).toHaveURL(`${origin}/auth/callback`);
  await expect(page.getByRole("heading", { name: "Hesap doğrulaması" })).toBeVisible();
  expect(calls.exchange).toBe(1);
  await captureAuth(page, "e10-email-no-code", testInfo);
  await page.getByRole("link", { name: "Hesabım", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/account`);
  await expect(page.getByLabel("E-posta", { exact: false })).toHaveValue("fixture@example.invalid");
  calls.completeEmailChangeOnExchange = true;
  await page.goto("/auth/callback?code=fixture-email-approved");
  await expect(page).toHaveURL(`${origin}/account`);
  await expect(page.getByLabel("E-posta", { exact: false })).toHaveValue("next@example.invalid");
  expect(calls.exchange).toBe(2);
  await page.getByRole("button", { name: "E-postayı değiştir", exact: true }).click();
  await expect(page.getByLabel("Güncel e-posta", { exact: true })).toHaveValue(
    "next@example.invalid",
  );
  await expect(page.getByLabel("Bekleyen e-posta", { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("account theme uses versioned user settings, exact retry and read-only recovery while preserving profile drafts", async ({
  page,
}, testInfo) => {
  const calls = await mockNative(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/login");
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/account`);
  const dark = page.getByRole("radio", { name: "Koyu", exact: true });
  const light = page.getByRole("radio", { name: "Açık", exact: true });
  const system = page.getByRole("radio", { name: "Sistem", exact: true });
  await expect(system).toHaveAttribute("aria-checked", "true");
  await page.getByLabel("Görünen ad", { exact: true }).fill("Unsaved appearance draft");
  calls.rejectNextSettings = true;
  let releaseWrite: () => void = () => {
    throw new Error("Write gate not initialized");
  };
  calls.settingsWriteGate = new Promise<void>((resolve) => {
    releaseWrite = resolve;
  });
  await dark.click();
  await expect.poll(() => calls.settingsKeys.length).toBe(1);
  await page.getByRole("tab", { name: "Güvenlik", exact: true }).click();
  await expect(page.getByRole("radiogroup", { name: "Tema" })).not.toBeVisible();
  await page.getByRole("tab", { name: "Profil", exact: true }).click();
  await expect(dark).toBeDisabled();
  expect(calls.settingsKeys).toHaveLength(1);
  releaseWrite();
  await expect(
    page.getByRole("button", { name: "Aynı isteği yeniden dene", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Güvenlik", exact: true }).click();
  await page.getByRole("tab", { name: "Profil", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Aynı isteği yeniden dene", exact: true }),
  ).toBeVisible();
  await expect(light).toBeDisabled();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "system");
  await page.getByRole("button", { name: "Aynı isteği yeniden dene", exact: true }).click();
  await expect(page.getByText("Görünüm tercihi kaydedildi.")).toBeVisible();
  expect(calls.settingsKeys[1]).toBe(calls.settingsKeys[0]);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByLabel("Görünen ad", { exact: true })).toHaveValue(
    "Unsaved appearance draft",
  );
  expect(calls.profileKeys).toHaveLength(0);
  calls.conflictNextSettings = true;
  await light.click();
  await expect(page.getByText("Tercih başka bir işlemle değişti.", { exact: false })).toBeVisible();
  await expect(dark).toBeDisabled();
  await page.getByRole("button", { name: "Güncel tercihi yükle", exact: true }).click();
  await expect(dark).toBeEnabled();
  await dark.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(calls.settingsKeys[3]).not.toBe(calls.settingsKeys[2]);
  calls.blockSettingsReads = true;
  await light.click();
  await expect(page.getByText("Tercih kaydedildi. Güncel görünüm okunamadı.")).toBeVisible();
  await expect(dark).toBeDisabled();
  await expect(page.getByRole("button", { name: "Yeniden dene", exact: true })).toBeEnabled();
  const writes = calls.settingsKeys.length;
  calls.blockSettingsReads = false;
  await page.getByRole("button", { name: "Yeniden dene", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(calls.settingsKeys).toHaveLength(writes);
  await page.reload();
  await expect(light).toHaveAttribute("aria-checked", "true");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await system.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "system");
  await page.reload();
  await expect(system).toBeChecked();
  await system.scrollIntoViewIfNeeded();
  await captureAuth(
    page,
    "e10-appearance-theme",
    testInfo,
    page
      .locator('[data-slot="card"]')
      .filter({ has: page.getByRole("heading", { name: "Görünüm", exact: true }) }),
  );
  await page.getByRole("tab", { name: "Güvenlik", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "system");
  await page.getByRole("button", { name: "Çıkış yap", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/login`);
  await expect(page.locator("html")).not.toHaveAttribute("data-theme");
  expect(errors).toEqual([]);
});

test("font scale preserves exact pending intents, system choice, keyboard access and reflow at 200 percent", async ({
  page,
}, testInfo) => {
  const calls = await mockNative(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/login");
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/account`);
  const scale = page.getByRole("combobox", { name: "Ölçek", exact: true });
  await expect(scale).toHaveValue("system");
  await scale.focus();
  await expect(scale).toBeFocused();
  calls.rejectNextSettings = true;
  await scale.selectOption("1.25");
  await expect(
    page.getByRole("button", { name: "Aynı isteği yeniden dene", exact: true }),
  ).toBeVisible();
  await expect(scale).toBeDisabled();
  await page.getByRole("tab", { name: "Güvenlik", exact: true }).click();
  await page.getByRole("tab", { name: "Profil", exact: true }).click();
  await page.getByRole("button", { name: "Aynı isteği yeniden dene", exact: true }).click();
  await expect(page.locator("html")).toHaveCSS("zoom", "1.25");
  expect(calls.settingsKeys[1]).toBe(calls.settingsKeys[0]);
  expect(calls.settingsPatches[1]).toEqual({ font_scale: 1.25 });
  expect(calls.settingsPatches[0]).toEqual(calls.settingsPatches[1]);
  await page.reload();
  await expect(scale).toHaveValue("1.25");
  await expect(page.locator("html")).toHaveCSS("zoom", "1.25");
  await scale.selectOption("2");
  await expect(page.locator("html")).toHaveCSS("zoom", "2");
  await expect(scale).toBeEnabled();
  await captureAuth(
    page,
    "e10-appearance-scale-200",
    testInfo,
    page
      .locator('[data-slot="card"]')
      .filter({ has: page.getByRole("heading", { name: "Görünüm", exact: true }) }),
  );
  await page.getByRole("button", { name: "E-postayı değiştir", exact: true }).click();
  const emailDialog = page.getByRole("dialog");
  await expect(emailDialog.getByLabel("Yeni e-posta", { exact: true })).toBeVisible();
  expect((await scanAccessibility(page, "email-sheet-200-percent")).violations).toEqual([]);
  const dialogBounds = await emailDialog.boundingBox();
  expect(dialogBounds).not.toBeNull();
  expect(dialogBounds!.x).toBeGreaterThanOrEqual(0);
  expect(dialogBounds!.x + dialogBounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.screenshot({ path: ".tmp/e10-appearance-scale-sheet-200-390-dark.png" });
  await emailDialog.getByLabel("Kapat", { exact: true }).click();
  await scale.focus();
  await expect(scale).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("radio", { name: "Koyu", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(scale).toBeFocused();
  const focusedBounds = await scale.boundingBox();
  expect(focusedBounds).not.toBeNull();
  expect(focusedBounds!.x).toBeGreaterThanOrEqual(0);
  expect(focusedBounds!.y).toBeGreaterThanOrEqual(0);
  expect(focusedBounds!.x + focusedBounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(focusedBounds!.y + focusedBounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  // Native OS option menus are not driven by Chromium keyboard events on macOS.
  // The SDK-recommended selection API tests the write; native menu keyboard acceptance stays separate.
  await scale.selectOption("1.5");
  await expect(scale).toHaveValue("1.5");
  await expect(page.locator("html")).toHaveCSS("zoom", "1.5");
  await expect(scale).toBeEnabled();
  await expect(scale).toBeFocused();
  calls.blockSettingsReads = true;
  await scale.selectOption("system");
  await expect(page.getByText("Tercih kaydedildi. Güncel görünüm okunamadı.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Yeniden dene", exact: true })).toBeEnabled();
  const writes = calls.settingsKeys.length;
  calls.blockSettingsReads = false;
  await page.getByRole("button", { name: "Yeniden dene", exact: true }).click();
  await expect(scale).toHaveValue("system");
  await expect(page.locator("html")).toHaveCSS("zoom", "1");
  expect(calls.settingsKeys).toHaveLength(writes);
  expect(calls.settingsPatches.at(-1)).toEqual({ font_scale: null });
  await captureAuth(
    page,
    "e10-appearance-scale-system",
    testInfo,
    page
      .locator('[data-slot="card"]')
      .filter({ has: page.getByRole("heading", { name: "Görünüm", exact: true }) }),
  );
  await page.getByRole("button", { name: "Çıkış yap", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/login`);
  await expect(page.locator("html")).not.toHaveAttribute("data-theme");
  expect(await page.locator("html").evaluate((element) => element.style.zoom)).toBe("");
  expect(errors).toEqual([]);
});

test("minimum saved font scale and 320 CSS pixel reflow keep the same WCAG 2.2 AA checks", async ({
  page,
}, testInfo) => {
  const calls = await mockNative(page);
  calls.fontScale = 0.75;
  await page.goto("/login");
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  const scale = page.getByRole("combobox", { name: "Ölçek", exact: true });
  await expect(scale).toHaveValue("0.75");
  await expect(page.locator("html")).toHaveCSS("zoom", "0.75");
  await captureAuth(
    page,
    "e10-appearance-scale-75",
    testInfo,
    page
      .locator('[data-slot="card"]')
      .filter({ has: page.getByRole("heading", { name: "Görünüm", exact: true }) }),
  );
  await scale.selectOption("system");
  await expect(page.locator("html")).toHaveCSS("zoom", "1");
  await expect(scale).toBeEnabled();
  await page.setViewportSize({ width: 320, height: 844 });
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    expect((await scanAccessibility(page, "account-320-reflow")).violations).toEqual([]);
    expect(await page.evaluate("document.documentElement.scrollWidth > innerWidth")).toBe(false);
    await page.screenshot({
      path: `.tmp/e10-appearance-reflow-320-${colorScheme}.png`,
      fullPage: true,
    });
  }
  expect(calls.settingsPatches).toEqual([{ font_scale: null }]);
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`verification validation and explicit retry after rate limit ${colorScheme}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme });
    await mockNative(page);
    let attempts = 0;
    await page.route("**/auth/v1/resend*", async (route) => {
      attempts++;
      expect(route.request().postDataJSON()).toMatchObject({
        type: "signup",
        email: "fixture@example.invalid",
      });
      if (attempts === 1) {
        return route.fulfill({
          status: 429,
          json: { code: "over_email_send_rate_limit", msg: "Rate limit exceeded" },
        });
      }
      return route.fulfill({ json: {} });
    });
    await page.goto("/verify-email");
    const resend = page.getByRole("button", { name: "Yeniden gönder" });
    await resend.click();
    const email = page.getByLabel("E-posta");
    await email.fill("invalid");
    await resend.click();
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await expect(email).toHaveAccessibleDescription("Geçerli bir e-posta adresi gir.");
    expect(attempts).toBe(0);
    await email.fill("fixture@example.invalid");
    await resend.click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(email).toHaveValue("fixture@example.invalid");
    expect(attempts).toBe(1);
    expect((await scanAccessibility(page, "verification-rate-limit")).violations).toEqual([]);
    await expect(resend).toBeEnabled();
    await resend.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status")).toContainText("Uygun bir kayıt varsa");
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(email).toHaveValue("fixture@example.invalid");
    expect(attempts).toBe(2);
    expect((await scanAccessibility(page, "verification-retry-result")).violations).toEqual([]);
  });
}

test("signup validates policy, stops existing accounts and requests native confirmation once", async ({
  page,
}, testInfo) => {
  await mockNative(page);
  let status = "account_exists";
  let checks = 0;
  let signups = 0;
  await page.route("**/api/auth/signup-check", async (route) => {
    checks++;
    expect(route.request().postDataJSON()).toMatchObject({
      client_api_version: 1,
      email: "signup@example.invalid",
    });
    expect(route.request().headers()["authorization"]).toBeUndefined();
    if (status === "temporary")
      return route.fulfill({
        status: 503,
        json: {
          ok: false,
          error: {
            code: "SERVICE_UNAVAILABLE",
            retryable: true,
            trace_id: "019a7fd0-0000-7000-8000-000000000001",
          },
        } satisfies FailureEnvelope,
      });
    return route.fulfill({ json: { ok: true, data: { status }, trace_id: "signup-trace" } });
  });
  await page.route("**/auth/v1/signup*", async (route) => {
    signups++;
    expect(route.request().postDataJSON()).toMatchObject({
      email: "signup@example.invalid",
      password: "Fixture123",
      data: { display_name: "Test Student" },
    });
    return route.fulfill({
      json: {
        user: {
          id: "00000000-0000-4000-8000-000000000001",
          aud: "authenticated",
          email: "signup@example.invalid",
          identities: [{ provider: "email" }],
          created_at: "2026-11-14T00:00:00Z",
        },
        session: null,
      },
    });
  });
  await page.goto("/signup");
  await captureAuth(page, "e02", testInfo);
  await page.getByLabel("Ad soyad", { exact: true }).fill("Test Student");
  await page.getByLabel("E-posta", { exact: true }).fill("signup@example.invalid");
  const password = page.getByLabel("Parola", { exact: true });
  const submit = page.getByRole("button", { name: "Hesap oluştur", exact: true });
  await page.getByLabel("Parola tekrar", { exact: true }).fill("Fixture123");
  await password.fill("weak");
  await submit.click();
  await expect(password).toHaveJSProperty(
    "validationMessage",
    "En az 8 karakter, büyük harf, küçük harf ve sayı içerir.",
  );
  expect(checks).toBe(0);
  await password.fill("Fixture123");
  await page.getByLabel("Parola tekrar", { exact: true }).fill("different");
  await submit.click();
  await expect(page.getByLabel("Parola tekrar", { exact: true })).toHaveJSProperty(
    "validationMessage",
    "Parolalar eşleşmiyor.",
  );
  expect(checks).toBe(0);
  await page.getByLabel("Parola tekrar", { exact: true }).fill("Fixture123");
  await submit.click();
  await expect(page.getByRole("alert")).toContainText(
    "Bu e-posta adresiyle ilişkili bir hesap zaten var.",
  );
  expect(checks).toBe(1);
  expect(signups).toBe(0);
  expect((await scanAccessibility(page, "signup-existing-account")).violations).toEqual([]);
  status = "temporary";
  await submit.click();
  await expect(page.getByRole("alert")).toContainText("Kayıt tamamlanamadı");
  expect(checks).toBe(2);
  expect(signups).toBe(0);
  status = "available";
  await submit.click();
  await expect(page).toHaveURL(`${origin}/verify-email`);
  await expect(page.getByRole("heading", { name: "E-postanı doğrula" })).toBeVisible();
  expect(checks).toBe(3);
  expect(signups).toBe(1);
});

test("signup Google uses shared OAuth without submitting password registration", async ({
  page,
}) => {
  const calls = await mockNative(page);
  let signups = 0;
  await page.route("**/auth/v1/signup*", async (route) => {
    signups++;
    return route.fulfill({ json: {} });
  });
  await page.goto("/signup");
  await page.getByRole("button", { name: "Google ile kayıt ol" }).click();
  await expect(page).toHaveURL(`${origin}/account`);
  await expect(page.getByRole("heading", { name: "Hesabım", exact: true })).toBeVisible();
  expect(calls.exchange).toBe(1);
  expect(signups).toBe(0);
  expect(calls.resend).toBe(0);
});
