import { test, expect } from "./test.js";
import { mockStudio, openStudio, studioIds as I } from "./studio-fixture.js";
import { origin } from "./auth-fixture.js";
import { scanAccessibility } from "./accessibility.js";
import type { RequestPeopleList, SuccessPeopleList } from "../src/lib/api-contracts/generated.js";

test("Members: server status/cursor reset and exact scoped summaries, responsive AA", async ({
  page,
}) => {
  await mockStudio(page);
  const requests: RequestPeopleList[] = [];
  await page.route("**/functions/v1/backend-v1/people_list_v1", async (route) => {
    const request = route.request().postDataJSON() as RequestPeopleList;
    requests.push(request);
    expect(request).toMatchObject({
      org_id: I.org,
      center_id: I.center,
      include_member_summary: true,
    });
    const inactive = request.student_status === "inactive";
    const name = inactive
      ? "Fixture Inactive"
      : request.page.cursor
        ? "Fixture Page Two"
        : "Fixture Active";
    await route.fulfill({
      json: {
        ok: true,
        trace_id: I.org,
        data: {
          items: [
            {
              id: I.instructor,
              display_name: name,
              relationships: [
                { kind: "student", center_id: I.center, state: inactive ? "inactive" : "active" },
              ],
              member_summary: {
                as_of: "2026-11-15T00:00:00Z",
                rights: inactive
                  ? { status: "restricted" }
                  : {
                      status: "available",
                      available_credits: "9007199254740993",
                      available_timed_packages: 2,
                    },
                debt: inactive
                  ? { status: "not_enabled" }
                  : {
                      status: "available",
                      by_currency: [
                        { currency: "TRY", remaining_minor: "9007199254740993" },
                        { currency: "USD", remaining_minor: "100" },
                      ],
                    },
                next_lesson: { status: "available", lesson: null },
              },
            },
          ],
          next_cursor:
            request.student_status || request.page.cursor ? null : "synthetic-second-page",
          as_of: "2026-11-15T00:00:00Z",
        },
      } satisfies SuccessPeopleList,
    });
  });
  await openStudio(page);
  await page.goto(`${origin}/o/${I.org}/c/${I.center}/people`);
  const table = page.getByRole("grid", { name: "Üyeler", exact: true });
  await expect(table.getByText("Fixture Active", { exact: true })).toBeVisible();
  await expect(
    table.getByText("9.007.199.254.740.993 kredi · 2 süreli paket", { exact: true }),
  ).toBeVisible();
  await expect(table.getByText(/90\.071\.992\.547\.409,93/)).toBeVisible();
  expect((await scanAccessibility(page, "members-summary-desktop")).violations).toEqual([]);
  await page.getByRole("button", { name: "Sonraki", exact: true }).click();
  await expect(table.getByText("Fixture Page Two", { exact: true })).toBeVisible();
  const filter = page.getByRole("radiogroup", { name: "Durum", exact: true });
  await filter.getByRole("radio", { name: "Aktif", exact: true }).click();
  await expect(table.getByText("Fixture Active", { exact: true })).toBeVisible();
  expect(requests.at(-1)?.student_status).toBe("active");
  expect(requests.at(-1)?.page.cursor).toBeUndefined();
  await filter.getByRole("radio", { name: "Pasif", exact: true }).click();
  await expect(table.getByText("Fixture Inactive", { exact: true })).toBeVisible();
  expect(requests.at(-1)?.student_status).toBe("inactive");
  expect(requests.at(-1)?.page.cursor).toBeUndefined();
  await expect(table.getByText("Bu bilgiyi görme yetkin yok", { exact: true })).toBeVisible();
  await expect(table.getByText("Bu özellik planda açık değil", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 900 });
  await page.emulateMedia({ colorScheme: "dark" });
  expect(await page.evaluate<boolean>("document.documentElement.scrollWidth > innerWidth")).toBe(
    false,
  );
  expect((await scanAccessibility(page, "members-summary-mobile-dark")).violations).toEqual([]);
});
