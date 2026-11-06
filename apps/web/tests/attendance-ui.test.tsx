import { beforeEach, expect, test, vi } from "vitest";
import { screen, within, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "./mocks/server";
import { render } from "./render";
import { AttendancePanel } from "../src/components/attendance/attendance-panel";
import type { AttendanceApi } from "../src/lib/attendance";
import { id, reservation, scope, session, view, makeApi } from "./attendance-fixtures";
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
test("denied actions keep a readable sheet without financial or management fields", async () => {
  const user = userEvent.setup(),
    access = vi.fn<AttendanceApi["access"]>(async () => false);
  render(
    <AttendancePanel
      scope={scope}
      sessionId={id}
      timeZone="Europe/Istanbul"
      api={{ ...makeApi(), access }}
    />,
  );
  expect(await screen.findByText("Abone No 1001")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Katılımı işaretle" }));
  await waitFor(() => expect(access).toHaveBeenCalledTimes(4));
  expect(screen.queryByLabelText("Katılım sonucu")).not.toBeInTheDocument();
  expect(screen.queryByText("Güncel haklar")).not.toBeInTheDocument();
  expect(screen.queryByText("Borç politikası")).not.toBeInTheDocument();
});
test.each([
  "attendance_start_v1",
  "attendance_mark_v1",
  "attendance_block_v1",
  "attendance_close_v1",
] as const)(
  "%s uses exact versions, explicit review and authoritative reread",
  async (operation) => {
    const user = userEvent.setup(),
      writes: Record<string, unknown>[] = [],
      changed = vi.fn<(value: typeof session) => void>();
    let saved = false;
    const api: AttendanceApi = {
      ...makeApi(),
      access: async (_scope, op) => op === operation,
      read: vi.fn<AttendanceApi["read"]>(async () => ({
        session: { ...session, version: saved ? 9 : 8 },
        view: {
          ...view,
          session_version: saved ? 9 : 8,
          entries: [
            {
              ...view.entries[0]!,
              result: operation === "attendance_close_v1" ? "attended" : "unmarked",
            },
          ],
        },
      })),
      rights: vi.fn<AttendanceApi["rights"]>(async () => []),
    };
    server.use(
      http.post(`*/functions/v1/backend-v1/${operation}`, async ({ request }) => {
        writes.push((await request.json()) as Record<string, unknown>);
        saved = true;
        return HttpResponse.json({
          ok: true,
          trace_id: id,
          data: {
            primary_id: reservation,
            operation_id: id,
            version: 9,
            related: [],
            replayed: false,
          },
        });
      }),
    );
    render(
      <AttendancePanel
        scope={scope}
        sessionId={id}
        timeZone="Europe/Istanbul"
        api={api}
        onChanged={changed}
      />,
    );
    await screen.findByText("Abone No 1001");
    if (operation === "attendance_mark_v1" || operation === "attendance_block_v1") {
      await user.click(screen.getByRole("button", { name: "Katılımı işaretle" }));
      if (operation === "attendance_mark_v1") {
        await user.selectOptions(await screen.findByLabelText("Katılım sonucu"), "attended");
        await user.click(screen.getByRole("button", { name: "İşlemi incele" }));
      } else {
        await user.selectOptions(await screen.findByLabelText("Katılım engeli"), "debt_policy");
        await user.click(screen.getByRole("button", { name: "Engeli incele" }));
      }
    } else if (operation === "attendance_start_v1") {
      const form = within(await screen.findByRole("region", { name: "Fiilî başlangıcı kaydet" }));
      fireEvent.change(form.getByLabelText("Fiilî başlangıç"), {
        target: { value: "2026-01-01T13:00" },
      });
      await user.type(form.getByLabelText("Gerekçe"), "Ders başladı");
      await user.click(form.getByRole("button", { name: "İşlemi incele" }));
    } else {
      const form = within(await screen.findByRole("region", { name: "Yoklamayı kapat" }));
      await user.selectOptions(form.getByLabelText("Seans fiilen gerçekleşti mi?"), "yes");
      await user.click(form.getByLabelText("Atanmış eğitmen 1"));
      await user.click(form.getByRole("button", { name: "İşlemi incele" }));
    }
    expect(writes).toHaveLength(0);
    expect(screen.getByRole("button", { name: "İşlemi uygula" })).toBeDisabled();
    await user.click(screen.getByLabelText("Gösterilen işlemi ve etkilerini onaylıyorum."));
    await user.click(screen.getByRole("button", { name: "İşlemi uygula" }));
    await waitFor(() => expect(api.read).toHaveBeenCalledTimes(2));
    expect(writes[0]).toMatchObject({
      expected_version:
        operation === "attendance_mark_v1" || operation === "attendance_block_v1" ? 7 : 8,
    });
    expect(changed).toHaveBeenLastCalledWith({ ...session, version: 9 });
    await waitFor(() =>
      expect(api.rights).toHaveBeenCalledTimes(operation === "attendance_close_v1" ? 1 : 0),
    );
  },
);
test("permission failure is retryable and cannot open a writer", async () => {
  const user = userEvent.setup(),
    access = vi
      .fn<AttendanceApi["access"]>()
      .mockRejectedValueOnce(Error("POLICY_NOT_CONFIGURED"))
      .mockResolvedValue(false);
  render(
    <AttendancePanel scope={scope} sessionId={id} timeZone="UTC" api={{ ...makeApi(), access }} />,
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("yetkisi doğrulanamadı");
  await user.click(screen.getByRole("button", { name: "Tekrar dene" }));
  await waitFor(() => expect(access).toHaveBeenCalledTimes(3));
  expect(screen.queryByLabelText("Gerekçe")).not.toBeInTheDocument();
});
test("a rejected row write remains visible while the sheet refreshes", async () => {
  const user = userEvent.setup(),
    api: AttendanceApi = {
      ...makeApi(),
      access: async (_scope, op) => op === "attendance_mark_v1",
      read: vi.fn<AttendanceApi["read"]>(async () => ({ session, view })),
    };
  server.use(
    http.post("*/functions/v1/backend-v1/attendance_mark_v1", () =>
      HttpResponse.json({
        ok: false,
        trace_id: id,
        error: { code: "VERSION_CONFLICT", retryable: false, trace_id: id },
      }),
    ),
  );
  render(<AttendancePanel scope={scope} sessionId={id} timeZone="UTC" api={api} />);
  await user.click(await screen.findByRole("button", { name: "Katılımı işaretle" }));
  await user.selectOptions(await screen.findByLabelText("Katılım sonucu"), "attended");
  await user.click(screen.getByRole("button", { name: "İşlemi incele" }));
  await user.click(screen.getByLabelText("Gösterilen işlemi ve etkilerini onaylıyorum."));
  await user.click(screen.getByRole("button", { name: "İşlemi uygula" }));
  await waitFor(() => expect(api.read).toHaveBeenCalledTimes(2));
  expect(await screen.findByRole("alert")).toHaveTextContent(/değiş/);
});
test("marking edits invalidate approval and cancellation never exposes row actions", async () => {
  const user = userEvent.setup(),
    first = render(
      <AttendancePanel
        scope={scope}
        sessionId={id}
        timeZone="UTC"
        api={{ ...makeApi(), access: async (_scope, op) => op === "attendance_mark_v1" }}
      />,
    );
  await user.click(await screen.findByRole("button", { name: "Katılımı işaretle" }));
  await user.selectOptions(await screen.findByLabelText("Katılım sonucu"), "attended");
  await user.click(screen.getByRole("button", { name: "İşlemi incele" }));
  await user.click(screen.getByLabelText("Gösterilen işlemi ve etkilerini onaylıyorum."));
  await user.selectOptions(screen.getByLabelText("Katılım sonucu"), "no_show");
  expect(screen.queryByRole("button", { name: "İşlemi uygula" })).not.toBeInTheDocument();
  first.unmount();
  render(
    <AttendancePanel
      scope={scope}
      sessionId={id}
      timeZone="UTC"
      api={{
        ...makeApi(),
        read: async () => ({ session: { ...session, state: "cancelled" }, view }),
        access: async () => true,
      }}
    />,
  );
  expect(await screen.findByText("İptal edilmiş seansın yoklaması değiştirilemez.")).toBeVisible();
  expect(screen.queryByRole("button", { name: "Katılımı işaretle" })).not.toBeInTheDocument();
});
