import type { Preview } from "@ftksaas/api-contracts";
import { beforeEach, expect, test, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "./mocks/server";
import { render } from "./render";
import { AttendancePanel } from "../src/components/attendance/attendance-panel";
import type { AttendanceApi } from "../src/lib/attendance";
import { id, scope, session, view, preview, makeApi } from "./attendance-fixtures";
vi.mock("../src/lib/supabase/client", () => ({
  browserClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: { access_token: "synthetic" } }, error: null }),
    },
  }),
}));
beforeEach(() => {
  sessionStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.example.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "synthetic");
});
const closed = {
  session: { ...session, state: "occurred" as const, attendance_state: "closed" as const },
  view: {
    ...view,
    closure_state: "closed" as const,
    revision: 1,
    entries: [{ ...view.entries[0]!, result: "attended" as const }],
  },
};
test("closed attendance correction displays old/new and backend effects, invalidates approval after edits and rereads rights", async () => {
  const user = userEvent.setup(),
    writes: Record<string, unknown>[] = [],
    api: AttendanceApi = {
      ...makeApi(),
      read: vi.fn<AttendanceApi["read"]>(async () => closed),
      access: async () => true,
      preview: vi.fn<AttendanceApi["preview"]>(async () => preview),
      rights: vi.fn<AttendanceApi["rights"]>(async () => []),
    };
  server.use(
    http.post("*/functions/v1/backend-v1/attendance_correct_apply_v1", async ({ request }) => {
      writes.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json({
        ok: true,
        trace_id: id,
        data: { primary_id: id, operation_id: id, related: [], version: 9, replayed: false },
      });
    }),
  );
  render(<AttendancePanel scope={scope} sessionId={id} timeZone="Europe/Istanbul" api={api} />);
  await user.click(await screen.findByRole("button", { name: "Yoklamayı düzelt" }));
  await user.selectOptions(await screen.findByLabelText("Katılım sonucu"), "no_show");
  await user.type(screen.getByLabelText("Gerekçe"), "Öğrenci gelmedi");
  await user.click(screen.getByRole("button", { name: "Düzeltmeyi incele" }));
  expect(await screen.findByText("Backend hak düzeltmesi")).toBeVisible();
  expect(screen.getByText(/Katıldı → Gelmedi/)).toBeVisible();
  expect(screen.getByRole("button", { name: "İşlemi uygula" })).toBeDisabled();
  await user.click(screen.getByLabelText("Gösterilen işlemi ve etkilerini onaylıyorum."));
  await user.type(screen.getByLabelText("Gerekçe"), ".");
  expect(screen.queryByRole("button", { name: "İşlemi uygula" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Düzeltmeyi incele" }));
  await user.click(await screen.findByLabelText("Gösterilen işlemi ve etkilerini onaylıyorum."));
  await user.click(screen.getByRole("button", { name: "İşlemi uygula" }));
  await waitFor(() => expect(api.read).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(api.rights).toHaveBeenCalledTimes(1));
  expect(writes[0]).toMatchObject({ preview: { id, token: preview.token } });
});
test.each(["expired", "blocker", "currency"])("%s preview cannot be applied", async (mode) => {
  const value: Preview = {
      ...preview,
      ...(mode === "expired"
        ? { expires_at: "2020-01-01T00:00:00Z" }
        : mode === "blocker"
          ? { blockers: [{ code: "FORBIDDEN", retryable: false, trace_id: id }] }
          : { effects: [{ ...preview.effects[0]!, amount_minor: "100", currency: null }] }),
    },
    user = userEvent.setup();
  render(
    <AttendancePanel
      scope={scope}
      sessionId={id}
      timeZone="UTC"
      api={{
        ...makeApi(),
        read: async () => closed,
        access: async () => true,
        preview: async () => value,
      }}
    />,
  );
  await user.click(await screen.findByRole("button", { name: "Yoklamayı düzelt" }));
  await user.selectOptions(await screen.findByLabelText("Katılım sonucu"), "no_show");
  await user.type(screen.getByLabelText("Gerekçe"), "Öğrenci gelmedi");
  await user.click(screen.getByRole("button", { name: "Düzeltmeyi incele" }));
  expect(await screen.findByRole("button", { name: "İşlemi uygula" })).toBeDisabled();
});
test("a late preview after an edited reason cannot restore approval", async () => {
  const { act } = await import("@testing-library/react");
  let resolve!: (value: typeof preview) => void;
  const user = userEvent.setup();
  render(
    <AttendancePanel
      scope={scope}
      sessionId={id}
      timeZone="UTC"
      api={{
        ...makeApi(),
        read: async () => closed,
        access: async () => true,
        preview: () =>
          new Promise((done) => {
            resolve = done;
          }),
      }}
    />,
  );
  await user.click(await screen.findByRole("button", { name: "Yoklamayı düzelt" }));
  await user.selectOptions(await screen.findByLabelText("Katılım sonucu"), "no_show");
  await user.type(screen.getByLabelText("Gerekçe"), "Öğrenci gelmedi");
  await user.click(screen.getByRole("button", { name: "Düzeltmeyi incele" }));
  await user.type(screen.getByLabelText("Gerekçe"), ".");
  await act(async () => resolve(preview));
  expect(screen.queryByRole("button", { name: "İşlemi uygula" })).not.toBeInTheDocument();
});
