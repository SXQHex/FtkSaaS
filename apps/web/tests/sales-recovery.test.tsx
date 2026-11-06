import { beforeEach, expect, test, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { render } from "./render";
import { server } from "./mocks/server";
import { StudentDirectory } from "../src/components/students/students-workspace";
import { sampleStudents, sampleStudentScope } from "../src/components/admin/student-fixtures";
import { studentActions, type StudentActions } from "../src/lib/students";
import { setupStorageKey } from "../src/lib/studio-setup";
import { readEntitlements } from "../src/lib/products";
import { SalesRecovery } from "../src/components/products/sales-recovery";
import { NextIntlClientProvider } from "next-intl";
import tr from "../messages/tr.json";
vi.mock("../src/lib/supabase/client", () => ({
  browserClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: { access_token: "synthetic" } }, error: null }),
    },
  }),
}));
const scope = { ...sampleStudentScope, actorId: "019a2b3c-4d5e-7000-8000-000000000080" };
const person = sampleStudents[0];
const command = {
  operation: "sale_apply_v1",
  input: {
    org_id: scope.orgId,
    center_id: scope.centerId,
    operation_key: "019a2b3c-4d5e-7000-8000-000000000081",
    preview: { id: person.id, token: "synthetic-preview" },
  },
};
beforeEach(() => {
  sessionStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.example.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "synthetic");
});
function seed() {
  sessionStorage.setItem(
    setupStorageKey(scope, `sale-renew:${person.id}`),
    JSON.stringify({ command }),
  );
}
function directory(detailDenied = false) {
  const actions = {
    ...studentActions,
    list: detailDenied
      ? vi
          .fn<StudentActions["list"]>()
          .mockResolvedValue({ items: [person], next_cursor: null, as_of: "2026-11-06T00:00:00Z" })
      : vi.fn<StudentActions["list"]>().mockRejectedValue(Error("Denied")),
    person: vi.fn<StudentActions["person"]>().mockRejectedValue(Error("Denied")),
  };
  return render(
    <StudentDirectory
      scope={scope}
      centerName="Fethiye"
      actions={actions}
      entitlements={readEntitlements}
    />,
  );
}
test("a pending sale can replay without the student list, with the exact original proof and key", async () => {
  seed();
  const bodies: Record<string, unknown>[] = [];
  server.use(
    http.post(
      "https://project.example.invalid/functions/v1/backend-v1/sale_apply_v1",
      async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({
          ok: true,
          data: { operation_id: person.id, primary_id: person.id, related: [], replayed: true },
          trace_id: person.id,
        });
      },
    ),
  );
  directory();
  await screen.findByRole("alert");
  await userEvent.click(screen.getByRole("button", { name: "Aynı işlemi yeniden gönder" }));
  await waitFor(() => expect(bodies).toHaveLength(1));
  expect(bodies[0]).toMatchObject(command.input);
  await waitFor(() => expect(sessionStorage.length).toBe(0));
  expect(screen.queryByRole("button", { name: "İşlemi uygula" })).not.toBeInTheDocument();
});
test("a denied person detail still exposes the pending sale result check inside the dialog", async () => {
  seed();
  directory(true);
  await userEvent.click(await screen.findByRole("button", { name: /Deniz Örnek/ }));
  const detail = within(screen.getByRole("dialog"));
  await detail.findByRole("alert");
  expect(detail.getByRole("button", { name: "İşlem sonucunu kontrol et" })).toBeVisible();
  expect(detail.queryByRole("button", { name: "Satış ve yenilemeyi aç" })).not.toBeInTheDocument();
});

