export type ReportAction = "import" | "export";

export function validateReportSearch(search: Record<string, unknown>): { action?: ReportAction } {
  return {
    action: search.action === "import" || search.action === "export" ? search.action : undefined,
  };
}
