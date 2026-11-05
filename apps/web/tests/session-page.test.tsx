import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import type { SessionView } from "@ftksaas/api-contracts";
import { render } from "./render";
import { setupStorageKey } from "../src/lib/studio-setup";
import { SessionPage } from "../src/components/calendar/session-page";
const mocks = vi.hoisted(() => ({
  account: vi.fn<typeof import("../src/lib/api").getAccount>(),
  session: vi.fn<typeof import("../src/lib/api").getSession>(),
  replace: vi.fn<(path: string) => void>(),
  refresh: vi.fn<() => void>(),
  unsubscribe: vi.fn<() => void>(),
  listener: null as null | ((event: string, session?: { user: { id: string } } | null) => void),
}));
const router = { replace: mocks.replace, refresh: mocks.refresh };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("../src/components/preferences", () => ({ Preferences: () => null }));
vi.mock("../src/lib/api", async (original) => ({
  ...(await original<typeof import("../src/lib/api")>()),
  getSession: mocks.session,
  getAccount: mocks.account,
}));
vi.mock("../src/lib/supabase/client", () => ({
  browserClient: () => ({
    auth: {
      onAuthStateChange: (listener: NonNullable<typeof mocks.listener>) => {
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
  sessionStorage.clear();
  mocks.account.mockResolvedValue({
    id: "core-account",
    state: "active",
    display_name: "Synthetic",
  });
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
  expect(mocks.replace).toHaveBeenCalledWith("/login?next=%2Forganizasyon%2Forg%2Fseans%2Fsession");
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

test("scoped direct session exposes booking controls after the backend validates the center", async () => {
  render(<SessionPage actorId="actor" orgId="org" sessionId="session" centerId="center" />);
  expect(await screen.findByRole("button", { name: "Rezervasyonları yönet" })).toBeVisible();
  expect(mocks.session).toHaveBeenCalledExactlyOnceWith("org", "center", "session");
});
test("wrong center read failure never exposes a booking command", async () => {
  const { ApiFailure } = await import("../src/lib/api");
  mocks.session.mockRejectedValue(
    new ApiFailure({
      ok: false,
      error: { code: "NOT_FOUND", retryable: false, trace_id: "synthetic" },
    }),
  );
  render(<SessionPage actorId="actor" orgId="org" sessionId="session" centerId="foreign" />);
  await screen.findByRole("alert");
  expect(screen.queryByRole("button", { name: "Rezervasyonları yönet" })).not.toBeInTheDocument();
});

test("root journal remains recoverable on the direct route when account and Auth UUIDs differ", async () => {
  const id = "019a2b3c-4d5e-7000-8000-000000000080";
  const scope = { actorId: "core-account", orgId: "org", centerId: "center" };
  sessionStorage.setItem(
    setupStorageKey(scope, "bookings:session"),
    JSON.stringify({
      command: {
        operation: "reservation_cancel_v1",
        input: {
          org_id: "org",
          center_id: "center",
          operation_key: id,
          reservation_id: id,
          expected_version: 1,
          reason: "synthetic pending root cancellation",
        },
      },
    }),
  );
  render(
    <SessionPage actorId="native-auth-user" orgId="org" sessionId="session" centerId="center" />,
  );
  expect(await screen.findByRole("button", { name: "Aynı işlemi yeniden gönder" })).toBeVisible();
  expect(mocks.account).toHaveBeenCalledOnce();
});

test("a different native user cannot retain the previous account booking context", async () => {
  render(
    <SessionPage actorId="native-auth-user" orgId="org" sessionId="session" centerId="center" />,
  );
  await screen.findByRole("button", { name: "Rezervasyonları yönet" });
  act(() => mocks.listener?.("SIGNED_IN", { user: { id: "different-native-user" } }));
  expect(screen.queryByRole("button", { name: "Rezervasyonları yönet" })).not.toBeInTheDocument();
  expect(mocks.replace).toHaveBeenCalledWith(
    "/login?next=%2Forganizasyon%2Forg%2Fseans%2Fsession%3Fcenter%3Dcenter",
  );
});
test("failed native account lookup does not substitute the Auth UUID for a write scope", async () => {
  mocks.account.mockRejectedValue(Error("offline"));
  render(
    <SessionPage actorId="native-auth-user" orgId="org" sessionId="session" centerId="center" />,
  );
  await screen.findByRole("alert");
  expect(screen.queryByRole("button", { name: "Rezervasyonları yönet" })).not.toBeInTheDocument();
});
