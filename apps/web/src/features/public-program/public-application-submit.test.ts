import { afterEach, expect, it, vi } from "vitest";
import { preparePublicApplication, submitPublicApplication } from "./public-application-submit";
import type { DiscoveredPublicForm } from "./public-discovery";
const id = "019ab7b0-0000-7000-8000-000000000020";
const form: DiscoveredPublicForm = {
  form_id: id,
  contact_requirement: "either",
  required_fields: ["interest"],
  consents: [
    {
      purpose: "participation",
      version: "v1",
      required: true,
      content_template_id: id,
      source_version: "v1",
      content_hash: "a".repeat(64),
      content: {
        name: "Koşullar",
        language: "tr",
        template_id: "document.test",
        template_version: "1",
        text: "Örnek koşullar",
      },
    },
  ],
};
function values() {
  const v = new FormData();
  for (const [name, value] of Object.entries({
    display_name: " Örnek Aday ",
    email: "candidate@example.test",
    interest: "Tango",
    "consent-0": "on",
  }))
    v.set(name, value);
  return v;
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("constructs the exact configured form branch and explicit source consent without source text or hidden fields", () => {
  const v = values();
  v.set("attribution", "untrusted");
  v.set("publication_id", id);
  const attempt = preparePublicApplication(form, v, id);
  expect(attempt.formId).toBe(id);
  expect(attempt.centerId).toBe(id);
  expect(attempt.key).toMatch(/^[\da-f]{8}-[\da-f]{4}-7/);
  expect(attempt.intake).toEqual({
    display_name: "Örnek Aday",
    email: "candidate@example.test",
    interest: "Tango",
    consents: [
      { purpose: "participation", version: "v1", accepted: true, occurred_at: expect.any(String) },
    ],
  });
});
it("rejects missing contact or the configured contact type, required content and consent", () => {
  const v = values();
  v.delete("email");
  expect(() => preparePublicApplication(form, v)).toThrow("CONTACT_REQUIRED");
  v.set("phone", "+905550000000");
  expect(() => preparePublicApplication({ ...form, contact_requirement: "email" }, v)).toThrow(
    "CONTACT_REQUIRED",
  );
  v.delete("interest");
  expect(() => preparePublicApplication(form, v)).toThrow("REQUIRED_FIELD");
  v.set("interest", "Tango");
  v.delete("consent-0");
  expect(() => preparePublicApplication(form, v)).toThrow("CONSENT_REQUIRED");
});
it("retains optional false consent, requires configured extra fields and omits empty optional contact", () => {
  const v = values();
  v.delete("email");
  v.set("phone", "+905550000000");
  v.set("partner_name", "Partner");
  v.set("mode", "Özel ders");
  v.set("level", "Başlangıç");
  const f = {
    ...form,
    required_fields: ["partner_name", "mode", "level"] as const,
    consents: [...form.consents, { ...form.consents[0]!, purpose: "optional", required: false }],
  };
  const result = preparePublicApplication({ ...f, required_fields: [...f.required_fields] }, v);
  expect(result.intake).toMatchObject({
    phone: "+905550000000",
    partner_name: "Partner",
    mode: "Özel ders",
    level: "Başlangıç",
    consents: [{ accepted: true }, { purpose: "optional", accepted: false }],
  });
  expect(result.intake).not.toHaveProperty("email");
});
it("rejects honeypot, malformed email and native oversized fields before transport", () => {
  const v = values();
  v.set("website", "spam");
  expect(() => preparePublicApplication(form, v)).toThrow("HONEYPOT");
  v.delete("website");
  v.set("email", "invalid");
  expect(() => preparePublicApplication(form, v)).toThrow();
  v.set("email", "candidate@example.test");
  v.set("display_name", "x".repeat(201));
  expect(() => preparePublicApplication(form, v)).toThrow();
});
it("uses anonymous no-store Worker transport and immutable same-key replay with a fresh request ID and bot proof", async () => {
  vi.stubEnv("VITE_PUBLIC_GATEWAY_URL", "https://gateway.example.invalid");
  const fetcher = vi.fn(
    async () => new Response(JSON.stringify({ ok: true, data: { accepted: true }, trace_id: id })),
  );
  vi.stubGlobal("fetch", fetcher);
  const attempt = preparePublicApplication(form, values(), id);
  const original = structuredClone(attempt);
  await submitPublicApplication(attempt, "proof-one");
  await submitPublicApplication(attempt, "proof-two");
  const a = fetcher.mock.calls as unknown as [string, RequestInit][];
  const first = JSON.parse(a[0]![1].body as string),
    second = JSON.parse(a[1]![1].body as string);
  expect(a[0]![0]).toMatch(/\/api\/public\/application$/);
  expect(a[0]![1]).toMatchObject({
    method: "POST",
    credentials: "omit",
    cache: "no-store",
    headers: { "content-type": "application/json" },
  });
  expect(Object.keys(first).sort()).toEqual(
    [
      "client_api_version",
      "request_id",
      "center_id",
      "form_id",
      "contact_intake",
      "client_request_key",
      "bot_proof",
    ].sort(),
  );
  expect(first.form_id).toBe(id);
  expect(first.client_request_key).toBe(second.client_request_key);
  expect(first.contact_intake).toEqual(second.contact_intake);
  expect(first.request_id).not.toBe(second.request_id);
  expect(second.bot_proof).toBe("proof-two");
  expect(attempt).toEqual(original);
});
it("rejects HTTP200 error envelopes and false or malformed accepted results", async () => {
  const attempt = preparePublicApplication(form, values());
  for (const payload of [
    { ok: false, error: { code: "BOT_VERIFICATION_FAILED", retryable: false, trace_id: id } },
    { ok: true, data: { accepted: false }, trace_id: id },
    { ok: true, data: {}, trace_id: id },
  ]) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(payload))),
    );
    await expect(submitPublicApplication(attempt, "proof")).rejects.toThrow();
  }
});
it("never submits without a provider proof", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  await expect(
    submitPublicApplication(preparePublicApplication(form, values()), " "),
  ).rejects.toThrow("PUBLIC_SUBMIT_UNAVAILABLE");
  expect(fetcher).not.toHaveBeenCalled();
});
