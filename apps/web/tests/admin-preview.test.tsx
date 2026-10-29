import { expect, test } from "vitest";
import { screen, within } from "@testing-library/react";
import { render } from "./render";
import { AdminPreview } from "../src/components/admin/admin-preview";

test.each([
  {
    locale: "tr" as const,
    dayName: "Paz 1",
    fullDate: "1 Kasım Pazar",
    preview: "Tasarım önizlemesi",
    note: "Tüm kişi ve veriler örnektir.",
  },
  {
    locale: "en" as const,
    dayName: "Sun 1",
    fullDate: "Sunday, November 1",
    preview: "Design preview",
    note: "All people and data are fictional.",
  },
])(
  "$locale day controls keep visible names and full date descriptions",
  ({ locale, dayName, fullDate, preview, note }) => {
    render(<AdminPreview />, locale);
    const sunday = screen.getByRole("button", { name: dayName });
    expect(sunday).toHaveAccessibleDescription(fullDate);
    expect(sunday).toHaveAttribute("aria-pressed", "false");
    const previewRegion = screen.getByRole("region", { name: preview });
    expect(within(previewRegion).getByText(note)).toBeVisible();
  },
);
