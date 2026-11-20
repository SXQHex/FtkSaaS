import { test, expect } from "./test.js";
import { mockNative, origin } from "./auth-fixture.js";
import { studioIds as I } from "./studio-fixture.js";
import common from "../src/locales/tr/common.json" with { type: "json" };

const B = {
  org: "019a7b00-0000-7000-8000-000000000901",
  center: "019a7b00-0000-7000-8000-000000000902",
  person: "019a7b00-0000-7000-8000-000000000903",
};
async function scopes(page: import("@playwright/test").Page) {
  await mockNative(page);
  const state = {
    revoked: false,
    holdFirstCalendar: false,
    oldReplyCompleted: false,
    reads: [] as { op: string; r: Record<string, unknown> }[],
  };
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1)!,
      r = route.request().postDataJSON();
    const send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } });
    const list = (items: unknown[]) => ({
      items,
      next_cursor: null,
      as_of: new Date().toISOString(),
    });
    state.reads.push({ op, r });
    const second = r.org_id === B.org,
      org = second ? B.org : I.org,
      center = second ? B.center : I.center,
      person = second ? B.person : I.self;
    if (op === "organizations_list_v1")
      return send(
        list([
          ...(!state.revoked
            ? [
                {
                  id: I.org,
                  name: "Birinci stüdyo",
                  state: "active",
                  access_mode: "normal",
                  version: 1,
                  self_context: {
                    person_id: I.self,
                    subscriber_number: null,
                    centers: [
                      { center_id: I.center, student: true, instructor: true, assistant: false },
                    ],
                  },
                },
              ]
            : []),
          {
            id: B.org,
            name: "İkinci stüdyo",
            state: "active",
            access_mode: "normal",
            version: 1,
            self_context: {
              person_id: B.person,
              subscriber_number: null,
              centers: [
                { center_id: B.center, student: true, instructor: false, assistant: false },
              ],
            },
          },
        ]),
      );
    if (op === "centers_list_v1")
      return send(
        list([
          {
            id: center,
            name: second ? "Londra merkezi" : "İstanbul merkezi",
            timezone: second ? "Europe/London" : "Europe/Istanbul",
            state: "active",
            accessible: true,
            version: 1,
          },
        ]),
      );
    if (op === "roles_list_v1") {
      expect(r.person_id).toBe(person);
      return send(
        list(
          second
            ? []
            : ["owner", "instructor"].map((role, index) => ({
                id: index ? I.role : I.account,
                person_id: person,
                role,
                scope_center_id: index ? center : null,
                state: "active",
                version: 1,
              })),
        ),
      );
    }
    if (op === "calendar_get_v1") {
      expect(r).toMatchObject({ org_id: org, center_id: center, member_discovery: true });
      if (!second && state.holdFirstCalendar) {
        state.holdFirstCalendar = false;
        await held;
      }
      await send(
        list([
          {
            id: second ? B.person : I.lesson,
            type: "session",
            center_id: center,
            starts_at: "2026-11-17T12:00:00Z",
            ends_at: "2026-11-17T13:00:00Z",
            title: second ? "Londra ders kaydı" : "İstanbul ders kaydı",
            capacity: {
              total: 12,
              held: 0,
              remaining: 12,
              category_held: null,
              category_remaining: null,
              categories: null,
              room_capacity: 20,
            },
            member_lesson: {
              version: 1,
              format: "group",
              state: "planned",
              attendance_state: "open",
              instructor_labels: [second ? "Londra eğitmeni" : "İstanbul eğitmeni"],
              room_labels: [],
              booking_window: {
                state: "not_configured",
                policy_version_id: null,
                opens_at: null,
                closes_at: null,
              },
              cancellation: {
                status: "not_configured",
                source: "current_policy",
                policy_version_id: null,
                terms: null,
                cutoff_at: null,
              },
              own_reservation: null,
              waitlist_enabled: false,
              own_waitlist: null,
            },
          },
        ]),
      );
      if (!second) state.oldReplyCompleted = true;
      return;
    }
    if (op === "entitlements_get_v1") {
      expect(r.person_id).toBe(person);
      expect(r.center_id).toBe(center);
      return send([]);
    }
    if (op === "member_finance_currencies_get_v1")
      return send({ person_id: person, currencies: [], as_of: new Date().toISOString() });
    if (op === "person_get_v1") {
      expect(r.person_id).toBe(person);
      return send({
        id: person,
        display_name: second ? "Londra öz kişisi" : "İstanbul öz kişisi",
        version: 1,
        relationships: [{ center_id: center, kind: "student", state: "active" }],
        discipline_relationships: [],
        member_summary: {
          as_of: new Date().toISOString(),
          rights: { status: "available", available_credits: "0", available_timed_packages: 0 },
          debt: { status: "available", by_currency: [] },
          next_lesson: { status: "available", lesson: null },
        },
      });
    }
    return route.fallback();
  });
  await page.goto(`${origin}/login`);
  await page.getByLabel("E-posta", { exact: true }).fill("scopes@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("Synthetic123");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/account`);
  return { state, release };
}

