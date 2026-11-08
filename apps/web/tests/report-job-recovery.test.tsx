import { beforeEach, expect, test, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { v7 } from "uuid";
import { render } from "./render";
import { useSetupCommand, SetupFeedback } from "../src/components/setup/setup-command";
import { setupStorageKey, type SetupCommand } from "../src/lib/studio-setup";
import { jobKey, restoreJob, reportBinding } from "../src/lib/job-record";
import tr from "../messages/tr.json";
const m = vi.hoisted(() => ({
  call: vi.fn<(op: string, input: Record<string, unknown>) => Promise<unknown>>(),
  saved: vi.fn<() => void>(),
}));
vi.mock("../src/lib/studio-setup", async (load) => ({
  ...(await load<typeof import("../src/lib/studio-setup")>()),
  setupCall: m.call,
}));
const scope = { actorId: v7(), orgId: v7(), centerId: v7() },
  slot = `report-export:${scope.centerId}`,
  key = v7();
const command: SetupCommand = {
  operation: "report_export_start_v1",
  input: {
    org_id: scope.orgId,
    center_id: scope.centerId,
    operation_key: key,
    report: "collections_debts",
    filters: {
      center_ids: [scope.centerId],
      interval: { starts_at: "2026-11-01T00:00:00Z", ends_at: "2026-11-08T00:00:00Z" },
    },
    format: "csv",
  },
};
beforeEach(() => {
  m.call.mockReset();
  m.saved.mockReset();
  sessionStorage.clear();
  sessionStorage.setItem(setupStorageKey(scope, slot), JSON.stringify({ command }));
});
function Recovery() {
  const c = useSetupCommand(scope, slot, m.saved);
  return <SetupFeedback command={c} />;
}
test("lost export reply persists its confirmed native job before clearing the command, bound to original filters", async () => {
  const job = v7();
  m.call.mockResolvedValue({
    operation: command.operation,
    key,
    status: "succeeded",
    result_reference: { type: "report_jobs", id: job },
  });
  const u = userEvent.setup();
  render(<Recovery />);
  await u.click(screen.getByRole("button", { name: tr.setup.check }));
  await screen.findByText(tr.setup.saved);
  expect(m.saved).toHaveBeenCalledWith(job);
  expect(restoreJob(scope, slot, reportBinding(command.input))).toBe(job);
  expect(
    restoreJob(
      scope,
      slot,
      reportBinding({ ...command.input, filters: { ...command.input.filters, currency: "TRY" } }),
    ),
  ).toBeNull();
  expect(sessionStorage.getItem(setupStorageKey(scope, slot))).toBeNull();
});
test("unknown async result keeps the original key and does not manufacture a job", async () => {
  m.call.mockResolvedValue({
    operation: command.operation,
    key,
    status: "succeeded",
    result_reference: { type: "people", id: v7() },
  });
  const u = userEvent.setup();
  render(<Recovery />);
  await u.click(screen.getByRole("button", { name: tr.setup.check }));
  await screen.findByText(tr.setup.uncertain);
  expect(m.saved).not.toHaveBeenCalled();
  expect(sessionStorage.getItem(jobKey(scope, slot))).toBeNull();
  expect(sessionStorage.getItem(setupStorageKey(scope, slot))).not.toBeNull();
});
