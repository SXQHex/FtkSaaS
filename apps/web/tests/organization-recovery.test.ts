import { test, expect, beforeEach } from "vitest";
import { v7 } from "uuid";
import { organizationRecoveries } from "../src/lib/organization-recovery";
import { setupStorageKey } from "../src/lib/studio-setup";
import { jobKey } from "../src/lib/job-record";
const scope = { actorId: v7(), orgId: v7() };
beforeEach(() => sessionStorage.clear());
test("a lost deletion intent stays discoverable after the organization leaves normal lists", () => {
  sessionStorage.setItem(
    setupStorageKey(scope, "organization-delete"),
    JSON.stringify({
      command: {
        operation: "organization_delete_apply_v1",
        input: {
          org_id: scope.orgId,
          operation_key: v7(),
          preview: { id: v7(), token: "synthetic" },
          all_data: true,
        },
      },
    }),
  );
  expect(organizationRecoveries(scope.actorId)).toEqual([{ scope, job: null, pending: true }]);
});
test("a successful privacy job remains discoverable independently of the organization list and other actors", () => {
  const job = v7();
  sessionStorage.setItem(jobKey(scope, "organization-delete"), JSON.stringify({ id: job }));
  expect(organizationRecoveries(scope.actorId)).toEqual([{ scope, job, pending: false }]);
  expect(organizationRecoveries(v7())).toEqual([]);
});
