import type { WaitlistApi } from "../src/lib/waitlist";
import type { EarningsApi } from "../src/lib/earnings";
import { NativeCommandReview } from "../src/components/setup/native-command-review";
import { waitlistCommand } from "../src/lib/waitlist";
import { setupStorageKey } from "../src/lib/studio-setup";
import { discoverPendingOperations } from "../src/lib/pending-operations";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "./render";
import { WaitlistPanel } from "../src/components/bookings/waitlist-panel";
import { EarningsPanel } from "../src/components/earnings/earnings-panel";
import { InstructorPaymentForm } from "../src/components/earnings/instructor-payment-form";
import type { EarningView } from "@ftksaas/api-contracts";
import { setupCall, sendSetupCommand } from "../src/lib/studio-setup";
vi.mock("../src/lib/studio-setup", async (load) => ({
  ...(await load<typeof import("../src/lib/studio-setup")>()),
  sendSetupCommand: vi.fn<typeof sendSetupCommand>(),
  setupCall: vi.fn<typeof setupCall>(),
}));
const person = "019a2b3c-4d5e-7000-8000-000000000001",
  center = "019a2b3c-4d5e-7000-8000-000000000002",
  session = "019a2b3c-4d5e-7000-8000-000000000003";
const scope = { actorId: person, orgId: person, centerId: center };
const earning: EarningView = {
  id: session,
  person_id: person,
  center_id: center,
  session_id: session,
  event_assignment_id: null,
  amount_minor: "20000",
  paid_minor: "1000",
  remaining_minor: "19000",
  overpaid_minor: "0",
  direction: "add",
  previous_id: null,
  closure_id: session,
  version: 1,
  created_at: "2026-11-07T00:00:00Z",
  basis: { source: "lesson_agreement", currency: "TRY", quantity: 1, excluded_blocked: 0 },
  currency: "TRY",
  payments: [],
};
beforeEach(() => {
  sessionStorage.clear();
  vi.mocked(sendSetupCommand)
    .mockReset()
    .mockResolvedValue({} as never);
});
test("waitlist stays lazy, requires explicit confirmation and refreshes only after the write", async () => {
  const user = userEvent.setup(),
    list = vi.fn<WaitlistApi["list"]>().mockResolvedValue({ items: [], next_cursor: null }),
    changed = vi.fn<() => void>();
  render(
    <WaitlistPanel
      scope={scope}
      sessionId={session}
      personId={person}
      categories={null}
      api={{ list }}
      onChanged={changed}
    />,
  );
  expect(list).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Bekleme listesi ve yer teklifleri" }));
  await user.click(await screen.findByRole("button", { name: "Bekleme listesine katıl" }));
  expect(sendSetupCommand).not.toHaveBeenCalled();
  const review = screen.getByRole("region", { name: "İşlemi incele" });
  expect(within(review).getByRole("button", { name: "İşlemi uygula" })).toBeDisabled();
  await user.click(within(review).getByRole("checkbox"));
  await user.click(within(review).getByRole("button", { name: "İşlemi uygula" }));
  await waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
  expect(sendSetupCommand).toHaveBeenCalledWith(
    expect.objectContaining({
      operation: "waitlist_join_v1",
      input: expect.objectContaining({ person_id: person, session_id: session }),
    }),
  );
});
test("waitlist read rejection exposes no join control", async () => {
  const user = userEvent.setup(),
    list = vi.fn<WaitlistApi["list"]>().mockRejectedValue(Error("FORBIDDEN"));
  render(
    <WaitlistPanel
      scope={scope}
      sessionId={session}
      personId={person}
      categories={null}
      api={{ list }}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Bekleme listesi ve yer teklifleri" }));
  expect(await screen.findByRole("alert")).toBeVisible();
  expect(screen.queryByRole("button", { name: "Bekleme listesine katıl" })).not.toBeInTheDocument();
});
test("self earnings stays read-only and does not read a report or payment authority", async () => {
  const user = userEvent.setup(),
    list = vi
      .fn<EarningsApi["list"]>()
      .mockResolvedValue({ items: [earning], next_cursor: null, as_of: "2026-11-07T00:00:00Z" }),
    report = vi.fn<EarningsApi["report"]>();
  render(
    <EarningsPanel
      scope={scope}
      personId={person}
      timeZone="Europe/Istanbul"
      api={{ list, report }}
    />,
  );
  expect(list).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Hakediş ve eğitmen ödemeleri" }));
  expect(await screen.findByText(/Ödenen:/)).toBeVisible();
  expect(screen.queryByRole("button", { name: "Eğitmen ödemesi kaydet" })).not.toBeInTheDocument();
  expect(report).not.toHaveBeenCalled();
});
test("payment review preserves exact selected earning and local timestamp; editing removes approval", async () => {
  const user = userEvent.setup(),
    saved = vi.fn<() => void>();
  render(
    <InstructorPaymentForm
      scope={scope}
      personId={person}
      rows={[earning]}
      timeZone="Europe/Istanbul"
      onSaved={saved}
      onCancel={() => {}}
    />,
  );
  await user.type(screen.getByLabelText("Ödeme / düzeltme tutarı"), "12,50");
  await user.type(screen.getByLabelText("Para birimi"), "TRY");
  await user.type(screen.getByLabelText("Gerçek ödeme / düzeltme zamanı"), "2020-01-01T12:00");
  await user.click(screen.getByRole("checkbox"));
  await user.click(screen.getByRole("button", { name: "Ödemeyi incele" }));
  const review = screen.getByRole("region", { name: "İşlemi incele" });
  expect(sendSetupCommand).not.toHaveBeenCalled();
  await user.click(within(review).getByRole("checkbox"));
  await user.click(within(review).getByRole("button", { name: "İşlemi uygula" }));
  await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
  expect(sendSetupCommand).toHaveBeenCalledWith(
    expect.objectContaining({
      operation: "instructor_payment_record_v1",
      input: expect.objectContaining({
        earning_ids: [session],
        amount_minor: "1250",
        occurred_at: "2020-01-01T09:00:00.000Z",
      }),
    }),
  );
});

afterEach(() => vi.useRealTimers());
test("an offer expiring during review loses its apply control", async () => {
  vi.useFakeTimers();
  const expiresAt = new Date(Date.now() + 5000).toISOString();
  const draft = waitlistCommand(scope, session, person, "seat_offer_accept_v1", {
    id: session,
    version: 1,
    session_id: session,
    person_id: person,
    state: "active",
    expires_at: expiresAt,
  });
  render(
    <NativeCommandReview
      scope={scope}
      slot={draft.slot}
      command={draft.command}
      expiresAt={expiresAt}
      onSaved={() => {}}
      onBack={() => {}}
    >
      <p>Teklif incelemesi</p>
    </NativeCommandReview>,
  );
  fireEvent.click(screen.getByRole("checkbox"));
  expect(screen.getByRole("button", { name: "İşlemi uygula" })).toBeEnabled();
  await act(() => vi.advanceTimersByTime(5001));
  expect(screen.queryByRole("button", { name: "İşlemi uygula" })).not.toBeInTheDocument();
  expect(sendSetupCommand).not.toHaveBeenCalled();
});
test("uncertain waitlist write remains discoverable and replays the exact key after remount", async () => {
  const user = userEvent.setup(),
    draft = waitlistCommand(scope, session, person, "waitlist_join_v1");
  vi.mocked(sendSetupCommand).mockRejectedValueOnce(Error("response lost"));
  const initial = render(
    <NativeCommandReview
      scope={scope}
      slot={draft.slot}
      command={draft.command}
      onSaved={() => {}}
      onBack={() => {}}
    >
      <p>Katıl</p>
    </NativeCommandReview>,
  );
  await user.click(screen.getByRole("checkbox"));
  await user.click(screen.getByRole("button", { name: "İşlemi uygula" }));
  await waitFor(() => expect(discoverPendingOperations(person)).toHaveLength(1));
  const pending = JSON.parse(sessionStorage.getItem(setupStorageKey(scope, draft.slot))!);
  expect(pending.command.input.operation_key).toBe(draft.command.input.operation_key);
  initial.unmount();
  const saved = vi.fn<() => void>();
  render(
    <NativeCommandReview
      scope={scope}
      slot={draft.slot}
      command={draft.command}
      onSaved={saved}
      onBack={() => {}}
    >
      <p>Katıl</p>
    </NativeCommandReview>,
  );
  await user.click(screen.getByRole("button", { name: /Aynı işlemi/ }));
  await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
  expect(vi.mocked(sendSetupCommand).mock.calls[1][0]).toEqual(
    vi.mocked(sendSetupCommand).mock.calls[0][0],
  );
  expect(discoverPendingOperations(person)).toEqual([]);
});
test("partitioned sessions require an explicit waitlist category; ordinary sessions omit it", async () => {
  const user = userEvent.setup(),
    list = vi.fn<WaitlistApi["list"]>().mockResolvedValue({ items: [], next_cursor: null });
  render(
    <WaitlistPanel
      scope={scope}
      sessionId={session}
      personId={person}
      categories={{ male: 4, female: 4 }}
      api={{ list }}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Bekleme listesi ve yer teklifleri" }));
  const join = await screen.findByRole("button", { name: "Bekleme listesine katıl" });
  expect(join).toBeDisabled();
  await user.selectOptions(screen.getByLabelText("Kayıt kategorisi"), "female");
  await user.click(join);
  const review = screen.getByRole("region", { name: "İşlemi incele" });
  expect(within(review).getByText("Kadın")).toBeVisible();
});
test("a definitively failed recovered command drops the old draft and requests a source reload", async () => {
  const user = userEvent.setup(),
    draft = waitlistCommand(scope, session, person, "waitlist_join_v1"),
    saved = vi.fn<(code?: string) => void>();
  sessionStorage.setItem(
    setupStorageKey(scope, draft.slot),
    JSON.stringify({ command: draft.command }),
  );
  vi.mocked(setupCall).mockResolvedValueOnce({
    operation: draft.command.operation,
    key: draft.command.input.operation_key,
    status: "failed_final",
  } as never);
  render(
    <NativeCommandReview
      scope={scope}
      slot={draft.slot}
      command={draft.command}
      onSaved={saved}
      onBack={() => {}}
    >
      <p>Eski taslak</p>
    </NativeCommandReview>,
  );
  await user.click(screen.getByRole("button", { name: "İşlem sonucunu kontrol et" }));
  await waitFor(() => expect(saved).toHaveBeenCalledWith("OPERATION_FAILED"));
  expect(sessionStorage.getItem(setupStorageKey(scope, draft.slot))).toBeNull();
  expect(sendSetupCommand).not.toHaveBeenCalled();
});
