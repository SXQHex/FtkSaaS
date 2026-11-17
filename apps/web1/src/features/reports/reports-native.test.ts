import { beforeEach, expect, it, vi } from "vitest";
import { reportInterval, readReport, readImportDirectory } from "./reports-read";
import { reportMoney, reportCount, salesPoints } from "./reports-presentation";
import {
  importUploadIntent,
  prepareImport,
  transferImport,
  writeReportJob,
  reportJobReceipt,
  readReportJob,
  downloadReport,
  type ReportJobIntent,
} from "./reports-command";
import { readImportRows, readImportPreview } from "./import-read";
import { i18n } from "../../i18n";
const call = vi.hoisted(() => vi.fn());
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: async () => ({ call }) }));
vi.mock("../../lib/supabase", () => ({
  getSupabaseClient: () => ({
    auth: {
      getSession: async () => ({
        data: { session: { access_token: "synthetic-native-token" } },
        error: null,
      }),
    },
  }),
}));
const id = (n: number) => `019ab7b0-0000-7000-8000-${String(n).padStart(12, "0")}`;
const scope = { accountId: id(1), orgId: id(2), centerId: id(3) };
const interval = { starts_at: "2026-11-01T00:00:00Z", ends_at: "2026-12-01T00:00:00Z" },
  filters = { interval, center_ids: [scope.centerId] };
