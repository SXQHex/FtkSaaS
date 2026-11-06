import { attendanceClose } from "../src/lib/attendance-command";
import { session as actualSession } from "./attendance-fixtures";
import { expect, test } from "vitest";
import type { AttendanceView } from "@ftksaas/api-contracts";
import { attendanceMatches, attendanceMark, attendanceStart } from "../src/lib/attendance-command";
import { recoverSetup, setupStorageKey } from "../src/lib/studio-setup";
const id = "019a2b3c-4d5e-7000-8000-000000000001",
  row = "019a2b3c-4d5e-7000-8000-000000000002";
const scope = { actorId: id, orgId: id, centerId: row };
const view: AttendanceView = {
  session_id: id,
  closure_state: "open",
  revision: 0,
  session_version: 8,
  actual_started_at: null,
  entries: [
    {
      reservation_id: row,
      person_id: id,
      result: "unmarked",
      version: 7,
      protected: true,
      eligibility_snapshot: null,
    },
  ],
};
test("attendance rejects foreign sessions, duplicated rows and invented versions", () => {
  expect(attendanceMatches(view, id)).toBe(true);
  for (const v of [
    { ...view, session_id: row },
    { ...view, entries: [...view.entries, ...view.entries] },
    { ...view, session_version: 0 },
  ])
    expect(attendanceMatches(v, id)).toBe(false);
});
test("draft uses reservation version, never the session or attendance entry version", () => {
  expect(attendanceMark(scope, view, view.entries[0]!, "attended").input).toMatchObject({
    reservation_id: row,
    expected_version: 7,
    result: "attended",
  });
  expect(() =>
    attendanceMark(scope, { ...view, closure_state: "closed" }, view.entries[0]!, "attended"),
  ).toThrow("invalidAttendance");
});
test("real start uses explicit time, rejects future/gap/repeated start and uses fresh session version", () => {
  expect(
    attendanceStart(scope, view, "2026-01-01T13:00", "Europe/Istanbul", "", "Ders başladı").input,
  ).toMatchObject({
    session_id: id,
    expected_version: 8,
    actual_started_at: "2026-01-01T10:00:00.000Z",
  });
  expect(() => attendanceStart(scope, view, "2099-01-01T13:00", "UTC", "", "Başladı")).toThrow(
    "invalidAttendance",
  );
  expect(() =>
    attendanceStart(
      scope,
      { ...view, actual_started_at: "2026-01-01T10:00:00Z" },
      "2026-01-01T13:00",
      "UTC",
      "",
      "Başladı",
    ),
  ).toThrow("invalidAttendance");
});
test.each(["attended", "no_show"] as const)(
  "%s journal remains exact and rejects another row or family",
  (result) => {
    sessionStorage.clear();
    const command = attendanceMark(scope, view, view.entries[0]!, result);
    const slot = `attendance-row:${row}`;
    sessionStorage.setItem(setupStorageKey(scope, slot), JSON.stringify({ command }));
    expect(recoverSetup(scope, slot)).toEqual({ command });
    for (const wrong of [`attendance-row:${id}`, `finance:${row}`, `attendance:${row}`]) {
      sessionStorage.setItem(setupStorageKey(scope, wrong), JSON.stringify({ command }));
      expect(recoverSetup(scope, wrong)).toBe("invalid");
    }
  },
);
test("malformed journal result arrays do not become valid strings", () => {
  const command = attendanceMark(scope, view, view.entries[0]!, "attended");
  sessionStorage.setItem(
    setupStorageKey(scope, `attendance-row:${row}`),
    JSON.stringify({ command: { ...command, input: { ...command.input, result: ["attended"] } } }),
  );
  expect(recoverSetup(scope, `attendance-row:${row}`)).toBe("invalid");
});
test("local start refuses DST gaps and requires the chosen repeated-hour offset", () => {
  expect(() =>
    attendanceStart(scope, view, "2026-03-29T02:30", "Europe/Berlin", "", "Ders başladı"),
  ).toThrow("invalidAttendance");
  expect(() =>
    attendanceStart(scope, view, "2025-10-26T02:30", "Europe/Berlin", "", "Ders başladı"),
  ).toThrow("invalidAttendance");
  expect(
    attendanceStart(
      scope,
      view,
      "2025-10-26T02:30",
      "Europe/Berlin",
      "2025-10-26T01:30:00.000Z",
      "Ders başladı",
    ).input.actual_started_at,
  ).toBe("2025-10-26T01:30:00.000Z");
});

test("closure refuses unmarked participants, foreign instructors and an implicit occurrence choice", () => {
  const ready = { ...view, entries: [{ ...view.entries[0]!, result: "attended" as const }] };
  expect(() => attendanceClose(scope, view, actualSession, "yes", [id])).toThrow(
    "invalidAttendance",
  );
  expect(() => attendanceClose(scope, ready, actualSession, "yes", [row])).toThrow(
    "invalidAttendance",
  );
  expect(() => attendanceClose(scope, ready, actualSession, "", [])).toThrow("invalidAttendance");
  expect(() => attendanceClose(scope, ready, actualSession, "no", [id])).toThrow(
    "invalidAttendance",
  );
  expect(attendanceClose(scope, ready, actualSession, "no", []).input).toMatchObject({
    expected_version: 8,
    performed: false,
    performed_instructor_ids: [],
  });
});
