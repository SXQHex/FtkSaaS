import { expect, test } from "vitest";
import { screen, within } from "@testing-library/react";
import { render } from "./render";
import { SessionSummary } from "../src/components/calendar/session-summary";
import { sampleSession } from "../src/components/admin/session-change-fixtures";

test("category capacity displays backend totals, held and remaining independently, including zero", () => {
  render(
    <SessionSummary
      session={{
        ...sampleSession,
        capacity: {
          ...sampleSession.capacity,
          categories: { male: 7, female: 13 },
          category_held: { male: 0, female: 3 },
          category_remaining: { male: 4, female: 6 },
          room_capacity: 0,
        },
      }}
      timeZone="Europe/Istanbul"
    />,
  );
  const male = within(screen.getByRole("group", { name: "Erkek" }));
  expect(male.getByText("7")).toBeVisible();
  expect(male.getByText("0")).toBeVisible();
  expect(male.getByText("4")).toBeVisible();
  const female = within(screen.getByRole("group", { name: "Kadın" }));
  expect(female.getByText("13")).toBeVisible();
  expect(female.getByText("3")).toBeVisible();
  expect(female.getByText("6")).toBeVisible();
  expect(screen.getByText("Oda kapasitesi: 0")).toBeVisible();
});

test("missing category readings are unavailable rather than inferred from limits", () => {
  render(
    <SessionSummary
      session={{
        ...sampleSession,
        capacity: {
          ...sampleSession.capacity,
          categories: { male: 0, female: 20 },
          category_held: null,
          category_remaining: null,
          room_capacity: null,
        },
      }}
      timeZone="Europe/Istanbul"
    />,
  );
  const male = within(screen.getByRole("group", { name: "Erkek" }));
  expect(male.getByText("0")).toBeVisible();
  expect(male.getAllByText("Bilgi yok")).toHaveLength(2);
  expect(screen.queryByText(/Oda kapasitesi:/)).not.toBeInTheDocument();
});

test("English summary shows category information and keeps backend attendance separate from time", () => {
  render(
    <SessionSummary
      session={{
        ...sampleSession,
        state: "cancelled",
        capacity: {
          ...sampleSession.capacity,
          categories: { male: 10, female: 10 },
          category_held: { male: 5, female: 7 },
          category_remaining: { male: 5, female: 3 },
        },
      }}
      timeZone="Europe/Istanbul"
    />,
    "en",
  );
  expect(screen.getByRole("group", { name: "Male" })).toBeVisible();
  expect(screen.getByRole("group", { name: "Female" })).toBeVisible();
  expect(screen.getByText("Cancelled", { exact: true })).toBeVisible();
  expect(screen.getByText("Open", { exact: true })).toBeVisible();
});
