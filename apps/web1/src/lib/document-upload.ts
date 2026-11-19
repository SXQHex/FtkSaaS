export async function sha256Hex(bytes: Uint8Array<ArrayBuffer>) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (value) => value.toString(16).padStart(2, "0")).join("");
}

export function scopedUploadUrl(
  base: string,
  capability: string,
  bucket: "ftksaas-documents" | "ftksaas-invoices",
  orgId: string,
  resourceId: string,
) {
  const origin = new URL(base);
  const url = new URL(capability, origin);
  const path = `/storage/v1/object/upload/sign/${bucket}/${orgId}/${resourceId}`;
  if (
    url.origin !== origin.origin ||
    url.pathname !== path ||
    url.username ||
    url.password ||
    url.hash ||
    !url.searchParams.get("token")
  )
    return undefined;
  return url;
}
