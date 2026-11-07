import { beforeEach, expect, test, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { v7 } from "uuid";
import { render } from "./render";
import { useSetupCommand, SetupFeedback } from "../src/components/setup/setup-command";
import { setupStorageKey } from "../src/lib/studio-setup";
import tr from "../messages/tr.json";
const m = vi.hoisted(() => ({
  call: vi.fn<(op: string, input: Record<string, unknown>) => Promise<unknown>>(),
  saved: vi.fn<() => void>(),
  rejected: vi.fn<(code: string) => void>(),
}));
vi.mock("../src/lib/studio-setup", async (load) => ({
  ...(await load<typeof import("../src/lib/studio-setup")>()),
  setupCall: m.call,
}));
const scope = { actorId: v7(), orgId: v7(), centerId: v7() },
  event = v7(),
  person = v7(),
  key = v7(),
  slot = `event-register:${event}:${person}`;
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  sessionStorage.setItem(
    setupStorageKey(scope, slot),
    JSON.stringify({
      command: {
        operation: "event_register_v1",
        input: {
          org_id: scope.orgId,
          center_id: scope.centerId,
          operation_key: key,
          event_id: event,
          person_id: person,
          preview: { id: v7(), token: "synthetic" },
        },
      },
    }),
  );
});
function Recovery() {
  const c = useSetupCommand(scope, slot, m.saved, m.rejected);
  return <SetupFeedback command={c} />;
}
test("successful capacity-closed status is not confirmed registration", async () => {
  m.call.mockResolvedValue({
    operation: "event_register_v1",
    key,
    status: "succeeded",
    result_reference: { type: "event_payment_preparations", id: v7() },
  });
  const u = userEvent.setup();
  render(<Recovery />);
  await u.click(screen.getByRole("button", { name: tr.setup.check }));
  await screen.findByText(tr.setup.CAPACITY_FULL);
  expect(m.saved).not.toHaveBeenCalled();
  expect(m.rejected).toHaveBeenCalledWith("CAPACITY_FULL");
  expect(sessionStorage.getItem(setupStorageKey(scope, slot))).toBeNull();
});
test("missing registration result type retains exact journal for explicit replay", async () => {
  m.call.mockResolvedValue({
    operation: "event_register_v1",
    key,
    status: "succeeded",
    result_reference: null,
  });
  const u = userEvent.setup();
  render(<Recovery />);
  await u.click(screen.getByRole("button", { name: tr.setup.check }));
  await screen.findByText(tr.setup.uncertain);
  expect(m.saved).not.toHaveBeenCalled();
  expect(sessionStorage.getItem(setupStorageKey(scope, slot))).not.toBeNull();
});
