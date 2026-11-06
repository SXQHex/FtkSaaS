import { beforeEach, expect, test, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "./mocks/server";
import { render } from "./render";
import { PendingOperations } from "../src/components/setup/pending-operations";
import { recoverSetup, setupStorageKey, type SetupCommand } from "../src/lib/studio-setup";
import { attendanceStart, attendanceMark, attendanceClose } from "../src/lib/attendance-command";
import { id, reservation, scope, session, view, preview } from "./attendance-fixtures";
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
const common = { org_id: scope.orgId, center_id: scope.centerId, operation_key: id };
const commands: SetupCommand[] = [
  attendanceStart(scope, view, "2026-01-01T13:00", "Europe/Istanbul", "", "Ders başladı"),
  attendanceMark(scope, view, view.entries[0]!, "attended"),
  {
    operation: "attendance_block_v1",
    input: { ...common, reservation_id: reservation, expected_version: 7, reason: "debt_policy" },
  },
  attendanceClose(
    scope,
    { ...view, entries: [{ ...view.entries[0]!, result: "attended" }] },
    session,
    "yes",
    [id],
  ),
  {
    operation: "attendance_correct_apply_v1",
    input: { ...common, preview: { id: preview.id, token: preview.token } },
  },
];
test.each(commands)(
  "$operation preserves the exact approved command through lost response and remount",
  async (command) => {
    const slot =
        command.operation === "attendance_mark_v1" || command.operation === "attendance_block_v1"
          ? `attendance-row:${reservation}`
          : `attendance:${id}`,
      key = setupStorageKey(scope, slot),
      user = userEvent.setup(),
      saved = vi.fn<() => void>(),
      writes: Record<string, unknown>[] = [];
    sessionStorage.setItem(key, JSON.stringify({ command }));
    expect(recoverSetup(scope, slot)).toEqual({ command });
    let answer = false;
    server.use(
      http.post(`*/functions/v1/backend-v1/${command.operation}`, async ({ request }) => {
        writes.push((await request.json()) as Record<string, unknown>);
        return answer
          ? HttpResponse.json({
              ok: true,
              trace_id: id,
              data: { primary_id: id, operation_id: id, version: 9, related: [], replayed: true },
            })
          : HttpResponse.error();
      }),
    );
    const first = render(<PendingOperations actorId={scope.actorId} onSaved={saved} />);
    await user.click(screen.getByRole("button", { name: "Aynı işlemi yeniden gönder" }));
    await screen.findByText(
      "Sonuç doğrulanamadı. Yeni anahtarla tekrar başlatma; aynı işlemin sonucunu kontrol et.",
    );
    first.unmount();
    answer = true;
    render(<PendingOperations actorId={scope.actorId} onSaved={saved} />);
    await user.click(screen.getByRole("button", { name: "Aynı işlemi yeniden gönder" }));
    await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
    expect(writes.length).toBeGreaterThanOrEqual(2);
    for (const write of writes) expect(write).toMatchObject(command.input);
    expect(writes.at(-1)!.request_id).not.toBe(writes[0]!.request_id);
    expect(sessionStorage.getItem(key)).toBeNull();
    const wrong = slot.startsWith("attendance-row:") ? `attendance-row:${id}` : `finance:${id}`;
    sessionStorage.setItem(setupStorageKey(scope, wrong), JSON.stringify({ command }));
    expect(recoverSetup(scope, wrong)).toBe("invalid");
  },
);
