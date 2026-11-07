import { expect, test, vi } from "vitest";
import { createHash, createHmac } from "node:crypto";
import { v7 } from "uuid";
import { publicTransport } from "../src/lib/public-transport";
vi.mock("../src/lib/config", () => ({ publicConfig: () => null }));
const env = {
  NODE_ENV: "test",
  VERCEL: "1",
  FTK_PUBLIC_BACKEND_ORIGIN: "https://backend.example.invalid",
  FTK_PUBLIC_ANON_KEY: `synthetic.${Buffer.from(JSON.stringify({ role: "anon" })).toString("base64url")}.signature`,
  FTK_PUBLIC_APPLICATION_HOSTNAME: "studio.example.invalid",
  FTK_PUBLIC_INGRESS_SECRET: "synthetic-ingress-key".repeat(3),
} as NodeJS.ProcessEnv;
const input = {
  publication_id: v7(),
  client_request_key: v7(),
  contact: "acceptance@example.invalid",
  bot_proof: "synthetic-bot-proof",
};
const req = (body: unknown = input, headers: Record<string, string | undefined> = {}) =>
  new Request("https://studio.example.invalid/api/public/application", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://studio.example.invalid",
      "x-vercel-forwarded-for": "192.0.2.10",
      ...Object.fromEntries(
        Object.entries(headers).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      ),
    },
    body: JSON.stringify(body),
  });
