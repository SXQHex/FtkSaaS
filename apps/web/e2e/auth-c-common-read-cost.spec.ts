import type { Page, Request, Response, Route } from "@playwright/test";
import type { CalendarItem, SuccessPeopleList } from "@ftksaas/api-contracts";
import { clickWorkspaceLink } from "./auth-fixture.js";
import { mockSessionDetail } from "./session-detail-fixture.js";
import { studioIds as I } from "./studio-fixture.js";
import { expect, test } from "./test.js";

function recordBackendReads(page: Page) {
  const active = new Map<Request, { operation: string; startedAt: number }>();
  const phases: {
    name: string;
    durationMs: number;
    operations: { operation: string; rows: number; durationMs: number; ok: boolean }[];
  }[] = [];
  let records: (typeof phases)[number]["operations"] = [];
  let startedAt = performance.now();

  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    const operation = path.match(
      /^\/(?:functions\/v1\/backend-v1|rest\/v1\/rpc)\/([a-z0-9_]+)$/,
    )?.[1];
    if (operation && request.method() === "POST") {
      active.set(request, { operation, startedAt: performance.now() });
    }
  });

  async function complete(request: Request, response: Response | null) {
    const call = active.get(request);
    if (!call) return;
    const durationMs = performance.now() - call.startedAt;
    try {
      const envelope: unknown = response ? await response.json() : undefined;
      const ok = Boolean(
        response?.ok() &&
        envelope &&
        typeof envelope === "object" &&
        "ok" in envelope &&
        envelope.ok === true,
      );
      const data =
        ok && envelope && typeof envelope === "object" && "data" in envelope ? envelope.data : null;
      const payload = data && typeof data === "object" && "rows" in data ? data.rows : data;
      const rows = Array.isArray(payload)
        ? payload.length
        : payload &&
            typeof payload === "object" &&
            "items" in payload &&
            Array.isArray(payload.items)
          ? payload.items.length
          : payload == null
            ? 0
            : 1;
      records.push({ operation: call.operation, rows, durationMs, ok });
    } catch {
      records.push({ operation: call.operation, rows: 0, durationMs, ok: false });
    } finally {
      active.delete(request);
    }
  }
  page.on("requestfinished", async (request) => {
    await complete(request, await request.response());
  });
  page.on("requestfailed", (request) => void complete(request, null));

  return {
    phases,
    async finish(name: string) {
      await expect.poll(() => active.size).toBe(0);
      phases.push({ name, durationMs: performance.now() - startedAt, operations: records });
      records = [];
      startedAt = performance.now();
    },
  };
}

