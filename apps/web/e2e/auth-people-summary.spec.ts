import { activate, closeWithDevice, hasTouchInput } from "./device-input.js";
import { test, expect } from "./test.js";
import { mockStudio, openStudio, studioIds as I } from "./studio-fixture.js";
import { openWorkspaceSearch, origin } from "./auth-fixture.js";
import { scanAccessibility } from "./accessibility.js";
import type { RequestPeopleList, SuccessPeopleList } from "@ftksaas/api-contracts";

test("command palette opens the existing invitation form without creating a person", async ({
  page,
}) => {
  const state = await mockStudio(page);
  await openStudio(page);
  await openWorkspaceSearch(page);
  const input = page.getByPlaceholder("Sayfa adı ara…");
  await input.fill("Üye davet et");
  await expect(page.getByRole("menuitem", { name: "Üye davet et", exact: true })).toBeVisible();
  if (hasTouchInput(page)) {
    await activate(page.getByRole("menuitem", { name: "Üye davet et", exact: true }));
  } else {
    await input.press("ArrowDown");
    await input.press("Enter");
  }
  const invite = page.getByRole("dialog", { name: "Üye davet et", exact: true });
  await expect(invite.getByRole("textbox", { name: /Ad soyad/ })).toBeFocused();
  await closeWithDevice(invite.getByRole("button", { name: /^(Close|Kapat|Vazgeç)$/ }).first());
  await expect(invite).toHaveCount(0);
  await expect(page).toHaveURL(`${origin}/o/${I.org}/c/${I.center}/people`);
  expect(state.writes).toEqual([]);
});

test("command palette searches active members through the selected center and opens the native result", async ({
  page,
}) => {
  const state = await mockStudio(page);
  const requests: RequestPeopleList[] = [];
  await page.route("**/functions/v1/backend-v1/people_list_v1", async (route) => {
    const request = route.request().postDataJSON() as RequestPeopleList;
    if (!request.query) return route.fallback();
    requests.push(request);
    expect(request).toMatchObject({
      org_id: I.org,
      center_id: I.center,
      student_status: "active",
    });
    if (request.query === "1002")
      return route.fulfill({
        status: 403,
        json: { ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: I.org } },
      });
    return route.fulfill({
      json: {
        ok: true,
        trace_id: I.org,
        data: {
          items: [
            {
              id: I.instructor,
              display_name: "Sentetik Üye",
              relationships: [{ kind: "student", center_id: I.center, state: "active" }],
            },
          ],
          next_cursor: null,
          as_of: "2026-11-15T00:00:00Z",
        },
      } satisfies SuccessPeopleList,
    });
  });
  await openStudio(page);
  await openWorkspaceSearch(page);
  const palette = page.getByRole("dialog", { name: "Sayfalarda ara", exact: true });
  const input = palette.getByPlaceholder("Sayfa adı ara…");
  expect(requests).toHaveLength(0);
  await input.fill("1001");
  const member = palette.getByRole("menuitem", { name: "Sentetik Üye", exact: true });
  await expect(member).toBeVisible();
  await input.fill("1002");
  await expect(member).toHaveCount(0);
  await expect(palette.getByText("Üye araması tamamlanamadı.", { exact: true })).toBeVisible();
  await input.fill("1001");
  await expect(member).toBeVisible();
  if (hasTouchInput(page)) {
    await activate(member);
  } else {
    await input.press("ArrowDown");
    await input.press("Enter");
  }
  await expect(page).toHaveURL(`${origin}/o/${I.org}/c/${I.center}/people/${I.instructor}`);
  await expect(page.locator('[data-slot="dialog-overlay"]')).toHaveCount(0);
  expect(state.writes).toEqual([]);
});

test("Members: creation recovers one person, invitation acknowledgement only rereads its job", async ({
  page,
}) => {
  const state = await mockStudio(page);
  let jobReads = 0;
  await page.route("**/functions/v1/backend-v1/job_status_get_v1", async (route) => {
    const request = route.request().postDataJSON();
    jobReads++;
    if (jobReads === 1) return route.abort("failed");
    await route.fulfill({
      json: {
        ok: true,
        trace_id: I.org,
        data: {
          id: request.job_id,
          state: "pending",
          progress_count: 0,
          total_count: null,
          result_reference: null,
          safe_error_code: null,
        },
      },
    });
  });
  await openStudio(page);
  await page.goto(`${origin}/o/${I.org}/c/${I.center}/people`);
  await activate(page.getByRole("button", { name: "Üye davet et", exact: true }));
  const dialog = page.getByRole("dialog");
  await dialog.locator("#people-name").fill("Yeni Fixture Üye");
  await dialog.locator("#people-email").fill("new-member@example.invalid");
  state.nextWrite = "unknown";
  await activate(dialog.getByRole("button", { name: "Kişiyi oluştur", exact: true }));
  await expect(dialog.getByRole("button", { name: "Vazgeç", exact: true })).toBeDisabled();
  await activate(dialog.getByRole("button", { name: "Aynı isteği yeniden dene", exact: true }));
  await expect(dialog.locator("#people-name")).toHaveAttribute("readonly", "");
  const creates = state.writes.filter((write) => write.operation === "person_create_v1");
  expect(creates).toHaveLength(2);
  expect(creates[0]!.key).toBe(creates[1]!.key);
  expect(state.people.filter((person) => person.display_name === "Yeni Fixture Üye")).toHaveLength(
    1,
  );
  expect(state.effects).toEqual(["person_create_v1"]);
  await activate(dialog.getByRole("button", { name: "Daveti gönder", exact: true }));
  const refresh = dialog.getByRole("button", { name: "Güncel durumu oku", exact: true });
  await expect(refresh).toBeVisible();
  await activate(refresh);
  await expect.poll(() => jobReads).toBe(2);
  expect(state.effects).toEqual(["person_create_v1", "account_access_send_v1"]);
  expect(state.writes.filter((write) => write.operation === "account_access_send_v1")).toHaveLength(
    1,
  );
  expect(
    state.people.find((person) => person.display_name === "Yeni Fixture Üye")!.relationships,
  ).toEqual([]);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.emulateMedia({ colorScheme: "dark" });
  expect(await page.evaluate<boolean>("document.documentElement.scrollWidth > innerWidth")).toBe(
    false,
  );
  expect(
    (await scanAccessibility(page, "members-created-invitation-recovery-mobile")).violations,
  ).toEqual([]);
  await activate(dialog.getByRole("button", { name: "Vazgeç", exact: true }));
  await expect(dialog).toHaveCount(0);
});

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
  await activate(page.getByRole("button", { name: "Sonraki", exact: true }));
  await expect(table.getByText("Fixture Page Two", { exact: true })).toBeVisible();
  await page.clock.install();
  await page.getByRole("textbox", { name: "Üye ara", exact: true }).fill(" ");
  await page.clock.runFor(350);
  await expect(table.getByText("Fixture Page Two", { exact: true })).toBeVisible();
  const filter = page.getByRole("radiogroup", { name: "Durum", exact: true });
  await activate(filter.getByRole("radio", { name: "Aktif", exact: true }));
  await expect(table.getByText("Fixture Active", { exact: true })).toBeVisible();
  expect(requests.at(-1)?.student_status).toBe("active");
  expect(requests.at(-1)?.page.cursor).toBeUndefined();
  await activate(filter.getByRole("radio", { name: "Pasif", exact: true }));
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
