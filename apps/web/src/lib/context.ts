import type { CenterView, OrganizationView, UserSettingsValues } from "@ftksaas/api-contracts";
export type WorkContext = {
  org_id: string;
  center_id: string | null;
  discipline_id: string | null;
};
export const contextStorageKey = (accountId: string) => `ftksaas:context:v1:${accountId}`;
export function readRememberedContext(value: string | null): WorkContext | null {
  try {
    const parsed: unknown = JSON.parse(value ?? "null");
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("org_id" in parsed) ||
      !("center_id" in parsed) ||
      !("discipline_id" in parsed)
    )
      return null;
    if (
      typeof parsed.org_id !== "string" ||
      !(parsed.center_id === null || typeof parsed.center_id === "string") ||
      !(parsed.discipline_id === null || typeof parsed.discipline_id === "string")
    )
      return null;
    return {
      org_id: parsed.org_id,
      center_id: parsed.center_id,
      discipline_id: parsed.discipline_id,
    };
  } catch {
    return null;
  }
}
export function preferredContext(
  settings: UserSettingsValues,
  remembered: WorkContext | null,
  organizations: OrganizationView[],
) {
  const candidate = settings.remember_context ? remembered : settings.startup_context;
  if (
    !candidate ||
    !organizations.some((org) => org.id === candidate.org_id && org.access_mode !== "closed")
  )
    return null;
  return candidate;
}
export function accessibleCenters(centers: CenterView[]) {
  return centers.filter((center) => center.accessible && center.state === "active");
}
