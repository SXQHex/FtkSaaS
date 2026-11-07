import { expect, test, vi } from "vitest";
import { waitlistApi, waitlistCommand, validWaitlistCommand } from "../src/lib/waitlist";
import { setupCall } from "../src/lib/studio-setup";
vi.mock("../src/lib/studio-setup", () => ({ setupCall: vi.fn<typeof setupCall>() }));
const person = "019a2b3c-4d5e-7000-8000-000000000001",
  center = "019a2b3c-4d5e-7000-8000-000000000002",
  session = "019a2b3c-4d5e-7000-8000-000000000003",
  entry = "019a2b3c-4d5e-7000-8000-000000000004",
  offer = "019a2b3c-4d5e-7000-8000-000000000005";
const scope = { actorId: person, orgId: person, centerId: center };
const row = {
  id: entry,
  center_id: center,
  session_id: session,
  person_id: person,
  state: "offered",
  version: 4,
  created_at: "2026-11-07T00:00:00Z",
  joined_at: "2026-11-07T00:00:00Z",
  offers: [
    {
      id: offer,
      entry_id: entry,
      session_id: session,
      person_id: person,
      state: "active",
      version: 2,
      created_at: "2026-11-07T00:00:00Z",
      expires_at: "2099-01-01T00:00:00Z",
    },
  ],
} as const;
function page(detail: unknown = row) {
  return {
    items: [
      {
        operation: "waitlist_join_v1",
        entity: { type: "waitlist_entries", id: entry },
        exists: true,
        versions: [{ entity: { type: "waitlist_entries", id: entry }, version: 4 }],
        waitlist_detail: detail,
      },
    ],
    next_cursor: null,
  };
}
test("normal waitlist reader uses exact selected person/session and preserves its cursor", async () => {
  vi.mocked(setupCall).mockResolvedValueOnce(page() as never);
  const result = await waitlistApi.list(scope, session, person);
  expect(result.items[0].id).toBe(entry);
  expect(setupCall).toHaveBeenLastCalledWith(
    "management_state_get_v1",
    expect.objectContaining({
      center_id: center,
      operation: "waitlist_join_v1",
      selector: { operation: "waitlist_join_v1", key: { person_id: person, session_id: session } },
      page: { limit: 25, sort: "created_at_asc" },
    }),
  );
});
test.each([
  { ...row, person_id: center },
  { ...row, center_id: person },
  { ...row, version: 3 },
  { ...row, offers: [{ ...row.offers[0], person_id: center }] },
])("reader rejects wrong scope or mismatched entity version", async (detail) => {
  vi.mocked(setupCall).mockResolvedValueOnce(page(detail) as never);
  await expect(waitlistApi.list(scope, session, person)).rejects.toThrow("invalidWaitlist");
});
test("expired offers cannot produce a new accept command; reject uses real offer version", () => {
  expect(() =>
    waitlistCommand(scope, session, person, "seat_offer_accept_v1", {
      ...row.offers[0],
      expires_at: "2020-01-01T00:00:00Z",
    }),
  ).toThrow("OFFER_UNAVAILABLE");
  const draft = waitlistCommand(scope, session, person, "seat_offer_reject_v1", row.offers[0]);
  expect(draft.command.input).toMatchObject({ offer_id: offer, expected_version: 2 });
  expect(
    validWaitlistCommand(draft.command.operation, draft.command.input, center, draft.slot),
  ).toBe(true);
  expect(
    validWaitlistCommand(
      draft.command.operation,
      draft.command.input,
      center,
      `waitlist-offer:${entry}`,
    ),
  ).toBe(false);
});
test("expired active offers cannot produce reject commands either", () => {
  expect(() =>
    waitlistCommand(scope, session, person, "seat_offer_reject_v1", {
      ...row.offers[0],
      expires_at: "2020-01-01T00:00:00Z",
    }),
  ).toThrow("OFFER_UNAVAILABLE");
});
