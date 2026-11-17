import type { Page } from "@playwright/test";
import type {
  OrganizationView,
  JobStatusView,
  Preview,
} from "../src/lib/api-contracts/generated.js";
import { mockSettingsCompletion } from "./settings-native-fixture.js";
import { studioIds as I } from "./studio-fixture.js";
import { uid, nativePage, nativeMutation } from "./pro-completion-fixture.js";
export async function mockOrganizationLifecycle(
  page: Page,
  options: {
    unknownClose?: boolean;
    unknownDelete?: boolean;
    ackUnreadClose?: boolean;
    ackUnreadDelete?: boolean;
    denied?: boolean;
    expired?: boolean;
    staleClose?: boolean;
  } = {},
) {
  const settings = await mockSettingsCompletion(page);
  const organization: OrganizationView = {
    id: I.org,
    name: "Fixture Studio",
    state: "active",
    access_mode: "normal",
    version: 4,
    self_context: { person_id: I.self, subscriber_number: null, centers: [] },
  };
  const writes: { op: string; r: Record<string, any> }[] = [],
    requests: { op: string; r: Record<string, any> }[] = [];
  const payloads = new Map<string, string>();
  let previewNumber = 0,
    effects = 0,
    orgReadFailure = false,
    jobReadFailure = false;
  const job: JobStatusView = {
    id: uid(310),
    state: "retry_wait",
    progress_count: 0,
    total_count: null,
    result_reference: { type: "privacy_requests", id: uid(311) },
    safe_error_code: "RESULT_NOT_CONFIRMED",
    privacy: {
      request_state: "partial",
      completed_at: null,
      pending_scopes: ["database", "storage", "exports", "backups"],
    },
  };
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1)!,
      r = route.request().postDataJSON();
    requests.push({ op, r });
    const send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: uid(399) } });
    const fail = (code: string, retryable = false) =>
      route.fulfill({
        status: 403,
        json: { ok: false, error: { code, retryable, trace_id: uid(399) } },
      });
    if (op === "organizations_list_v1") return send(nativePage([organization]));
    if (op === "organization_get_v1") {
      if (orgReadFailure) {
        orgReadFailure = false;
        return fail("TEMPORARY_FAILURE", true);
      }
      return send(organization);
    }
    if (op === "organization_close_preview_v1" || op === "organization_delete_preview_v1") {
      if (options.denied) return fail("FORBIDDEN");
      previewNumber++;
      const preview: Preview = {
        id: uid(320 + previewNumber),
        token: `synthetic-${previewNumber}`,
        scope_hash: "synthetic",
        dependencies: {
          versions: [
            { entity: { type: "organizations", id: I.org }, version: organization.version },
          ],
          policy_hashes: [],
          permission_hash: "synthetic",
        },
        effects: [
          {
            entity: { type: "organizations", id: I.org },
            action: op === "organization_close_preview_v1" ? "close" : "delete",
            quantity: 1,
          },
        ],
        blockers: [],
        expires_at: options.expired ? "2020-01-01T00:00:00Z" : "2099-01-01T00:00:00Z",
        lifecycle_impact: {
          active_account_links: 2,
          open_sessions: 1,
          open_requests: 0,
          active_reservations: 4,
          active_event_registrations: 0,
          open_debts: 3,
          student_credit_accounts: 2,
          export_operation: "report_export_start_v1",
          export_requires_scope_check: true,
          export_before_closure: true,
          physical_erasure_complete: false,
        },
      };
      return send(preview);
    }
    if (op === "organization_close_apply_v1" || op === "organization_delete_apply_v1") {
      writes.push({ op, r });
      const payload = JSON.stringify({ ...r, request_id: undefined, reauth: undefined });
      const old = payloads.get(r.operation_key);
      if (old && old !== payload) return fail("IDEMPOTENCY_PAYLOAD_MISMATCH");
      if (!old) {
        if (options.staleClose && op === "organization_close_apply_v1" && writes.length === 1) {
          organization.version = 5;
          return fail("VERSION_CONFLICT");
        }
        payloads.set(r.operation_key, payload);
        effects++;
        organization.version++;
        organization.state = op === "organization_close_apply_v1" ? "closed" : "deletion_pending";
        organization.access_mode = "closed";
        if (op === "organization_close_apply_v1" && options.ackUnreadClose) orgReadFailure = true;
        if (op === "organization_delete_apply_v1" && options.ackUnreadDelete) jobReadFailure = true;
        if (
          (op === "organization_close_apply_v1" && options.unknownClose) ||
          (op === "organization_delete_apply_v1" && options.unknownDelete)
        )
          return route.abort("failed");
      }
      return op === "organization_close_apply_v1"
        ? send({ ...nativeMutation(I.org), version: organization.version, replayed: !!old })
        : send({ job_id: job.id, state: "pending" });
    }
    if (op === "job_status_get_v1" && r.job_id === job.id) {
      if (jobReadFailure) {
        jobReadFailure = false;
        return fail("TEMPORARY_FAILURE", true);
      }
      return send(job);
    }
    if (
      op === "operation_status_get_v1" &&
      ["organization_close_apply_v1", "organization_delete_apply_v1"].includes(r.operation)
    )
      return send({
        operation: r.operation,
        key: r.key,
        status: "succeeded",
        result_available: true,
        result_reference:
          r.operation === "organization_close_apply_v1"
            ? { type: "organizations", id: I.org }
            : { type: "privacy_requests", id: uid(311) },
      });
    return route.fallback();
  });
  await page.reload();
  await page
    .getByRole("combobox", { name: "Ayar kapsamı", exact: true })
    .selectOption("organization");
  await page.getByRole("tab", { name: "Plan", exact: true }).click();
  return { settings, writes, requests, organization, job, effects: () => effects };
}
