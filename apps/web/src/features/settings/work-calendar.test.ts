import { beforeEach, describe, expect, it, vi } from "vitest";
import { BackendError } from "../../lib/backend";
const { call, document, context } = vi.hoisted(() => ({
  call: vi.fn(),
  document: vi.fn(),
  context: vi.fn(),
}));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: vi.fn(async () => ({ call })) }));
vi.mock("./settings-document", () => ({ readSettingsDocument: document }));
vi.mock("../studio/closure", () => ({ readClosureContext: context }));
import {
  readWorkCalendar,
  prepareWorkCalendar,
  writeWorkCalendar,
  readWorkCalendarResult,
  readWorkCalendarReceipt,
  workCalendarSchema,
} from "./work-calendar";
const scope = { accountId: "actor", orgId: "org", centerId: "center" };
const calendar = {
  rules: [
    {
      weekdays: [1],
      local_start: "09:00:00",
      local_end: "24:00:00",
      valid_from: "2026-11-23",
      valid_until: null,
    },
  ],
  closures: [],
};
let version: number, writable: boolean, missing: boolean;
beforeEach(() => {
  vi.resetAllMocks();
  version = 1;
  writable = true;
  missing = false;
  document.mockImplementation(async () => ({
    document: { version, values: missing ? {} : { work_calendar: null } },
    catalog: { fields: [{ key: "work_calendar", writable }] },
  }));
  context.mockResolvedValue({ center: { timezone: "Europe/Istanbul" } });
  call.mockImplementation(async (operation, request) =>
    operation !== "management_state_get_v1"
      ? { primary_id: scope.accountId }
      : {
          items: [
            {
              operation: "settings_update_v1",
              exists: true,
              entity: { type: "centers", id: scope.centerId },
              current: {
                operation: "settings_update_v1",
                values: {
                  scope: "center",
                  settings_version: 1,
                  work_calendar: request.selector.key.work_calendar,
                  work_calendar_impact: { count: 0, truncated: false, sessions: [] },
                },
              },
            },
          ],
          next_cursor: null,
        },
  );
});
describe("center work calendar", () => {
  it("preserves local dates, 24:00, explicit null and maximum-length closure reasons", () => {
    const value = {
      ...calendar,
      closures: [
        {
          starts_at: "2026-12-01T00:00:00Z",
          ends_at: "2026-12-02T00:00:00Z",
          reason: "x".repeat(2000),
        },
      ],
    };
    expect(workCalendarSchema.parse(value)).toEqual(value);
    expect(workCalendarSchema.parse(null)).toBeNull();
    const { valid_until, ...unbounded } = calendar.rules[0]!;
    expect(valid_until).toBeNull();
    expect(workCalendarSchema.parse({ ...calendar, rules: [unbounded] })).toEqual(calendar);
  });
  it("rejects overnight shorthand, impossible dates, empty or duplicate days and reversed validity", () => {
    for (const patch of [
      { local_start: "24:00:00" },
      { local_start: "22:00:00", local_end: "02:00:00" },
      { weekdays: [] },
      { weekdays: [1, 1] },
      { valid_from: "2026-02-30" },
      { valid_until: "2026-11-22" },
    ])
      expect(() =>
        workCalendarSchema.parse({ ...calendar, rules: [{ ...calendar.rules[0], ...patch }] }),
      ).toThrow();
  });
  it("does not invent an unrestricted calendar for omitted native metadata", async () => {
    missing = true;
    await expect(readWorkCalendar(scope)).rejects.toThrow("WORK_CALENDAR_UNAVAILABLE");
  });
  it("checks the current version and live write authority before preparing impact", async () => {
    const before = await readWorkCalendar(scope);
    version = 2;
    await expect(prepareWorkCalendar(before, calendar)).rejects.toMatchObject({
      code: "VERSION_CONFLICT",
    });
    version = 1;
    writable = false;
    await expect(prepareWorkCalendar(before, calendar)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(call).not.toHaveBeenCalled();
  });
  it("requires a complete zero-impact projection for the current settings version", async () => {
    const before = await readWorkCalendar(scope);
    for (const impact of [
      { count: 1, truncated: false, sessions: [] },
      { count: 0, truncated: true, sessions: [] },
      { count: 0, truncated: false, sessions: [{}] },
    ]) {
      call.mockResolvedValueOnce({
        items: [
          {
            operation: "settings_update_v1",
            exists: true,
            entity: { type: "centers", id: scope.centerId },
            current: {
              operation: "settings_update_v1",
              values: {
                scope: "center",
                settings_version: 1,
                work_calendar: calendar,
                work_calendar_impact: impact,
              },
            },
          },
        ],
        next_cursor: null,
      });
      await expect(prepareWorkCalendar(before, calendar)).rejects.toBeInstanceOf(BackendError);
    }
    for (const entity of [
      { type: "centers", id: "foreign" },
      { type: "accounts", id: scope.accountId },
    ]) {
      call.mockResolvedValueOnce({
        items: [
          {
            operation: "settings_update_v1",
            exists: true,
            entity,
            current: {
              operation: "settings_update_v1",
              values: {
                scope: "center",
                settings_version: 1,
                work_calendar: calendar,
                work_calendar_impact: { count: 0, truncated: false, sessions: [] },
              },
            },
          },
        ],
        next_cursor: null,
      });
      await expect(prepareWorkCalendar(before, calendar)).rejects.toThrow(
        "WORK_CALENDAR_IMPACT_UNAVAILABLE",
      );
    }
    call.mockResolvedValueOnce({ items: [], next_cursor: null });
    await expect(prepareWorkCalendar(before, calendar)).rejects.toThrow(
      "WORK_CALENDAR_IMPACT_UNAVAILABLE",
    );
  });
  it("freezes the exact scope, version, calendar and key without cancelling a session", async () => {
    const before = await readWorkCalendar(scope),
      draft = structuredClone(calendar),
      intent = await prepareWorkCalendar(before, draft);
    draft.rules[0]!.local_start = "10:00:00";
    await writeWorkCalendar(intent);
    expect(call).toHaveBeenLastCalledWith(
      "settings_update_v1",
      expect.objectContaining({
        scope: "center",
        org_id: "org",
        center_id: "center",
        expected_version: 1,
        operation_key: intent.key,
        patch: { work_calendar: calendar },
      }),
    );
    expect(call.mock.calls.map(([operation]) => operation)).toEqual([
      "management_state_get_v1",
      "settings_update_v1",
    ]);
  });
  it("accepts only a newer exact native result and an actor-bound operation receipt", async () => {
    const intent = await prepareWorkCalendar(await readWorkCalendar(scope), calendar);
    await expect(readWorkCalendarResult(intent, "foreign")).rejects.toThrow(
      "WORK_CALENDAR_RESULT_UNAVAILABLE",
    );
    await expect(readWorkCalendarResult(intent, "actor")).rejects.toThrow(
      "WORK_CALENDAR_RESULT_UNAVAILABLE",
    );
    document.mockResolvedValue({
      document: { version: 2, values: { work_calendar: calendar } },
      catalog: { fields: [{ key: "work_calendar", writable: true }] },
    });
    expect((await readWorkCalendarResult(intent, "actor")).calendar).toEqual(calendar);
    call.mockResolvedValue({
      operation: "settings_update_v1",
      key: intent.key,
      status: "succeeded",
      result_reference: { type: "accounts", id: "foreign" },
    });
    await expect(readWorkCalendarReceipt(intent)).rejects.toThrow(
      "WORK_CALENDAR_RECEIPT_UNAVAILABLE",
    );
  });
});