const view = () => ({
  report_kind: "sales" as const,
  as_of: interval.starts_at,
  filters,
  rows: {
    items: [
      {
        group_key: "gross_sales:2026-11-02",
        center_id: scope.centerId,
        currency: "TRY",
        count: 1,
        amount_minor: "9007199254740993",
        period_start: "2026-11-02",
      },
    ],
    as_of: interval.starts_at,
    next_cursor: null,
  },
  totals: [
    {
      group_key: "gross_sales:2026-11-02",
      currency: "TRY",
      count: 5,
      amount_minor: "9007199254740993",
    },
    { group_key: "gross_sales:2026-11-09", currency: "TRY", count: 3, amount_minor: "7" },
    { group_key: "gross_sales:2026-11-02", currency: "EUR", count: 2, amount_minor: "1200" },
  ],
});
beforeEach(() => {
  call.mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("builds inclusive date selections into exact half-open center-local intervals through DST", async () => {
  expect(
    await reportInterval("Europe/Berlin", "custom", "2026-03-28", "2026-03-29", interval.starts_at),
  ).toEqual({ starts_at: "2026-03-27T23:00:00Z", ends_at: "2026-03-29T22:00:00Z" });
  await expect(
    reportInterval("Europe/Istanbul", "custom", "2026-12-01", "2026-11-01", interval.starts_at),
  ).rejects.toThrow();
  await expect(
    reportInterval("UTC", "custom", "2025-01-01", "2026-01-02", interval.starts_at),
  ).rejects.toThrow();
});
it("keeps whole-filter native money/currency totals exact above JS safe integer and charts explicitly relative", async () => {
  call.mockResolvedValue(view());
  const data = await readReport(scope, "sales", filters, "native-cursor");
  expect(call.mock.calls[0]![1]).toMatchObject({
    report: "sales",
    filters,
    page: { limit: 20, cursor: "native-cursor" },
  });
  expect(reportMoney(data.totals, "gross_sales:")).toContain("90.071.992.547.410,00");
  expect(reportMoney(data.totals, "gross_sales:")).toContain("€12,00");
  expect(reportCount(data.totals, "gross_sales:")).toBe("10");
  const points = salesPoints(data, "week", i18n.t.bind(i18n));
  expect(points[0]?.value).toBe(100);
  expect(points[0]?.display).toContain("90.071.992.547.409,93");
  expect(data.rows.items).toHaveLength(1);
});
it("rejects cross-center sources, mismatched report/interval and malformed financial facts", async () => {
  await expect(readReport(scope, "sales", { ...filters, center_ids: [id(8)] })).rejects.toThrow();
  expect(call).not.toHaveBeenCalled();
  call.mockResolvedValue({ ...view(), report_kind: "earnings" });
  await expect(readReport(scope, "sales", filters)).rejects.toThrow();
  const data = view();
  data.rows.items[0]!.amount_minor = "1e8";
  call.mockResolvedValue(data);
  await expect(readReport(scope, "sales", filters)).rejects.toThrow();
});
it("preserves absent native import configuration and applies row filters before cursor through the real API", async () => {
  call.mockResolvedValue({ items: [], as_of: interval.starts_at, next_cursor: null, limits: null });
  expect((await readImportDirectory(scope)).limits).toBeNull();
  call.mockResolvedValue({ items: [], as_of: interval.starts_at, next_cursor: null });
  await readImportRows(scope, id(9), "invalid", "row-cursor");
  expect(call.mock.calls.at(-1)?.[1]).toMatchObject({
    job_id: id(9),
    state: "invalid",
    include_details: true,
    page: { cursor: "row-cursor", limit: 20 },
  });
});
it("freezes file bytes/checksum and native prepare key; rejects forged storage capability destinations", async () => {
  const bytes = new TextEncoder().encode("source_key,display_name\r\nsynthetic,Sentetik kişi\r\n");
  const file = new File([bytes], "fixture.csv", { type: "text/csv" });
  Object.defineProperty(file, "arrayBuffer", { value: async () => bytes.buffer });
  const intent = await importUploadIntent(scope, file, 2048);
  const capability = {
    file_id: id(10),
    upload_url: `/storage/v1/object/upload/sign/ftksaas-imports/${scope.orgId}/${id(10)}?token=synthetic`,
    expires_at: "2099-01-01T00:00:00Z",
    allowed_mime: ["text/csv"],
    max_bytes: 2048,
  };
  call.mockResolvedValue(capability);
  await prepareImport(intent);
  await prepareImport(intent);
  expect(call.mock.calls[0]![1].operation_key).toBe(call.mock.calls[1]![1].operation_key);
  expect(intent.checksum).toMatch(/^[a-f0-9]{64}$/);
  const fetcher = vi.fn().mockResolvedValue(new Response("", { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  vi.stubEnv("VITE_SUPABASE_URL", "https://fixture.example.invalid");
  await expect(
    transferImport(intent, {
      ...capability,
      upload_url: "https://other.example.invalid/capability",
    }),
  ).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
  await transferImport(intent, capability);
  expect(fetcher.mock.calls[0]![1]).toMatchObject({
    method: "PUT",
    credentials: "omit",
    redirect: "error",
    body: intent.body,
  });
  await expect(importUploadIntent(scope, file, 1)).rejects.toThrow();
});
it("job writes replay only the frozen key and ACK readback uses only the job getter", async () => {
  const intent: ReportJobIntent = {
    scope,
    operation: "report_export_start_v1",
    request: {
      client_api_version: 1,
      org_id: scope.orgId,
      center_id: scope.centerId,
      operation_key: id(11),
      report: "sales",
      filters,
      format: "csv",
    },
  };
  call.mockResolvedValue({ job_id: id(12), state: "pending" });
  await writeReportJob(intent);
  await writeReportJob(intent);
  expect(call.mock.calls[0]![1].operation_key).toBe(call.mock.calls[1]![1].operation_key);
  expect(call.mock.calls[0]![1].request_id).not.toBe(call.mock.calls[1]![1].request_id);
  call.mockResolvedValue({
    id: id(12),
    state: "running",
    progress_count: 2,
    total_count: null,
    result_reference: null,
    safe_error_code: null,
  });
  expect((await readReportJob(intent, id(12))).state).toBe("running");
  expect(call.mock.calls.at(-1)?.[0]).toBe("job_status_get_v1");
  call.mockResolvedValue({
    operation: "import_apply_v1",
    key: id(11),
    result_reference: { type: "report_jobs", id: id(12) },
  });
  await expect(reportJobReceipt(intent)).rejects.toThrow();
});
it("requires the native import summary and does not substitute a zero summary for unavailable results", async () => {
  call.mockResolvedValue({ id: id(9), token: "synthetic", expires_at: "2099-01-01T00:00:00Z" });
  await expect(readImportPreview(scope, id(9))).rejects.toThrow();
});
it("downloads only a verified native-session CSV POST and rejects cross-origin metadata before sending the bearer", async () => {
  vi.stubEnv("VITE_SUPABASE_URL", "https://fixture.example.invalid");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "synthetic-public-key");
  const requests: { url: string; init: RequestInit }[] = [];
  let foreign = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: URL | string, init: RequestInit) => {
      requests.push({ url: String(url), init });
      const path = new URL(url).pathname;
      if (path.endsWith("account_get_v1"))
        return Response.json({ ok: true, data: { id: scope.accountId }, trace_id: id(19) });
      if (!new URL(url).search)
        return Response.json({
          ok: true,
          data: {
            file_id: id(20),
            download_path: foreign
              ? "https://other.example.invalid/leak"
              : "/functions/v1/backend-v1/report_file_get_v1?download=csv",
            expires_at: "2099-01-01T00:00:00Z",
          },
          trace_id: id(19),
        });
      return new Response("name,count\r\nsynthetic,1", {
        headers: { "content-type": "text/csv; charset=utf-8" },
      });
    }),
  );
  const result = await downloadReport(scope, id(12), id(11));
  expect(await result.text()).toContain("synthetic,1");
  expect(requests.at(-1)?.init).toMatchObject({
    method: "POST",
    credentials: "omit",
    redirect: "error",
  });
  expect(JSON.parse(requests.at(-1)!.init.body as string).operation_key).toBe(id(11));
  foreign = true;
  requests.length = 0;
  await expect(downloadReport(scope, id(12), id(11))).rejects.toThrow();
  expect(
    requests.every((row) => new URL(row.url).origin === "https://fixture.example.invalid"),
  ).toBe(true);
  expect(requests).toHaveLength(2);
});
