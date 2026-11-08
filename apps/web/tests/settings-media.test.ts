import { test, expect } from "vitest";
import { v7 } from "uuid";
import { recoverSetup, setupStorageKey } from "../src/lib/studio-setup";
const scope = { actorId: v7(), orgId: v7() };
function recover(input: object, slot = "settings-media:organization") {
  sessionStorage.setItem(
    setupStorageKey(scope, slot),
    JSON.stringify({
      command: {
        operation: "settings_update_v1",
        input: {
          org_id: scope.orgId,
          scope: "organization",
          operation_key: v7(),
          expected_version: 2,
          reason: "Logo",
          patch: {},
          ...input,
        },
      },
    }),
  );
  return recoverSetup(scope, slot);
}
test("logo removal and bounded typed raster intents recover only in their native organization slot", () => {
  expect(recover({ logo_image: null })).not.toBe("invalid");
  expect(
    recover({ logo_image: { mime: "image/png", data_base64: "AAAA", checksum: "a".repeat(64) } }),
  ).not.toBe("invalid");
  expect(
    recover({
      logo_image: { mime: "image/svg+xml", data_base64: "AAAA", checksum: "a".repeat(64) },
    }),
  ).toBe("invalid");
  expect(recover({ logo_image: null, patch: { description: "smuggled" } })).toBe("invalid");
  expect(recover({ logo_image: null }, "settings-editor:organization")).toBe("invalid");
});
