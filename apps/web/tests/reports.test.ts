import { expect, test } from "vitest";
import { v7 } from "uuid";
import { validateReport, validateImportMapping, privateReportUrl } from "../src/lib/reports";
const center = v7(),
  interval = { starts_at: "2026-11-01T00:00:00Z", ends_at: "2026-12-01T00:00:00Z" };
const filters = { interval, center_ids: [center] };
const report = {
  report_kind: "occupancy" as const,
  filters,
  as_of: interval.ends_at,
  rows: {
    as_of: interval.ends_at,
    items: [{ group_key: "sessions", center_id: center, ratio_bps: 15000, count: 3 }],
    next_cursor: null,
  },
  totals: [{ group_key: "sessions", count: 3 }],
};
test("report preserves whole-result totals and ratios above 100 percent while rejecting another scope", () => {
  expect(validateReport(report, "occupancy", filters)).toBe(report);
  expect(() =>
    validateReport(
      {
        ...report,
        rows: { ...report.rows, items: [{ ...report.rows.items[0], center_id: v7() }] },
      },
      "occupancy",
      filters,
    ),
  ).toThrow("invalidReport");
  expect(() =>
    validateReport({ ...report, filters: { ...filters, currency: "TRY" } }, "occupancy", filters),
  ).toThrow("invalidReport");
});
test("import mapping requires explicit source keys, names and non-repeated typed targets", () => {
  const mapping = {
    delimiter: ";" as const,
    columns: [
      { source_column: "id", target: "source_key" as const },
      { source_column: "name", target: "display_name" as const },
    ],
  };
  expect(validateImportMapping(mapping)).toBe(mapping);
  expect(() => validateImportMapping({ ...mapping, columns: [mapping.columns[1]!] })).toThrow(
    "invalidImport",
  );
  expect(() =>
    validateImportMapping({
      ...mapping,
      columns: [...mapping.columns, { source_column: "name", target: "phone" }],
    }),
  ).toThrow("invalidImport");
});
test("CSV download can only use the authenticated fixed Edge endpoint", () => {
  expect(
    privateReportUrl(
      "https://project.invalid",
      "/functions/v1/backend-v1/report_file_get_v1?download=csv",
    ).origin,
  ).toBe("https://project.invalid");
  expect(() => privateReportUrl("https://project.invalid", "https://evil.invalid/files")).toThrow(
    "invalidReport",
  );
  expect(() => privateReportUrl("https://project.invalid", "/storage/private/file")).toThrow(
    "invalidReport",
  );
});

test("native minor-unit strings retain arbitrary precision and their currency", () => {
  const row = {
    group_key: "collections",
    center_id: center,
    amount_minor: "90071992547409930",
    currency: "TRY",
    count: 1,
  };
  const financial = {
    ...report,
    report_kind: "collections_debts" as const,
    rows: { ...report.rows, items: [row] },
    totals: [{ ...row }],
  };
  expect(validateReport(financial, "collections_debts", filters)).toBe(financial);
  expect(() =>
    validateReport(
      { ...financial, rows: { ...financial.rows, items: [{ ...row, currency: null }] } },
      "collections_debts",
      filters,
    ),
  ).toThrow("invalidReport");
});

test("scoped empty template filters and person_ids preserve unfiltered native semantics", () => {
  const raw = { ...filters, center_ids: [], person_ids: [] },
    scoped = {
      ...report,
      filters: raw,
      rows: {
        ...report.rows,
        items: [{ group_key: "session", center_id: center, person_id: v7() }],
      },
    };
  expect(validateReport(scoped, "occupancy", raw, undefined, center)).toBe(scoped);
});
test("an explicitly selected amount-only projection stays in minor units without invented currency", () => {
  const row = { group_key: "collections", amount_minor: "12345678901234567890" };
  const projected = { ...report, rows: { ...report.rows, items: [row] } };
  expect(
    validateReport(projected, "occupancy", filters, undefined, center, {
      columns: ["amount_minor"],
    }),
  ).toBe(projected);
});
