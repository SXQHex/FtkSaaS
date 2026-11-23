import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { refreshStudioRooms, studioRoomQuery, studioRoomsQuery } from "./studio-rooms-query";
import { scheduleCacheKeys } from "../schedule/schedule-cache";
import { readStudioResource, readStudioRooms, type RoomRecord } from "./studio";

vi.mock("./studio", () => ({ readStudioRooms: vi.fn(), readStudioResource: vi.fn() }));

it("refreshes the room catalogue once and marks each scoped room label consumer stale", async () => {
  const queries = new QueryClient();
  const scope = { accountId: "actor-a", orgId: "org-a", centerId: "center-a" };
  const tenant = [scope.accountId, scope.orgId, scope.centerId];
  const catalogue = studioRoomsQuery(scope).queryKey;
  const affected = [
    studioRoomQuery(queries, scope, "room-a").queryKey,
    [...scheduleCacheKeys.overview(scope), "timezone"],
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

it("seeds a verified room without restarting directory freshness and reads a cold exact room", async () => {
  const queries = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });
  const scope = { accountId: "actor-a", orgId: "org-a", centerId: "center-a" };
  const room: RoomRecord = {
    scope,
    kind: "room",
    id: "room-a",
    version: 1,
    name: "Sentetik salon",
    active: true,
    capacity: 10,
  };
  const updatedAt = Date.now() - 10_000;
  const catalogue = studioRoomsQuery(scope).queryKey;
  queries.setQueryData(catalogue, [room], { updatedAt });
  const exact = studioRoomQuery(queries, scope, room.id);
  await expect(queries.fetchQuery(exact)).resolves.toEqual(room);
  expect(queries.getQueryState(exact.queryKey)?.dataUpdatedAt).toBe(updatedAt);
  expect(readStudioResource).not.toHaveBeenCalled();

  queries.removeQueries({ queryKey: exact.queryKey, exact: true });
  await queries.invalidateQueries({ queryKey: catalogue, exact: true, refetchType: "none" });
  vi.mocked(readStudioResource).mockResolvedValueOnce({ ...room, version: 2 });
  await expect(queries.fetchQuery(studioRoomQuery(queries, scope, room.id))).resolves.toMatchObject(
    { version: 2 },
  );
  expect(readStudioResource).toHaveBeenCalledExactlyOnceWith(
    scope,
    "room",
    room.id,
    expect.anything(),
  );
});
