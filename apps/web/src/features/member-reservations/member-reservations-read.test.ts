import { beforeEach, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { BackendError } from "../../lib/backend";
import { readOwnReservations } from "./member-reservations-read";
const { reservations, discovery, header } = vi.hoisted(() => ({
  reservations: vi.fn(),
  discovery: vi.fn(),
  header: vi.fn(),
}));
vi.mock("../member-profile/reservations", () => ({ readMemberReservations: reservations }));
vi.mock("../member-classes/member-classes-read", () => ({ readMemberClasses: discovery }));
vi.mock("../session-detail/session-detail-read", () => ({ readSessionHeader: header }));
const id = (n: number) => `019ab7b0-0000-7000-8000-${String(n).padStart(12, "0")}`;
const scope = { accountId: id(1), orgId: id(2), centerId: id(3) },
  person = id(4);
const session = {
  id: id(5),
  state: "planned",
  starts_at: "2026-11-17T15:00:00Z",
  ends_at: "2026-11-17T16:00:00Z",
};
const cancellation = {
  status: "available",
  source: "reservation_policy",
  policy_version_id: id(8),
  terms: {
    cutoff_minutes: 120,
    before_cutoff: "release",
    after_cutoff: "consume",
    no_show: "consume",
  },
  cutoff_at: "2026-11-17T13:00:00Z",
};
const native = () => ({
  id: session.id,
  title: "Görünür ders",
  member_lesson: {
    instructor_labels: ["Görünür eğitmen"],
    room_labels: ["Görünür salon"],
    cancellation: { ...cancellation, source: "current_policy" },
    own_reservation: { id: id(6), version: 2, cancellation },
    own_waitlist: { id: id(99) },
  },
});
beforeEach(() => {
  vi.resetAllMocks();
  reservations.mockResolvedValue({
    items: [
      { reservation: { id: id(6), session_id: session.id, version: 2, state: "active" }, session },
    ],
    nextCursor: "next",
    asOf: "2026-11-16T12:00:00Z",
  });
  discovery.mockResolvedValue([native()]);
  header.mockResolvedValue({ title: "Mevcut başlık" });
});
it("hydrates only visible upcoming session intervals, retaining cursor and native frozen cancellation", async () => {
  const result = await readOwnReservations(scope, person, "upcoming", "current");
  expect(reservations).toHaveBeenCalledWith(scope, person, "current", "upcoming", {
    sort: "starts_at_asc",
    includeSourceSummary: true,
    includeAttendance: false,
  });
  expect(discovery).toHaveBeenCalledExactlyOnceWith(scope, {
    starts_at: session.starts_at,
    ends_at: session.ends_at,
  });
  expect(result.nextCursor).toBe("next");
  expect(result.items[0]).toMatchObject({
    title: "Görünür ders",
    lesson: { instructors: ["Görünür eğitmen"], rooms: ["Görünür salon"], cancellation },
  });
  expect(result.items[0]!.lesson).not.toHaveProperty("own_waitlist");
  expect(header).not.toHaveBeenCalled();
});
it("shares the Query identity through the visible reservation, discovery and header readers", async () => {
  const readContext = { client: new QueryClient(), signal: new AbortController().signal };
  discovery.mockResolvedValueOnce([]);
  const result = await readOwnReservations(
    scope,
    person,
    "upcoming",
    "current",
    undefined,
    readContext,
  );
  expect(reservations).toHaveBeenCalledExactlyOnceWith(
    scope,
    person,
    "current",
    "upcoming",
    {
      sort: "starts_at_asc",
      includeSourceSummary: true,
      includeAttendance: false,
      sessionId: undefined,
    },
    readContext,
  );
  expect(discovery).toHaveBeenCalledExactlyOnceWith(
    scope,
    { starts_at: session.starts_at, ends_at: session.ends_at },
    readContext,
  );
  expect(header).toHaveBeenCalledExactlyOnceWith(scope, session, readContext);
  expect(result.items[0]!.title).toBe("Mevcut başlık");
});
it("never substitutes current policy for a mismatched own reservation or version", async () => {
  for (const own of [
    { id: id(99), version: 2, cancellation },
    { id: id(6), version: 99, cancellation },
    { id: id(6), version: 2, cancellation: { ...cancellation, source: "current_policy" } },
  ]) {
    discovery.mockResolvedValueOnce([
      { ...native(), member_lesson: { ...native().member_lesson, own_reservation: own } },
    ]);
    expect((await readOwnReservations(scope, person, "upcoming")).items[0]!.lesson).toBeUndefined();
  }
});
it("keeps history on its existing header reader without scanning discovery history", async () => {
  const result = await readOwnReservations(scope, person, "past");
  expect(discovery).not.toHaveBeenCalled();
  expect(header).toHaveBeenCalledTimes(1);
  expect(result.items[0]).toMatchObject({ title: "Mevcut başlık", lesson: undefined });
});
it("uses the existing header only when the native discovery has no visible session", async () => {
  discovery.mockResolvedValueOnce([]);
  expect((await readOwnReservations(scope, person, "upcoming")).items[0]!.title).toBe(
    "Mevcut başlık",
  );
});
it("preserves revoked and transient errors rather than fabricating a policy", async () => {
  for (const error of [
    new BackendError({ code: "SESSION_REVOKED", retryable: false, trace_id: id(9) }),
    new Error("TRANSPORT_ERROR"),
  ]) {
    discovery.mockRejectedValueOnce(error);
    await expect(readOwnReservations(scope, person, "upcoming")).rejects.toBe(error);
  }
});

it("shares one exact discovery interval for two different upcoming lessons", async () => {
  const second = { ...session, id: id(77) };
  reservations.mockResolvedValueOnce({
    items: [
      { reservation: { id: id(6), session_id: session.id, version: 2 }, session },
      { reservation: { id: id(76), session_id: second.id, version: 2 }, session: second },
    ],
    nextCursor: null,
    asOf: "2026-11-16T12:00:00Z",
  });
  discovery.mockResolvedValueOnce([
    native(),
    { ...native(), id: second.id, title: "İkinci görünür ders" },
  ]);
  const result = await readOwnReservations(scope, person, "upcoming");
  expect(discovery).toHaveBeenCalledTimes(1);
  expect(result.items.map((item) => item.title)).toEqual(["Görünür ders", "İkinci görünür ders"]);
});
