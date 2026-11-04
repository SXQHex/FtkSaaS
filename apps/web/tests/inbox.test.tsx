import { beforeEach, expect, test, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "./mocks/server";
import { render } from "./render";
import { InboxFeed } from "../src/components/inbox/inbox-feed";
import { AuditHistory } from "../src/components/inbox/audit-history";
import type { NotificationView } from "@ftksaas/api-contracts";
import type { listInbox, listAudit, getNotificationVersion } from "../src/lib/inbox";
import { setupStorageKey } from "../src/lib/studio-setup";
vi.mock("../src/lib/supabase/client", () => ({
  browserClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: { access_token: "synthetic" } }, error: null }),
    },
  }),
}));
const id = "019a2b3c-4d5e-7000-8000-000000000080";
const scope = { actorId: id, orgId: "019a2b3c-4d5e-7000-8000-000000000081" };
const notice: NotificationView = {
  id,
  kind: "session_change",
  payload: {
    template_key: "session_change",
    subject: { type: "sessions", id },
    title: "Program güncellendi",
  },
  created_at: "2026-11-04T00:00:00Z",
  read_at: null,
};
const page = (items: NotificationView[], next_cursor: string | null = null) => ({
  items,
  next_cursor,
  as_of: "2026-11-04T00:00:00Z",
});
beforeEach(() => {
  sessionStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.example.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "synthetic");
});
test("unread filtering resets the cursor and failed refresh hides the old list", async () => {
  const user = userEvent.setup();
  const list = vi
    .fn<typeof listInbox>()
    .mockResolvedValueOnce(page([notice], "cursor"))
    .mockResolvedValueOnce(
      page([{ ...notice, id: scope.orgId, payload: { ...notice.payload, title: "İkinci sayfa" } }]),
    )
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce(page([]));
  render(<InboxFeed scope={scope} list={list} />);
  await screen.findByText("Program güncellendi");
  await user.click(screen.getByRole("button", { name: "Sonraki sayfa" }));
  await screen.findByText("İkinci sayfa");
  await user.click(screen.getByRole("checkbox", { name: "Yalnız okunmamış" }));
  await screen.findByRole("alert");
  expect(screen.queryByText("İkinci sayfa")).not.toBeInTheDocument();
  expect(list.mock.calls[2]).toEqual([scope, false, undefined]);
  await user.click(screen.getByRole("button", { name: "Yeniden yükle" }));
  await screen.findByText("Bu görünümde bildirim yok.");
});
test("read confirmation uses the management version and refreshes only after success", async () => {
  const user = userEvent.setup();
  const list = vi
    .fn<typeof listInbox>()
    .mockResolvedValueOnce(page([notice]))
    .mockResolvedValue(page([]));
  const version = vi.fn<typeof getNotificationVersion>().mockResolvedValue(8);
  let body: Record<string, unknown> | null = null;
  server.use(
    http.post(
      "https://project.example.invalid/functions/v1/backend-v1/notification_mark_read_v1",
      async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          ok: true,
          data: { primary_id: id, operation_id: id, replayed: false, related: [] },
          trace_id: id,
        });
      },
    ),
  );
  render(<InboxFeed scope={scope} list={list} version={version} />);
  await screen.findByText("Program güncellendi");
  await user.click(screen.getByRole("button", { name: "Okundu olarak işaretle" }));
  expect(body).toBeNull();
  await user.click(await screen.findByRole("button", { name: "Okundu olarak onayla" }));
  await screen.findByText("Bu görünümde bildirim yok.");
  expect(body).toMatchObject({ org_id: scope.orgId, notification_id: id, expected_version: 8 });
  expect(sessionStorage.getItem(setupStorageKey(scope, "inbox-read"))).toBeNull();
});
test("missing management version blocks read without assuming version one", async () => {
  const user = userEvent.setup();
  render(<InboxFeed scope={scope} list={async () => page([notice])} version={async () => null} />);
  await user.click(await screen.findByRole("button", { name: "Okundu olarak işaretle" }));
  await screen.findByRole("alert");
  expect(screen.queryByRole("button", { name: "Okundu olarak onayla" })).not.toBeInTheDocument();
});
test("pending read remains recoverable when unread list is empty or inaccessible", async () => {
  const command = {
    operation: "notification_mark_read_v1",
    input: { org_id: scope.orgId, notification_id: id, expected_version: 8, operation_key: id },
  };
  sessionStorage.setItem(setupStorageKey(scope, "inbox-read"), JSON.stringify({ command }));
  render(
    <InboxFeed
      scope={scope}
      list={async () => {
        throw new Error("denied");
      }}
    />,
  );
  await screen.findByRole("alert");
  expect(screen.getByRole("button", { name: "İşlem sonucunu kontrol et" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Aynı işlemi yeniden gönder" })).toBeInTheDocument();
});
test("audit shows authorized timeline without dumping payload or financial diff", async () => {
  const list = vi.fn<typeof listAudit>().mockResolvedValue({
    items: [
      {
        id,
        action: "session_change_apply_v1",
        subject: { type: "sessions", id },
        actor_display: "Test Yönetici",
        created_at: "2026-11-04T00:00:00Z",
        reason: "Saat düzeltmesi",
        diff: {
          changes: [{ field: "private_payload", old_value: "hidden", new_value: "secret" }],
        },
      },
    ],
    next_cursor: null,
    as_of: "2026-11-04T00:00:00Z",
  });
  render(<AuditHistory scope={scope} subject={{ type: "sessions", id }} list={list} />);
  await screen.findByText("Test Yönetici");
  expect(screen.getByText("Saat düzeltmesi")).toBeInTheDocument();
  expect(screen.queryByText("secret")).not.toBeInTheDocument();
  expect(list).toHaveBeenCalledWith(
    scope,
    { type: "sessions", id },
    expect.objectContaining({ starts_at: expect.any(String), ends_at: expect.any(String) }),
    undefined,
  );
});
test("closing or unmounting a scope ignores a delayed version lookup", async () => {
  const user = userEvent.setup();
  let resolve: (n: number) => void = () => {};
  const delayed = new Promise<number>((r) => {
    resolve = r;
  });
  const view = render(
    <InboxFeed scope={scope} list={async () => page([notice])} version={() => delayed} />,
  );
  await user.click(await screen.findByRole("button", { name: "Okundu olarak işaretle" }));
  view.unmount();
  resolve(8);
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Okundu olarak onayla" })).not.toBeInTheDocument(),
  );
});
test("version conflicts discard the old approval and require a new version lookup", async () => {
  const user = userEvent.setup();
  const list = vi.fn<typeof listInbox>().mockResolvedValue(page([notice]));
  const version = vi
    .fn<typeof getNotificationVersion>()
    .mockResolvedValueOnce(8)
    .mockResolvedValueOnce(9);
  server.use(
    http.post(
      "https://project.example.invalid/functions/v1/backend-v1/notification_mark_read_v1",
      () =>
        HttpResponse.json({
          ok: false,
          error: { code: "VERSION_CONFLICT", retryable: false, trace_id: id },
        }),
    ),
  );
  render(<InboxFeed scope={scope} list={list} version={version} />);
  await user.click(await screen.findByRole("button", { name: "Okundu olarak işaretle" }));
  const confirm = await screen.findByRole("button", { name: "Okundu olarak onayla" });
  expect(confirm).toHaveFocus();
  await user.click(confirm);
  await screen.findByRole("alert");
  expect(screen.queryByRole("button", { name: "Okundu olarak onayla" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Okundu olarak işaretle" }));
  expect(await screen.findByRole("button", { name: "Okundu olarak onayla" })).toHaveFocus();
  expect(version).toHaveBeenCalledTimes(2);
});
test("unknown reply is recovered with the original key even after the server removes an unread notification", async () => {
  const user = userEvent.setup();
  const list = vi.fn<typeof listInbox>().mockResolvedValue(page([notice]));
  let original: Record<string, unknown> | null = null;
  server.use(
    http.post(
      "https://project.example.invalid/functions/v1/backend-v1/notification_mark_read_v1",
      async ({ request }) => {
        original = (await request.json()) as Record<string, unknown>;
        return HttpResponse.error();
      },
    ),
  );
  const view = render(<InboxFeed scope={scope} list={list} version={async () => 8} />);
  await user.click(await screen.findByRole("button", { name: "Okundu olarak işaretle" }));
  await user.click(await screen.findByRole("button", { name: "Okundu olarak onayla" }));
  await screen.findByRole("alert");
  const stored = sessionStorage.getItem(setupStorageKey(scope, "inbox-read"));
  expect(stored).toContain('"expected_version":8');
  view.unmount();
  server.use(
    http.post(
      "https://project.example.invalid/functions/v1/backend-v1/operation_status_get_v1",
      async ({ request }) => {
        const input = (await request.json()) as Record<string, unknown>;
        expect(input.key).toBe(original?.operation_key);
        return HttpResponse.json({
          ok: true,
          data: {
            operation: "notification_mark_read_v1",
            key: input.key,
            status: "succeeded",
            result_available: true,
            result_reference: { type: "notifications", id },
          },
          trace_id: id,
        });
      },
    ),
  );
  render(<InboxFeed scope={scope} list={async () => page([])} />);
  await user.click(screen.getByRole("button", { name: "İşlem sonucunu kontrol et" }));
  await waitFor(() =>
    expect(sessionStorage.getItem(setupStorageKey(scope, "inbox-read"))).toBeNull(),
  );
  expect(await screen.findByText("Bu görünümde bildirim yok.")).toBeInTheDocument();
});
