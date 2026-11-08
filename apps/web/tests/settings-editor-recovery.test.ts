import { test, expect } from "vitest";
import { v7 } from "uuid";
import { recoverSetup, setupStorageKey } from "../src/lib/studio-setup";
const actor = v7(),
  scope = { actorId: actor, orgId: actor };
function read(target: string, patch: object, org?: string) {
  const slot = `settings-editor:${target}`;
  sessionStorage.setItem(
    setupStorageKey(scope, slot),
    JSON.stringify({
      command: {
        operation: "settings_update_v1",
        input: {
          scope: target,
          operation_key: v7(),
          expected_version: 0,
          patch,
          reason: "Explicit preference",
          ...(org ? { org_id: org } : {}),
        },
      },
    }),
  );
  return recoverSetup(scope, slot);
}
test("own settings recover without an organization while rejecting member fields and tenant injection", () => {
  expect(read("user", { font_scale: 1.25 })).not.toBe("invalid");
  expect(read("user", { profile_visible: true })).toBe("invalid");
  expect(read("user", { theme: "dark" }, actor)).toBe("invalid");
});
test("member template edits retain the approved array and cannot write organization policy", () => {
  expect(read("member", { report_templates: [] }, actor)).not.toBe("invalid");
  expect(read("member", { primary_color: "#112233" }, actor)).toBe("invalid");
});

test("history restore retains one selected immutable source and rejects mixed inheritance", () => {
  const slot = "settings-editor:member",
    input = {
      scope: "member",
      org_id: actor,
      operation_key: v7(),
      expected_version: 4,
      patch: {},
      reason: "Restore selected field",
      history_source: { id: v7(), fields: ["in_app_marketing"] },
    };
  sessionStorage.setItem(
    setupStorageKey(scope, slot),
    JSON.stringify({ command: { operation: "settings_update_v1", input } }),
  );
  expect(recoverSetup(scope, slot)).not.toBe("invalid");
  sessionStorage.setItem(
    setupStorageKey(scope, slot),
    JSON.stringify({
      command: {
        operation: "settings_update_v1",
        input: { ...input, inherit_fields: ["report_templates"] },
      },
    }),
  );
  expect(recoverSetup(scope, slot)).toBe("invalid");
});
