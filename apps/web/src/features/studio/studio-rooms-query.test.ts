import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { refreshStudioRooms, studioRoomsQuery } from "./studio-rooms-query";
import { readStudioRooms } from "./studio";

vi.mock("./studio", () => ({ readStudioRooms: vi.fn() }));

it("refreshes the room catalogue once and marks each scoped room label consumer stale", async () => {
  const queries = new QueryClient();
  const scope = { accountId: "actor-a", orgId: "org-a", centerId: "center-a" };
  const tenant = [scope.accountId, scope.orgId, scope.centerId];
  const catalogue = studioRoomsQuery(scope).queryKey;
  const affected = [
    ["instructor-calendar", ...tenant, "teacher", "week"],
    ["instructor-session", ...tenant, "teacher", "session"],
    ["overview-labels", ...tenant, [["session", 1]]],
    ["session-detail", ...tenant, "session", "rooms", 1],
    ["member-classes", ...tenant, "student"],
    ["member-reservations", ...tenant, "student"],
  ];
  const unaffected = [
    ["session-detail", ...tenant, "session", "participants"],
    ["instructor-calendar", scope.accountId, scope.orgId, "center-b", "teacher", "week"],
    ["member-classes", "actor-b", scope.orgId, scope.centerId, "student"],
  ];
  for (const key of [catalogue, ...affected, ...unaffected]) queries.setQueryData(key, []);
  const unrelatedRead = vi.fn(async () => []);
  const unsubscribe = new QueryObserver(queries, {
    queryKey: affected[0],
    queryFn: unrelatedRead,
    staleTime: Infinity,
  }).subscribe(() => {});
  vi.mocked(readStudioRooms).mockResolvedValueOnce([]);

  await expect(refreshStudioRooms(queries, scope)).resolves.toEqual([]);
  expect(readStudioRooms).toHaveBeenCalledExactlyOnceWith(
    scope,
    undefined,
    expect.any(AbortSignal),
  );
  for (const key of affected) expect(queries.getQueryState(key)?.isInvalidated).toBe(true);
  for (const key of unaffected) expect(queries.getQueryState(key)?.isInvalidated).toBe(false);
  expect(unrelatedRead).not.toHaveBeenCalled();
  unsubscribe();
});
