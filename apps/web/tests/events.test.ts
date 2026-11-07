import { expect, test } from "vitest";
import { v7 } from "uuid";
import { validEventCommand, eventPreviewMatches } from "../src/lib/event-command";
const center = v7(),
  event = v7(),
  person = v7(),
  token = v7();
test("event journal binds source event, center, actual registration version and explicit eligibility override reason", () => {
  const input = { center_id: center, event_id: event, published: true };
  expect(validEventCommand("event_publish_v1", input, center, `event:${event}`)).toBe(true);
  expect(
    validEventCommand("event_publish_v1", { ...input, event_id: v7() }, center, `event:${event}`),
  ).toBe(false);
  const mark = {
    center_id: center,
    registration_id: person,
    expected_version: 3,
    result: "attended",
    record_ineligible_attendance: true,
  };
  expect(
    validEventCommand("event_attendance_mark_v1", mark, center, `event-registration:${person}`),
  ).toBe(false);
  expect(
    validEventCommand(
      "event_attendance_mark_v1",
      { ...mark, reason: "Observed actual participation" },
      center,
      `event-registration:${person}`,
    ),
  ).toBe(true);
});
test("event preview binds exact event version and cannot be applied after expiry", () => {
  const p = {
    id: token,
    token: "synthetic",
    expires_at: "2099-01-01T00:00:00Z",
    dependencies: { versions: [{ entity: { type: "events", id: event }, version: 4 }] },
  };
  expect(eventPreviewMatches(p as never, event, 4)).toBe(true);
  expect(eventPreviewMatches(p as never, event, 5)).toBe(false);
  expect(eventPreviewMatches({ ...p, expires_at: "2000-01-01T00:00:00Z" } as never, event, 4)).toBe(
    false,
  );
});

test("registration and duty commands cannot recover from another target or create slot", () => {
  const r = v7();
  const input = { center_id: center, registration_id: r, expected_version: 3, result: "attended" };
  expect(
    validEventCommand("event_attendance_mark_v1", input, center, `event-registration:${r}`),
  ).toBe(true);
  expect(
    validEventCommand("event_attendance_mark_v1", input, center, `event-registration:${v7()}`),
  ).toBe(false);
  expect(
    validEventCommand("event_attendance_mark_v1", input, center, `event-create:${center}`),
  ).toBe(false);
  expect(
    validEventCommand(
      "event_duty_verify_v1",
      { center_id: center, assignment_id: r, expected_version: 2, performed: false },
      center,
      `event-duty:${r}`,
    ),
  ).toBe(true);
});