test("public transport signs exact outgoing bytes using trusted IP and never forwards caller authorization", async () => {
  const fetcher = vi.fn<typeof fetch>(async () =>
    Response.json({ ok: true, data: { accepted: true }, trace_id: v7() }),
  );
  const response = await publicTransport(
    req(input, { authorization: "Bearer caller-synthetic", "x-ftk-client-ip": "203.0.113.1" }),
    "public_application_submit_v1",
    env,
    fetcher,
  );
  expect(response.status).toBe(200);
  expect((await response.json()).data).toEqual({ accepted: true });
  const [url, options] = fetcher.mock.calls[0]!,
    headers = options!.headers as Record<string, string>,
    body = options!.body as string;
  expect(url).toBe(
    "https://backend.example.invalid/functions/v1/backend-v1/public_application_submit_v1",
  );
  expect(headers.authorization).toBe(`Bearer ${env.FTK_PUBLIC_ANON_KEY}`);
  expect(headers["x-ftk-client-ip"]).toBe("192.0.2.10");
  expect(headers["x-ftk-ingress-signature"]).toBe(
    createHmac("sha256", env.FTK_PUBLIC_INGRESS_SECRET!)
      .update(
        [
          "POST",
          "/functions/v1/backend-v1/public_application_submit_v1",
          headers["x-ftk-ingress-time"],
          "192.0.2.10",
          createHash("sha256").update(body).digest("hex"),
        ].join("\n"),
      )
      .digest("hex"),
  );
  expect(options!.redirect).toBe("error");
  expect(JSON.parse(body).client_request_key).toBe(input.client_request_key);
});
test.each([
  { origin: "https://foreign.example.invalid" },
  { "x-vercel-forwarded-for": "192.0.2.10, 203.0.113.1" },
])("untrusted origin or IP chain cannot reach the backend", async (headers) => {
  const fetcher = vi.fn<typeof fetch>();
  expect(
    (await publicTransport(req(input, headers), "public_application_submit_v1", env, fetcher))
      .status,
  ).toBe(403);
  expect(fetcher).not.toHaveBeenCalled();
});
test("public submit is unavailable outside the trusted host environment", async () => {
  const fetcher = vi.fn<typeof fetch>();
  expect(
    (
      await publicTransport(
        req(),
        "public_application_submit_v1",
        { ...env, VERCEL: undefined },
        fetcher,
      )
    ).status,
  ).toBe(503);
  expect(fetcher).not.toHaveBeenCalled();
});
test.each([
  { ...input, org_id: v7() },
  { ...input, contact: "x".repeat(66000) },
])("client tenant injection and oversized bodies are rejected", async (body) => {
  const fetcher = vi.fn<typeof fetch>();
  expect(
    (await publicTransport(req(body), "public_application_submit_v1", env, fetcher)).status,
  ).toBe(400);
  expect(fetcher).not.toHaveBeenCalled();
});
test("unexpected success envelope is a retryable transport error rather than a false acceptance", async () => {
  const fetcher = vi.fn<typeof fetch>(async () =>
    Response.json({ ok: true, data: { saved: true }, trace_id: v7() }),
  );
  const r = await publicTransport(req(), "public_application_submit_v1", env, fetcher);
  expect(r.status).toBe(503);
  expect((await r.json()).error.code).toBe("TEMPORARY_FAILURE");
});
test("public role validation rejects a configured service key before any network request", async () => {
  const fetcher = vi.fn<typeof fetch>(),
    key = `synthetic.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.signature`;
  const r = await publicTransport(
    req(),
    "public_application_submit_v1",
    { ...env, FTK_PUBLIC_ANON_KEY: key },
    fetcher,
  );
  expect(r.status).toBe(503);
  expect(fetcher).not.toHaveBeenCalled();
});
test("IPv6 uses the same canonical address in the signed header and message", async () => {
  const fetcher = vi.fn<typeof fetch>(async () =>
    Response.json({ ok: true, data: { accepted: true }, trace_id: v7() }),
  );
  await publicTransport(
    req(input, { "x-vercel-forwarded-for": "2001:0db8:0:0:0:0:0:1" }),
    "public_application_submit_v1",
    env,
    fetcher,
  );
  const headers = fetcher.mock.calls[0]![1]!.headers as Record<string, string>;
  expect(headers["x-ftk-client-ip"]).toBe("2001:db8::1");
});
test("valid public profile logos above 64 KiB survive the response bound and are projected", async () => {
  const bytes = Buffer.alloc(70000, 1),
    logo = {
      asset: {
        id: v7(),
        mime: "image/png",
        bytes: bytes.length,
        checksum: createHash("sha256").update(bytes).digest("hex"),
      },
      data_base64: bytes.toString("base64"),
    };
  const page = {
    items: [
      {
        publication_id: v7(),
        title: "Practice",
        interval: { starts_at: "2026-11-08T12:00:00Z", ends_at: "2026-11-08T13:00:00Z" },
        venue_public_label: "Studio",
        fee_minor: "0",
        currency: "TRY",
        public_conditions: "Contact studio",
        discipline_ids: [],
      },
    ],
    as_of: "2026-11-07T00:00:00Z",
    organization_profile: { name: "Studio", logo },
  };
  const fetcher = vi.fn<typeof fetch>(async () =>
    Response.json({ ok: true, data: page, trace_id: v7() }),
  );
  const request = new Request("https://studio.example.invalid/api/public/calendar", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      slug: "studio",
      interval: { starts_at: "2026-11-08T00:00:00Z", ends_at: "2026-11-09T00:00:00Z" },
    }),
  });
  const r = await publicTransport(request, "public_calendar_get_v1", env, fetcher);
  expect(r.status).toBe(200);
  expect((await r.json()).data).toEqual(page);
});
test("unexpected private fields in an anonymous calendar are never forwarded", async () => {
  const fetcher = vi.fn<typeof fetch>(async () =>
    Response.json({
      ok: true,
      data: { items: [], as_of: "2026-11-07T00:00:00Z", account_email: "private@example.invalid" },
      trace_id: v7(),
    }),
  );
  const request = new Request("https://studio.example.invalid/api/public/calendar", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      slug: "studio",
      interval: { starts_at: "2026-11-08T00:00:00Z", ends_at: "2026-11-09T00:00:00Z" },
    }),
  });
  const r = await publicTransport(request, "public_calendar_get_v1", env, fetcher);
  expect(r.status).toBe(503);
  expect(JSON.stringify(await r.json())).not.toContain("private@example.invalid");
});

test("public calendar forwards only an explicit valid center and rejects malformed centers", async () => {
  const center = v7(),
    interval = { starts_at: "2026-11-07T00:00:00Z", ends_at: "2026-11-14T00:00:00Z" };
  const fetcher = vi.fn<typeof fetch>(async () =>
    Response.json({
      ok: true,
      trace_id: v7(),
      data: { items: [], next_cursor: null, as_of: "2026-11-07T00:00:00Z" },
    }),
  );
  const response = await publicTransport(
    req({ slug: v7(), center_id: center, interval }),
    "public_calendar_get_v1",
    env,
    fetcher,
  );
  expect(response.status).toBe(200);
  expect(JSON.parse(fetcher.mock.calls[0]![1]!.body as string).center_id).toBe(center);
  const bad = await publicTransport(
    req({ slug: v7(), center_id: "private-key", interval }),
    "public_calendar_get_v1",
    env,
    fetcher,
  );
  expect(bad.status).toBe(400);
  expect(fetcher).toHaveBeenCalledOnce();
});
