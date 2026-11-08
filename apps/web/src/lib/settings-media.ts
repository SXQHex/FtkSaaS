import { validate } from "uuid";
export function validSettingsMedia(
  i: Record<string, unknown>,
  center: string | undefined,
  slot: string,
) {
  if (
    slot !== "settings-media:organization" ||
    center ||
    i.center_id !== undefined ||
    i.scope !== "organization" ||
    !Number.isSafeInteger(i.expected_version) ||
    Number(i.expected_version) < 0 ||
    !i.patch ||
    typeof i.patch !== "object" ||
    Object.keys(i.patch).length !== 0 ||
    typeof i.reason !== "string" ||
    !i.reason.trim() ||
    i.reason.length > 1000 ||
    i.inherit_fields !== undefined
  )
    return false;
  if (i.logo_image === null) return true;
  if (!i.logo_image || typeof i.logo_image !== "object" || Array.isArray(i.logo_image))
    return false;
  const image = i.logo_image as Record<string, unknown>;
  return (
    Object.keys(image).length === 3 &&
    ["image/png", "image/jpeg", "image/webp"].includes(String(image.mime)) &&
    typeof image.data_base64 === "string" &&
    image.data_base64.length > 0 &&
    image.data_base64.length <= 1398104 &&
    /^[A-Za-z0-9+/]*={0,2}$/.test(image.data_base64) &&
    typeof image.checksum === "string" &&
    /^[a-f0-9]{64}$/.test(image.checksum)
  );
}
export const mediaAssetId = (v: unknown) =>
  !!v && typeof v === "object" && "id" in v && typeof v.id === "string" && validate(v.id)
    ? v.id
    : null;
