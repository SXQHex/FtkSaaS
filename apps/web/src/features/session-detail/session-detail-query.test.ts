import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { invalidateSessionDetailViews, sessionDetailKeys } from "./session-detail-query";

const scope = { accountId: "actor-a", orgId: "org-a", centerId: "center-a" };
const other = { ...scope, centerId: "center-b" };
const session = "session-a";

it("M01 marks old participant and waitlist cursors stale without a refetch storm or crossing scope", async () => {
  const queries = new QueryClient();
  const old = sessionDetailKeys.participants(scope, session, undefined, "old-cursor");
  const first = sessionDetailKeys.participants(scope, session);
  const waitlistOld = [...sessionDetailKeys.session(scope, session), "waitlist", "entries", "old"];
  const anotherSession = sessionDetailKeys.participants(scope, "session-b", undefined, "old");
  const anotherCenter = sessionDetailKeys.participants(other, session, undefined, "old");
  const schedule = ["schedule-range", scope.accountId, scope.orgId, scope.centerId, "week-1"];
  const profile = ["profile-reservations", scope.accountId, scope.orgId, scope.centerId, "person"];
  const reader = vi.fn(async () => ({ items: ["old"], next_cursor: null }));
  await queries.fetchQuery({ queryKey: old, queryFn: reader, staleTime: Infinity });
  const unsubscribe = new QueryObserver(queries, {
    queryKey: old,
    queryFn: reader,
    staleTime: Infinity,
  }).subscribe(() => {});
  for (const key of [waitlistOld, anotherSession, anotherCenter, schedule, profile])
    queries.setQueryData(key, { items: ["old"] });
  await invalidateSessionDetailViews(queries, scope, session);
  expect(queries.getQueryState(old)?.isInvalidated).toBe(true);
  expect(queries.getQueryState(waitlistOld)?.isInvalidated).toBe(true);
  expect(queries.getQueryState(schedule)?.isInvalidated).toBe(true);
  expect(queries.getQueryState(profile)?.isInvalidated).toBe(true);
  expect(queries.getQueryState(anotherSession)?.isInvalidated).toBe(false);
  expect(queries.getQueryState(anotherCenter)?.isInvalidated).toBe(false);
  expect(reader).toHaveBeenCalledTimes(1);
  const fresh = vi.fn(async () => ({ items: ["fresh"], next_cursor: "new-cursor" }));
  await queries.fetchQuery({ queryKey: first, queryFn: fresh, staleTime: 0 });
  expect(queries.getQueryData(first)).toEqual({ items: ["fresh"], next_cursor: "new-cursor" });
  expect(reader).toHaveBeenCalledTimes(1);
  unsubscribe();
});
