import { beforeEach, expect, test, vi } from "vitest";
import { screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { v7 } from "uuid";
import { render } from "./render";
import { SelfDashboard } from "../src/components/self/self-dashboard";
import tr from "../messages/tr.json";
const m = vi.hoisted(() => ({
  call: vi.fn<(op: string, input: Record<string, unknown>) => Promise<unknown>>(),
  session: vi.fn<(org: string, center: string | undefined, id: string) => Promise<unknown>>(),
}));
vi.mock("../src/lib/studio-setup", async (load) => ({
  ...(await load<typeof import("../src/lib/studio-setup")>()),
  setupCall: m.call,
}));
vi.mock("../src/lib/api", async (load) => ({
  ...(await load<typeof import("../src/lib/api")>()),
  getSession: m.session,
}));
vi.mock("../src/components/bookings/session-bookings", () => ({
  SessionBookings: ({ session }: { session: { id: string } }) => <output>{session.id}</output>,
}));
const org = v7(),
  center = v7(),
  person = v7(),
  actor = v7(),
  a = v7(),
  b = v7();
const studios = [
  {
    organization: {
      id: org,
      name: "Studio",
      state: "active",
      access_mode: "normal",
      version: 1,
      self_context: {
        person_id: person,
        subscriber_number: 1061,
        centers: [{ center_id: center, student: true, instructor: false, assistant: false }],
      },
    },
    centers: [
      {
        id: center,
        name: "Merkez",
        accessible: true,
        state: "active",
        timezone: "Europe/Istanbul",
        version: 1,
      },
    ],
  },
] as const;
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  m.call.mockImplementation(async (op) =>
    op === "person_get_v1"
      ? { id: person, display_name: "Kendim", relationships: [], state: "active" }
      : op === "entitlements_get_v1"
        ? []
        : op === "calendar_get_v1"
          ? {
              items: [
                {
                  id: a,
                  type: "session",
                  center_id: center,
                  title: "Ders A",
                  starts_at: "2099-01-01T12:00:00Z",
                },
                {
                  id: b,
                  type: "session",
                  center_id: center,
                  title: "Ders B",
                  starts_at: "2099-01-02T12:00:00Z",
                },
              ],
              next_cursor: null,
            }
          : { items: [], next_cursor: null },
  );
});
test("self context absence does not infer person from account or subscriber number", () => {
  render(
    <SelfDashboard
      actorId={actor}
      studios={
        [
          { ...studios[0], organization: { ...studios[0].organization, self_context: null } },
        ] as never
      }
    />,
  );
  expect(screen.getByText(tr.selfDashboard.noLink)).toBeVisible();
  expect(m.call).not.toHaveBeenCalled();
});
test("late session A cannot overwrite later selected session B", async () => {
  let resolveA!: (value: unknown) => void;
  m.session.mockImplementation(async (_o, _c, id) =>
    id === a
      ? new Promise((r) => {
          resolveA = r;
        })
      : { id: b },
  );
  const u = userEvent.setup();
  render(<SelfDashboard actorId={actor} studios={studios as never} />);
  const buttons = await screen.findAllByRole("button", { name: tr.selfDashboard.open });
  await u.click(buttons[0]);
  await u.click(buttons[1]);
  await screen.findByText(b);
  await act(async () => resolveA({ id: a }));
  expect(screen.queryByText(a)).not.toBeInTheDocument();
  expect(screen.getByText(b)).toBeVisible();
  await waitFor(() => expect(m.session).toHaveBeenCalledTimes(2));
});

test("clearing the week date leaves the personal panel usable and reports a local read error", async () => {
  const u = userEvent.setup();
  render(<SelfDashboard actorId={actor} studios={studios as never} />);
  await screen.findByRole("heading", { name: /Kendim · Abone No/ });
  await u.clear(screen.getByLabelText(tr.selfDashboard.week));
  await screen.findByText(tr.flows.errors.invalidSelfDate);
  expect(screen.getByRole("heading", { name: tr.selfDashboard.title })).toBeVisible();
});
