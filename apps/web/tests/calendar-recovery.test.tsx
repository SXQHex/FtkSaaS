import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { v7 } from "uuid";
import {
  personalCalendarApi,
  calendarStorageKey,
  type CalendarCommand,
} from "../src/lib/personal-calendar";
import { useCalendarCommand } from "../src/components/personal-calendar/use-calendar-command";
import { ApiFailure } from "../src/lib/api";
vi.mock("../src/lib/personal-calendar", async (load) => ({
  ...(await load<typeof import("../src/lib/personal-calendar")>()),
  personalCalendarApi: {
    write: vi.fn<typeof personalCalendarApi.write>(),
    status: vi.fn<typeof personalCalendarApi.status>(),
  },
}));
const actor = v7(),
  org = v7();
const command: CalendarCommand = {
  operation: "calendar_link_create_v1",
  input: { operation_key: v7(), organization_scope: { org_id: org }, kinds: ["lessons", "duties"] },
};
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});
test("lost create survives remount and succeeded status, then recovers the same URL by exact replay", async () => {
  const saved = vi.fn<() => void>();
  vi.mocked(personalCalendarApi.write).mockRejectedValueOnce(Error("lost response"));
  const first = renderHook(() => useCalendarCommand(actor, saved));
  await act(() => first.result.current.run(command));
  expect(first.result.current.pending).toEqual(command);
  const journal = sessionStorage.getItem(calendarStorageKey(actor));
  first.unmount();
  const second = renderHook(() => useCalendarCommand(actor, saved));
  vi.mocked(personalCalendarApi.status).mockResolvedValueOnce({
    operation: command.operation,
    key: command.input.operation_key,
    status: "succeeded",
  } as never);
  await act(() => second.result.current.check());
  expect(second.result.current.message).toBe("credentialAvailable");
  expect(sessionStorage.getItem(calendarStorageKey(actor))).toBe(journal);
  expect(saved).not.toHaveBeenCalled();
  vi.mocked(personalCalendarApi.write).mockResolvedValueOnce({
    subscription_url: "https://calendar.example.invalid/private.ics",
  } as never);
  await act(() => second.result.current.run());
  expect(personalCalendarApi.write).toHaveBeenNthCalledWith(2, command, actor);
  expect(second.result.current.url).toBe("https://calendar.example.invalid/private.ics");
  expect(sessionStorage.getItem(calendarStorageKey(actor))).toBeNull();
  expect(saved).toHaveBeenCalledOnce();
  await act(() => second.result.current.clearUrl());
  expect(second.result.current.url).toBe("");
});
test("a later authorization failure cannot discard an uncertain calendar mutation", async () => {
  sessionStorage.setItem(calendarStorageKey(actor), JSON.stringify(command));
  vi.mocked(personalCalendarApi.write).mockRejectedValue(
    new ApiFailure({ ok: false, error: { code: "FORBIDDEN", retryable: false, trace_id: v7() } }),
  );
  const saved = vi.fn<() => void>(),
    view = renderHook(() => useCalendarCommand(actor, saved));
  await act(() => view.result.current.run());
  expect(view.result.current.pending).toEqual(command);
  expect(sessionStorage.getItem(calendarStorageKey(actor))).not.toBeNull();
  expect(saved).not.toHaveBeenCalled();
});