test("denied replay and missing status preserve the same pending write until its exact receipt succeeds", async () => {
  seed();
  const saved = vi.fn<() => void>();
  const bodies: Record<string, unknown>[] = [];
  let checks = 0;
  server.use(
    http.post(
      "https://project.example.invalid/functions/v1/backend-v1/sale_apply_v1",
      async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json(
          { ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: person.id } },
          { status: 403 },
        );
      },
    ),
    http.post(
      "https://project.example.invalid/functions/v1/backend-v1/operation_status_get_v1",
      async ({ request }) => {
        const input = (await request.json()) as Record<string, unknown>;
        expect(input).toMatchObject({
          org_id: scope.orgId,
          operation: command.operation,
          key: command.input.operation_key,
        });
        checks++;
        return checks === 1
          ? HttpResponse.json(
              { ok: false, error: { code: "NOT_FOUND", retryable: false, trace_id: person.id } },
              { status: 404 },
            )
          : HttpResponse.json({
              ok: true,
              data: {
                operation: command.operation,
                key: command.input.operation_key,
                status: "succeeded",
                result_available: true,
                result_reference: { type: "sales", id: person.id },
              },
              trace_id: person.id,
            });
      },
    ),
  );
  render(<SalesRecovery scope={scope} onSaved={saved} />);
  await userEvent.click(screen.getByRole("button", { name: "Aynı işlemi yeniden gönder" }));
  await screen.findByRole("alert");
  expect(sessionStorage.length).toBe(1);
  await userEvent.click(screen.getByRole("button", { name: "İşlem sonucunu kontrol et" }));
  await waitFor(() => expect(checks).toBe(1));
  expect(saved).not.toHaveBeenCalled();
  expect(sessionStorage.length).toBe(1);
  await userEvent.click(screen.getByRole("button", { name: "İşlem sonucunu kontrol et" }));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  expect(sessionStorage.length).toBe(0);
  expect(bodies).toHaveLength(1);
  expect(bodies[0]).toMatchObject(command.input);
  expect(screen.getByText("Bekleyen işlem 1")).toHaveFocus();
});

test.each(["actorId", "orgId", "centerId"] as const)(
  "another %s cannot inspect or replay this journal",
  (field) => {
    seed();
    const saved = vi.fn<() => void>();
    const view = render(<SalesRecovery scope={scope} onSaved={saved} />);
    expect(screen.getByRole("button", { name: "Aynı işlemi yeniden gönder" })).toBeVisible();
    view.rerender(
      <NextIntlClientProvider locale="tr" messages={tr} timeZone="UTC">
        <SalesRecovery
          scope={{ ...scope, [field]: "019a2b3c-4d5e-7000-8000-000000000089" }}
          onSaved={saved}
        />
      </NextIntlClientProvider>,
    );
    expect(
      screen.queryByRole("button", { name: "Aynı işlemi yeniden gönder" }),
    ).not.toBeInTheDocument();
    expect(saved).not.toHaveBeenCalled();
    expect(sessionStorage.length).toBe(1);
  },
);

test("invalid commands fail closed and expired results never offer replay after remount", () => {
  const key = setupStorageKey(scope, `sale-renew:${person.id}`);
  sessionStorage.setItem(key, "{broken");
  const first = render(<SalesRecovery scope={scope} onSaved={vi.fn<() => void>()} />);
  expect(screen.getByText(/İşlem takibi okunamıyor/)).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Aynı işlemi yeniden gönder" }),
  ).not.toBeInTheDocument();
  first.unmount();
  sessionStorage.setItem(key, JSON.stringify({ command, blocked: true }));
  render(<SalesRecovery scope={scope} onSaved={vi.fn<() => void>()} />);
  expect(screen.getByRole("button", { name: "İşlem sonucunu kontrol et" })).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Aynı işlemi yeniden gönder" }),
  ).not.toBeInTheDocument();
});

test("a final failed receipt clears the journal and keeps keyboard focus on the result", async () => {
  seed();
  const saved = vi.fn<() => void>();
  server.use(
    http.post(
      "https://project.example.invalid/functions/v1/backend-v1/operation_status_get_v1",
      () =>
        HttpResponse.json({
          ok: true,
          data: {
            operation: command.operation,
            key: command.input.operation_key,
            status: "failed_final",
            result_available: false,
            result_reference: null,
          },
          trace_id: person.id,
        }),
    ),
  );
  render(<SalesRecovery scope={scope} onSaved={saved} />);
  await userEvent.click(screen.getByRole("button", { name: "İşlem sonucunu kontrol et" }));
  await screen.findByRole("alert");
  expect(sessionStorage.length).toBe(0);
  expect(saved).not.toHaveBeenCalled();
  expect(
    screen.queryByRole("button", { name: "Aynı işlemi yeniden gönder" }),
  ).not.toBeInTheDocument();
  expect(screen.getByText("Bekleyen işlem 1")).toHaveFocus();
});

test("the detail fallback never offers another person's pending sale", () => {
  seed();
  render(
    <SalesRecovery scope={scope} personId={sampleStudents[1].id} onSaved={vi.fn<() => void>()} />,
  );
  expect(
    screen.queryByRole("button", { name: "Aynı işlemi yeniden gönder" }),
  ).not.toBeInTheDocument();
  expect(sessionStorage.length).toBe(1);
});
