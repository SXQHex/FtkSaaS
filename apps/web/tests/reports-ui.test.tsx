import { beforeEach, expect, test, vi } from "vitest";
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import tr from "../messages/tr.json";
import { v7 } from "uuid";
import { render } from "./render";
import { ReportResults, ReportValues } from "../src/components/reports/report-panel";
import { ImportResults } from "../src/components/reports/import-results";
import type { ReportView } from "@ftksaas/api-contracts";
const m = vi.hoisted(() => ({
  call: vi.fn<(op: string, input: Record<string, unknown>) => Promise<unknown>>(),
}));
vi.mock("../src/lib/studio-setup", async (load) => ({
  ...(await load<typeof import("../src/lib/studio-setup")>()),
  setupCall: m.call,
}));
const scope = { actorId: v7(), orgId: v7(), centerId: v7() },
  filters = {
    center_ids: [scope.centerId],
    interval: { starts_at: "2026-11-01T00:00:00Z", ends_at: "2026-11-08T00:00:00Z" },
  },
  query = { kind: "occupancy" as const, filters, layout: {} };
beforeEach(() => {
  sessionStorage.clear();
  m.call.mockReset();
});
test("report renders native subscriber number, precise minor units and occupancy over 100 percent", () => {
  render(
    <ReportValues
      row={{
        group_key: "sessions",
        subscriber_number: "10042",
        amount_minor: "25001",
        currency: "TRY",
        ratio_bps: 15000,
      }}
    />,
  );
  expect(screen.getByText("10042")).toBeVisible();
  expect(screen.getByText(/250,01/)).toBeVisible();
  expect(screen.getByText(/150/)).toBeVisible();
});
test("changing report filters discards an old late response and keeps whole-result totals separate", async () => {
  let resolve!: (p: ReportView) => void;
  const report: ReportView = {
    report_kind: "occupancy",
    filters,
    as_of: filters.interval.ends_at,
    rows: {
      as_of: filters.interval.ends_at,
      items: [{ group_key: "old", count: 1 }],
      next_cursor: null,
    },
    totals: [{ group_key: "old total", count: 99 }],
  };
  m.call
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    )
    .mockResolvedValue({
      ...report,
      filters: { ...filters, currency: "TRY" },
      rows: { ...report.rows, items: [{ group_key: "new", count: 2 }] },
      totals: [{ group_key: "all result", count: 40 }],
    });
  const view = render(<ReportResults scope={scope} query={query} />);
  await screen.findByText("Okunuyor…");
  view.rerender(
    <NextIntlClientProvider locale="tr" messages={tr} timeZone="UTC">
      <ReportResults scope={scope} query={{ ...query, filters: { ...filters, currency: "TRY" } }} />
    </NextIntlClientProvider>,
  );
  await screen.findByText("all result");
  await act(async () => resolve(report));
  expect(screen.queryByText("old total")).not.toBeInTheDocument();
  expect(screen.getByText("40")).toBeVisible();
  expect(screen.getByText("2")).toBeVisible();
});
test("import queue acceptance cannot expose apply until the worker returns a preview", async () => {
  const job = v7();
  m.call.mockImplementation(async (op) => {
    if (op === "job_status_get_v1")
      return {
        id: job,
        state: "pending",
        progress_count: 0,
        total_count: null,
        result_reference: null,
        safe_error_code: null,
      };
    throw Error("Unexpected request");
  });
  render(<ImportResults scope={scope} previewJob={job} />);
  await screen.findByText(/Sırada/);
  expect(
    screen.queryByRole("button", { name: "Aktarım etkilerini incele" }),
  ).not.toBeInTheDocument();
  expect(m.call).toHaveBeenCalledTimes(1);
});
test("import preview shows currency-separated opening debt, rejects blockers, and does not auto apply", async () => {
  const job = v7(),
    preview = v7();
  m.call.mockImplementation(async (op) => {
    if (op === "job_status_get_v1")
      return {
        id: job,
        state: "succeeded",
        progress_count: 2,
        total_count: 2,
        result_reference: { type: "previews", id: preview },
        safe_error_code: null,
      };
    if (op === "preview_get_v1")
      return {
        id: preview,
        token: "synthetic",
        expires_at: "2099-01-01T00:00:00Z",
        blockers: [{ code: "LIMIT_EXCEEDED" }],
        effects: [],
        scope_hash: "synthetic",
        dependencies: { versions: [], policy_hashes: [], permission_hash: "synthetic" },
        import_summary: {
          total_rows: 2,
          valid_rows: 1,
          invalid_rows: 1,
          new_people: 1,
          replayed_rows: 0,
          opening_credits: 5,
          existing_negative_credits: 0,
          opening_debt_totals: [
            { currency: "TRY", amount_minor: "25000" },
            { currency: "EUR", amount_minor: "1000" },
          ],
          original_credit_basis_totals: [],
        },
      };
    if (op === "import_rows_list_v1")
      return {
        items: [
          { row_number: 1, state: "valid", error_code: null, created_references: [] },
          {
            row_number: 2,
            state: "invalid",
            error_code: "VALIDATION_FAILED",
            created_references: [],
          },
        ],
        as_of: "2026-11-08T00:00:00Z",
        next_cursor: null,
      };
    throw Error("Unexpected request");
  });
  const u = userEvent.setup();
  render(<ImportResults scope={scope} previewJob={job} />);
  expect(await screen.findByRole("button", { name: "Aktarım etkilerini incele" })).toBeDisabled();
  expect(screen.getByText(/₺250,00/)).toBeVisible();
  expect(screen.getByText(/€10,00/)).toBeVisible();
  await u.click(screen.getAllByRole("button", { name: "Yenile" })[0]!);
  expect(m.call.mock.calls.some(([op]) => op === "import_apply_v1")).toBe(false);
});

