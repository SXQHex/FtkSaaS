import { test, expect } from "@playwright/test";
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
