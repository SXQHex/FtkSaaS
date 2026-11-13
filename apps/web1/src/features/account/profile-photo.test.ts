import { afterEach, expect, it, vi } from "vitest";
const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("../../lib/backend", () => ({ getBackend: () => ({ call }) }));
import { preparePhoto, readPhoto } from "./profile-photo";
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});
it("rejects unsupported MIME and oversized files before reading or decoding", async () => {
  await expect(preparePhoto(new File(["svg"], "x.svg", { type: "image/svg+xml" }))).rejects.toThrow(
    "PHOTO_TYPE",
  );
  await expect(
    preparePhoto(new File([new Uint8Array(1048577)], "x.png", { type: "image/png" })),
  ).rejects.toThrow("PHOTO_SIZE");
});
it("encodes exact bytes and SHA256 only after a successful browser image decode", async () => {
  const close = vi.fn();
  vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ close }));
  const upload = await preparePhoto(new File(["abc"], "x.png", { type: "image/png" }));
  expect(upload).toEqual({
    mime: "image/png",
    data_base64: "YWJj",
    checksum: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  });
  expect(close).toHaveBeenCalledOnce();
  vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("decode")));
  await expect(preparePhoto(new File(["abc"], "x.png", { type: "image/png" }))).rejects.toThrow(
    "PHOTO_DECODE",
  );
});
it("reads only own current asset and rejects mismatched metadata or content", async () => {
  const asset = {
    id: "fixture-asset",
    mime: "image/png" as const,
    bytes: 3,
    checksum: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  };
  call.mockResolvedValue({ asset, data_base64: "YWJj" });
  const blob = await readPhoto(asset);
  expect(blob.size).toBe(3);
  expect(blob.type).toBe("image/png");
  expect(call).toHaveBeenCalledWith("media_get_v1", {
    client_api_version: 1,
    request_id: expect.any(String),
    scope: "user",
    asset_id: asset.id,
  });
  call.mockResolvedValue({ asset: { ...asset, id: "old-pointer" }, data_base64: "YWJj" });
  await expect(readPhoto(asset)).rejects.toThrow("PHOTO_READ");
  call.mockResolvedValue({ asset, data_base64: "YWJk" });
  await expect(readPhoto(asset)).rejects.toThrow("PHOTO_READ");
});
