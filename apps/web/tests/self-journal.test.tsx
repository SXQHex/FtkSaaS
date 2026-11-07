import { expect, test, vi } from "vitest";
import { screen } from "@testing-library/react";
import { v7 } from "uuid";
import { render } from "./render";
import { SessionBookings } from "../src/components/bookings/session-bookings";
import { setupStorageKey, recoverSetup } from "../src/lib/studio-setup";
import { attendanceTasksApi } from "../src/lib/attendance-tasks";
import { setupCall } from "../src/lib/studio-setup";
import tr from "../messages/tr.json";
vi.mock("../src/lib/studio-setup", async (load) => ({
  ...(await load<typeof import("../src/lib/studio-setup")>()),
  setupCall: vi.fn<typeof setupCall>(),
}));
const scope = { actorId: v7(), orgId: v7(), centerId: v7() },
  person = v7(),
  other = v7(),
  session = v7();
test("management pending command for another student does not appear in personal booking panel", () => {
  sessionStorage.clear();
  sessionStorage.setItem(
    setupStorageKey(scope, `bookings:${session}`),
    JSON.stringify({
      command: {
        operation: "reservation_create_v1",
        input: {
          org_id: scope.orgId,
          center_id: scope.centerId,
          operation_key: v7(),
          person_id: other,
          session_id: session,
          source_sale_id: v7(),
          mode: "flexible",
        },
      },
    }),
  );
  render(
    <SessionBookings
      scope={scope}
      session={
        {
          id: session,
          state: "planned",
          capacity: { total: 10, held: 0, remaining: 10, categories: null },
        } as never
      }
      fixedPerson={{ id: person, display_name: "Kendim", relationships: [] } as never}
    />,
  );
  expect(screen.queryByRole("button", { name: tr.setup.retrySame })).not.toBeInTheDocument();
  expect(recoverSetup(scope, `bookings:${session}`)).not.toBeNull();
});
test("own duty calendar sends the canonical person resource even when user has CM privileges", async () => {
  vi.mocked(setupCall).mockResolvedValueOnce({ items: [], next_cursor: null } as never);
  const interval = { starts_at: "2027-01-01T00:00:00Z", ends_at: "2027-01-02T00:00:00Z" };
  await attendanceTasksApi.list(scope, interval, undefined, person);
  expect(setupCall).toHaveBeenLastCalledWith(
    "calendar_get_v1",
    expect.objectContaining({
      resource: { kind: "person", id: person },
      center_id: scope.centerId,
    }),
  );
});
