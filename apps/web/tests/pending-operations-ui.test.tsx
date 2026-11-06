import { beforeEach, expect, test, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { render } from "./render";
import { server } from "./mocks/server";
import { PendingOperations } from "../src/components/setup/pending-operations";
import { SetupFeedback, useSetupCommand } from "../src/components/setup/setup-command";
import { setupStorageKey, type SetupCommand } from "../src/lib/studio-setup";
vi.mock("../src/lib/supabase/client", () => ({
  browserClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: { access_token: "synthetic" } }, error: null }),
    },
  }),
}));
const scope = {
  actorId: "019a2b3c-4d5e-7000-8000-000000000001",
  orgId: "019a2b3c-4d5e-7000-8000-000000000002",
  centerId: "019a2b3c-4d5e-7000-8000-000000000003",
};
const id = "019a2b3c-4d5e-7000-8000-000000000004";
const command: SetupCommand = {
  operation: "sale_apply_v1",
  input: {
    org_id: scope.orgId,
    center_id: scope.centerId,
    operation_key: id,
    preview: { id, token: "synthetic-preview" },
  },
};
const key = setupStorageKey(scope, `sale-renew:${id}`);
beforeEach(() => {
  sessionStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.example.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "synthetic");
});
function seed(blocked = false) {
  sessionStorage.setItem(key, JSON.stringify({ command, blocked }));
}
test("denied replay preserves the exact old scope and key; a final status focuses the persistent heading", async () => {
  seed();
  const saved = vi.fn<() => void>();
  const bodies: Record<string, unknown>[] = [];
  const calls: string[] = [];
  server.use(
    http.post(
      "https://project.example.invalid/functions/v1/backend-v1/:operation",
      async ({ request, params }) => {
        calls.push(String(params.operation));
        const body = (await request.json()) as Record<string, unknown>;
        bodies.push(body);
        if (params.operation === "sale_apply_v1")
          return HttpResponse.json(
            { ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: id } },
            { status: 403 },
          );
        return HttpResponse.json({
          ok: true,
          data: {
            operation: command.operation,
            key: id,
            status: "succeeded",
            result_available: true,
            result_reference: { type: "sales", id },
          },
          trace_id: id,
        });
      },
    ),
  );
  const user = userEvent.setup();
  render(<PendingOperations actorId={scope.actorId} onSaved={saved} />);
  await user.click(screen.getByRole("button", { name: "Aynı işlemi yeniden gönder" }));
  expect(sessionStorage.getItem(key)).not.toBeNull();
  expect(bodies[0]).toMatchObject(command.input);
  expect(saved).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "İşlem sonucunu kontrol et" }));
  expect(bodies[1]).toMatchObject({ org_id: scope.orgId, operation: command.operation, key: id });
  expect(bodies[0].request_id).not.toBe(bodies[1].request_id);
  expect(calls).toEqual(["sale_apply_v1", "operation_status_get_v1"]);
  expect(sessionStorage.getItem(key)).toBeNull();
  expect(saved).toHaveBeenCalledOnce();
  await waitFor(() =>
    expect(screen.getByRole("heading", { name: "Satış veya yenileme · İşlem 1" })).toHaveFocus(),
  );
});
test("expired and corrupt operations cannot be replayed", () => {
  seed(true);
  sessionStorage.setItem(setupStorageKey(scope, `bookings:${id}`), "broken-json");
  render(<PendingOperations actorId={scope.actorId} onSaved={vi.fn<() => void>()} />);
  expect(
    screen.queryByRole("button", { name: "Aynı işlemi yeniden gönder" }),
  ).not.toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "İşlem sonucunu kontrol et" })).toHaveLength(1);
  expect(
    within(screen.getByRole("region", { name: "Bekleyen işlemler" })).getByText(
      /İşlem takibi okunamıyor veya yazılamıyor/,
    ),
  ).toBeVisible();
});
test("another account has no access to the saved recovery entries", () => {
  seed();
  render(<PendingOperations actorId={id} onSaved={vi.fn<() => void>()} />);
  expect(screen.getByText("Bu hesap için bu sekmede bekleyen işlem yok.")).toBeVisible();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

const replacement = {
  command: {
    ...command,
    input: { ...command.input, operation_key: "019a2b3c-4d5e-7000-8000-000000000005" },
  },
  blocked: false,
};
test.each(["Aynı işlemi yeniden gönder", "İşlem sonucunu kontrol et"])(
  "a stale controller cannot overwrite a newer operation before %s",
  async (action) => {
    seed();
    const called = vi.fn<() => void>();
    server.use(
      http.post("https://project.example.invalid/functions/v1/backend-v1/:operation", () => {
        called();
        return HttpResponse.error();
      }),
    );
    render(<PendingOperations actorId={scope.actorId} onSaved={vi.fn<() => void>()} />);
    const newer = JSON.stringify(replacement);
    sessionStorage.setItem(key, newer);
    await userEvent.setup().click(screen.getByRole("button", { name: action }));
    expect(called).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(key)).toBe(newer);
    expect(
      screen.queryByRole("button", { name: "Aynı işlemi yeniden gönder" }),
    ).not.toBeInTheDocument();
  },
);
test.each(["sale_apply_v1", "operation_status_get_v1"])(
  "a late %s response cannot clear a replacement operation",
  async (operation) => {
    seed();
    let finish!: () => void;
    const started = vi.fn<() => void>();
    const saved = vi.fn<() => void>();
    server.use(
      http.post(
        `https://project.example.invalid/functions/v1/backend-v1/${operation}`,
        async () => {
          started();
          await new Promise<void>((resolve) => {
            finish = resolve;
          });
          return HttpResponse.json({
            ok: true,
            data:
              operation === "sale_apply_v1"
                ? { operation_id: id, primary_id: id, related: [], replayed: true }
                : {
                    operation: command.operation,
                    key: id,
                    status: "succeeded",
                    result_available: true,
                    result_reference: { type: "sales", id },
                  },
            trace_id: id,
          });
        },
      ),
    );
    render(<PendingOperations actorId={scope.actorId} onSaved={saved} />);
    await userEvent.setup().click(
      screen.getByRole("button", {
        name:
          operation === "sale_apply_v1"
            ? "Aynı işlemi yeniden gönder"
            : "İşlem sonucunu kontrol et",
      }),
    );
    await waitFor(() => expect(started).toHaveBeenCalledOnce());
    const newer = JSON.stringify(replacement);
    sessionStorage.setItem(key, newer);
    finish();
    await waitFor(() =>
      expect(screen.getByText(/İşlem takibi başka bir ekranda değişti/)).toBeVisible(),
    );
    expect(sessionStorage.getItem(key)).toBe(newer);
    expect(saved).not.toHaveBeenCalled();
  },
);

test("matching operation keys do not authorize a changed saved payload", async () => {
  seed();
  const called = vi.fn<() => void>();
  server.use(
    http.post("https://project.example.invalid/functions/v1/backend-v1/:operation", () => {
      called();
      return HttpResponse.error();
    }),
  );
  render(<PendingOperations actorId={scope.actorId} onSaved={vi.fn<() => void>()} />);
  const changed = JSON.stringify({
    command: {
      ...command,
      input: { ...command.input, preview: { id, token: "different-synthetic-preview" } },
    },
    blocked: false,
  });
  sessionStorage.setItem(key, changed);
  await userEvent.setup().click(screen.getByRole("button", { name: "Aynı işlemi yeniden gönder" }));
  expect(called).not.toHaveBeenCalled();
  expect(sessionStorage.getItem(key)).toBe(changed);
});
function DraftController() {
  const controller = useSetupCommand(scope, `sale-renew:${id}`, vi.fn<() => void>());
  return (
    <>
      <button onClick={() => void controller.run(command)}>New operation</button>
      <SetupFeedback command={controller} />
    </>
  );
}
test("a fresh form cannot replace another controller's newly saved pending operation", async () => {
  const called = vi.fn<() => void>();
  server.use(
    http.post("https://project.example.invalid/functions/v1/backend-v1/:operation", () => {
      called();
      return HttpResponse.error();
    }),
  );
  render(<DraftController />);
  const newer = JSON.stringify(replacement);
  sessionStorage.setItem(key, newer);
  await userEvent.setup().click(screen.getByRole("button", { name: "New operation" }));
  expect(called).not.toHaveBeenCalled();
  expect(sessionStorage.getItem(key)).toBe(newer);
});

test("an expired response for an older operation cannot block a newer record", async () => {
  seed();
  let finish!: () => void;
  const started = vi.fn<() => void>();
  server.use(
    http.post("https://project.example.invalid/functions/v1/backend-v1/sale_apply_v1", async () => {
      started();
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      return HttpResponse.json({
        ok: false,
        error: {
          code: "OPERATION_RESULT_EXPIRED",
          retryable: false,
          trace_id: id,
        },
      });
    }),
  );
  render(<PendingOperations actorId={scope.actorId} onSaved={vi.fn<() => void>()} />);
  await userEvent.setup().click(screen.getByRole("button", { name: "Aynı işlemi yeniden gönder" }));
  await waitFor(() => expect(started).toHaveBeenCalledOnce());
  const newer = JSON.stringify(replacement);
  sessionStorage.setItem(key, newer);
  finish();
  await screen.findByText(/İşlem takibi başka bir ekranda değişti/);
  expect(sessionStorage.getItem(key)).toBe(newer);
});
