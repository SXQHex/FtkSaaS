export function leadPath(orgId: string, centerId: string, personId: string, leadId: string) {
  return `/organizasyon/${encodeURIComponent(orgId)}/merkez/${encodeURIComponent(centerId)}/aday/${encodeURIComponent(personId)}/${encodeURIComponent(leadId)}`;
}
