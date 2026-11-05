export function sessionPath(orgId: string, sessionId: string, centerId?: string) {
  return `/organizasyon/${encodeURIComponent(orgId)}/seans/${encodeURIComponent(sessionId)}${centerId ? `?center=${encodeURIComponent(centerId)}` : ""}`;
}
