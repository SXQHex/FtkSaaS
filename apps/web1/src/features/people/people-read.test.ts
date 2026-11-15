import { beforeEach, describe, expect, it, vi } from "vitest";
const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("../../lib/scoped-backend", () => ({
  scopedBackend: vi.fn(async () => ({ call })),
}));
import { readPeoplePage } from "./people";
const scope = {
  accountId: "019a7b00-0000-7000-8000-000000000002",
  orgId: "019a7b00-0000-7000-8000-000000000003",
  centerId: "019a7b00-0000-7000-8000-000000000004",
};
beforeEach(() => {
  call.mockReset();
});
describe("server-scoped member page", () => {
  it.each(["active", "inactive"] as const)(
    "requests %s before server pagination without scanning other pages",
    async (status) => {
      const page = { items: [], next_cursor: "next-synthetic-page" };
      call.mockResolvedValue(page);
      expect(
        await readPeoplePage(scope, "  Fixture  ", "current-synthetic-page", status, true),
      ).toBe(page);
      expect(call).toHaveBeenCalledTimes(1);
      expect(call).toHaveBeenCalledWith(
        "people_list_v1",
        expect.objectContaining({
          org_id: scope.orgId,
          center_id: scope.centerId,
          query: "Fixture",
          student_status: status,
          include_member_summary: true,
          page: { limit: 20, cursor: "current-synthetic-page" },
        }),
      );
    },
  );
  it("omits the student filter for all people, including people without student history", async () => {
    call.mockResolvedValue({ items: [], next_cursor: null });
    await readPeoplePage(scope, "");
    const input = call.mock.calls[0]![1];
    expect(input).not.toHaveProperty("student_status");
    expect(input).not.toHaveProperty("query");
    expect(input).not.toHaveProperty("include_member_summary");
    expect(input.page).toEqual({ limit: 20 });
  });
  it("preserves server failures instead of replacing them with an empty successful page", async () => {
    const error = new Error("VERSION_CONFLICT");
    call.mockRejectedValue(error);
    await expect(readPeoplePage(scope, "", "stale-synthetic-page", "inactive")).rejects.toBe(error);
    expect(call).toHaveBeenCalledTimes(1);
  });
});
