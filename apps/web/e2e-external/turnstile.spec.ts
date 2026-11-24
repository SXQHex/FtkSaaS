import { activate } from "../e2e/device-input.js";
import { test, expect } from "../e2e/test.js";
import { fillApplication, prepareApplication } from "../e2e/public-application-fixture.js";
import { publicForm } from "../e2e/public-calendar-fixture.js";

test("P12.5 public application uses the real Turnstile widget and test Siteverify", async ({
  page,
  request,
}) => {
  const siteverify = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
  const fixture = await prepareApplication(page, "open", async (proof) => {
    async function verify(secret: string) {
      const response = await request.post(siteverify, {
        form: { secret, response: proof },
        timeout: 10_000,
      });
      expect(response.ok()).toBe(true);
      return response.json();
    }
    expect(await verify("1x0000000000000000000000000000000AA")).toMatchObject({
      success: true,
      hostname: "example.com",
    });
    expect(await verify("3x0000000000000000000000000000000AA")).toMatchObject({
      success: false,
      "error-codes": ["timeout-or-duplicate"],
    });
    return true;
  });

  await page.goto(`/public/test-studio/apply?center_id=${publicForm.form_id}`);
  await fillApplication(page, false);
  const submit = page.getByRole("button", { name: "Başvuruyu gönder", exact: true });
  await expect(async () => {
    if (!fixture.mutations.length) await activate(submit);
    expect(fixture.mutations).toHaveLength(1);
  }).toPass({ timeout: 20_000 });
  await expect(
    page.getByRole("heading", { name: "Başvurun iletildi.", exact: true }),
  ).toBeVisible();
  expect(fixture.mutations).toHaveLength(1);
});
