import "../../i18n";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import type { AccountSessionView } from "../../lib/api-contracts/generated";
const { save } = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("./sessions", () => ({ saveSessionLabel: save }));
import { BackendError } from "../../lib/backend";
import { SessionLabel } from "./session-label";
afterEach(() => vi.resetAllMocks());
const session: AccountSessionView = {
  session_id: "550e8400-e29b-41d4-a716-446655440000",
  current: false,
  created_at: "2026-11-13T00:00:00Z",
  last_refreshed_at: "2026-11-13T00:00:00Z",
  expires_at: null,
  aal: "aal1",
  user_agent: null,
  label: null,
  version: 2,
};
it("keeps the native target, version and same-label intent when retrying a failed save", async () => {
  save.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce({ version: 3 });
  const refresh = vi.fn().mockResolvedValue(undefined),
    close = vi.fn();
  render(<SessionLabel session={session} onRefresh={refresh} onClose={close} />);
  await userEvent.type(screen.getByLabelText("Oturum etiketi"), " Laptop ");
  await userEvent.click(screen.getByRole("button", { name: "Kaydet" }));
  expect(await screen.findByRole("alert")).toBeVisible();
  expect(close).not.toHaveBeenCalled();
  expect(refresh).toHaveBeenCalledOnce();
  await userEvent.click(screen.getByRole("button", { name: "Kaydet" }));
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  expect(save.mock.calls[0][0]).toEqual(save.mock.calls[1][0]);
  expect(save.mock.calls[0][0]).toMatchObject({
    sessionId: session.session_id,
    version: 2,
    label: "Laptop",
  });
});
it("blocks overlong labels without changing the provider contract", async () => {
  render(<SessionLabel session={session} onRefresh={vi.fn()} onClose={vi.fn()} />);
  await userEvent.type(screen.getByLabelText("Oturum etiketi"), "a".repeat(81));
  await userEvent.click(screen.getByRole("button", { name: "Kaydet" }));
  expect(await screen.findByText("Etiket en fazla 80 karakter olabilir.")).toBeVisible();
  expect(save).not.toHaveBeenCalled();
});

it("closes a stale-version edit after rereading so a new confirmation uses the current row", async () => {
  save.mockRejectedValue(
    new BackendError({
      code: "VERSION_CONFLICT",
      retryable: false,
      trace_id: "019a7b00-0000-7000-8000-000000000001",
    }),
  );
  const close = vi.fn(),
    refresh = vi.fn().mockResolvedValue(undefined);
  render(<SessionLabel session={session} onClose={close} onRefresh={refresh} />);
  await userEvent.type(screen.getByLabelText("Oturum etiketi"), "Laptop");
  await userEvent.click(screen.getByRole("button", { name: "Kaydet" }));
  await waitFor(() => expect(close).toHaveBeenCalledExactlyOnceWith(true));
  expect(refresh).toHaveBeenCalledOnce();
  expect(refresh.mock.invocationCallOrder[0]).toBeLessThan(close.mock.invocationCallOrder[0]);
  expect(save).toHaveBeenCalledOnce();
});