test("revoking job access during refresh removes the old CSV download action", async () => {
  const { persistJob } = await import("../src/lib/job-record");
  const job = v7(),
    file = v7();
  persistJob(scope, `report-export:${scope.centerId}`, job, {
    operation: "report_export_start_v1",
    input: {
      org_id: scope.orgId,
      center_id: scope.centerId,
      operation_key: v7(),
      report: query.kind,
      filters,
      format: "csv",
    },
  });
  let denied = false;
  m.call.mockImplementation(async (op) => {
    if (op === "report_get_v1")
      return {
        report_kind: query.kind,
        filters,
        as_of: filters.interval.ends_at,
        rows: { as_of: filters.interval.ends_at, items: [], next_cursor: null },
        totals: [],
      };
    if (op === "job_status_get_v1") {
      if (denied) throw Error("FORBIDDEN");
      return {
        id: job,
        state: "succeeded",
        progress_count: 1,
        total_count: 1,
        result_reference: { type: "files", id: file },
        safe_error_code: null,
      };
    }
    throw Error("Unexpected request");
  });
  const u = userEvent.setup();
  render(<ReportResults scope={scope} query={query} />);
  await screen.findByRole("button", { name: "CSV indir" });
  denied = true;
  await u.click(
    within(screen.getByRole("region", { name: "İş durumu" })).getByRole("button", {
      name: "Yenile",
    }),
  );
  await screen.findByRole("alert");
  expect(screen.queryByRole("button", { name: "CSV indir" })).not.toBeInTheDocument();
});
test("recovering a previous export under another search never offers its CSV as the current result", async () => {
  const { setupStorageKey } = await import("../src/lib/studio-setup");
  const key = v7(),
    job = v7();
  const input = {
    org_id: scope.orgId,
    center_id: scope.centerId,
    operation_key: key,
    report: query.kind,
    filters: { ...filters, currency: "EUR" },
    format: "csv",
  };
  sessionStorage.setItem(
    setupStorageKey(scope, `report-export:${scope.centerId}`),
    JSON.stringify({ command: { operation: "report_export_start_v1", input } }),
  );
  m.call.mockImplementation(async (op) => {
    if (op === "report_get_v1")
      return {
        report_kind: query.kind,
        filters,
        as_of: filters.interval.ends_at,
        rows: { as_of: filters.interval.ends_at, items: [], next_cursor: null },
        totals: [],
      };
    if (op === "operation_status_get_v1")
      return {
        operation: "report_export_start_v1",
        key,
        status: "succeeded",
        result_reference: { type: "report_jobs", id: job },
      };
    throw Error("Unexpected request");
  });
  const u = userEvent.setup();
  render(<ReportResults scope={scope} query={query} />);
  await u.click(screen.getByRole("button", { name: tr.setup.check }));
  await screen.findByText(tr.flows.errors.exportDifferentQuery);
  expect(screen.queryByRole("button", { name: "CSV indir" })).not.toBeInTheDocument();
  expect(m.call.mock.calls.some(([op]) => op === "job_status_get_v1")).toBe(false);
});

