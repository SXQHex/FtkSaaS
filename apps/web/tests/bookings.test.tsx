import { beforeEach, expect, test, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { SessionView, PersonSummary } from "@ftksaas/api-contracts";
import { render } from "./render";
import { server } from "./mocks/server";
import { SessionBookings } from "../src/components/bookings/session-bookings";
import { bookingApi, type BookingApi } from "../src/lib/bookings";
import { setupStorageKey } from "../src/lib/studio-setup";
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
const session: SessionView = {
  id,
  starts_at: "2027-01-01T10:00:00Z",
  ends_at: "2027-01-01T11:00:00Z",
  class_id: null,
  discipline_id: id,
  format: "group",
  state: "planned",
  attendance_state: "open",
  assignments: [],
  version: 3,
  capacity: {
    total: 8,
    held: 7,
    remaining: 1,
    category_held: null,
    category_remaining: null,
    room_capacity: 8,
  },
};
const student: PersonSummary = { id: person, display_name: "Sentetik Öğrenci", relationships: [] };
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
    session: vi.fn<BookingApi["session"]>().mockResolvedValue(session),
    people: vi
      .fn<BookingApi["people"]>()
      .mockResolvedValue({ items: [student], next_cursor: null, as_of: "2027-01-01T00:00:00Z" }),
    reservations: vi
      .fn<BookingApi["reservations"]>()
      .mockResolvedValue({ items: [], next_cursor: null, as_of: "2027-01-01T00:00:00Z" }),
    rights: vi.fn<BookingApi["rights"]>().mockResolvedValue([
      {
        sale_id: org,
        person_id: person,
        kind: "credits",
        state: "active",
        start_date: "2026-11-01",
        end_date: "2027-02-01",
        timezone: "Europe/Istanbul",
        available: 5,
        available_at_session: 4,
        reserved: 1,
        consumed: 2,
        deficit: 0,
        quotas: [],
        deficit_scopes: [],
      },
    ]),
  };
}
beforeEach(() => {
  sessionStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.example.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "synthetic");
});
test("booking is lazy, uses contextual rights and selected sale only after explicit confirmation", async () => {
  const reads = api(),
    user = userEvent.setup(),
    bodies: Record<string, unknown>[] = [];
  server.use(
    http.post(
      "https://project.example.invalid/functions/v1/backend-v1/reservation_create_v1",
      async ({ request }) => {
        expect(sessionStorage.getItem(setupStorageKey(scope, `bookings:${id}`))).not.toBeNull();
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({
          ok: true,
          data: { operation_id: id, primary_id: org, replayed: false, related: [] },
          trace_id: id,
        });
      },
    ),
  );
  render(<SessionBookings scope={scope} session={session} api={reads} />);
  expect(reads.reservations).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Rezervasyonları yönet" }));
  await user.click(await screen.findByRole("button", { name: "Sentetik Öğrenci" }));
  await screen.findByRole("option", { name: /seansa uygun kredi/ });
  expect(reads.rights).toHaveBeenCalledWith(scope, person, id, "flexible");
  await user.selectOptions(screen.getByRole("combobox", { name: "Kullanılacak hak" }), org);
  await user.click(screen.getByRole("button", { name: "Rezervasyonu incele" }));
  expect(bodies).toHaveLength(0);
  await user.click(screen.getByRole("checkbox", { name: /Gösterilen işlemi/ }));
  await user.click(screen.getByRole("button", { name: "İşlemi uygula" }));
  await waitFor(() => expect(reads.reservations).toHaveBeenCalledTimes(2));
  expect(bodies[0]).toMatchObject({
    org_id: org,
    center_id: id,
    person_id: person,
    session_id: id,
    source_sale_id: org,
    mode: "flexible",
  });
});
test("wrong person eligibility never exposes a usable source", async () => {
  const reads = api();
  vi.mocked(reads.rights).mockResolvedValue([
    {
      sale_id: org,
      person_id: org,
      state: "active",
      start_date: "2026-01-01",
      end_date: "2027-01-01",
      timezone: "Europe/Istanbul",
      available: 1,
      available_at_session: 1,
      reserved: 0,
      consumed: 0,
      deficit: 0,
      quotas: [],
      deficit_scopes: [],
    },
  ]);
  const user = userEvent.setup();
  render(<SessionBookings scope={scope} session={session} api={reads} />);
  await user.click(screen.getByRole("button", { name: "Rezervasyonları yönet" }));
  await user.click(await screen.findByRole("button", { name: "Sentetik Öğrenci" }));
  await screen.findByRole("alert");
  expect(screen.queryByRole("combobox", { name: "Kullanılacak hak" })).not.toBeInTheDocument();
});
test("capacity race refreshes session and contextual rights without silently changing source", async () => {
  const reads = api(),
    user = userEvent.setup(),
    writes: Record<string, unknown>[] = [];
  server.use(
    http.post(
      "https://project.example.invalid/functions/v1/backend-v1/reservation_create_v1",
      async ({ request }) => {
        writes.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json(
          { ok: false, error: { code: "CAPACITY_FULL", retryable: false, trace_id: id } },
          { status: 409 },
        );
      },
    ),
  );
  render(<SessionBookings scope={scope} session={session} api={reads} />);
  await user.click(screen.getByRole("button", { name: "Rezervasyonları yönet" }));
  await user.click(await screen.findByRole("button", { name: "Sentetik Öğrenci" }));
  await screen.findByRole("option", { name: /seansa uygun kredi/ });
  await user.selectOptions(screen.getByRole("combobox", { name: "Kullanılacak hak" }), org);
  await user.click(screen.getByRole("button", { name: "Rezervasyonu incele" }));
  await user.click(screen.getByRole("checkbox", { name: /Gösterilen işlemi/ }));
  await user.click(screen.getByRole("button", { name: "İşlemi uygula" }));
  await waitFor(() => expect(reads.rights).toHaveBeenCalledTimes(2));
  expect(reads.session).toHaveBeenCalledOnce();
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({ source_sale_id: org });
  expect(screen.getByRole("combobox", { name: "Kullanılacak hak" })).toHaveValue("");
});
test("cancellation uses the actual reservation version and reason, then displays the reread state", async () => {
  const reads = api(),
    user = userEvent.setup(),
    writes: Record<string, unknown>[] = [];
  const reservation = {
    id: org,
    person_id: person,
    session_id: id,
    state: "active" as const,
    mode: "flexible" as const,
    version: 6,
  };
  vi.mocked(reads.reservations)
    .mockResolvedValueOnce({
      items: [reservation],
      next_cursor: null,
      as_of: "2026-11-01T00:00:00Z",
    })
    .mockResolvedValue({
      items: [{ ...reservation, state: "cancelled", version: 7 }],
      next_cursor: null,
      as_of: "2026-11-01T00:00:00Z",
    });
  server.use(
    http.post(
      "https://project.example.invalid/functions/v1/backend-v1/reservation_cancel_v1",
      async ({ request }) => {
        writes.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({
          ok: true,
          data: { operation_id: id, primary_id: org, replayed: false, related: [] },
          trace_id: id,
        });
      },
    ),
  );
  render(<SessionBookings scope={scope} session={session} api={reads} />);
  await user.click(screen.getByRole("button", { name: "Rezervasyonları yönet" }));
  await user.type(await screen.findByRole("textbox", { name: "İptal gerekçesi" }), "Katılamıyor");
  await user.click(screen.getByRole("button", { name: "İptali incele" }));
  expect(writes).toHaveLength(0);
  await user.click(screen.getByRole("checkbox", { name: /Gösterilen işlemi/ }));
  await user.click(screen.getByRole("button", { name: "İşlemi uygula" }));
  await screen.findByText(/Katılımcı 1 · İptal/);
  expect(writes[0]).toMatchObject({
    reservation_id: org,
    expected_version: 6,
    reason: "Katılamıyor",
  });
});
test("uncertain booking remount replays exact source and key, then reopens authoritative reads", async () => {
  const reads = api(),
    user = userEvent.setup(),
    writes: Record<string, unknown>[] = [];
  server.use(
    http.post(
      "https://project.example.invalid/functions/v1/backend-v1/reservation_create_v1",
      async ({ request }) => {
        writes.push((await request.json()) as Record<string, unknown>);
        return writes.length === 1
          ? HttpResponse.error()
          : HttpResponse.json({
              ok: true,
              data: { operation_id: id, primary_id: org, replayed: true, related: [] },
              trace_id: id,
            });
      },
    ),
  );
  const view = render(<SessionBookings scope={scope} session={session} api={reads} />);
  await user.click(screen.getByRole("button", { name: "Rezervasyonları yönet" }));
  await user.click(await screen.findByRole("button", { name: "Sentetik Öğrenci" }));
  await screen.findByRole("option", { name: /seansa uygun kredi/ });
  await user.selectOptions(screen.getByRole("combobox", { name: "Kullanılacak hak" }), org);
  await user.click(screen.getByRole("button", { name: "Rezervasyonu incele" }));
  await user.click(screen.getByRole("checkbox", { name: /Gösterilen işlemi/ }));
  await user.click(screen.getByRole("button", { name: "İşlemi uygula" }));
  await screen.findByRole("button", { name: "Aynı işlemi yeniden gönder" });
  view.unmount();
  render(<SessionBookings scope={scope} session={session} api={reads} />);
  await user.click(screen.getByRole("button", { name: "Aynı işlemi yeniden gönder" }));
  await waitFor(() => expect(reads.reservations).toHaveBeenCalledTimes(2));
  expect({ ...writes[0], request_id: undefined }).toEqual({ ...writes[1], request_id: undefined });
  expect(writes[0]!.request_id).not.toBe(writes[1]!.request_id);
  expect(reads.session).toHaveBeenCalledOnce();
});
