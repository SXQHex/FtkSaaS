import { describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "./server";

// Reserved .invalid domain: never a real API or Supabase project.
const endpoint = "https://toolchain.invalid/health";

describe("MSW HTTP interception", () => {
  it("returns a successful JSON response", async () => {
    server.use(http.get(endpoint, () => HttpResponse.json({ status: "ready" })));
    const response = await fetch(endpoint);
    expect(response.status).toBe(200);
    expect(response.ok).toBe(true);
    expect(await response.json()).toEqual({ status: "ready" });
  });

  it("preserves HTTP error status and body", async () => {
    server.use(
      http.get(endpoint, () => HttpResponse.json({ error: "unavailable" }, { status: 503 })),
    );
    const response = await fetch(endpoint);
    expect(response.ok).toBe(false);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "unavailable" });
  });

  it.each(["/unhandled", "/asset.svg"])(
    "blocks unhandled %s instead of bypassing interception",
    async (path) => {
      const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
      await expect(fetch(`https://toolchain.invalid${path}`)).rejects.toMatchObject({
        cause: { type: "error" },
      });
      expect(error).toHaveBeenCalled();
    },
  );
});

// Sequential cases deliberately share a URL: afterEach in setup must remove the first handler.
// The second case would receive the first response if resetHandlers were removed.
describe("MSW handler isolation between tests", { concurrent: false }, () => {
  const isolatedEndpoint = "https://toolchain.invalid/isolated";
  it("adds a test-local handler", async () => {
    server.use(http.get(isolatedEndpoint, () => HttpResponse.json({ scope: "first test" })));
    expect(await (await fetch(isolatedEndpoint)).json()).toEqual({ scope: "first test" });
  });

  it("cannot reuse a handler from the previous test", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(fetch(isolatedEndpoint)).rejects.toMatchObject({
      cause: { type: "error" },
    });
    expect(error).toHaveBeenCalled();
  });
});
