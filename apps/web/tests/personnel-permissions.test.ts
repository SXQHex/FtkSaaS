import { expect, test, vi } from "vitest";
import { v7 } from "uuid";
import { setupCall } from "../src/lib/studio-setup";
import { readPermission } from "../src/lib/personnel-permissions";
vi.mock("../src/lib/studio-setup", () => ({ setupCall: vi.fn<typeof setupCall>() }));
const scope = { actorId: v7(), orgId: v7(), centerId: v7() },
  person = v7();
function page(override = false, enabled?: boolean) {
  return {
    items: [
      {
        operation: "permission_set_v1",
        entity: { type: "people", id: person },
        exists: true,
        state: "active",
        versions: [{ entity: { type: "people", id: person }, version: 7 }],
        current: {
          operation: "permission_set_v1",
          values: {
            person_id: person,
            permission: "sale.write",
            override_exists: override,
            ...(enabled === undefined ? {} : { enabled }),
          },
        },
      },
    ],
    next_cursor: null,
    as_of: "2026-11-07T00:00:00Z",
  };
}
test("permission discovery preserves missing override and actual person version without inventing effective permission", async () => {
  vi.mocked(setupCall).mockResolvedValueOnce(page() as never);
  expect(await readPermission(scope, person, "sale.write")).toEqual({
    version: 7,
    overrideExists: false,
  });
  expect(setupCall).toHaveBeenLastCalledWith("management_state_get_v1", {
    org_id: scope.orgId,
    center_id: scope.centerId,
    operation: "permission_set_v1",
    selector: {
      operation: "permission_set_v1",
      key: { person_id: person, permission: "sale.write" },
    },
  });
});
test("explicit false override remains false rather than falling back to a role default", async () => {
  vi.mocked(setupCall).mockResolvedValueOnce(page(true, false) as never);
  expect(await readPermission(scope, person, "sale.write")).toEqual({
    version: 7,
    overrideExists: true,
    enabled: false,
  });
});
test.each([
  "foreign-person",
  "wrong-entity",
  "wrong-permission",
  "missing-version",
  "unknown-override",
  "missing-enabled",
  "extra-enabled",
  "extra-row",
  "cursor",
])("rejects malformed permission projection: %s", async (kind) => {
  const p = page(),
    r = p.items[0]!;
  if (kind === "foreign-person") r.entity.id = v7();
  if (kind === "wrong-entity") r.entity.type = "role_assignments";
  if (kind === "wrong-permission") r.current.values.permission = "finance.collect";
  if (kind === "missing-version") r.versions = [];
  if (kind === "unknown-override")
    delete (r.current.values as Record<string, unknown>).override_exists;
  if (kind === "missing-enabled") r.current.values.override_exists = true;
  if (kind === "extra-enabled") (r.current.values as Record<string, unknown>).enabled = true;
  if (kind === "extra-row") p.items.push(r);
  if (kind === "cursor") Object.assign(p, { next_cursor: "next" });
  vi.mocked(setupCall).mockResolvedValueOnce(p as never);
  await expect(readPermission(scope, person, "sale.write")).rejects.toThrow("invalidPermission");
});