test("an active import cannot be abandoned with the new-file control", async () => {
  const { ImportPanel } = await import("../src/components/reports/import-panel"),
    { persistJob } = await import("../src/lib/job-record");
  const job = v7();
  persistJob(scope, `import-preview:${scope.centerId}`, job, {
    operation: "import_preview_v1",
    input: {
      org_id: scope.orgId,
      center_id: scope.centerId,
      operation_key: v7(),
      file_id: v7(),
      source_namespace: "synthetic",
      mapping: {
        delimiter: ",",
        columns: [
          { source_column: "id", target: "source_key" },
          { source_column: "name", target: "display_name" },
        ],
      },
    },
  });
  m.call.mockResolvedValue({
    id: job,
    state: "running",
    progress_count: 1,
    total_count: 20,
    result_reference: null,
    safe_error_code: null,
  });
  render(<ImportPanel scope={scope} />);
  await screen.findByText(/Çalışıyor/);
  expect(screen.getByRole("button", { name: "Yeni dosya / aktarım başlat" })).toBeDisabled();
});
test("an apply job from another file is not restored into the current import preview", async () => {
  const { persistJob } = await import("../src/lib/job-record");
  const job = v7(),
    old = v7(),
    preview = v7();
  persistJob(scope, `import-apply:${scope.centerId}`, old, {
    operation: "import_apply_v1",
    input: {
      org_id: scope.orgId,
      center_id: scope.centerId,
      operation_key: v7(),
      preview: { id: v7(), token: "old" },
    },
  });
  m.call.mockImplementation(async (op) => {
    if (op === "job_status_get_v1")
      return {
        id: job,
        state: "succeeded",
        progress_count: 1,
        total_count: 1,
        result_reference: { type: "previews", id: preview },
        safe_error_code: null,
      };
    if (op === "preview_get_v1")
      return {
        id: preview,
        token: "synthetic",
        expires_at: "2099-01-01T00:00:00Z",
        blockers: [],
        effects: [],
        scope_hash: "synthetic",
        dependencies: { versions: [], policy_hashes: [], permission_hash: "synthetic" },
        import_summary: {
          total_rows: 1,
          valid_rows: 1,
          invalid_rows: 0,
          new_people: 1,
          replayed_rows: 0,
          opening_credits: 0,
          existing_negative_credits: 0,
          opening_debt_totals: [],
          original_credit_basis_totals: [],
        },
      };
    if (op === "import_rows_list_v1")
      return { items: [], as_of: filters.interval.ends_at, next_cursor: null };
    throw Error("Unexpected request");
  });
  render(<ImportResults scope={scope} previewJob={job} />);
  expect(await screen.findByRole("button", { name: "Aktarım etkilerini incele" })).toBeEnabled();
  expect(screen.queryByText(tr.reports.applyQueued)).not.toBeInTheDocument();
});

test("refreshing templates invalidates a late preparation without replacing the active draft", async () => {
  const { WorkTemplatePicker } = await import("../src/components/reports/work-template-picker");
  const source = { scope: "member", key: "synthetic", version: 1 };
  let resolve!: (v: unknown) => void;
  const onResolved = vi.fn<(v: unknown) => void>();
  m.call.mockImplementation(async (op) => {
    if (op === "settings_catalog_get_v1")
      return { work_templates: { imports: [{ source, template: { name: "Hazır eşleme" } }] } };
    if (op === "settings_template_resolve_v1")
      return new Promise((done) => {
        resolve = done;
      });
    throw Error("Unexpected request");
  });
  const u = userEvent.setup();
  render(<WorkTemplatePicker scope={scope} kind="import" onResolved={onResolved} />);
  await screen.findByRole("option", { name: /Hazır eşleme/ });
  await u.selectOptions(screen.getByLabelText("Kayıtlı hazırlık şablonu"), "0");
  await u.click(screen.getByRole("button", { name: "Şablonu hazırla" }));
  await u.click(screen.getByRole("button", { name: "Yenile" }));
  await act(async () =>
    resolve({
      kind: "import",
      source,
      request: {
        center_id: scope.centerId,
        source_namespace: "old",
        mapping: { columns: [], delimiter: "," },
      },
    }),
  );
  expect(onResolved).not.toHaveBeenCalled();
});
test("revoking access on an applied import refresh removes every old row and person link", async () => {
  const { persistJob } = await import("../src/lib/job-record");
  const job = v7(),
    person = v7();
  let denied = false;
  persistJob(scope, `import-apply:${scope.centerId}`, job, {
    operation: "import_apply_v1",
    input: {
      org_id: scope.orgId,
      center_id: scope.centerId,
      operation_key: v7(),
      preview: { id: v7(), token: "synthetic" },
    },
  });
  m.call.mockImplementation(async (op) => {
    if (op === "job_status_get_v1") {
      if (denied) throw Error("FORBIDDEN");
      return {
        id: job,
        state: "succeeded",
        progress_count: 1,
        total_count: 1,
        result_reference: { type: "import_jobs", id: job },
        safe_error_code: null,
      };
    }
    if (op === "import_rows_list_v1")
      return {
        items: [
          {
            row_number: 1,
            state: "applied",
            error_code: null,
            created_references: [{ type: "people", id: person }],
          },
        ],
        as_of: filters.interval.ends_at,
        next_cursor: null,
      };
    throw Error("Unexpected request");
  });
  const u = userEvent.setup();
  render(<ImportResults scope={scope} previewJob={job} />);
  await screen.findByRole("link", { name: "Kişi, hak ve finans kaydını aç" });
  denied = true;
  await u.click(
    within(screen.getByRole("region", { name: "İş durumu" })).getByRole("button", {
      name: "Yenile",
    }),
  );
  await screen.findByRole("alert");
  expect(
    screen.queryByRole("link", { name: "Kişi, hak ve finans kaydını aç" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText("Satır 1")).not.toBeInTheDocument();
});
