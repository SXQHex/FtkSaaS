import { afterEach, expect, it, vi } from "vitest";
const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: async () => ({ call }) }));
import { readApplicationsPage, readLeadsPage } from "./leads-read";
import { BackendError } from "../../lib/backend";
const id = (n: number) => `019a7b00-0000-7000-8000-${String(n).padStart(12, "0")}`,
  scope = { accountId: id(1), orgId: id(2), centerId: id(3) };
afterEach(() => vi.resetAllMocks());
it("rejects unknown application state instead of labeling it closed", async () => {
  call.mockResolvedValue({
    items: [
      {
        entity: { type: "public_applications", id: id(4) },
        exists: true,
        state: null,
        versions: [{ entity: { type: "public_applications", id: id(4) }, version: 1 }],
        current: { operation: "public_application_review_v1", values: { application_id: id(4) } },
      },
    ],
  });
  await expect(readApplicationsPage(scope)).rejects.toThrow();
});
it("keeps a permitted lead when a person name is forbidden, without scanning other people", async () => {
  call.mockImplementation(async (operation) => {
    if (operation === "leads_list_v1")
      return {
        items: [
          {
            id: id(4),
            person_id: id(5),
            assigned_to: null,
            version: 1,
            source: "phone",
            interest: "Tango",
            state: "open",
            last_contact: null,
            due_followup: null,
          },
        ],
        next_cursor: "page-two",
      };
    throw new BackendError({ code: "FORBIDDEN", retryable: false, trace_id: id(9) });
  });
  const result = await readLeadsPage(scope, "Tango", "page-one");
  expect(result.items).toHaveLength(1);
  expect(result.people).toEqual([]);
  expect(result.next_cursor).toBe("page-two");
  expect(call).toHaveBeenCalledTimes(2);
  expect(call.mock.calls[0][1]).toMatchObject({
    query: "Tango",
    page: { limit: 20, cursor: "page-one" },
    org_id: scope.orgId,
    center_id: scope.centerId,
  });
});
