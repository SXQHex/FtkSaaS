import { beforeEach, expect, test, vi } from "vitest";
import { screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { v7 } from "uuid";
import type { EventView } from "@ftksaas/api-contracts";
import { render } from "./render";
import { EventEditor } from "../src/components/events/event-editor";
import { EventActions } from "../src/components/events/event-actions";
import tr from "../messages/tr.json";
const m = vi.hoisted(() => ({
  catalog: vi.fn<() => Promise<unknown>>(),
  call: vi.fn<(op: string, input: Record<string, unknown>) => Promise<unknown>>(),
  send: vi.fn<(c: unknown) => Promise<unknown>>(),
  saved: vi.fn<() => void>(),
}));
vi.mock("../src/lib/events", () => ({ eventCatalog: m.catalog }));
vi.mock("../src/lib/studio-setup", async (load) => ({
  ...(await load<typeof import("../src/lib/studio-setup")>()),
  setupCall: m.call,
  sendSetupCommand: m.send,
}));
const scope = { actorId: v7(), orgId: v7(), centerId: v7() },
  id = v7(),
  person = v7(),
  registration = v7();
const event: EventView = {
  id,
  center_id: scope.centerId,
  name: "Atölye",
  version: 4,
  state: "published",
  attendance_state: "open",
  interval: { starts_at: "2099-01-01T12:00:00Z", ends_at: "2099-01-01T14:00:00Z" },
  timezone: "Europe/Istanbul",
  venue: {
    kind: "external",
    name: "Sahil",
    address: "Etkinlik alanı",
    latitude: 36.62,
    longitude: 29.11,
    timezone: "America/New_York",
  },
  capacity: { nominal: 15, maximum: 20 },
  assignments: [],
  assignment_terms: [],
  discipline_ids: [],
  terms: {
    fee_minor: "0",
    currency: "TRY",
    full_payment_required: false,
    allowed_product_version_ids: [],
    cancellation: {
      before_cutoff: "release",
      after_cutoff: "consume",
      no_show: "consume",
      cutoff_minutes: null,
    },
    refund: { method: "none" },
  },
  registrations: [
    {
      id: registration,
      person_id: person,
      display_name: "Öğrenci A",
      state: "active",
      attendance_result: "unmarked",
      version: 7,
      subscriber_number: "1061",
    },
  ],
};
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  m.catalog.mockResolvedValue({ rooms: [], disciplines: [], people: [], products: [] });
  m.send.mockResolvedValue({});
});
async function apply(u: ReturnType<typeof userEvent.setup>) {
  const region = await screen.findByRole("region", { name: tr.flows.review });
  expect(within(region).getByRole("button", { name: tr.flows.apply })).toBeDisabled();
  await u.click(within(region).getByRole("checkbox"));
  await u.click(within(region).getByRole("button", { name: tr.flows.apply }));
}
test("editing only name preserves external coordinates and independent venue timezone", async () => {
  const u = userEvent.setup();
  render(<EventEditor scope={scope} timeZone={event.timezone} event={event} onSaved={m.saved} />);
  const name = await screen.findByLabelText(tr.events.name);
  await u.clear(name);
  await u.type(name, "Yeni atölye");
  await u.click(screen.getByRole("button", { name: tr.events.review }));
  await apply(u);
  await waitFor(() => expect(m.send).toHaveBeenCalled());
  expect(m.send.mock.calls[0][0]).toMatchObject({
    operation: "event_save_v1",
    input: {
      event_id: id,
      expected_version: 4,
      name: "Yeni atölye",
      venue: event.venue,
      assignments: [],
    },
  });
});
test("missing monetary assignment metadata prevents an edit from deleting existing duties", async () => {
  const u = userEvent.setup();
  render(
    <EventEditor
      scope={scope}
      timeZone={event.timezone}
      event={{
        ...event,
        assignments: [{ person_id: person, duty: "instructor" }],
        assignment_terms: undefined,
      }}
      onSaved={m.saved}
    />,
  );
  await screen.findByLabelText(tr.events.name);
  expect(screen.getByRole("button", { name: tr.events.review })).toBeDisabled();
  expect(m.send).not.toHaveBeenCalled();
  await u.click(screen.getByRole("button", { name: tr.events.review }));
  expect(screen.queryByRole("region", { name: tr.flows.review })).not.toBeInTheDocument();
});
test("attendance uses registration version and distinct approval, then rereads authoritative event", async () => {
  const u = userEvent.setup();
  render(<EventActions scope={scope} event={event} onSaved={m.saved} />);
  await u.selectOptions(screen.getByLabelText(tr.events.action), "mark");
  await u.selectOptions(screen.getByLabelText(tr.events.registration), registration);
  await u.selectOptions(screen.getByLabelText(tr.events.attendance), "attended");
  await u.type(screen.getByLabelText(tr.events.reason), "Gerçek katılım");
  await u.click(screen.getByRole("button", { name: tr.events.review }));
  expect(m.send).not.toHaveBeenCalled();
  await apply(u);
  await waitFor(() => expect(m.saved).toHaveBeenCalledOnce());
  expect(m.send.mock.calls[0][0]).toMatchObject({
    operation: "event_attendance_mark_v1",
    input: {
      registration_id: registration,
      expected_version: 7,
      result: "attended",
      reason: "Gerçek katılım",
    },
  });
});

test("Pratik cannot be reviewed with no explicitly eligible product", async () => {
  const u = userEvent.setup();
  render(<EventEditor scope={scope} timeZone={event.timezone} event={event} onSaved={m.saved} />);
  await screen.findByLabelText(tr.events.name);
  await u.click(screen.getByRole("checkbox", { name: tr.events.practice }));
  await u.click(screen.getByRole("button", { name: tr.events.review }));
  await screen.findByRole("alert");
  expect(screen.queryByRole("region", { name: tr.flows.review })).not.toBeInTheDocument();
  expect(m.send).not.toHaveBeenCalled();
});

test("a final child-command rejection stays visible and does not refresh to an error-code event", async () => {
  const { ApiFailure } = await import("../src/lib/api");
  m.send.mockRejectedValueOnce(
    new ApiFailure({
      ok: false,
      error: { code: "VERSION_CONFLICT", retryable: false, trace_id: v7() },
    }),
  );
  const u = userEvent.setup();
  render(<EventActions scope={scope} event={event} onSaved={m.saved} />);
  await u.selectOptions(screen.getByLabelText(tr.events.action), "mark");
  await u.selectOptions(screen.getByLabelText(tr.events.registration), registration);
  await u.selectOptions(screen.getByLabelText(tr.events.attendance), "attended");
  await u.type(screen.getByLabelText(tr.events.reason), "Gerçek katılım");
  await u.click(screen.getByRole("button", { name: tr.events.review }));
  await apply(u);
  await screen.findByText(tr.setup.VERSION_CONFLICT);
  expect(m.saved).not.toHaveBeenCalled();
  expect(screen.queryByRole("region", { name: tr.flows.review })).not.toBeInTheDocument();
});

test("save confirmation formats event fee in major currency units while preserving native minor units", async () => {
  const u = userEvent.setup();
  render(
    <EventEditor
      scope={scope}
      timeZone={event.timezone}
      event={{ ...event, terms: { ...event.terms, fee_minor: "25000" } }}
      onSaved={m.saved}
    />,
  );
  await screen.findByLabelText(tr.events.name);
  await u.click(screen.getByRole("button", { name: tr.events.review }));
  const region = await screen.findByRole("region", { name: tr.flows.review });
  expect(region).toHaveTextContent(/250,00/);
});
