import { validate } from "uuid";
import { validateImportMapping, validReportFilters, reportKinds } from "./report-input";
export const reportWrites = [
  "report_export_start_v1",
  "import_preview_v1",
  "import_apply_v1",
] as const;
export const reportFields = {
  report_export_start_v1: ["report", "filters", "format", "columns", "report_order", "group_by"],
  import_preview_v1: ["file_id", "mapping", "source_namespace"],
  import_apply_v1: ["preview", "selected_row_numbers"],
};
export function validReportCommand(
  operation: string,
  input: Record<string, unknown>,
  center: string | undefined,
  slot: string,
) {
  if (!center || input.center_id !== center) return false;
  if (operation === "report_export_start_v1")
    return (
      slot === `report-export:${center}` &&
      reportKinds.some((k) => k === input.report) &&
      input.format === "csv" &&
      validReportFilters(input.filters, center)
    );
  if (operation === "import_preview_v1") {
    if (
      slot !== `import-preview:${center}` ||
      typeof input.file_id !== "string" ||
      !validate(input.file_id) ||
      typeof input.source_namespace !== "string" ||
      !input.source_namespace.trim()
    )
      return false;
    try {
      validateImportMapping(input.mapping);
      return true;
    } catch {
      return false;
    }
  }
  if (operation !== "import_apply_v1" || slot !== `import-apply:${center}`) return false;
  const p = input.preview as Record<string, unknown> | null;
  return (
    !!p &&
    Object.keys(p).length === 2 &&
    typeof p.id === "string" &&
    validate(p.id) &&
    typeof p.token === "string" &&
    !!p.token &&
    input.selected_row_numbers === undefined
  );
}
