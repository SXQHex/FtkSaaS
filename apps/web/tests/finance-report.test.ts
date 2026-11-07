import { expect, test, vi } from "vitest";
import { financeReportApi } from "../src/lib/finance-report";
import { setupCall } from "../src/lib/studio-setup";
vi.mock("../src/lib/studio-setup", () => ({ setupCall: vi.fn<typeof setupCall>() }));
const person = "019a2b3c-4d5e-7000-8000-000000000001",
  center = "019a2b3c-4d5e-7000-8000-000000000002";
const scope = { actorId: person, orgId: person, centerId: center };
const interval = { starts_at: "2026-11-01T00:00:00Z", ends_at: "2026-12-01T00:00:00Z" };
function report() {
  return {
    report_kind: "collections_debts",
    as_of: interval.starts_at,
    filters: {
      interval: { ends_at: interval.ends_at, starts_at: interval.starts_at },
      center_ids: [center],
      person_ids: [person],
      currency: "TRY",
    },
    rows: {
      items: [
        {
          group_key: "collections",
          center_id: center,
          person_id: person,
          currency: "TRY",
          count: 1,
          amount_minor: "9007199254740993",
        },
      ],
      as_of: interval.starts_at,
      next_cursor: "next",
    },
    totals: [
      { group_key: "collections", currency: "TRY", count: 3, amount_minor: "9007199254740995" },
    ],
  };
}
test("finance report preserves exact minor units and whole-query totals independently of page rows", async () => {
  const data = report();
  vi.mocked(setupCall).mockResolvedValueOnce(data as never);
  expect(await financeReportApi.read(scope, person, "TRY", interval)).toEqual(data);
  expect(setupCall).toHaveBeenLastCalledWith(
    "report_get_v1",
    expect.objectContaining({
      report: "collections_debts",
      filters: { interval, center_ids: [center], person_ids: [person], currency: "TRY" },
    }),
  );
});
test.each([
  "person",
  "center",
  "currency",
  "interval",
  "kind",
  "money",
  "metric",
  "cursor",
  "asOf",
])("rejects mismatched or malformed %s before a successful comparison", async (kind) => {
  const data = report();
  if (kind === "person") data.rows.items[0].person_id = center;
  if (kind === "center") data.filters.center_ids = [];
  if (kind === "currency") data.totals[0].currency = "EUR";
  if (kind === "interval") data.filters.interval.ends_at = interval.starts_at;
  if (kind === "kind") data.report_kind = "earnings";
  if (kind === "money") data.totals[0].amount_minor = "-1";
  if (kind === "metric") data.totals[0].group_key = "unknown";
  if (kind === "asOf") data.rows.as_of = "invalid";
  vi.mocked(setupCall).mockResolvedValueOnce(data as never);
  await expect(
    financeReportApi.read(scope, person, "TRY", interval, kind === "cursor" ? "next" : undefined),
  ).rejects.toThrow("invalidFinance");
});
test("native permission rejection remains an error", async () => {
  vi.mocked(setupCall).mockRejectedValueOnce(Error("FORBIDDEN"));
  await expect(financeReportApi.read(scope, person, "TRY", interval)).rejects.toThrow("FORBIDDEN");
});
