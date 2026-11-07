import { beforeEach, expect, test, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { v7 } from "uuid";
import { render } from "./render";
import { EventsWorkspace } from "../src/components/events/events-workspace";
const m = vi.hoisted(() => ({
  call: vi.fn<() => Promise<unknown>>(),
  detail: vi.fn<(scope: unknown, id: string) => Promise<unknown>>(),
}));
vi.mock("../src/lib/studio-setup", async (load) => ({
  ...(await load<typeof import("../src/lib/studio-setup")>()),
  setupCall: m.call,
}));
vi.mock("../src/lib/events", () => ({ eventDetail: m.detail }));
vi.mock("../src/components/events/event-registration", () => ({
  EventRegistration: ({ onSaved }: { onSaved: (id?: string) => void }) => (
    <button onClick={() => onSaved("019a2b3c-4d5e-7000-8000-000000000099")}>
      Confirm registration
    </button>
  ),
}));
vi.mock("../src/components/events/event-actions", () => ({ EventActions: () => null }));
vi.mock("../src/components/crm/publication", () => ({ Publication: () => null }));
const org = v7(),
  center = v7(),
  id = v7();
const e = {
  id,
  name: "Atölye",
  center_id: center,
  version: 4,
  state: "published",
  timezone: "Europe/Istanbul",
  terms: { fee_minor: "0", currency: "TRY" },
  capacity: { nominal: 10, maximum: 10 },
  interval: { starts_at: "2099-01-01T12:00:00Z", ends_at: "2099-01-01T13:00:00Z" },
};
beforeEach(() => {
  vi.resetAllMocks();
  m.call.mockResolvedValue({ items: [e], next_cursor: null });
  m.detail.mockImplementation(async (_scope, key) => {
    if (key !== id) throw Error("NOT_FOUND");
    return e;
  });
});
test("registration result primary id never replaces the selected event id during readback", async () => {
  const u = userEvent.setup();
  render(
    <EventsWorkspace
      actorId={v7()}
      studios={[
        {
          organization: {
            id: org,
            name: "Studio",
            state: "active",
            access_mode: "normal",
            version: 1,
          },
          centers: [
            {
              id: center,
              name: "Merkez",
              timezone: "Europe/Istanbul",
              state: "active",
              accessible: true,
              version: 1,
            },
          ],
        },
      ]}
    />,
  );
  await u.click(await screen.findByRole("button", { name: /Atölye/ }));
  await u.click(await screen.findByRole("button", { name: "Confirm registration" }));
  await waitFor(() => expect(m.detail).toHaveBeenCalledTimes(2));
  expect(m.detail).toHaveBeenLastCalledWith(
    expect.objectContaining({ orgId: org, centerId: center }),
    id,
  );
});
