import { expect, test } from "vitest";
import { v7 } from "uuid";
import { automationCommand, validAutomationCommand } from "../src/lib/automation-command";
const scope = { actorId: v7(), orgId: v7(), centerId: v7() };
const definition = {
  name: "Takip",
  trigger: { kind: "student_inactive" as const, offset_days: 7 },
  action: {
    kind: "create_followup" as const,
    channel: "in_app" as const,
    template_key: "followup",
  },
  execution_center_ids: [scope.centerId],
  enabled: true,
};
test("retry requires a failed available job with no committed result and the exact config version", () => {
  const source = { id: v7(), version: 4, definition };
  const job = {
    id: v7(),
    version: 2,
    center_id: scope.centerId,
    person_id: v7(),
    state: "failed" as const,
    attempts: 3,
    next_attempt_at: null,
    safe_error_code: "FAILED",
    result_reference: null,
    retry_available: true,
  };
  const c = automationCommand(scope, source, definition, job);
  expect(c.input.expected_version).toBe(4);
  expect(c.input.retry_job).toEqual({ id: job.id, version: 2 });
  expect(() =>
    automationCommand(scope, source, definition, { ...job, state: "succeeded" }),
  ).toThrow("invalidAutomation");
  expect(() =>
    automationCommand(scope, source, definition, {
      ...job,
      result_reference: { type: "notifications", id: v7() },
    }),
  ).toThrow("invalidAutomation");
  expect(() => automationCommand(scope, source, { ...definition, enabled: false }, job)).toThrow(
    "invalidAutomation",
  );
});
test("recovery binds automation to its own center, target and supported action", () => {
  const source = { id: v7(), version: 2, definition };
  const c = automationCommand(scope, source, definition);
  expect(
    validAutomationCommand(c.operation, c.input, scope.centerId, `automation:${source.id}`),
  ).toBe(true);
  expect(validAutomationCommand(c.operation, c.input, scope.centerId, `automation:${v7()}`)).toBe(
    false,
  );
  expect(
    validAutomationCommand(
      c.operation,
      { ...c.input, definition: { ...definition, execution_center_ids: [v7()] } },
      scope.centerId,
      `automation:${source.id}`,
    ),
  ).toBe(false);
});

test("organization automation retains its native scope and execution centers during disable", () => {
  const source = {
    id: v7(),
    version: 3,
    configKind: "organization" as const,
    definition: { ...definition, execution_center_ids: [scope.centerId, v7()] },
  };
  const c = automationCommand(scope, source, { ...source.definition, enabled: false });
  expect(c.input).not.toHaveProperty("center_id");
  expect(c.input.scope).toEqual({ kind: "organization" });
  expect(c.input.definition.execution_center_ids).toEqual(source.definition.execution_center_ids);
  expect(
    validAutomationCommand(c.operation, c.input, scope.centerId, `automation-org:${source.id}`),
  ).toBe(true);
  expect(
    validAutomationCommand(
      c.operation,
      { ...c.input, center_id: scope.centerId },
      scope.centerId,
      `automation-org:${source.id}`,
    ),
  ).toBe(false);
});

test("organization pending creation survives a selected-center switch and is globally discoverable", async () => {
  const { configurationJournalScope, automationSlot } =
      await import("../src/lib/automation-command"),
    { recoverSetup, setupStorageKey } = await import("../src/lib/studio-setup"),
    { discoverPendingOperations } = await import("../src/lib/pending-operations");
  sessionStorage.clear();
  const command = automationCommand(scope, null, definition, undefined, "organization"),
    slot = automationSlot("automation", scope, "organization"),
    journal = configurationJournalScope(scope, "organization");
  sessionStorage.setItem(setupStorageKey(journal, slot), JSON.stringify({ command }));
  const changed = configurationJournalScope({ ...scope, centerId: v7() }, "organization");
  expect(setupStorageKey(changed, slot)).toBe(setupStorageKey(journal, slot));
  expect(recoverSetup(changed, slot)).not.toBe("invalid");
  expect(discoverPendingOperations(scope.actorId)).toEqual([
    { scope: journal, slot, kind: "automation" },
  ]);
});
