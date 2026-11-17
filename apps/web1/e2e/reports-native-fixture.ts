import type { Page } from "@playwright/test";
import {
  mockCompletion,
  nativePage,
  nativeMutation,
  metadata,
  uid,
  at,
  completionUrl,
  type NativeRequest,
} from "./pro-completion-fixture.js";
import { studioIds as I } from "./studio-fixture.js";
export async function mockReports(
  page: Page,
  options: {
    unknownExport?: boolean;
    ackUnread?: boolean;
    noLimits?: boolean;
    expiredPreview?: boolean;
  } = {},
) {
  const writes: { op: string; r: NativeRequest }[] = [];
  let failed = false,
    jobReadFailed = false,
    checksum = "",
    imported = false,
    applied = false,
    applyReleased = false,
    exportStarted = false;
  const fileId = uid(51),
    jobId = uid(52),
    previewId = uid(53),
    exportId = uid(54);
  const rows = [
    {
      row_number: 1,
      state: "valid",
      error_code: null,
      created_references: [],
      source_key: "synthetic-1",
      student_preview: {
        display_name: "Birinci sentetik",
        contacts: [{ kind: "phone", value: "+905550000001" }],
        warnings: [],
      },
      application: {
        intake: {
          display_name: "Birinci sentetik",
          phone: "+905550000001",
          email: null,
          interest: "Tango",
          message: "",
          partner_name: "",
          mode: "",
          consents: [],
        },
        source: {
          channel: "legacy_import",
          form_key: "legacy_import",
          source_namespace: "e2e-source",
          source_key: "synthetic-1",
          file_checksum: "a".repeat(64),
          import_job_id: jobId,
          row_number: 1,
          source_url: null,
        },
        phone_matches: [],
        phone_matches_truncated: false,
        email_matches: [],
        email_matches_truncated: false,
      },
    },
    {
      row_number: 2,
      state: "valid",
      error_code: null,
      created_references: [],
      source_key: "synthetic-2",
      student_preview: {
        display_name: "İkinci sentetik",
        contacts: [{ kind: "phone", value: "+905550000002" }],
        warnings: [],
      },
      application: null,
    },
    {
      row_number: 3,
      state: "invalid",
      error_code: "VALIDATION_FAILED",
      created_references: [],
      source_key: "synthetic-3",
      student_preview: { display_name: "Hatalı sentetik", contacts: [], warnings: [] },
      application: null,
      field_errors: ["phone"],
    },
  ];
  const preview = {
    id: previewId,
    token: "synthetic",
    scope_hash: "synthetic",
    dependencies: { versions: [] },
    effects: [],
    blockers: [],
    expires_at: options.expiredPreview ? "2020-01-01T00:00:00Z" : "2099-01-01T00:00:00Z",
    import_summary: {
      total_rows: 3,
      valid_rows: 2,
      invalid_rows: 1,
      new_people: 0,
      replayed_rows: 0,
      opening_credits: 0,
      existing_negative_credits: 0,
      opening_debt_totals: [],
      original_credit_basis_totals: [],
      import_kind: "crm_applications",
      new_applications: 2,
    },
  };
  const f = await mockCompletion(page, async ({ op, r, send, abort }) => {
    if (op === "report_get_v1") {
      const key = r.report;
      let entries: NativeRequest[] = [],
        totals: NativeRequest[] = [];
      if (key === "sales") {
        const product = r.filters.breakdown === "product";
        entries = [
          {
            group_key: product ? `gross_sales:${uid(60)}` : "gross_sales:2026-11-09",
            center_id: I.center,
            currency: "TRY",
            count: 2,
            amount_minor: "9007199254740993",
            ...(product
              ? { product_version_id: uid(60), product_name: "Değişmez paket adı" }
              : { period_start: "2026-11-09" }),
          },
          {
            group_key: product ? `gross_sales:${uid(60)}` : "gross_sales:2026-11-09",
            center_id: I.center,
            currency: "EUR",
            count: 1,
            amount_minor: "1200",
            ...(product
              ? { product_version_id: uid(60), product_name: "Değişmez paket adı" }
              : { period_start: "2026-11-09" }),
          },
        ];
        totals = entries.map((row) => ({
          group_key: row.group_key,
          currency: row.currency,
          count: row.count,
          amount_minor: row.amount_minor,
        }));
      } else if (key === "session_metrics") {
        entries = [
          {
            group_key: "occupancy",
            center_id: I.center,
            session_id: I.lesson,
            session_name: "Native ders",
            count: 12,
            basis_count: 20,
            ratio_bps: 6000,
          },
          {
            group_key: "closed_attendance",
            center_id: I.center,
            session_id: I.lesson,
            session_name: "Native ders",
            count: 1,
            basis_count: 1,
            ratio_bps: 10000,
          },
        ];
        totals = entries.map((row) => ({
          group_key: row.group_key,
          currency: null,
          count: row.count,
          basis_count: row.basis_count,
          ratio_bps: row.ratio_bps,
          amount_minor: null,
        }));
      } else if (key === "collection_breakdown") {
        entries = [
          {
            group_key: "collections",
            center_id: I.center,
            person_id: I.instructor,
            display_name: "Sentetik tahsilat kişisi",
            product_version_id: r.filters.breakdown === "product" ? uid(60) : null,
            product_name: r.filters.breakdown === "product" ? "Değişmez paket adı" : null,
            currency: "TRY",
            count: 1,
            amount_minor: "15000",
          },
        ];
        totals = [{ group_key: "collections", currency: "TRY", count: 1, amount_minor: "15000" }];
      } else if (key === "instructor_balances") {
        entries = [
          ...[
            ["earning_accrual", "10000"],
            ["instructor_paid", "4000"],
            ["instructor_remaining", "6000"],
            ["instructor_overpaid", "0"],
          ].map(([group_key, amount_minor]) => ({
            group_key,
            center_id: I.center,
            person_id: I.instructor,
            display_name: "Native eğitmen",
            currency: "TRY",
            count: 1,
            amount_minor,
          })),
          {
            group_key: "closed_sessions",
            center_id: I.center,
            person_id: I.instructor,
            display_name: "Native eğitmen",
            count: 1,
          },
        ];
        totals = entries.map((row) => ({
          group_key: row.group_key,
          currency: "currency" in row ? row.currency : null,
          count: row.count,
          amount_minor: "amount_minor" in row ? row.amount_minor : null,
        }));
      } else if (key === "crm_conversion") {
        entries = [
          {
            group_key: "crm_conversion",
            center_id: I.center,
            count: 2,
            basis_count: 5,
            ratio_bps: 4000,
          },
        ];
        totals = [{ group_key: "crm_conversion", currency: null, count: 2, amount_minor: null }];
      }
      await send({
        report_kind: key,
        as_of: at,
        filters: r.filters,
        rows: nativePage(entries),
        totals,
      });
    }
    if (op === "finance_directory_get_v1")
      await send({
        view: r.view,
        items: [],
        as_of: at,
        next_cursor: null,
        totals: [
          {
            currency: "TRY",
            sales_minor: "10000",
            collections_minor: "15000",
            refunds_minor: "0",
            debt_minor: "3000",
            credit_minor: "2000",
            debt_people: 1,
            credit_people: 1,
          },
        ],
      });
    if (op === "tracking_directory_get_v1")
      await send({
        items: exportStarted
          ? [
              {
                kind: "job",
                id: exportId,
                created_at: at,
                operation: "report_build_v1",
                state: "succeeded",
                expires_at: null,
                progress_count: 3,
                total_count: 3,
                safe_error_code: null,
                next_attempt_at: null,
                result_reference: { type: "files", id: uid(55) },
              },
            ]
          : [],
        as_of: at,
        next_cursor: null,
        summary: {
          total: exportStarted ? 1 : 0,
          previews: 0,
          operations: 0,
          jobs: exportStarted ? 1 : 0,
          attention: 0,
          running: 0,
          retry: 0,
          completed: exportStarted ? 1 : 0,
        },
      });
    if (op === "import_directory_get_v1")
      await send({
        items: imported
          ? [
              {
                job_id: jobId,
                created_at: at,
                state: applied && !applyReleased ? "pending" : "succeeded",
                phase: applied ? "apply" : "preview",
                progress_count: applied ? (applyReleased ? 1 : 0) : 3,
                total_count: applied ? 1 : 3,
                preview_id: previewId,
                safe_error_code: null,
                kind: "crm_applications",
              },
            ]
          : [],
        as_of: at,
        next_cursor: null,
        limits: options.noLimits ? null : { max_bytes: 4096, max_rows: 50 },
      });
    if (op === "report_export_start_v1") {
      writes.push({ op, r });
      if (options.unknownExport && !failed) {
        failed = true;
        await abort();
      } else {
        exportStarted = true;
        await send({ job_id: exportId, state: "pending" });
      }
    }
    if (op === "job_status_get_v1") {
      if (r.job_id === exportId) {
        if (options.ackUnread && !jobReadFailed) {
          jobReadFailed = true;
          await abort();
        } else
          await send({
            id: exportId,
            state: "succeeded",
            progress_count: 3,
            total_count: 3,
            result_reference: { type: "files", id: uid(55) },
            safe_error_code: null,
          });
      } else
        await send({
          id: jobId,
          state: applied && !applyReleased ? "pending" : "succeeded",
          progress_count: applied ? (applyReleased ? 1 : 0) : 3,
          total_count: applied ? 1 : 3,
          result_reference: applied
            ? applyReleased
              ? { type: "import_jobs", id: jobId }
              : null
            : { type: "previews", id: previewId },
          safe_error_code: null,
        });
    }
    if (op === "report_file_get_v1") {
      await send({
        file_id: uid(55),
        download_path: "/functions/v1/backend-v1/report_file_get_v1?download=csv",
        expires_at: "2099-01-01T00:00:00Z",
      });
    }
    if (op === "import_upload_prepare_v1") {
      writes.push({ op, r });
      checksum = r.checksum;
      await send({
        file_id: fileId,
        upload_url: `/storage/v1/object/upload/sign/ftksaas-imports/${I.org}/${fileId}?token=synthetic`,
        expires_at: "2099-01-01T00:00:00Z",
        allowed_mime: ["text/csv"],
        max_bytes: 4096,
      });
    }
    if (op === "file_upload_complete_v1") {
      writes.push({ op, r });
      await send(nativeMutation(fileId));
    }
    if (op === "management_state_get_v1" && r.operation === "file_upload_complete_v1")
      await send(
        nativePage([
          metadata(r.operation, "files", fileId, { file_id: fileId, checksum }, 1, "ready"),
        ]),
      );
    if (op === "import_preview_v1") {
      writes.push({ op, r });
      imported = true;
      await send({ job_id: jobId, state: "pending" });
    }
    if (op === "preview_get_v1") await send(preview);
    if (op === "import_rows_list_v1") {
      const actual = rows.map((row) => ({
        ...row,
        state: applied && applyReleased && row.row_number === 2 ? "applied" : row.state,
      }));
      const selected = r.state
        ? actual.filter((row) => row.state === r.state)
        : r.page.cursor
          ? actual.slice(1)
          : actual.slice(0, 1);
      await send(nativePage(selected, r.state || r.page.cursor ? null : "rows-next"));
    }
    if (op === "import_apply_v1") {
      writes.push({ op, r });
      applied = true;
      await send({
        job_id: jobId,
        state: "pending",
        selected_rows_count: r.selected_row_numbers.length,
      });
    }
    if (op === "operation_status_get_v1")
      await send({
        operation: r.operation,
        key: r.key,
        status: "succeeded",
        result_reference: {
          type: r.operation === "report_export_start_v1" ? "report_jobs" : "import_jobs",
          id: r.operation === "report_export_start_v1" ? exportId : jobId,
        },
        result_available: true,
      });
  });
  await page.route("**/storage/v1/object/upload/sign/ftksaas-imports/**", (route) =>
    route.fulfill({ status: 200, json: { Key: "synthetic" } }),
  );
  // The download stays an authenticated Edge POST; the fixture models its binary branch separately.
  await page.route("**/functions/v1/backend-v1/report_file_get_v1?download=csv", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/csv; charset=utf-8",
      body: "name,count\r\nsynthetic,3",
    }),
  );
  await page.goto(completionUrl("reports"));
  return {
    ...f,
    writes,
    releaseApply: () => {
      applyReleased = true;
    },
  };
}
