import { test, expect, vi } from "vitest";
import { v7 } from "uuid";
import { setupCall } from "../src/lib/studio-setup";
import { readOwnerResources } from "../src/lib/owner-retention";
vi.mock("../src/lib/studio-setup", () => ({ setupCall: vi.fn<typeof setupCall>() }));
const scope = { actorId: v7(), orgId: v7(), centerId: v7() };
const target = v7(),
  subscription = v7(),
  room = v7();
const row = () => ({
  operation: "subscription_downgrade_request_v1",
  exists: true,
  entity: { type: "saas_subscriptions", id: subscription },
  versions: [{ entity: { type: "saas_subscriptions", id: subscription }, version: 9 }],
  retained_resource: { kind: "rooms", id: room, display_name: "Room", subscriber_number: null },
});
test("Owner discovers resources through the version-bound narrow subscription reader without CM reads", async () => {
  vi.mocked(setupCall).mockResolvedValueOnce({ items: [row()], next_cursor: null } as never);
  expect((await readOwnerResources(scope, target, 9, "rooms")).items).toEqual([
    { id: room, name: "Room", subscriber_number: null },
  ]);
  expect(setupCall).toHaveBeenLastCalledWith("management_state_get_v1", {
    org_id: scope.orgId,
    operation: "subscription_downgrade_request_v1",
    selector: {
      operation: "subscription_downgrade_request_v1",
      key: { target_plan_id: target, kept_center_id: scope.centerId, expected_version: 9 },
      resources: "rooms",
    },
    page: { limit: 200, sort: "created_at_asc" },
  });
});
test.each(["version", "kind", "entity", "duplicate"])(
  "rejects mismatched retained catalog %s",
  async (kind) => {
    const r = row();
    if (kind === "version") r.versions[0]!.version = 8;
    if (kind === "kind") r.retained_resource.kind = "students";
    if (kind === "entity") r.versions[0]!.entity.id = v7();
    vi.mocked(setupCall).mockResolvedValueOnce({
      items: kind === "duplicate" ? [r, r] : [r],
      next_cursor: null,
    } as never);
    await expect(readOwnerResources(scope, target, 9, "rooms")).rejects.toThrow(
      "invalidPlanChange",
    );
  },
);
