import { expect, type Page } from "@playwright/test";
import { preparePublicCalendar, publicForm } from "./public-calendar-fixture.js";
export async function prepareApplication(
  page: Page,
  state: "open" | "closed" | "unavailable" = "open",
) {
  const fixture = await preparePublicCalendar(page);
  fixture.packet.next_cursor = null;
  fixture.packet.application =
    state === "open" ? { state, form: structuredClone(publicForm) } : { state, form: null };
  await page.route(
    "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
    async (route) => {
      await route.fulfill({
        contentType: "application/javascript",
        body: `window.turnstile={render(element,options){window.__widget=options;const button=document.createElement('button');button.type='button';button.textContent='Test doğrulamasını tamamla';window.__proofCount=(window.__proofCount||0)+1;const proof='test-provider-proof-'+window.__proofCount;button.onclick=()=>options.callback(proof);element.append(button);return 'test-widget';},remove(){document.querySelectorAll('button').forEach(b=>{if(b.textContent==='Test doğrulamasını tamamla')b.remove()})}};`,
      });
    },
  );
  const mutations: Record<string, unknown>[] = [];
  let response: "success" | "abort" | "bot" | "expired" = "success";
  await page.route("**/api/public/application", async (route) => {
    const request = route.request();
    expect(request.headers()["authorization"]).toBeUndefined();
    expect(request.headers()["apikey"]).toBeUndefined();
    expect(request.headers()["cookie"]).toBeUndefined();
    mutations.push(request.postDataJSON() as Record<string, unknown>);
    if (response === "abort") {
      response = "success";
      await route.abort();
      return;
    }
    const data =
      response === "success"
        ? { ok: true, data: { accepted: true }, trace_id: publicForm.form_id }
        : {
            ok: false,
            error: {
              code: response === "bot" ? "BOT_VERIFICATION_FAILED" : "OPERATION_RESULT_EXPIRED",
              retryable: false,
              trace_id: publicForm.form_id,
            },
          };
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(data) });
  });
  return {
    ...fixture,
    mutations,
    setResponse: (value: typeof response) => {
      response = value;
    },
  };
}
export async function fillApplication(page: Page) {
  await page.getByLabel("Ad soyad (zorunlu)", { exact: true }).fill("Örnek Aday");
  await page.getByLabel("E-posta", { exact: true }).fill("candidate@example.test");
  await page.getByLabel("Ne ilgini çekiyor?", { exact: true }).selectOption({ label: "Tango" });
  const consent = page.getByRole("checkbox", { name: "Katılım koşulları", exact: true });
  await consent.focus();
  await consent.press("Space");
  await expect(consent).toBeChecked();
  await page.getByRole("button", { name: "Test doğrulamasını tamamla", exact: true }).click();
}
