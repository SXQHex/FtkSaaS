import { beforeEach, expect, it, vi } from "vitest";
import {
  readStudioAgreements,
  readStudioAvailabilityByResource,
  readStudioClosures,
  readStudioPrograms,
} from "./studio-reads";

const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: async () => ({ call }) }));

const scope = { accountId: "account", orgId: "organization", centerId: "center" };
const resources = [
  { kind: "person" as const, id: "first" },
  { kind: "person" as const, id: "second" },
];
const page = (items: unknown[], next_cursor?: string) => ({ items, next_cursor });
beforeEach(() => call.mockReset());

it("uses exact resource, class and person sets and retains the same selector on the next cursor", async () => {
  call.mockResolvedValueOnce(page([], "next")).mockResolvedValue(page([]));
  await expect(readStudioAvailabilityByResource(scope, resources)).resolves.toEqual(
    new Map([
      ["person/first", []],
      ["person/second", []],
    ]),
  );
  await expect(readStudioClosures(scope, resources)).resolves.toEqual([]);
  await expect(readStudioPrograms(scope, ["first", "second"])).resolves.toEqual([]);
  await expect(readStudioAgreements(scope, ["first", "second"])).resolves.toEqual([]);
  expect(call).toHaveBeenCalledTimes(5);
  for (const [index, operation] of [
    [1, "availability_save_v1"],
    [2, "availability_save_v1"],
    [3, "availability_exception_save_v1"],
  ] as const)
    expect(call).toHaveBeenNthCalledWith(
      index,
      "management_state_get_v1",
      expect.objectContaining({
        org_id: scope.orgId,
        center_id: scope.centerId,
        selector: { operation, key: { resources } },
        ...(index === 2 ? { page: { limit: 50, cursor: "next" } } : {}),
      }),
    );
  expect(call).toHaveBeenNthCalledWith(
    4,
    "management_state_get_v1",
    expect.objectContaining({
      selector: { operation: "program_preview_v1", key: { class_ids: ["first", "second"] } },
    }),
  );
  expect(call).toHaveBeenNthCalledWith(
    5,
    "instructor_agreements_list_v1",
    expect.objectContaining({
      person_ids: ["first", "second"],
      center_id: scope.centerId,
    }),
  );
});

it("rejects a returned agreement for a different subject or center", async () => {
  call.mockResolvedValueOnce(page([{ person_id: "other", center_id: scope.centerId }]));
  await expect(readStudioAgreements(scope, ["first", "second"])).rejects.toThrow(
    "STUDIO_UNAVAILABLE",
  );
  call.mockResolvedValueOnce(page([{ person_id: "first", center_id: "other" }]));
  await expect(readStudioAgreements(scope, ["first", "second"])).rejects.toThrow(
    "STUDIO_UNAVAILABLE",
  );
});
