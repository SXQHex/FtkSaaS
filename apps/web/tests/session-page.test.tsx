import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import type { SessionView } from "@ftksaas/api-contracts";
import { render } from "./render";
import { SessionPage } from "../src/components/calendar/session-page";
const mocks = vi.hoisted(() => ({
  session: vi.fn<typeof import("../src/lib/api").getSession>(),
  replace: vi.fn<(path: string) => void>(),
  refresh: vi.fn<() => void>(),
  unsubscribe: vi.fn<() => void>(),
  listener: null as null | ((event: string) => void),
}));
const router = { replace: mocks.replace, refresh: mocks.refresh };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("../src/components/preferences", () => ({ Preferences: () => null }));
vi.mock("../src/lib/api", async (original) => ({
  ...(await original<typeof import("../src/lib/api")>()),
  getSession: mocks.session,
}));
vi.mock("../src/lib/supabase/client", () => ({
  browserClient: () => ({
    auth: {
      onAuthStateChange: (listener: (event: string) => void) => {
        mocks.listener = listener;
        return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
      },
    },
  }),
}));
const session: SessionView = {
  id: "session",
  class_id: null,
  discipline_id: "discipline",
  format: "group",
  starts_at: "2026-10-29T15:00:00Z",
  ends_at: "2026-10-29T16:00:00Z",
  state: "cancelled",
  attendance_state: "open",
  assignments: [],
  version: 3,
  capacity: {
    total: 10,
    held: 3,
    remaining: 7,
    category_held: null,
    category_remaining: null,
    room_capacity: 20,
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue(session);
});
test("direct links use the backend session scope without requiring an administrative center list", async () => {
  render(<SessionPage actorId="actor" orgId="org" sessionId="session" />);
  expect(await screen.findByText("İptal edildi")).toBeVisible();
  expect(screen.getByText("Açık", { exact: true })).toBeVisible();
  expect(screen.getByText(/Saatler cihazının saat diliminde/)).toBeVisible();
  expect(mocks.session).toHaveBeenCalledExactlyOnceWith("org", undefined, "session");
});
test("failed refresh hides the old session and retry loads fresh state", async () => {
  const user = userEvent.setup();
  mocks.session
    .mockResolvedValueOnce(session)
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({ ...session, state: "planned" });
  render(<SessionPage actorId="actor" orgId="org" sessionId="session" />);
  await screen.findByText("İptal edildi");
  await user.click(screen.getByRole("button", { name: "Bilgileri yenile" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Bağlantı kurulamadı");
  expect(screen.queryByText("İptal edildi")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Yeniden dene" }));
  expect(await screen.findByText("Planlandı")).toBeVisible();
});
test("sign-out clears the detail and a late response cannot restore it", async () => {
  let finish!: (value: SessionView) => void;
  mocks.session.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  render(<SessionPage actorId="actor" orgId="org" sessionId="session" />);
  act(() => mocks.listener?.("SIGNED_OUT"));
  await act(async () => finish(session));
  expect(screen.queryByText("İptal edildi")).not.toBeInTheDocument();
  expect(mocks.replace).toHaveBeenCalledWith("/giris?next=%2Forganizasyon%2Forg%2Fseans%2Fsession");
});
test("access denial remains an error without session facts or a demo fallback", async () => {
  const { ApiFailure } = await import("../src/lib/api");
  mocks.session.mockRejectedValue(
    new ApiFailure({
      ok: false,
      error: { code: "FORBIDDEN", retryable: false, trace_id: "synthetic" },
    }),
  );
  render(<SessionPage actorId="actor" orgId="other-org" sessionId="session" />);
  expect(await screen.findByRole("alert")).toHaveTextContent("yetkin");
  expect(screen.queryByText("Kontenjan")).not.toBeInTheDocument();
});
