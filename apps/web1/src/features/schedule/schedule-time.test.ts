import { describe, expect, it } from "vitest";
import { programOffsetChoices, scheduleInterval, scheduleTimeChoices } from "./schedule-time";

describe("schedule wall-clock input", () => {
  it("converts the center's local time to UTC and ignores an offset left from another date", async () => {
    await expect(
      scheduleInterval("Europe/Istanbul", "2026-11-15", "09:00", 60, "-04:00"),
    ).resolves.toEqual({ starts_at: "2026-11-15T06:00:00Z", ends_at: "2026-11-15T07:00:00Z" });
  });

  it("rejects a spring-forward gap instead of moving the lesson", async () => {
    await expect(scheduleInterval("America/New_York", "2027-03-14", "02:30", 60)).rejects.toThrow(
      "SCHEDULE_TIME_GAP",
    );
  });

  it("requires a choice for a repeated time and preserves elapsed duration across the transition", async () => {
    await expect(
      scheduleInterval("America/New_York", "2027-11-07", "01:30", 60),
    ).rejects.toMatchObject({
      message: "SCHEDULE_TIME_AMBIGUOUS",
      requests: [
        {
          date: "2027-11-07",
          choices: [
            { id: "-04:00", label: "UTC-04:00" },
            { id: "-05:00", label: "UTC-05:00" },
          ],
        },
      ],
    });
    await expect(
      scheduleInterval("America/New_York", "2027-11-07", "01:30", 60, "-04:00"),
    ).resolves.toEqual({ starts_at: "2027-11-07T05:30:00Z", ends_at: "2027-11-07T06:30:00Z" });
    await expect(
      scheduleInterval("America/New_York", "2027-11-07", "01:30", 60, "-05:00"),
    ).resolves.toEqual({ starts_at: "2027-11-07T06:30:00Z", ends_at: "2027-11-07T07:30:00Z" });
  });

  it("supports a thirty-minute DST transition without assuming a one-hour fold", async () => {
    expect(
      (await scheduleTimeChoices("Australia/Lord_Howe", "2027-04-04", "01:45")).offsets,
    ).toEqual(["+11:00", "+10:30"]);
  });

  it.each([0, -1, 1.5, Number.POSITIVE_INFINITY])(
    "rejects invalid elapsed minutes %s",
    async (duration) => {
      await expect(scheduleInterval("UTC", "2026-11-15", "09:00", duration)).rejects.toThrow(
        "SCHEDULE_INVALID",
      );
    },
  );
});

describe("finite native program offset choices", () => {
  const input = {
    timezone: "America/New_York",
    startsOn: "2027-01-01",
    endsOn: "2029-01-01",
    time: "01:30",
    weekdays: [7],
    selected: {},
  };

  it("asks separately for every repeated local date in a multi-year program", async () => {
    await expect(programOffsetChoices(input)).rejects.toMatchObject({
      message: "SCHEDULE_TIME_AMBIGUOUS",
      requests: [
        expect.objectContaining({ date: "2027-11-07" }),
        expect.objectContaining({ date: "2028-11-05" }),
      ],
    });
  });

  it("passes only explicit per-date offsets to the native recurrence preview", async () => {
    await expect(
      programOffsetChoices({
        ...input,
        selected: { "2027-11-07": "-04:00", "2028-11-05": "-05:00" },
      }),
    ).resolves.toEqual([
      { date: "2027-11-07", offset_minutes: -240 },
      { date: "2028-11-05", offset_minutes: -300 },
    ]);
  });

  it("uses an exclusive end date and ignores transition dates outside the selected weekdays", async () => {
    await expect(programOffsetChoices({ ...input, endsOn: "2027-11-07" })).resolves.toEqual([]);
    await expect(programOffsetChoices({ ...input, weekdays: [1] })).resolves.toEqual([]);
  });

  it("rejects a selected spring gap and a skipped calendar date", async () => {
    await expect(
      programOffsetChoices({ ...input, endsOn: "2028-01-01", time: "02:30" }),
    ).rejects.toThrow("SCHEDULE_TIME_GAP");
    await expect(
      programOffsetChoices({
        timezone: "Pacific/Apia",
        startsOn: "2011-12-29",
        endsOn: "2012-01-02",
        time: "09:00",
        weekdays: [5],
        selected: {},
      }),
    ).rejects.toThrow("SCHEDULE_TIME_GAP");
  });
});
