import { beforeEach, describe, expect, it, vi } from "vitest";
import { readStudioSetup } from "./setup";
import { readClosureContext } from "./closure";
import { enrollmentIntent, readInstructorEnrollment } from "./instructor-enrollment";
import type { InstructorRecord } from "./studio-reads";
import type { StudioResources } from "./studio";

const mocks = vi.hoisted(() => ({ call: vi.fn(), instructors: vi.fn() }));
vi.mock("./studio", () => ({
  studioBackend: async () => ({ call: mocks.call }),
  studioPages: async (read: (cursor?: string) => Promise<{ items: unknown[] }>) =>
    (await read()).items,
}));
vi.mock("./studio-reads", () => ({
  readStudioInstructors: mocks.instructors,
  readStudioAvailability: async () => [],
}));
const scope = { accountId: "actor", orgId: "organization", centerId: "center" };
const person = {
  id: "person",
  display_name: "Fixture",
  version: 1,
  contacts: [],
  relationships: [],
  discipline_relationships: [],
};
const resources: StudioResources = { rooms: [], classes: [], disciplines: [] };
let summary:
  | { document_published: boolean; member_invitation_sent: boolean; as_of: string }
  | undefined;
let rejected = false;
beforeEach(() => {
  vi.clearAllMocks();
  summary = {
    document_published: true,
    member_invitation_sent: false,
    as_of: "2026-11-14T12:00:00Z",
  };
  rejected = false;
  mocks.instructors.mockResolvedValue([]);
  mocks.call.mockImplementation(async (op, request) => {
    if (op === "centers_list_v1") {
      expect(request).toMatchObject({
        org_id: scope.orgId,
        center_id: scope.centerId,
        include_setup_status: true,
      });
      if (rejected) throw new Error("FORBIDDEN");
      return {
        items: [
          {
            id: scope.centerId,
            accessible: true,
            name: "Fixture",
            timezone: "Europe/Istanbul",
            setup_status: summary,
          },
        ],
        next_cursor: null,
      };
    }
    if (op === "settings_catalog_get_v1") return { scope: "center", fields: [] };
    if (op === "settings_get_v1")
      return { scope: "center", values: {}, as_of: "2026-11-14T12:00:00Z" };
    if (op === "products_list_v1" || op === "management_state_get_v1")
      return { items: [], next_cursor: null };
    if (op === "person_get_v1") return person;
    throw new Error(`Unexpected operation ${op}`);
  });
});
describe("scoped setup evidence", () => {
  it("keeps provider-confirmed false distinct from unknown and reads no recipients or files", async () => {
    const result = await readStudioSetup(scope, resources, []);
    expect(result.documents).toBe(true);
    expect(result.invitations).toBe(false);
    expect(mocks.call.mock.calls.map(([op]) => op).sort((a, b) => a.localeCompare(b))).toEqual(
      ["centers_list_v1", "products_list_v1", "settings_catalog_get_v1", "settings_get_v1"].sort(
        (a, b) => a.localeCompare(b),
      ),
    );
  });
  it.each(["missing", "forbidden"])(
    "does not turn %s summary into completion or absence",
    async (mode) => {
      if (mode === "missing") summary = undefined;
      else rejected = true;
      const result = await readStudioSetup(scope, resources, []);
      expect(result.documents).toBeNull();
      expect(result.invitations).toBeNull();
    },
  );

  it("keeps setup evidence unknown when the exact center response has a continuation", async () => {
    mocks.call.mockResolvedValueOnce({
      items: [
        {
          id: scope.centerId,
          accessible: true,
          name: "Fixture",
          timezone: "Europe/Istanbul",
          setup_status: summary,
        },
      ],
      next_cursor: "unexpected",
    });
    const result = await readStudioSetup(scope, resources, []);
    expect(result.documents).toBeNull();
    expect(result.invitations).toBeNull();
    expect(mocks.call).toHaveBeenCalledWith(
      "centers_list_v1",
      expect.objectContaining({ center_id: scope.centerId, page: { limit: 1 } }),
    );
  });
});
describe("closure center selection", () => {
  const center = { id: scope.centerId, accessible: true, version: 7, timezone: "Europe/Istanbul" };
  const other = { ...center, id: "other-center" };

  it("reads the single selected center from the normal reader", async () => {
    mocks.call.mockImplementationOnce(async (_operation, request) => ({
      items: request.center_id ? [center] : [other, center],
      next_cursor: null,
    }));
    await expect(readClosureContext(scope)).resolves.toEqual({ scope, center });
    expect(mocks.call).toHaveBeenCalledExactlyOnceWith(
      "centers_list_v1",
      expect.objectContaining({
        org_id: scope.orgId,
        center_id: scope.centerId,
        page: { limit: 1 },
      }),
    );
    expect(mocks.call.mock.calls[0]?.[1]).not.toHaveProperty("include_setup_status");
  });

  it.each([
    { items: [other], next_cursor: null },
    { items: [{ ...center, accessible: false }], next_cursor: null },
    { items: [center, other], next_cursor: null },
    { items: [center], next_cursor: "unexpected" },
  ])("rejects a center response outside the exact read contract %#", async (page) => {
    mocks.call.mockResolvedValueOnce(page);
    await expect(readClosureContext(scope)).rejects.toThrow("STUDIO_UNAVAILABLE");
    expect(mocks.call).toHaveBeenCalledTimes(1);
  });
});
describe("verified assignment binding", () => {
  it.each([true, false, null])(
    "distinguishes an active duty from account access %s",
    async (access) => {
      const role: InstructorRecord = {
        assignmentId: "role",
        version: 2,
        active: true,
        accountAccessGranted: access,
        person,
      };
      mocks.instructors.mockResolvedValue([role]);
      const result = await readInstructorEnrollment(scope, person.id);
      expect(result.activeRole).toBe(true);
      expect(result.accountAccessGranted).toBe(access);
      if (access === true)
        expect(() => enrollmentIntent({ ...result, activeLink: true }, "grant")).toThrow(
          "ENROLLMENT_CHANGED",
        );
      else
        expect(enrollmentIntent({ ...result, activeLink: true }, "grant")).toMatchObject({
          kind: "grant",
          personId: person.id,
        });
    },
  );
  it("does not report access from a revoked assignment", async () => {
    mocks.instructors.mockResolvedValue([
      { assignmentId: "role", version: 3, active: false, accountAccessGranted: true, person },
    ]);
    const result = await readInstructorEnrollment(scope, person.id);
    expect(result.activeRole).toBe(false);
    expect(result.accountAccessGranted).toBe(false);
  });
});