test("C-ortak measures scoped SPA reads, cursor and single-write readback", async ({
  page,
}, info) => {
  const now = new Date("2026-11-18T12:00:00Z");
  await page.clock.setFixedTime(now);
  const measure = recordBackendReads(page);
  const as_of = now.toISOString();
  const emptyPage = { items: [], next_cursor: null, as_of };
  const send = (route: Route, data: unknown) =>
    route.fulfill({ json: { ok: true, data, trace_id: I.role } });
  await page.route("**/rest/v1/rpc/centers_list_v1", (route) => {
    expect(route.request().headers()["content-profile"]).toBe("api_read");
    expect(route.request().postDataJSON()).toMatchObject({ p_request: { org_id: I.org } });
    return send(route, {
      ...emptyPage,
      items: [
        {
          id: I.center,
          name: "Fixture Center",
          timezone: "Europe/Istanbul",
          state: "active",
          accessible: true,
          version: 7,
        },
      ],
    });
  });
  const { studio, session } = await mockSessionDetail(page, {
    openDetail: false,
    centerManager: true,
    now,
  });
  const uid = (index: number) => `019a7b00-0000-7000-8000-${String(400 + index).padStart(12, "0")}`;
  const members = Array.from({ length: 21 }, (_, index) => ({
    id: uid(index),
    display_name: `Sentetik üye ${String(index + 1).padStart(2, "0")}`,
    relationships: [{ kind: "student" as const, center_id: I.center, state: "active" as const }],
    member_summary: {
      as_of,
      rights: { status: "available" as const, available_credits: "4", available_timed_packages: 1 },
      debt: { status: "available" as const, by_currency: [] },
      next_lesson: { status: "available" as const, lesson: null },
    },
  }));

  await page.route("**/functions/v1/backend-v1/people_list_v1", async (route) => {
    const request: unknown = route.request().postDataJSON();
    if (
      !request ||
      typeof request !== "object" ||
      !("include_member_summary" in request) ||
      !request.include_member_summary
    ) {
      return route.fallback();
    }
    expect(request).toMatchObject({ org_id: I.org, center_id: I.center, page: { limit: 20 } });
    const portion =
      "page" in request &&
      request.page &&
      typeof request.page === "object" &&
      "cursor" in request.page
        ? request.page.cursor
        : undefined;
    expect([undefined, "c-common-members-2"]).toContain(portion);
    const data = {
      items: portion ? members.slice(20) : members.slice(0, 20),
      next_cursor: portion ? null : "c-common-members-2",
      as_of,
    } satisfies SuccessPeopleList["data"];
    await route.fulfill({ json: { ok: true, data, trace_id: I.role } });
  });

  await page.route("**/functions/v1/backend-v1/calendar_get_v1", async (route) => {
    const request: unknown = route.request().postDataJSON();
    expect(request).toMatchObject({ org_id: I.org, center_id: I.center });
    const includeSummary =
      request &&
      typeof request === "object" &&
      "include_session_summary" in request &&
      request.include_session_summary === true;
    const item: CalendarItem = {
      id: session.id,
      center_id: I.center,
      type: "session",
      title: "Sentetik seans",
      starts_at: session.starts_at,
      ends_at: session.ends_at,
      resources: [{ kind: "room", id: I.room }],
      capacity: session.capacity,
      ...(includeSummary
        ? {
            session_summary: {
              state: session.state,
              attendance_state: session.attendance_state,
              format: session.format,
              class_id: session.class_id,
              assignments: session.assignments.map(({ person_id, duty }) => ({ person_id, duty })),
              version: session.version,
            },
          }
        : {}),
    };
    await route.fulfill({
      json: { ok: true, trace_id: I.role, data: { items: [item], next_cursor: null, as_of } },
    });
  });
  await page.route("**/functions/v1/backend-v1/management_work_list_v1", (route) =>
    route.fulfill({
      json: {
        ok: true,
        trace_id: I.role,
        data: {
          items: [],
          next_cursor: null,
          as_of,
          summary: {
            total: 0,
            lesson_request: 0,
            lesson_attendance: 0,
            event_attendance: 0,
            crm_followup: 0,
            application_review: 0,
          },
        },
      },
    }),
  );
  await page.route("**/functions/v1/backend-v1/settings_catalog_get_v1", (route) => {
    const request: unknown = route.request().postDataJSON();
    if (
      !request ||
      typeof request !== "object" ||
      !("scope" in request) ||
      request.scope !== "organization"
    ) {
      return route.fallback();
    }
    expect(request).toMatchObject({ org_id: I.org });
    return route.fulfill({
      json: {
        ok: true,
        trace_id: I.role,
        data: {
          scope: "organization",
          catalog_version: 24,
          fields: [],
          defaults: {},
          brand_packages: [],
        },
      },
    });
  });
  await page.route("**/functions/v1/backend-v1/settings_history_get_v1", (route) =>
    send(route, emptyPage),
  );
  await page.route("**/functions/v1/backend-v1/policies_get_v1", (route) => send(route, []));
  await page.route("**/functions/v1/backend-v1/report_get_v1", (route) => {
    const request: unknown = route.request().postDataJSON();
    expect(request).toMatchObject({ org_id: I.org, filters: { center_ids: [I.center] } });
    if (
      !request ||
      typeof request !== "object" ||
      !("report" in request) ||
      !("filters" in request)
    ) {
      throw Error("Missing report selection");
    }
    return send(route, {
      report_kind: request.report,
      filters: request.filters,
      as_of,
      rows: emptyPage,
      totals: [],
    });
  });

  await clickWorkspaceLink(page, "Stüdyo");
  await expect(page.getByRole("button", { name: /Örnek Eğitmen/ })).toBeVisible();
  await measure.finish("cold-studio");
  const lifetime = await page.evaluate(() => performance.timeOrigin);

  await clickWorkspaceLink(page, "Üyeler");
  const membersGrid = page.getByRole("grid", { name: "Üyeler", exact: true });
  await expect(membersGrid.getByText("Sentetik üye 01", { exact: true })).toBeVisible();
  await measure.finish("members");
  await page.getByRole("button", { name: "Sonraki", exact: true }).click();
  await expect(membersGrid.getByText("Sentetik üye 21", { exact: true })).toBeVisible();
  await measure.finish("members-cursor");

  await clickWorkspaceLink(page, "Ders programı");
  await expect(page.getByText("Sentetik seans", { exact: true })).toBeVisible();
  await measure.finish("schedule");
  await clickWorkspaceLink(page, "Genel bakış");
  const overview = page.getByRole("region", { name: "Sıradaki ders", exact: true });
  await expect(overview.getByText("Sentetik seans", { exact: true })).toBeVisible();
  await measure.finish("overview");
  await clickWorkspaceLink(page, "Ayarlar");
  const settingScope = page.getByLabel("Ayar kapsamı", { exact: true });
  await expect(settingScope).toBeEnabled();
  await measure.finish("settings");

  await page.goBack();
  await expect(overview.getByText("Sentetik seans", { exact: true })).toBeVisible();
  await measure.finish("back-to-overview");
  await page.goForward();
  await expect(settingScope).toBeEnabled();
  await measure.finish("forward-to-settings");

  await clickWorkspaceLink(page, "Stüdyo");
  await page.getByRole("tab", { name: "Dersler ve salonlar", exact: true }).click();
  const firstClass = page.getByRole("button", { name: "Başlangıç grubu", exact: true });
  await expect(firstClass).toBeVisible();
  await measure.finish("return-to-studio");
  await firstClass.click();
  const dialog = page.getByRole("dialog");
  const className = dialog.locator("#class-name");
  await expect(className).toHaveValue("Başlangıç grubu");
  await measure.finish("class-panel");

  await className.fill("C-ortak güncel ders");
  await dialog.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "C-ortak güncel ders", exact: true }),
  ).toBeVisible();
  await measure.finish("class-write-and-readback");

  expect(studio.effects).toEqual(["class_save_v1"]);
  expect(studio.writes).toHaveLength(1);
  expect(studio.writes[0]?.payload).toMatchObject({ class_id: I.lesson, expected_version: 4 });
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(lifetime);
  await info.attach("c-common-read-cost", {
    body: JSON.stringify({ viewport: page.viewportSize(), phases: measure.phases }),
    contentType: "application/json",
  });
  expect(measure.phases.flatMap(({ operations }) => operations.filter(({ ok }) => !ok))).toEqual(
    [],
  );
});
