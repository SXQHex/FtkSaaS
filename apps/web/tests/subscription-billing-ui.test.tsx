import { beforeEach, test, expect, vi } from "vitest";
import { screen, within, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { v7 } from "uuid";
import { render } from "./render";
import { SubscriptionBilling } from "../src/components/subscription/subscription-billing";
import { setupStorageKey } from "../src/lib/studio-setup";
import { subscriptionProof } from "../src/lib/subscription-actions";
import { readSubscription } from "../src/lib/plan-downgrade";
import tr from "../messages/tr.json";
vi.mock("../src/lib/plan-downgrade", () => ({
  readSubscription: vi.fn<typeof readSubscription>(),
}));
vi.mock("../src/lib/subscription-actions", () => ({
  subscriptionProof: vi.fn<typeof subscriptionProof>(),
}));
const scope = { actorId: v7(), orgId: v7() },
  target = v7(),
  second = v7();
const plan = () => ({
  plan: "pro",
  state: "active",
  cancel_at_period_end: false,
  subscription_version: 9,
  period_end: "2030-01-01T00:00:00Z",
  billing: {
    current: { id: v7(), period: "monthly", amount_minor: "100000", currency: "TRY" },
    period_change_options: [
      { id: target, period: "yearly", amount_minor: "1200000", currency: "TRY" },
      { id: second, period: "yearly", amount_minor: "1400000", currency: "TRY" },
    ],
  },
});
beforeEach(() => {
  sessionStorage.clear();
  vi.resetAllMocks();
  vi.mocked(readSubscription).mockResolvedValue(plan() as never);
});
test("period changes discard a late proof after selecting a different target", async () => {
  let finish!: (v: Awaited<ReturnType<typeof subscriptionProof>>) => void;
  vi.mocked(subscriptionProof).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  render(<SubscriptionBilling scope={scope} />);
  const user = userEvent.setup(),
    select = await screen.findByRole("combobox", { name: tr.subscription.period });
  await user.selectOptions(select, target);
  const region = screen.getByRole("region", { name: tr.subscription.title });
  await user.click(within(region).getAllByRole("button", { name: tr.subscription.review })[0]!);
  await waitFor(() => expect(subscriptionProof).toHaveBeenCalledTimes(1));
  await user.selectOptions(select, second);
  await act(async () =>
    finish({
      version: 9,
      period: {
        target_plan_id: target,
        expected_version: 9,
        amount_minor: "1200000",
        currency: "TRY",
        effective_at: "2030-01-01T00:00:00Z",
      },
    }),
  );
  expect(screen.queryByRole("checkbox", { name: tr.flows.confirm })).not.toBeInTheDocument();
});
test("returning to a target restores its exact uncertain intent and blocks preparing a new one", async () => {
  const slot = `subscription-period:${target}`;
  sessionStorage.setItem(
    setupStorageKey(scope, slot),
    JSON.stringify({
      command: {
        operation: "subscription_period_change_request_v1",
        input: {
          org_id: scope.orgId,
          operation_key: v7(),
          target_plan_id: target,
          expected_version: 9,
          amount_minor: "1200000",
          currency: "TRY",
          effective_at: "2030-01-01T00:00:00Z",
        },
      },
    }),
  );
  render(<SubscriptionBilling scope={scope} />);
  await userEvent.selectOptions(
    await screen.findByRole("combobox", { name: tr.subscription.period }),
    target,
  );
  expect(screen.getByText(tr.setup.pending)).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: tr.subscription.review })[0]).toBeDisabled();
  expect(subscriptionProof).not.toHaveBeenCalled();
});

test("a decimal payment amount passes native form validity and is reviewed in major currency units", async () => {
  const { fireEvent } = await import("@testing-library/react");
  render(<SubscriptionBilling scope={scope} />);
  const user = userEvent.setup();
  const amount = await screen.findByRole("textbox", { name: "Tutar (TRY)" });
  await user.type(amount, "123,50");
  await user.type(
    screen.getByRole("textbox", { name: tr.subscription.reference }),
    "Bank reference",
  );
  fireEvent.change(screen.getByLabelText(tr.subscription.date), {
    target: { value: "2030-01-01T12:00" },
  });
  expect(amount).toBeValid();
  await user.click(screen.getByRole("button", { name: tr.subscription.review }));
  expect(screen.getByRole("checkbox", { name: tr.flows.confirm })).toBeInTheDocument();
  expect(screen.getByText(/123,50/)).toHaveTextContent("Bank reference");
  expect(sessionStorage.getItem(setupStorageKey(scope, "subscription-payment"))).toBeNull();
});
