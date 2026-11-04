import { useState } from "react";
import { beforeEach, expect, test, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "./mocks/server";
import { render } from "./render";
import { NotificationPreferences } from "../src/components/inbox/notification-preferences";
import type { readNotificationPreferences } from "../src/lib/notification-preferences";
import { setupStorageKey } from "../src/lib/studio-setup";
vi.mock("../src/lib/supabase/client", () => ({
  browserClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: { access_token: "synthetic" } }, error: null }),
    },
  }),
}));
const id = "019a2b3c-4d5e-7000-8000-000000000080",
  other = "019a2b3c-4d5e-7000-8000-000000000081";
const scope = { actorId: id, orgId: other };
const endpoint = "https://project.example.invalid/functions/v1/backend-v1/settings_update_v1";
beforeEach(() => {
  sessionStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.example.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "synthetic");
});
function reader() {
  return vi
    .fn<typeof readNotificationPreferences>()
    .mockResolvedValue({ version: 0, enabled: false, writable: true });
}
test("saving requires explicit scoped approval, uses actual zero version, then rereads authoritative state", async () => {
  const user = userEvent.setup(),
    read = reader(),
    bodies: Record<string, unknown>[] = [];
  read
    .mockResolvedValueOnce({ version: 0, enabled: false, writable: true })
    .mockResolvedValue({ version: 4, enabled: true, writable: true });
  server.use(
    http.post(endpoint, async ({ request }) => {
      bodies.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json({
        ok: true,
        data: { primary_id: other, operation_id: id, replayed: false, related: [] },
        trace_id: id,
      });
    }),
  );
  render(<NotificationPreferences scope={scope} read={read} />);
  const checkbox = await screen.findByRole("checkbox");
  await user.click(checkbox);
  await user.click(screen.getByRole("button", { name: "Değişikliği incele" }));
  expect(bodies).toHaveLength(0);
  expect(screen.getByRole("button", { name: "Tercihimi kaydet" })).toHaveFocus();
  await user.click(screen.getByRole("button", { name: "Tercihimi kaydet" }));
  await screen.findByText("Uygulama içi pazarlama açık.");
  expect(bodies).toHaveLength(1);
  expect(bodies[0]).toMatchObject({
    scope: "member",
    org_id: other,
    expected_version: 0,
    patch: { in_app_marketing: true },
  });
  expect(bodies[0]).not.toHaveProperty("person_id");
  expect(bodies[0]).not.toHaveProperty("center_id");
  expect(read).toHaveBeenCalledTimes(2);
  expect(sessionStorage.getItem(setupStorageKey(scope, "notification-preferences"))).toBeNull();
});
test("lost response survives remount; denied reads do not hide exact-payload recovery", async () => {
  const user = userEvent.setup(),
    read = reader(),
    bodies: Record<string, unknown>[] = [];
  server.use(
    http.post(endpoint, async ({ request }) => {
      bodies.push((await request.json()) as Record<string, unknown>);
      return bodies.length === 1
        ? HttpResponse.error()
        : HttpResponse.json({
            ok: true,
            data: { primary_id: other, operation_id: id, replayed: true, related: [] },
            trace_id: id,
          });
    }),
  );
  const view = render(<NotificationPreferences scope={scope} read={read} />);
  await user.click(await screen.findByRole("checkbox"));
  await user.click(screen.getByRole("button", { name: "Değişikliği incele" }));
  await user.click(screen.getByRole("button", { name: "Tercihimi kaydet" }));
  await screen.findByRole("button", { name: /Aynı işlemi/ });
  expect(screen.getByRole("heading", { name: "Bildirim tercihleri" })).toHaveFocus();
  view.unmount();
  read.mockRejectedValue(new Error("denied"));
  render(<NotificationPreferences scope={scope} read={read} />);
  await screen.findByText("Bildirim tercihleri okunamadı. Mevcut seçimin değiştirilmedi.");
  await user.click(screen.getByRole("button", { name: /Aynı işlemi/ }));
  await waitFor(() => expect(bodies).toHaveLength(2));
  expect(bodies[1]).toMatchObject({
    operation_key: bodies[0]?.operation_key,
    expected_version: 0,
    patch: { in_app_marketing: true },
  });
  expect(bodies[1]?.request_id).not.toBe(bodies[0]?.request_id);
});
test("read failure and unsupported channel cannot offer a guessed opt-in", async () => {
  const read = reader().mockRejectedValue(new Error("denied"));
  const view = render(<NotificationPreferences scope={scope} read={read} />);
  await screen.findByRole("alert");
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  view.unmount();
  read.mockResolvedValue({ version: 3, enabled: true, writable: false });
  render(<NotificationPreferences scope={scope} read={read} />);
  await screen.findByText("Uygulama içi pazarlama açık.");
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
});
function ScopeSwitch({
  read,
  actorOnly = false,
}: {
  read: typeof readNotificationPreferences;
  actorOnly?: boolean;
}) {
  const [changed, setChanged] = useState(false);
  return (
    <>
      <button onClick={() => setChanged(true)}>Stüdyoyu değiştir</button>
      <NotificationPreferences
        scope={
          changed
            ? actorOnly
              ? { actorId: other, orgId: scope.orgId }
              : { actorId: id, orgId: id }
            : scope
        }
        read={read}
      />
    </>
  );
}
test.each([false, true])(
  "organization/account change clears an open confirmation before a denied read (actorOnly=%s)",
  async (actorOnly) => {
    const user = userEvent.setup(),
      read = reader();
    render(<ScopeSwitch read={read} actorOnly={actorOnly} />);
    await user.click(await screen.findByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Değişikliği incele" }));
    read.mockRejectedValue(new Error("denied"));
    await user.click(screen.getByRole("button", { name: "Stüdyoyu değiştir" }));
    await screen.findByRole("alert");
    expect(screen.queryByRole("button", { name: "Tercihimi kaydet" })).not.toBeInTheDocument();
  },
);
test("version conflict cannot claim success and fresh read is required before another approval", async () => {
  const user = userEvent.setup(),
    read = reader(),
    bodies: Record<string, unknown>[] = [];
  read
    .mockResolvedValueOnce({ version: 2, enabled: false, writable: true })
    .mockResolvedValue({ version: 9, enabled: false, writable: true });
  server.use(
    http.post(endpoint, async ({ request }) => {
      bodies.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json({
        ok: false,
        error: { code: "VERSION_CONFLICT", retryable: false, trace_id: id },
      });
    }),
  );
  render(<NotificationPreferences scope={scope} read={read} />);
  await user.click(await screen.findByRole("checkbox"));
  await user.click(screen.getByRole("button", { name: "Değişikliği incele" }));
  await user.click(screen.getByRole("button", { name: "Tercihimi kaydet" }));
  await screen.findByRole("alert");
  expect(screen.queryByText("Uygulama içi pazarlama açık.")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Yeniden yükle" }));
  await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
  await user.click(await screen.findByRole("checkbox"));
  await user.click(screen.getByRole("button", { name: "Değişikliği incele" }));
  await user.click(screen.getByRole("button", { name: "Tercihimi kaydet" }));
  await waitFor(() => expect(bodies).toHaveLength(2));
  expect(bodies[1]?.expected_version).toBe(9);
});
test("cancelling the approval restores focus and journal failure sends no write", async () => {
  const user = userEvent.setup(),
    read = reader(),
    send = vi.fn<() => void>();
  server.use(
    http.post(endpoint, () => {
      send();
      return HttpResponse.error();
    }),
  );
  render(<NotificationPreferences scope={scope} read={read} />);
  await user.click(await screen.findByRole("checkbox"));
  await user.click(screen.getByRole("button", { name: "Değişikliği incele" }));
  await user.click(screen.getByRole("button", { name: "Vazgeç" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Değişikliği incele" })).toHaveFocus(),
  );
  expect(send).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Değişikliği incele" }));
  const broken = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("storage unavailable");
  });
  try {
    await user.click(screen.getByRole("button", { name: "Tercihimi kaydet" }));
    await screen.findByRole("alert");
    expect(send).not.toHaveBeenCalled();
  } finally {
    broken.mockRestore();
  }
});
