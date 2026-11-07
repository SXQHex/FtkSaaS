import { expect, test, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { render } from "./render";
import type { ProgramInput } from "../src/lib/program";
import { ProgramFields } from "../src/components/programs/program-fields";
const draft = {
  starts_on: "2030-10-01",
  ends_on: "2030-11-01",
  weekdays: [7],
  local_start: "02:30",
  duration_minutes: 60,
  total: 10,
  room_id: "room",
  person_id: "teacher",
};
test("changing program times discards previously confirmed DST offsets", () => {
  const setOffsets = vi.fn<(value: Record<string, number>) => void>();
  render(
    <ProgramFields
      draft={draft}
      setDraft={vi.fn<(value: ProgramInput) => void>()}
      offsets={{ "2030-10-27": 60 }}
      setOffsets={setOffsets}
      catalog={{ rooms: [], instructors: [], disciplines: [] }}
      timeZone="Europe/Berlin"
      disabled={false}
      loading={false}
    />,
  );
  fireEvent.change(screen.getByLabelText("Başlangıç saati"), { target: { value: "02:45" } });
  expect(setOffsets).toHaveBeenCalledWith({});
});
test("clearing a DST choice removes it rather than creating a zero offset", () => {
  const setOffsets = vi.fn<(value: Record<string, number>) => void>();
  render(
    <ProgramFields
      draft={draft}
      setDraft={vi.fn<(value: ProgramInput) => void>()}
      offsets={{ "2030-10-27": 60 }}
      setOffsets={setOffsets}
      catalog={{ rooms: [], instructors: [], disciplines: [] }}
      timeZone="Europe/Berlin"
      disabled={false}
      loading={false}
    />,
  );
  fireEvent.change(screen.getByRole("combobox", { name: /2030-10-27/ }), { target: { value: "" } });
  expect(setOffsets).toHaveBeenCalledWith({});
});
