import { createHash } from "node:crypto";
import { validate } from "uuid";
import type { Page_PublicCalendarItem, PublicBusinessProfile } from "@ftksaas/api-contracts";
const object = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);
const only = (x: Record<string, unknown>, keys: string[]) =>
  Object.keys(x).every((k) => keys.includes(k));
const text = (x: unknown) => typeof x === "string" && x.length <= 10000;
const instant = (x: unknown) => typeof x === "string" && Number.isFinite(Date.parse(x));
function reject(): never {
  throw Error("INTEGRITY_VIOLATION");
}
function profile(value: unknown): PublicBusinessProfile | null | undefined {
  if (value === undefined || value === null) return value;
  if (
    !object(value) ||
    !only(value, ["name", "description", "address", "contact", "hours", "timezone", "logo"])
  )
    return reject();
  for (const k of ["name", "description", "address", "timezone"])
    if (value[k] !== undefined && !text(value[k])) return reject();
  if (value.contact !== undefined) {
    const c = value.contact;
    if (
      !object(c) ||
      !only(c, ["phone", "email"]) ||
      !text(c.phone) ||
      !(c.email === null || text(c.email))
    )
      return reject();
  }
  if (value.hours !== undefined) {
    if (!Array.isArray(value.hours) || value.hours.length > 100) return reject();
    for (const h of value.hours) {
      if (
        !object(h) ||
        !only(h, ["weekdays", "local_start", "local_end", "timezone"]) ||
        !Array.isArray(h.weekdays) ||
        !h.weekdays.length ||
        h.weekdays.length > 7 ||
        new Set(h.weekdays).size !== h.weekdays.length ||
        h.weekdays.some((d) => !Number.isInteger(d) || Number(d) < 1 || Number(d) > 7) ||
        !["local_start", "local_end"].every(
          (k) =>
            typeof h[k] === "string" && /^([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/.test(h[k]),
        ) ||
        !text(h.timezone)
      )
        return reject();
    }
  }
  if (value.logo !== undefined && value.logo !== null) {
    const l = value.logo;
    if (
      !object(l) ||
      !only(l, ["asset", "data_base64"]) ||
      !object(l.asset) ||
      !only(l.asset, ["id", "mime", "bytes", "checksum"]) ||
      typeof l.asset.id !== "string" ||
      !validate(l.asset.id) ||
      !["image/png", "image/jpeg", "image/webp"].includes(String(l.asset.mime)) ||
      !Number.isSafeInteger(l.asset.bytes) ||
      Number(l.asset.bytes) < 1 ||
      Number(l.asset.bytes) > 1048576 ||
      typeof l.asset.checksum !== "string" ||
      !/^[a-f0-9]{64}$/.test(l.asset.checksum) ||
      typeof l.data_base64 !== "string" ||
      l.data_base64.length > 1398104
    )
      return reject();
    const bytes = Buffer.from(l.data_base64, "base64");
    if (
      bytes.length !== l.asset.bytes ||
      bytes.toString("base64") !== l.data_base64 ||
      createHash("sha256").update(bytes).digest("hex") !== l.asset.checksum
    )
      return reject();
  }
  return value as PublicBusinessProfile;
}
export function parsePublicCalendar(value: unknown): Page_PublicCalendarItem {
  if (
    !object(value) ||
    !only(value, ["items", "next_cursor", "as_of", "organization_profile", "center_profile"]) ||
    !instant(value.as_of) ||
    !Array.isArray(value.items) ||
    value.items.length > 25 ||
    (value.next_cursor !== undefined &&
      value.next_cursor !== null &&
      typeof value.next_cursor !== "string")
  )
    return reject();
  const ids = new Set();
  for (const r of value.items) {
    if (
      !object(r) ||
      !only(r, [
        "publication_id",
        "title",
        "interval",
        "venue_public_label",
        "fee_minor",
        "currency",
        "public_conditions",
        "discipline_ids",
      ]) ||
      typeof r.publication_id !== "string" ||
      !validate(r.publication_id) ||
      ids.has(r.publication_id) ||
      !["title", "venue_public_label", "public_conditions"].every((k) => text(r[k])) ||
      !object(r.interval) ||
      !only(r.interval, ["starts_at", "ends_at"]) ||
      !instant(r.interval.starts_at) ||
      !instant(r.interval.ends_at) ||
      Date.parse(String(r.interval.starts_at)) >= Date.parse(String(r.interval.ends_at)) ||
      typeof r.fee_minor !== "string" ||
      !/^(0|[1-9][0-9]{0,18})$/.test(r.fee_minor) ||
      BigInt(r.fee_minor) > 9223372036854775807n ||
      typeof r.currency !== "string" ||
      !/^[A-Z]{3}$/.test(r.currency) ||
      !Array.isArray(r.discipline_ids) ||
      r.discipline_ids.some((d) => typeof d !== "string" || !validate(d)) ||
      new Set(r.discipline_ids).size !== r.discipline_ids.length
    )
      return reject();
    ids.add(r.publication_id);
  }
  const organization = profile(value.organization_profile),
    center = profile(value.center_profile);
  return {
    items: value.items as Page_PublicCalendarItem["items"],
    as_of: value.as_of as string,
    ...(value.next_cursor !== undefined ? { next_cursor: value.next_cursor as string | null } : {}),
    ...(organization !== undefined ? { organization_profile: organization } : {}),
    ...(center !== undefined ? { center_profile: center } : {}),
  };
}
