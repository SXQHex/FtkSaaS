import { createHash, createHmac } from "node:crypto";
import { isIP } from "node:net";
import { v7, validate } from "uuid";
import { parsePublicCalendar } from "./public-calendar";
import { publicConfig } from "./config";
function isAnonKey(key: string) {
  try {
    return (
      key.split(".").length === 3 &&
      JSON.parse(Buffer.from(key.split(".")[1]!, "base64url").toString("utf8")).role === "anon"
    );
  } catch {
    return false;
  }
}
const path = "/functions/v1/backend-v1/";
const failure = (code: string, status: number) =>
  Response.json(
    { ok: false, error: { code, retryable: code === "TEMPORARY_FAILURE", trace_id: v7() } },
    { status, headers: { "cache-control": "no-store" } },
  );
export async function boundedText(body: ReadableStream<Uint8Array> | null, maxBytes = 65536) {
  if (!body) throw Error("VALIDATION_FAILED");
  const reader = body.getReader(),
    chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const r = await reader.read();
    if (r.done) break;
    length += r.value.byteLength;
    if (length > maxBytes) {
      await reader.cancel();
      throw Error("VALIDATION_FAILED");
    }
    chunks.push(r.value);
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
}
export async function publicTransport(
  request: Request,
  operation: "public_calendar_get_v1" | "public_application_submit_v1",
  env = process.env,
  fetcher = fetch,
) {
  if (
    request.method !== "POST" ||
    !/^application\/json(?:;|$)/i.test(request.headers.get("content-type") ?? "")
  )
    return failure("VALIDATION_FAILED", 400);
  const config = publicConfig(),
    origin = env.FTK_PUBLIC_BACKEND_ORIGIN ?? config?.url,
    key = env.FTK_PUBLIC_ANON_KEY;
  if (!origin || !key || !isAnonKey(key)) return failure("SERVICE_UNAVAILABLE", 503);
  let backend: URL;
  try {
    backend = new URL(origin);
    if (backend.protocol !== "https:" || backend.origin !== origin) throw Error();
  } catch {
    return failure("SERVICE_UNAVAILABLE", 503);
  }
  let input: Record<string, unknown>;
  try {
    input = JSON.parse(await boundedText(request.body));
    if (!input || Array.isArray(input) || typeof input !== "object") throw Error();
  } catch {
    return failure("VALIDATION_FAILED", 400);
  }
  let payload: Record<string, unknown>;
  if (operation === "public_calendar_get_v1") {
    const interval = input.interval as { starts_at?: unknown; ends_at?: unknown } | undefined;
    if (
      Object.keys(input).some((k) => !["slug", "interval", "cursor", "center_id"].includes(k)) ||
      (input.center_id !== undefined &&
        (typeof input.center_id !== "string" || !validate(input.center_id))) ||
      typeof input.slug !== "string" ||
      !input.slug.trim() ||
      input.slug.length > 1000 ||
      !interval ||
      typeof interval.starts_at !== "string" ||
      typeof interval.ends_at !== "string" ||
      !Number.isFinite(Date.parse(interval.starts_at)) ||
      !Number.isFinite(Date.parse(interval.ends_at)) ||
      Date.parse(interval.starts_at) >= Date.parse(interval.ends_at) ||
      (input.cursor !== undefined && typeof input.cursor !== "string")
    )
      return failure("VALIDATION_FAILED", 400);
    payload = {
      client_api_version: 1,
      request_id: v7(),
      slug: input.slug,
      ...(input.center_id ? { center_id: input.center_id } : {}),
      interval: { starts_at: interval.starts_at, ends_at: interval.ends_at },
      page: { limit: 25, sort: "starts_at_asc", ...(input.cursor ? { cursor: input.cursor } : {}) },
    };
  } else {
    if (
      Object.keys(input).some(
        (k) => !["publication_id", "contact", "bot_proof", "client_request_key"].includes(k),
      ) ||
      typeof input.publication_id !== "string" ||
      !validate(input.publication_id) ||
      typeof input.client_request_key !== "string" ||
      !validate(input.client_request_key) ||
      typeof input.contact !== "string" ||
      !input.contact.trim() ||
      input.contact.length > 320 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.contact) ||
      typeof input.bot_proof !== "string" ||
      !input.bot_proof ||
      input.bot_proof.length > 10000
    )
      return failure("VALIDATION_FAILED", 400);
    payload = {
      client_api_version: 1,
      request_id: v7(),
      publication_id: input.publication_id,
      contact: input.contact.trim(),
      bot_proof: input.bot_proof,
      client_request_key: input.client_request_key,
    };
  }
  const body = JSON.stringify(payload),
    headers: Record<string, string> = {
      authorization: `Bearer ${key}`,
      apikey: key,
      "content-type": "application/json",
    };
  if (operation === "public_application_submit_v1") {
    const url = new URL(request.url),
      host = env.FTK_PUBLIC_APPLICATION_HOSTNAME,
      secret = env.FTK_PUBLIC_INGRESS_SECRET,
      ip = request.headers.get("x-vercel-forwarded-for");
    if (env.VERCEL !== "1" || !host || !secret || Buffer.byteLength(secret, "utf8") < 32)
      return failure("SERVICE_UNAVAILABLE", 503);
    if (
      url.protocol !== "https:" ||
      url.hostname !== host ||
      request.headers.get("origin") !== `https://${host}` ||
      !ip ||
      !isIP(ip)
    )
      return failure("FORBIDDEN", 403);
    const normalizedIp = isIP(ip) === 6 ? new URL(`http://[${ip}]/`).hostname.slice(1, -1) : ip;
    const time = Math.floor(Date.now() / 1000).toString(),
      hash = createHash("sha256").update(body).digest("hex");
    headers["x-ftk-client-ip"] = normalizedIp;
    headers["x-ftk-ingress-time"] = time;
    headers["x-ftk-ingress-signature"] = createHmac("sha256", secret)
      .update(["POST", path + operation, time, normalizedIp, hash].join("\n"))
      .digest("hex");
  }
  try {
    const response = await fetcher(backend.origin + path + operation, {
      method: "POST",
      headers,
      body,
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    const result = JSON.parse(await boundedText(response.body, 4194304));
    if (
      result.ok === false &&
      typeof result.error?.code === "string" &&
      /^[A-Z_]+$/.test(result.error.code) &&
      typeof result.error.retryable === "boolean" &&
      validate(result.error.trace_id)
    )
      return Response.json(
        {
          ok: false,
          error: {
            code: result.error.code,
            retryable: result.error.retryable,
            trace_id: result.error.trace_id,
          },
        },
        { status: response.status, headers: { "cache-control": "no-store" } },
      );
    if (response.status !== 200 || result.ok !== true || !validate(result.trace_id)) throw Error();
    if (operation === "public_application_submit_v1") {
      if (result.data?.accepted !== true) throw Error();
      return Response.json(
        { ok: true, data: { accepted: true }, trace_id: result.trace_id },
        { headers: { "cache-control": "no-store" } },
      );
    }
    if (!Array.isArray(result.data?.items) || !Number.isFinite(Date.parse(result.data.as_of)))
      throw Error();
    return Response.json(
      { ok: true, data: parsePublicCalendar(result.data), trace_id: result.trace_id },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return failure("TEMPORARY_FAILURE", 503);
  }
}
