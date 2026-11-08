import { test, expect } from "vitest";
import { screen } from "@testing-library/react";
import { render } from "./render";
import { UserPreferencesProvider } from "../src/components/user-preferences";
import { useDisplayFormatter, useDisplayMoney } from "../src/components/display-format";
import { calendarInterval, weekStart } from "../src/lib/schedule";
function Consumer() {
  const f = useDisplayFormatter(),
    money = useDisplayMoney();
  return (
    <>
      <output data-testid="number">{f.number(1234.5)}</output>
      <output data-testid="money">{money("900719925474099301", "TRY", "tr")}</output>
      <output data-testid="time">
        {f.dateTime(new Date("2030-01-01T00:30:00Z"), { dateStyle: "medium", timeStyle: "short" })}
      </output>
    </>
  );
}
test("number locale is independent of Turkish messages and preserves minor-unit precision", () => {
  render(
    <UserPreferencesProvider
      value={{
        number_format: "en-US",
        time_format: "12",
        date_format: "dd.MM.yyyy",
        timezone_mode: "manual",
        timezone_name: "Europe/Istanbul",
      }}
    >
      <Consumer />
    </UserPreferencesProvider>,
  );
  expect(screen.getByTestId("number")).toHaveTextContent("1,234.5");
  expect(screen.getByTestId("money")).toHaveTextContent("9,007,199,254,740,993.01");
  expect(screen.getByTestId("time").textContent).toContain("03:30");
});
test("month and Sunday preference produce complete authoritative query intervals without changing a center timezone", () => {
  expect(weekStart("2030-01-07", "sunday")).toBe("2030-01-06");
  expect(calendarInterval("2030-02-15", "month", "Europe/Istanbul")).toEqual({
    starts_at: "2030-01-31T21:00:00.000Z",
    ends_at: "2030-02-28T21:00:00.000Z",
  });
});
