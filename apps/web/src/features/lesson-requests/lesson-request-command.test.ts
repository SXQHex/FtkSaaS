import { describe, expect, it } from "vitest";
import { requestIntent } from "./lesson-request-command";
import { requestDetail, requestInterval } from "./lesson-requests-read";
import type { LessonRequestView, ManagementStateView } from "@ftksaas/api-contracts";
import type { RequestDraft } from "./lesson-requests-view";
const id = (n: number) => `019a7b00-0000-7000-8000-${String(n).padStart(12, "0")}`;
const scope = { accountId: id(1), orgId: id(2), centerId: id(3) };
const before: LessonRequestView = {
  id: id(4),
  center_id: scope.centerId,
  person_id: id(5),
  discipline_id: id(6),
  requested_start: "2026-12-01T09:00:00Z",
  duration_minutes: 60,
  preferred_instructor_id: id(7),
  created_at: "2026-11-16T00:00:00Z",
  expires_at: null,
  format: "private",
  state: "pending",
  version: 2,
  alternatives: [],
  reservation_id: null,
};
const draft = (): RequestDraft => ({
  reason: "",
  day: "2026-12-02",
  time: "13:00",
  instructorId: id(7),
  roomId: id(8),
  sessionId: id(9),
  mode: "existing",
  capacity: "1",
  accepted: false,
  windowException: false,
  offset: "",
});
describe("lesson request native intents", () => {
  it("accepts minute precision input and converts the center timezone without reserving", async () => {
    const intent = await requestIntent(scope, before, "alternative", draft(), "Europe/Istanbul");
    expect(intent.operation).toBe("lesson_request_offer_alternative_v1");
    expect(intent.request).toMatchObject({
      expected_version: 2,
      lesson_request_id: before.id,
      alternatives: [
        {
          interval: { starts_at: "2026-12-02T10:00:00Z", ends_at: "2026-12-02T11:00:00Z" },
          instructor_id: id(7),
        },
      ],
    });
    expect(intent.request).not.toHaveProperty("session");
    expect(intent.request).not.toHaveProperty("window_exception");
  });
  it("requires explicit consent and keeps existing session approval separate from creation", async () => {
    await expect(
      requestIntent(scope, before, "approve", draft(), "Europe/Istanbul"),
    ).rejects.toThrow("LESSON_REQUEST_REVIEW_REQUIRED");
    const intent = await requestIntent(
      scope,
      before,
      "approve",
      { ...draft(), accepted: true },
      "Europe/Istanbul",
    );
    expect(intent.request).toMatchObject({ session_id: id(9) });
    expect(intent.request).not.toHaveProperty("session");
  });
  it("freezes source, selects native room/capacity/instructor and preserves requested interval", async () => {
    const source = structuredClone(before);
    const intent = await requestIntent(
      scope,
      source,
      "approve",
      { ...draft(), mode: "create", accepted: true },
      "Europe/Istanbul",
    );
    source.version = 99;
    expect(intent.before.version).toBe(2);
    expect(intent.request).toMatchObject({
      session: {
        format: "private",
        discipline_id: id(6),
        interval: { starts_at: "2026-12-01T09:00:00Z", ends_at: "2026-12-01T10:00:00Z" },
        resources: [{ kind: "room", id: id(8) }],
        assignments: [{ person_id: id(7), duty: "instructor" }],
        capacity: { total: 1 },
      },
    });
  });
  it("refuses instructor substitution and closed or cross-center sources", async () => {
    await expect(
      requestIntent(
        scope,
        before,
        "approve",
        { ...draft(), mode: "create", instructorId: id(10), accepted: true },
        "Europe/Istanbul",
      ),
    ).rejects.toThrow("LESSON_REQUEST_INSTRUCTOR_CHANGED");
    for (const source of [
      { ...before, center_id: id(10) },
      { ...before, state: "rejected" as const },
    ])
      await expect(
        requestIntent(
          scope,
          source,
          "reject",
          { ...draft(), reason: "uygun değil" },
          "Europe/Istanbul",
        ),
      ).rejects.toThrow("LESSON_REQUEST_SOURCE_CHANGED");
  });
  it("requires a rejection reason and explicit justified policy exception", async () => {
    await expect(
      requestIntent(scope, before, "reject", draft(), "Europe/Istanbul"),
    ).rejects.toThrow();
    await expect(
      requestIntent(
        scope,
        before,
        "alternative",
        { ...draft(), windowException: true },
        "Europe/Istanbul",
      ),
    ).rejects.toThrow();
    const intent = await requestIntent(
      scope,
      before,
      "alternative",
      { ...draft(), windowException: true, reason: "  yönetici kararı  " },
      "Europe/Istanbul",
    );
    expect(intent.request).toMatchObject({ window_exception: true, reason: "yönetici kararı" });
  });
  it("never approves an unaccepted alternative and uses the accepted native interval", async () => {
    const source = { ...before, state: "alternative_offered" as const };
    await expect(requestInterval(source)).rejects.toThrow(
      "LESSON_REQUEST_ALTERNATIVE_NOT_ACCEPTED",
    );
    const interval = { starts_at: "2026-12-03T11:00:00Z", ends_at: "2026-12-03T12:00:00Z" };
    await expect(
      requestInterval({
        ...source,
        alternatives: [
          {
            id: id(11),
            request_id: before.id,
            version: 1,
            ...interval,
            created_at: before.created_at,
            instructor_id: id(10),
            state: "accepted",
          },
        ],
      }),
    ).resolves.toEqual({ interval, instructorId: id(10) });
  });
  it("requires an explicit UTC offset for a repeated wall time", async () => {
    await expect(
      requestIntent(
        scope,
        before,
        "alternative",
        { ...draft(), day: "2027-11-07", time: "01:30" },
        "America/New_York",
      ),
    ).rejects.toThrow("SCHEDULE_TIME_AMBIGUOUS");
  });
  it("rejects mismatched source identity, center and version without inventing current state", () => {
    const row: ManagementStateView = {
      operation: "lesson_request_reject_v1",
      exists: true,
      current: null,
      entity: { type: "lesson_requests", id: before.id },
      state: "pending",
      as_of: before.created_at,
      versions: [{ entity: { type: "lesson_requests", id: before.id }, version: 2 }],
      request_detail: before,
    };
    expect(requestDetail(row, scope, row.operation, before.id)).toBe(before);
    expect(() => requestDetail({ ...row, versions: [] }, scope, row.operation)).toThrow();
    expect(() => requestDetail(row, { ...scope, centerId: id(99) }, row.operation)).toThrow();
    expect(() => requestDetail(row, scope, row.operation, id(99))).toThrow();
  });
});
