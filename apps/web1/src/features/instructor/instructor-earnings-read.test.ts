import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: async () => ({ call: mock.call }) }));
import { instructorEarningMonths, readInstructorEarningPage } from "./instructor-earnings-read";
const id = (n: number) => `019a7b00-0000-7000-8000-${String(n).padStart(12, "0")}`;
const scope = { accountId: id(1), orgId: id(2), centerId: id(3) };
const interval = { starts_at: "2026-11-01T00:00:00Z", ends_at: "2026-12-01T00:00:00Z" };
const row = {
  id: id(5),
  person_id: id(4),
  center_id: scope.centerId,
  amount_minor: "9007199254740993",
  paid_minor: "1",
  remaining_minor: "9007199254740992",
  currency: "TRY",
  direction: "add",
  created_at: "2026-11-16T12:00:00Z",
};
beforeEach(() => vi.clearAllMocks());
it("models month-only periods in the center IANA zone across DST and year rollover", async () => {
  const months = await instructorEarningMonths("America/New_York", "2027-12-01T03:00:00Z");
  expect(months.map((r) => r.id)).toEqual(["2027-11", "2027-10"]);
  expect(months[0]!.interval).toEqual({
    starts_at: "2027-11-01T04:00:00Z",
    ends_at: "2027-12-01T05:00:00Z",
  });
  expect((await instructorEarningMonths("Europe/Istanbul", "2027-01-15T12:00:00Z"))[1]!.id).toBe(
    "2026-12",
  );
});
it("keeps one cursor page, exact money strings and native self scope", async () => {
  mock.call.mockResolvedValue({ items: [row], next_cursor: "next" });
  expect(await readInstructorEarningPage(scope, id(4), interval, "current")).toEqual({
    items: [row],
    next_cursor: "next",
  });
  expect(mock.call).toHaveBeenCalledExactlyOnceWith(
    "earnings_list_v1",
    expect.objectContaining({
      person_id: id(4),
      center_id: scope.centerId,
      interval,
      page: { limit: 20, sort: "created_at_asc", cursor: "current" },
    }),
  );
});
it("rejects other people/centers and invalid money instead of displaying them", async () => {
  for (const change of [
    { person_id: id(9) },
    { center_id: id(9) },
    { paid_minor: "NaN" },
    { amount_minor: "1.5" },
    { created_at: interval.ends_at },
  ]) {
    mock.call.mockResolvedValue({ items: [{ ...row, ...change }], next_cursor: null });
    await expect(readInstructorEarningPage(scope, id(4), interval)).rejects.toThrow(
      "INSTRUCTOR_EARNINGS_UNAVAILABLE",
    );
  }
});
it("rejects duplicate identities and a repeated native cursor", async () => {
  mock.call
    .mockResolvedValueOnce({ items: [row, row], next_cursor: null })
    .mockResolvedValueOnce({ items: [row], next_cursor: "same" });
  await expect(readInstructorEarningPage(scope, id(4), interval)).rejects.toThrow();
  await expect(readInstructorEarningPage(scope, id(4), interval, "same")).rejects.toThrow();
});
