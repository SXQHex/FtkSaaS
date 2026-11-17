import { test, expect } from "./test.js";
import { prepareApplication, fillApplication } from "./public-application-fixture.js";
import { publicForm } from "./public-calendar-fixture.js";
const submit = "Başvuruyu gönder";
test("open bound form displays actual source, follows native contact rules, sends anonymous form branch and offers a real new application", async ({
  page,
}) => {
  const f = await prepareApplication(page);
  await page.goto(`/public/test-studio/apply?center_id=${publicForm.form_id}`);
  await expect(page.getByText("Yayımlanmış örnek koşullar.", { exact: true })).toBeVisible();
  await fillApplication(page);
  await page.getByRole("button", { name: submit, exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Başvurun iletildi.", exact: true }),
  ).toBeVisible();
  expect(f.mutations).toHaveLength(1);
  expect(f.mutations[0]).toMatchObject({
    form_id: publicForm.form_id,
    center_id: publicForm.form_id,
    contact_intake: {
      display_name: "Örnek Aday",
      email: "candidate@example.test",
      interest: "Tango",
      consents: [{ purpose: "participation", version: "v1", accepted: true }],
    },
  });
  expect(f.mutations[0]).not.toHaveProperty("publication_id");
  expect(f.mutations[0]).not.toHaveProperty("contact");
  expect(f.mutations[0]).not.toHaveProperty("intake");
  await page.getByRole("button", { name: "Yeni başvuru", exact: true }).click();
  await expect(page.getByLabel("Ad soyad (zorunlu)", { exact: true })).toHaveValue("");
  await expect(page.getByRole("link", { name: "Program", exact: true })).toHaveAttribute(
    "href",
    `/public/test-studio/calendar?center_id=${publicForm.form_id}`,
  );
});
test("invalid native fields and missing contact or proof never dispatch; errors appear after interaction", async ({
  page,
}) => {
  const f = await prepareApplication(page);
  await page.goto("/public/test-studio/apply");
  await expect(page.locator('[aria-invalid="true"]')).toHaveCount(0);
  await page.getByRole("button", { name: submit, exact: true }).click();
  await expect(page.getByLabel("Ad soyad (zorunlu)", { exact: true })).toBeFocused();
  expect(f.mutations).toHaveLength(0);
  await fillApplication(page);
  await page.getByLabel("E-posta", { exact: true }).fill("");
  await page.getByRole("button", { name: submit, exact: true }).click();
  await expect(
    page.getByText("E-posta veya telefondan en az birini gir.", { exact: true }),
  ).toBeVisible();
  expect(f.mutations).toHaveLength(0);
  await page.getByLabel("E-posta", { exact: true }).fill("candidate@example.test");
  await page.getByRole("button", { name: "Doğrulamayı yenile", exact: true }).click();
  await page.getByRole("button", { name: submit, exact: true }).click();
  await expect(page.getByText("Güvenlik doğrulamasını tamamla.", { exact: true })).toBeVisible();
  expect(f.mutations).toHaveLength(0);
});
test("timeout freezes the submitted intent and retries same key, payload and consent timestamp with fresh proof", async ({
  page,
}) => {
  const f = await prepareApplication(page);
  f.setResponse("abort");
  await page.goto("/public/test-studio/apply");
  await fillApplication(page);
  await page.getByRole("button", { name: submit, exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Aynı başvuruyu yeniden dene", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Ad soyad (zorunlu)", { exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Test doğrulamasını tamamla", exact: true }).click();
  await page.getByRole("button", { name: "Aynı başvuruyu yeniden dene", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Başvurun iletildi.", exact: true }),
  ).toBeVisible();
  expect(f.mutations).toHaveLength(2);
  expect(f.mutations[1]!.client_request_key).toBe(f.mutations[0]!.client_request_key);
  expect(f.mutations[1]!.contact_intake).toEqual(f.mutations[0]!.contact_intake);
  expect(f.mutations[1]!.request_id).not.toBe(f.mutations[0]!.request_id);
  expect(f.mutations[1]!.bot_proof).not.toBe(f.mutations[0]!.bot_proof);
});
test("expired operation receipt stays uncertain instead of allowing a fresh duplicate application", async ({
  page,
}) => {
  const f = await prepareApplication(page);
  f.setResponse("expired");
  await page.goto("/public/test-studio/apply");
  await fillApplication(page);
  await page.getByRole("button", { name: submit, exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Aynı başvuruyu yeniden dene", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Ad soyad (zorunlu)", { exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Yeniden yükle", exact: true })).toHaveCount(0);
});
test("real source required extras and phone-only requirement are represented without invented selectors", async ({
  page,
}) => {
  const f = await prepareApplication(page);
  f.packet.application = {
    state: "open",
    form: {
      ...publicForm,
      contact_requirement: "phone",
      required_fields: ["partner_name", "mode", "level", "message"],
      consents: [
        publicForm.consents[0]!,
        {
          ...publicForm.consents[0]!,
          purpose: "optional",
          required: false,
          content: { ...publicForm.consents[0]!.content, name: "İsteğe bağlı onay" },
        },
      ],
    },
  };
  await page.goto("/public/test-studio/apply");
  await expect(page.getByLabel("Telefon", { exact: true })).toHaveAttribute("required", "");
  await fillApplication(page);
  await page.getByLabel("Telefon", { exact: true }).fill("+905550000000");
  await page.getByLabel("Partner adı (zorunlu)", { exact: true }).fill("Örnek Partner");
  await page.getByLabel("Ders biçimi (zorunlu)", { exact: true }).fill("Özel ders");
  await page.getByLabel("Seviye (zorunlu)", { exact: true }).fill("Başlangıç");
  await page.getByLabel("Mesaj", { exact: true }).fill("Başlangıç grubu");
  await page.getByRole("button", { name: submit, exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Başvurun iletildi.", exact: true }),
  ).toBeVisible();
  expect(f.mutations[0]).toMatchObject({
    contact_intake: {
      phone: "+905550000000",
      partner_name: "Örnek Partner",
      mode: "Özel ders",
      level: "Başlangıç",
      consents: [{ accepted: true }, { purpose: "optional", accepted: false }],
    },
  });
});
test("provider error and expiry clear proof; official widget is compact and uses the required action", async ({
  page,
}) => {
  const f = await prepareApplication(page);
  await page.goto("/public/test-studio/apply");
  await fillApplication(page);
  const config = await page.evaluate(() => {
    const w = globalThis as unknown as { __widget: Record<string, unknown> };
    return {
      action: w.__widget.action,
      size: w.__widget.size,
      responseField: w.__widget["response-field"],
    };
  });
  expect(config).toEqual({ action: "public_application", size: "compact", responseField: false });
  await page.evaluate(() => {
    const w = globalThis as unknown as { __widget: Record<string, () => void> };
    w.__widget["expired-callback"]!();
  });
  await page.getByRole("button", { name: submit, exact: true }).click();
  await expect(page.getByText("Güvenlik doğrulamasını tamamla.", { exact: true })).toBeVisible();
  expect(f.mutations).toHaveLength(0);
});
test("unavailable binding never collects data and source errors are retryable without fake closed success", async ({
  page,
}) => {
  const f = await prepareApplication(page, "unavailable");
  await page.goto("/public/test-studio/apply");
  await expect(page.getByRole("button", { name: submit, exact: true })).toBeDisabled();
  await expect(page.getByLabel("Ad soyad (zorunlu)", { exact: true })).toBeDisabled();
  expect(f.mutations).toHaveLength(0);
  f.setFailure(true);
  await page.reload();
  await expect(
    page.getByText("Başvuru bilgisi okunamadı. Yeniden dene.", { exact: true }),
  ).toBeVisible();
  expect(f.mutations).toHaveLength(0);
});
test("long source is readable as plain text and wraps at320px; script text never executes", async ({
  page,
}) => {
  const f = await prepareApplication(page);
  const discovered = f.packet.application?.form;
  if (!discovered) throw new Error("Missing form");
  discovered.consents[0].content.text =
    "<script>globalThis.publicInjected=true</script>" + "UzunOnayİçeriği".repeat(180);
  discovered.consents[0].content.name = "UzunOnayBaşlığı".repeat(12);
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/public/test-studio/apply");
  await page.evaluate(() => {
    (
      globalThis as unknown as {
        document: { documentElement: { classList: { add: (x: string) => void } } };
      }
    ).document.documentElement.classList.add("dark");
  });
  await expect(page.getByRole("region")).toContainText("<script>");
  expect(
    await page.evaluate(
      () => (globalThis as unknown as { publicInjected?: boolean }).publicInjected,
    ),
  ).toBeUndefined();
  await page.getByRole("region").focus();
  await expect(page.getByRole("region")).toBeFocused();
  expect(f.mutations).toHaveLength(0);
});
test("provider rejection keeps false success hidden and reopens only a freshly read source", async ({
  page,
}) => {
  const f = await prepareApplication(page);
  f.setResponse("bot");
  await page.goto("/public/test-studio/apply");
  await fillApplication(page);
  await page.getByRole("button", { name: submit, exact: true }).click();
  await expect(
    page.getByText(
      "Başvuru kabul edilmedi. Formu yeniden yükleyip güncel koşullarla tekrar dene.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Başvurun iletildi.", exact: true })).toHaveCount(
    0,
  );
  f.packet.application = { state: "closed", form: null };
  await page.getByRole("button", { name: "Yeniden yükle", exact: true }).click();
  await expect(page.getByText("Başvurular şu an kapalı.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: submit, exact: true })).toBeDisabled();
  expect(f.mutations).toHaveLength(1);
});
