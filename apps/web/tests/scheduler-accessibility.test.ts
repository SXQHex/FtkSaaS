import { expect, test } from "vitest";
import { preserveVisibleEventName } from "../src/components/calendar/scheduler-accessibility";

test("event name contains the displayed title and times while retaining date context", () => {
  const element = document.createElement("div");
  element.innerHTML = "<span>Tango</span><span>18:00 - 19:00</span>";
  element.setAttribute("aria-label", "Tango, 11 Kasım 2030, 18:00 başlangıç, 19:00 bitiş");
  preserveVisibleEventName(element);
  expect(element).toHaveAccessibleName(
    "Tango18:00 - 19:00. Tango, 11 Kasım 2030, 18:00 başlangıç, 19:00 bitiş",
  );
  preserveVisibleEventName(element);
  expect(element).toHaveAccessibleName(
    "Tango18:00 - 19:00. Tango, 11 Kasım 2030, 18:00 başlangıç, 19:00 bitiş",
  );
});

test("existing matching names and missing context are preserved", () => {
  const element = document.createElement("div");
  element.textContent = "Tango";
  element.setAttribute("aria-label", "Tango, 11 Kasım");
  preserveVisibleEventName(element);
  expect(element).toHaveAccessibleName("Tango, 11 Kasım");
  element.removeAttribute("aria-label");
  preserveVisibleEventName(element);
  expect(element).not.toHaveAttribute("aria-label");
});

test("whitespace is normalized without discarding a translated context", () => {
  const element = document.createElement("div");
  element.textContent = "Tango\n  09:00 - 10:00";
  element.setAttribute("aria-label", "Tango starts Monday 7 January 2030");
  preserveVisibleEventName(element);
  expect(element).toHaveAccessibleName("Tango 09:00 - 10:00. Tango starts Monday 7 January 2030");
});

test("empty rendered event text leaves the vendor context intact", () => {
  const element = document.createElement("div");
  element.textContent = "  \n ";
  element.setAttribute("aria-label", "Session starts Monday");
  preserveVisibleEventName(element);
  expect(element).toHaveAccessibleName("Session starts Monday");
});
