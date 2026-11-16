import { test, expect } from "./test.js";
import type { Page } from "@playwright/test";
const id = "019ab7b0-0000-7000-8000-000000000001";
const item = {
  publication_id: id,
  title: "Tango programı",
  interval: { starts_at: "2026-11-18T15:00:00Z", ends_at: "2026-11-18T16:00:00Z" },
  venue_public_label: "Public salon",
  fee_minor: "50000",
  currency: "TRY",
  public_conditions: "Rahat ayakkabı",
  discipline_ids: [],
};
const data = {
  items: [item],
  as_of: "2026-11-16T12:00:00Z",
  next_cursor: "next-page",
  organization_profile: {
    name: "Örnek Stüdyo",
    address: "Yayınlanan adres",
    timezone: "Europe/Istanbul",
  },
};
async function prepare(
  page: Page,
  mode: "normal" | "error" | "empty" | "malformed" | "timezone" = "normal",
) {
  await page.clock.install({ time: new Date("2026-11-16T12:00:00Z") });
  const calls: Record<string, unknown>[] = [];
  let fail = mode === "error",
    failNext = false;
  await page.route("**/auth/v1/**", () => {
    throw new Error("Public route must not initialize native Auth");
  });
  await page.route("**/functions/v1/backend-v1/**", () => {
    throw new Error("Public route must not use authenticated backend");
  });
  await page.route("**/api/public/calendar", async (route) => {
    const req = route.request();
    expect(req.headers()).not.toHaveProperty("authorization");
    expect(req.headers()).not.toHaveProperty("apikey");
    const request = req.postDataJSON() as Record<string, unknown>;
    calls.push(request);
    if (fail || (failNext && (request.page as { cursor?: string }).cursor))
      return route.fulfill({
        status: 200,
        json: { ok: false, error: { code: "SERVICE_UNAVAILABLE", retryable: true, trace_id: id } },
      });
    const cursor = (request.page as { cursor?: string }).cursor;
    return route.fulfill({
      json: {
        ok: true,
        trace_id: id,
        data:
          mode === "empty"
            ? { ...data, items: [], next_cursor: null, organization_profile: null }
            : mode === "malformed"
              ? { ...data, items: [item, item] }
              : cursor
                ? {
                    ...data,
                    items: [
                      {
                        ...item,
                        publication_id: "019ab7b0-0000-7000-8000-000000000002",
                        title: "İkinci program",
                        interval: {
                          starts_at: "2026-11-19T15:00:00Z",
                          ends_at: "2026-11-19T16:00:00Z",
                        },
                      },
                    ],
                    next_cursor: null,
                  }
                : mode === "timezone"
                  ? { ...data, organization_profile: { name: "Örnek Stüdyo" }, next_cursor: null }
                  : data,
      },
    });
  });
  await page.goto(`/public/test-studio/calendar?center_id=${id}`);
  return {
    calls,
    recover: () => {
      fail = false;
    },
    failNext: () => {
      failNext = true;
    },
    recoverNext: () => {
      failNext = false;
    },
  };
}
test("anonymous public calendar reads published fields and paginates with unchanged interval", async ({
  page,
}) => {
  const state = await prepare(page);
  await expect(page.getByRole("heading", { name: "Tango programı", exact: true })).toBeVisible();
  await expect(page.getByText("18:00", { exact: true })).toBeVisible();
  await expect(page.getByText("Saat dilimi: Europe/Istanbul", { exact: true })).toBeVisible();
  await expect(page.getByText("₺500,00", { exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Ders türü", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Daha fazla göster", exact: true }).click();
  await expect(page.getByRole("heading", { name: "İkinci program", exact: true })).toBeVisible();
  expect(state.calls).toHaveLength(2);
  expect(state.calls[1]!.interval).toEqual(state.calls[0]!.interval);
  expect(state.calls[1]).toMatchObject({
    slug: "test-studio",
    center_id: id,
    page: { cursor: "next-page", limit: 50, sort: "starts_at_asc" },
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tango programı", exact: true })).toBeVisible();
});
test("public transport failure offers retry and never claims a closed publication", async ({
  page,
}) => {
  const state = await prepare(page, "error");
  await expect(page.getByText("Program yüklenemedi.", { exact: true })).toBeVisible();
  await expect(page.getByText("Bu sayfa şu an yayında değil", { exact: true })).toHaveCount(0);
  state.recover();
  await page.getByRole("button", { name: "Tekrar dene", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tango programı", exact: true })).toBeVisible();
});
test("next page failure preserves loaded rows and retries only the missing page", async ({
  page,
}) => {
  const state = await prepare(page);
  await expect(page.getByRole("heading", { name: "Tango programı", exact: true })).toBeVisible();
  state.failNext();
  await page.getByRole("button", { name: "Daha fazla göster", exact: true }).click();
  await expect(
    page.getByText("Sonraki program sayfası yüklenemedi.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tango programı", exact: true })).toBeVisible();
  state.recoverNext();
  await page.getByRole("button", { name: "Daha fazla göster", exact: true }).click();
  await expect(page.getByRole("heading", { name: "İkinci program", exact: true })).toBeVisible();
  expect(state.calls).toHaveLength(3);
});
test("empty anonymous result does not reveal private profile or invent application availability", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 750 });
  await prepare(page, "empty");
  await expect(
    page.getByText("Bu aralıkta yayınlanan bir içerik yok.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Örnek Stüdyo", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Başvur", exact: true })).toHaveCount(0);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "İçeriğe geç", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#public-main$/);
});
test("malformed publication data fails closed without rendering duplicate rows", async ({
  page,
}) => {
  await prepare(page, "malformed");
  await expect(page.getByText("Program yüklenemedi.", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tango programı", exact: true })).toHaveCount(0);
});
test("missing public timezone uses explicit UTC in dark narrow layout", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 750 });
  await page.addInitScript(
    'document.documentElement.dataset.theme="dark";document.documentElement.classList.add("dark");',
  );
  await prepare(page, "timezone");
  await expect(page.getByText("15:00", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Yayın saat dilimi paylaşılmadı; saatler UTC olarak gösterilir.", {
      exact: true,
    }),
  ).toBeVisible();
});
