import { v7 as uuidv7 } from "uuid";
import type { SettingsImageUpload, SettingsMediaAsset } from "../../lib/api-contracts/generated";
import { getBackend } from "../../lib/backend";

export type PhotoDraft = { upload: SettingsImageUpload; file: File } | null | undefined;
const maxBytes = 1048576;
async function checksum(bytes: Uint8Array<ArrayBuffer>) {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function decode(base64: string) {
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}
export async function preparePhoto(file: File): Promise<SettingsImageUpload> {
  const mime = file.type;
  if (mime !== "image/png" && mime !== "image/jpeg" && mime !== "image/webp")
    throw new Error("PHOTO_TYPE");
  if (!file.size || file.size > maxBytes) throw new Error("PHOTO_SIZE");
  try {
    const bitmap = await createImageBitmap(file);
    bitmap.close();
  } catch {
    throw new Error("PHOTO_DECODE");
  }
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("PHOTO_READ"));
    reader.onload = () => {
      if (typeof reader.result !== "string") return reject(new Error("PHOTO_READ"));
      resolve(reader.result.slice(reader.result.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });
  return { mime, data_base64: data, checksum: await checksum(decode(data)) };
}
export async function readPhoto(expected: SettingsMediaAsset) {
  const { asset, data_base64 } = await getBackend().call("media_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    scope: "user",
    asset_id: expected.id,
  });
  const bytes = decode(data_base64);
  if (
    asset.id !== expected.id ||
    asset.mime !== expected.mime ||
    asset.bytes !== expected.bytes ||
    asset.checksum !== expected.checksum ||
    bytes.length !== asset.bytes ||
    bytes.length > maxBytes ||
    (await checksum(bytes)) !== asset.checksum
  )
    throw new Error("PHOTO_READ");
  return new Blob([bytes], { type: asset.mime });
}
