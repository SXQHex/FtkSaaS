import { beforeEach, expect, test, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { LessonRequestView, SessionView } from "@ftksaas/api-contracts";
import { render } from "./render";
import { server } from "./mocks/server";
import { LessonRequests } from "../src/components/bookings/lesson-requests";
import { bookingApi, type BookingApi } from "../src/lib/bookings";
vi.mock("../src/lib/supabase/client", () => ({
  browserClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: { access_token: "synthetic" } }, error: null }),
    },
  }),
}));
const id = "019a2b3c-4d5e-7000-8000-000000000080",
  org = "019a2b3c-4d5e-7000-8000-000000000081",
  person = "019a2b3c-4d5e-7000-8000-000000000082",
  scope = { actorId: id, orgId: org, centerId: id };
const row: LessonRequestView = {
  id,
  person_id: person,
  center_id: id,
  created_at: "2026-11-01T00:00:00Z",
  version: 4,
  format: "private",
  discipline_id: id,
  requested_start: "2027-01-01T10:00:00Z",
  duration_minutes: 60,
  state: "alternative_offered",
  alternatives: [
    {
      id: org,
      request_id: id,
      version: 1,
      created_at: "2026-11-01T00:00:00Z",
      starts_at: "2027-01-01T14:00:00Z",
      ends_at: "2027-01-01T15:00:00Z",
      state: "offered",
    },
  ],
};
const session: SessionView = {
  id: org,
  class_id: null,
  format: "private",
  discipline_id: id,
  starts_at: row.requested_start,
  ends_at: "2027-01-01T11:00:00Z",
  state: "planned",
  attendance_state: "open",
  version: 3,
  assignments: [],
  capacity: {
    total: 1,
    held: 0,
    remaining: 1,
    room_capacity: 1,
    category_held: null,
    category_remaining: null,
  },
};
function api(): BookingApi {
  return {
    ...bookingApi,
    capacity: vi.fn<BookingApi["capacity"]>().mockResolvedValue(false),
    requestActions: vi
      .fn<BookingApi["requestActions"]>()
      .mockResolvedValue([
        "withdraw",
        "reject",
        "offer_alternative",
        "accept_alternative",
        "approve",
      ]),
    people: vi.fn<BookingApi["people"]>().mockResolvedValue({
      items: [{ id: person, display_name: "Sentetik Öğrenci", relationships: [] }],
      next_cursor: null,
      as_of: "2026-11-01T00:00:00Z",
    }),
    requests: vi
      .fn<BookingApi["requests"]>()
      .mockResolvedValue({ items: [row], next_cursor: null, as_of: "2026-11-01T00:00:00Z" }),
    catalog: vi
      .fn<BookingApi["catalog"]>()
      .mockResolvedValue({ disciplines: [{ id, name: "Salsa" }], instructors: [] }),
    calendar: vi.fn<BookingApi["calendar"]>().mockResolvedValue([
      {
        id: org,
        type: "session",
        center_id: id,
        title: "Sentetik",
        starts_at: row.requested_start,
        ends_at: session.ends_at,
      },
    ]),
    session: vi.fn<BookingApi["session"]>().mockResolvedValue(session),
  };
}
beforeEach(() => {
  sessionStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.example.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "synthetic");
});
async function start(reads: BookingApi) {
  const user = userEvent.setup();
  render(<LessonRequests scope={scope} timeZone="UTC" api={reads} />);
  await user.click(screen.getByRole("button", { name: "Talepleri yönet" }));
  await user.click(await screen.findByRole("button", { name: "Sentetik Öğrenci" }));
  await screen.findByRole("combobox", { name: "Talep işlemi" });
  return user;
}
test.each(["withdraw", "reject", "offer_alternative", "accept_alternative", "approve"] as const)(
  "%s uses the current request version, explicit review and a single writer",
  async (action) => {
    const reads = api(),
      writes: Record<string, unknown>[] = [];
    server.use(
      http.post(
        `https://project.example.invalid/functions/v1/backend-v1/lesson_request_${action}_v1`,
        async ({ request }) => {
          writes.push((await request.json()) as Record<string, unknown>);
          return HttpResponse.json({
            ok: true,
            data: { operation_id: id, primary_id: id, replayed: false, related: [] },
            trace_id: id,
          });
        },
      ),
    );
    const user = await start(reads);
    await user.selectOptions(screen.getByRole("combobox", { name: "Talep işlemi" }), action);
    if (action === "reject")
      await user.type(screen.getByRole("textbox", { name: "Gerekçe" }), "Uygun değil");
    if (action === "offer_alternative") {
      await user.type(screen.getByLabelText("Başlangıç"), "2027-01-02T14:00");
      await user.type(screen.getByLabelText("Bitiş"), "2027-01-02T15:00");
    }
    if (action === "accept_alternative")
      await user.selectOptions(screen.getByRole("combobox", { name: "Önerilen alternatif" }), org);
    if (action === "approve")
      await user.selectOptions(
        await screen.findByRole("combobox", { name: "Onaylanacak özel seans" }),
        org,
      );
    await user.click(screen.getByRole("button", { name: "İşlemi incele" }));
    expect(writes).toHaveLength(0);
    const review = screen.getByRole("region", { name: "İşlemi incele" });
    expect(
      within(review).getByText(
        action === "accept_alternative"
          ? /14:00/
          : action === "offer_alternative"
            ? /14:00/
            : /10:00/,
      ),
    ).toBeInTheDocument();
    await user.click(within(review).getByRole("checkbox"));
    await user.click(within(review).getByRole("button", { name: "İşlemi uygula" }));
    await waitFor(() => expect(reads.requests).toHaveBeenCalledTimes(2));
    expect(writes[0]).toMatchObject({
      org_id: org,
      center_id: id,
      lesson_request_id: id,
      expected_version: 4,
    });
  },
);
test("create validates authoritative discipline and local times without allocating a booking", async () => {
  const reads = api(),
    writes: Record<string, unknown>[] = [];
  server.use(
    http.post(
      "https://project.example.invalid/functions/v1/backend-v1/lesson_request_create_v1",
      async ({ request }) => {
        writes.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({
          ok: true,
          data: { operation_id: id, primary_id: id, replayed: false, related: [] },
          trace_id: id,
        });
      },
    ),
  );
  const user = await start(reads);
  await user.click(screen.getByRole("button", { name: "Özel ders talebi oluştur" }));
  await user.selectOptions(await screen.findByRole("combobox", { name: "Disiplin" }), id);
  expect(reads.catalog).toHaveBeenCalledWith(scope, person);
  await user.type(screen.getByLabelText("Başlangıç"), "2027-01-03T10:00");
  await user.type(screen.getByLabelText("Bitiş"), "2027-01-03T11:00");
  await user.click(screen.getByRole("button", { name: "Talebi incele" }));
  await user.click(screen.getByRole("checkbox", { name: /Gösterilen işlemi/ }));
  await user.click(screen.getByRole("button", { name: "İşlemi uygula" }));
  await waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0]).toMatchObject({
    person_id: person,
    discipline_id: id,
    requested_start: "2027-01-03T10:00:00.000Z",
    duration_minutes: 60,
  });
  expect(writes[0]).not.toHaveProperty("session_id");
});
test("wrong teacher or wrong returned session id cannot be offered for request approval", async () => {
  const reads = api();
  vi.mocked(reads.requests).mockResolvedValue({
    items: [{ ...row, preferred_instructor_id: person }],
    next_cursor: null,
    as_of: "2026-11-01T00:00:00Z",
  });
  const user = await start(reads);
  await user.selectOptions(screen.getByRole("combobox", { name: "Talep işlemi" }), "approve");
  await screen.findByText(/Tam eşleşen özel seans yok/);
  expect(
    screen.getByRole("combobox", { name: "Onaylanacak özel seans" }).querySelectorAll("option"),
  ).toHaveLength(1);
});
test("self request controls expose only actions allowed by the named management readers", async () => {
  const reads = api();
  vi.mocked(reads.requestActions).mockResolvedValue(["withdraw", "accept_alternative"]);
  const user = await start(reads);
  expect(screen.queryByRole("option", { name: "Merkez onayı ver" })).not.toBeInTheDocument();
  expect(screen.queryByRole("option", { name: "Reddet" })).not.toBeInTheDocument();
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Talep işlemi" }),
    "accept_alternative",
  );
  expect(screen.getByRole("combobox", { name: "Önerilen alternatif" })).toBeInTheDocument();
});
test("native action discovery denies manager actions to a self caller and binds every selector", async () => {
  const bodies: Record<string, unknown>[] = [];
  server.use(
    http.post(
      "https://project.example.invalid/functions/v1/backend-v1/management_state_get_v1",
      async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        bodies.push(body);
        const operation = String(body.operation);
        if (
          !["lesson_request_withdraw_v1", "lesson_request_accept_alternative_v1"].includes(
            operation,
          )
        )
          return HttpResponse.json(
            { ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: id } },
            { status: 403 },
          );
        return HttpResponse.json({
          ok: true,
          data: {
            items: [
              {
                operation,
                entity: { type: "lesson_requests", id },
                exists: true,
                state: row.state,
                versions: [],
                as_of: "2026-11-01T00:00:00Z",
                current: null,
                request_detail: row,
              },
            ],
            next_cursor: null,
            as_of: "2026-11-01T00:00:00Z",
          },
          trace_id: id,
        });
      },
    ),
  );
  expect(await bookingApi.requestActions(scope, row)).toEqual(["withdraw", "accept_alternative"]);
  expect(bodies).toHaveLength(5);
  for (const body of bodies) {
    expect(body).toMatchObject({
      org_id: org,
      center_id: id,
      selector: { operation: body.operation, key: { lesson_request_id: id } },
    });
  }
});