test("multiple roles reset navigation when the selected organization changes to an own-student scope", async ({
  page,
}) => {
  await scopes(page);
  const switcher = page.locator("[data-workspace-logo]").locator("..");
  await switcher.click();
  await page.getByRole("menuitem", { name: "Birinci stüdyo", exact: true }).click();
  const nav = page.getByRole("navigation", { name: "Ana menü", exact: true });
  await expect(
    nav.getByRole("link", { name: common.workspace.links.finance, exact: true }),
  ).toHaveAttribute("href", `/o/${I.org}/c/${I.center}/finance`);
  await page
    .getByRole("radio", { name: common.workspace.viewLabels.instructor, exact: true })
    .press("Space");
  await expect(
    nav.getByRole("link", { name: common.workspace.links.today, exact: true }),
  ).toHaveAttribute("href", `/instructor/today?org=${I.org}&center=${I.center}`);
  await expect(
    nav.getByRole("link", { name: common.workspace.links.finance, exact: true }),
  ).toHaveCount(0);
  await switcher.click();
  await page.getByRole("menuitem", { name: "İkinci stüdyo", exact: true }).click();
  await expect(switcher).toContainText("Londra merkezi");
  await expect(
    page.getByRole("radio", { name: common.workspace.viewLabels.instructor, exact: true }),
  ).toHaveCount(0);
  await expect(
    nav.getByRole("link", { name: common.workspace.links.today, exact: true }),
  ).toHaveCount(0);
  await expect(
    nav.getByRole("link", { name: common.workspace.links.finance, exact: true }),
  ).toHaveCount(0);
  const accountLink = nav.getByRole("link", { name: common.workspace.links.account, exact: true });
  const accountHref = `/account?org=${B.org}&center=${B.center}`;
  await expect(accountLink).toHaveAttribute("href", accountHref);
  await accountLink.press("Enter");
  await expect(page).toHaveURL(`${origin}${accountHref}`);
  await expect(switcher).toContainText("Londra merkezi");
  await expect(
    nav.getByRole("link", { name: common.workspace.links.finance, exact: true }),
  ).toHaveCount(0);
});

test("a late previous-org calendar cannot replace the selected member, and revoked history URLs expose no old data", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.clock.setFixedTime(new Date("2026-11-17T08:00:00Z"));
  const f = await scopes(page);
  f.state.holdFirstCalendar = true;
  await page.goto(`${origin}/member/classes?org=${I.org}&center=${I.center}`);
  await expect
    .poll(() => f.state.reads.some((row) => row.op === "calendar_get_v1" && row.r.org_id === I.org))
    .toBe(true);
  await page
    .getByRole("combobox", { name: common.memberReservations.chooseOrg, exact: true })
    .selectOption(B.org);
  await expect(page).toHaveURL(`${origin}/member/classes?org=${B.org}&center=${B.center}`);
  await expect(page.getByText("Londra ders kaydı", { exact: true })).toBeVisible();
  f.release();
  await expect.poll(() => f.state.oldReplyCompleted).toBe(true);
  await expect(page.getByText("Londra ders kaydı", { exact: true })).toBeVisible();
  await expect(page.getByText("İstanbul ders kaydı", { exact: true })).toHaveCount(0);
  await page
    .getByRole("link", { name: common.memberReservations.links.entitlements, exact: true })
    .click();
  await expect
    .poll(() =>
      f.state.reads.some(
        (row) =>
          row.op === "entitlements_get_v1" &&
          row.r.org_id === B.org &&
          row.r.person_id === B.person,
      ),
    )
    .toBe(true);
  await expect
    .poll(() =>
      f.state.reads.some(
        (row) =>
          row.op === "person_get_v1" && row.r.org_id === B.org && row.r.person_id === B.person,
      ),
    )
    .toBe(true);
  await page.goBack();
  await expect(page.getByText("Londra ders kaydı", { exact: true })).toBeVisible();
  await expect(page.getByText("İstanbul ders kaydı", { exact: true })).toHaveCount(0);
  f.state.revoked = true;
  const before = f.state.reads.filter(
    (row) => row.op === "calendar_get_v1" && row.r.org_id === I.org,
  ).length;
  // A direct reload starts a fresh application; wait for its authority read before inspecting options.
  await Promise.all([
    page.waitForResponse(
      (response) => response.url().endsWith("/organizations_list_v1") && response.ok(),
    ),
    page.goto(`${origin}/member/classes?org=${I.org}&center=${I.center}`),
  ]);
  await expect(
    page
      .getByRole("combobox", { name: common.memberReservations.chooseOrg, exact: true })
      .locator("option"),
  ).toHaveCount(2);
  await expect(page.getByText("İstanbul ders kaydı", { exact: true })).toHaveCount(0);
  expect(
    f.state.reads.filter((row) => row.op === "calendar_get_v1" && row.r.org_id === I.org),
  ).toHaveLength(before);
});
