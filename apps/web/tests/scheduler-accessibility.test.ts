import { expect, test, vi } from "vitest";
import {
  configureSchedulerEvent,
  preserveVisibleEventName,
} from "../src/components/calendar/scheduler-accessibility";

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

test("read-only editor events remain enabled detail buttons with the authoritative timezone context", () => {
  const element = document.createElement("div");
  element.textContent = "Tango 18:00 - 19:00";
  element.setAttribute("aria-label", "10 November, 18:00 GMT+03:00");
  element.setAttribute("aria-disabled", "true");
  configureSchedulerEvent(
    element,
    "10 November, 18:00 GMT+01:00 – 19:00 GMT+01:00",
    vi.fn<() => void>(),
  );
  expect(element).toHaveAccessibleName(
    "Tango 18:00 - 19:00. 10 November, 18:00 GMT+01:00 – 19:00 GMT+01:00",
  );
  expect(element).not.toHaveAttribute("aria-disabled");
  expect(element).toHaveAttribute("role", "button");
  expect(element.tabIndex).toBe(0);
});

test("Enter activates once and Space activates on release without duplicate vendor activation", () => {
  const element = document.createElement("div"),
    parent = document.createElement("div");
  parent.append(element);
  const selected = vi.fn<() => void>(),
    vendorKey = vi.fn<() => void>();
  parent.addEventListener("keydown", vendorKey);
  configureSchedulerEvent(element, "Date context", selected);
  element.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
  );
  element.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", repeat: true, bubbles: true, cancelable: true }),
  );
  expect(selected).toHaveBeenCalledTimes(1);
  const down = new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true });
  element.dispatchEvent(down);
  expect(down.defaultPrevented).toBe(true);
  expect(selected).toHaveBeenCalledTimes(1);
  element.dispatchEvent(new KeyboardEvent("keyup", { key: " ", bubbles: true, cancelable: true }));
  expect(selected).toHaveBeenCalledTimes(2);
  expect(vendorKey).not.toHaveBeenCalled();
});

test("rerender replaces activation and blur cancels Space while arrow keys remain native", () => {
  const element = document.createElement("div"),
    parent = document.createElement("div");
  parent.append(element);
  const previous = vi.fn<() => void>(),
    current = vi.fn<() => void>(),
    vendorKey = vi.fn<() => void>();
  parent.addEventListener("keydown", vendorKey);
  configureSchedulerEvent(element, "Date", previous);
  configureSchedulerEvent(element, "New date", current);
  element.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
  element.dispatchEvent(new FocusEvent("blur"));
  element.dispatchEvent(new KeyboardEvent("keyup", { key: " ", bubbles: true }));
  expect(current).not.toHaveBeenCalled();
  element.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  expect(vendorKey).toHaveBeenCalledTimes(1);
  element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  expect(current).toHaveBeenCalledTimes(1);
  expect(previous).not.toHaveBeenCalled();
});
