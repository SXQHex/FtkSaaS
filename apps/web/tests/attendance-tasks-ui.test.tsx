import { useState } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "./mocks/server";
import { render } from "./render";
import { AttendanceTasks } from "../src/components/attendance/attendance-tasks";
import type { AttendanceTasksApi } from "../src/lib/attendance-tasks";
import { id, reservation, scope, session, view } from "./attendance-fixtures";
vi.mock("../src/lib/supabase/client", () => ({
  browserClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: { access_token: "synthetic" } }, error: null }),
    },
  }),
}));
const row = {
  id,
  type: "session" as const,
  center_id: reservation,
  title: "Tango görevi",
  starts_at: "2026-11-06T10:00:00Z",
  ends_at: "2026-11-06T11:00:00Z",
  discipline_id: id,
};
const page = { items: [row], next_cursor: "next", as_of: row.starts_at };
beforeEach(() => {
  // Keep the initial Istanbul day distinct from the explicit November 8 selection.
  // Fake only Date so user-event, request delivery and waitFor retain real timers.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-07T12:00:00Z"));
  sessionStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.example.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "synthetic");
});
afterEach(() => vi.useRealTimers());
test("task cards read the native attendance only on selection and remove it when paginating", async () => {
  const user = userEvent.setup(),
    list = vi
      .fn<AttendanceTasksApi["list"]>()
      .mockResolvedValueOnce(page)
      .mockResolvedValue({ ...page, items: [], next_cursor: null }),
    read = vi.fn<() => void>();
  server.use(
    http.post("*/functions/v1/backend-v1/session_get_v1", () => {
      read();
      return HttpResponse.json({ ok: true, trace_id: id, data: session });
    }),
    http.post("*/functions/v1/backend-v1/attendance_get_v1", () =>
      HttpResponse.json({ ok: true, trace_id: id, data: view }),
    ),
    http.post("*/functions/v1/backend-v1/management_state_get_v1", () =>
      HttpResponse.json({
        ok: false,
        trace_id: id,
        error: { code: "FORBIDDEN", retryable: false, trace_id: id },
      }),
    ),
  );
  render(<AttendanceTasks scope={scope} timeZone="Europe/Istanbul" api={{ list }} />);
  await screen.findByRole("heading", { name: "Tango görevi" });
  expect(read).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Tango görevi yoklamasını aç" }));
  expect(await screen.findByRole("heading", { name: "Abone No 1001" })).toBeVisible();
  expect(read).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole("button", { name: "Sonraki seanslar" }));
  expect(await screen.findByText("Bu sayfada gösterilecek seans yok.")).toBeVisible();
  expect(screen.queryByRole("heading", { name: "Abone No 1001" })).not.toBeInTheDocument();
  expect(list).toHaveBeenLastCalledWith(scope, expect.any(Object), "next");
});
test("late responses after changing the day cannot restore old task cards", async () => {
  const user = userEvent.setup();
  let resolve!: (value: typeof page) => void;
  const list = vi
    .fn<AttendanceTasksApi["list"]>()
    .mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    )
    .mockResolvedValue({ ...page, items: [], next_cursor: null });
  render(<AttendanceTasks scope={scope} timeZone="Europe/Istanbul" api={{ list }} />);
  await waitFor(() => expect(list).toHaveBeenCalledTimes(1));
  fireEvent.change(screen.getByLabelText("Görev tarihi"), { target: { value: "2026-11-08" } });
  await screen.findByText("Bu sayfada gösterilecek seans yok.");
  await act(async () => resolve(page));
  expect(screen.queryByRole("heading", { name: "Tango görevi" })).not.toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText("Tarih aralığı"), "week");
  await waitFor(() => expect(list).toHaveBeenCalledTimes(3));
  expect(list.mock.calls[1]![1]).toEqual({
    starts_at: "2026-11-07T21:00:00.000Z",
    ends_at: "2026-11-08T21:00:00.000Z",
  });
});
test("account and center switches discard task selections and cannot reuse the former query", async () => {
  const user = userEvent.setup(),
    list = vi.fn<AttendanceTasksApi["list"]>(async () => ({
      ...page,
      items: [],
      next_cursor: null,
    }));
  function Changing() {
    const [changed, setChanged] = useState(false);
    return (
      <>
        <button onClick={() => setChanged(true)}>Hesabı değiştir</button>
        <AttendanceTasks
          scope={changed ? { actorId: reservation, orgId: reservation, centerId: id } : scope}
          timeZone="Europe/Istanbul"
          api={{ list }}
        />
      </>
    );
  }
  render(<Changing />);
  await screen.findByText("Bu sayfada gösterilecek seans yok.");
  await user.click(screen.getByRole("button", { name: "Hesabı değiştir" }));
  await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  expect(list.mock.calls[1]![0]).toEqual({
    actorId: reservation,
    orgId: reservation,
    centerId: id,
  });
});

test("an event-only page still offers the next page without claiming the whole period is empty", async () => {
  const user = userEvent.setup(),
    list = vi
      .fn<AttendanceTasksApi["list"]>()
      .mockResolvedValueOnce({ ...page, items: [] })
      .mockResolvedValueOnce({ ...page, next_cursor: null });
  render(<AttendanceTasks scope={scope} timeZone="Europe/Istanbul" api={{ list }} />);
  expect(await screen.findByText("Bu sayfada gösterilecek seans yok.")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Sonraki seanslar" }));
  expect(await screen.findByRole("heading", { name: "Tango görevi" })).toBeVisible();
  expect(screen.queryByText("Bu sayfada gösterilecek seans yok.")).not.toBeInTheDocument();
});
