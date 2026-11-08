import { validate } from "uuid";
import { setupCall, type SetupScope, type SetupCommand } from "./studio-setup";
export const jobKey = (scope: SetupScope, slot: string) =>
  `ftksaas:job:v1:${scope.actorId}:${scope.orgId}:${scope.centerId}:${slot}`;
export function reportBinding(input: Record<string, unknown>) {
  const f = input.filters as import("@ftksaas/api-contracts").ReportFilters;
  return JSON.stringify([
    input.report,
    f.interval.starts_at,
    f.interval.ends_at,
    [...f.center_ids].sort(),
    [...(f.person_ids ?? [])].sort(),
    f.currency ?? null,
    f.state ?? null,
    input.columns ?? null,
    input.report_order ?? null,
    input.group_by ?? null,
  ]);
}
export function persistJob(scope: SetupScope, slot: string, id: string, command: SetupCommand) {
  if (!validate(id)) throw Error("invalidJob");
  sessionStorage.setItem(
    jobKey(scope, slot),
    JSON.stringify({
      id,
      ...(command.operation === "report_export_start_v1"
        ? { binding: reportBinding(command.input) }
        : {}),
    }),
  );
}
export function restoreJob(scope: SetupScope, slot: string, binding?: string) {
  const raw = sessionStorage.getItem(jobKey(scope, slot));
  if (!raw) return null;
  const record = JSON.parse(raw);
  if (
    !record ||
    !validate(record.id) ||
    Object.keys(record).some((k) => !["id", "binding"].includes(k))
  )
    throw Error("invalidJob");
  return binding !== undefined && record.binding !== binding ? null : (record.id as string);
}
export function asyncCommand(command: SetupCommand) {
  return ["report_export_start_v1", "import_preview_v1", "import_apply_v1"].includes(
    command.operation,
  );
}
export async function readJob(scope: SetupScope, id: string) {
  const job = await setupCall("job_status_get_v1", {
    org_id: scope.orgId,
    center_id: scope.centerId,
    job_id: id,
  });
  if (job.id !== id) throw Error("invalidJob");
  return job;
}
