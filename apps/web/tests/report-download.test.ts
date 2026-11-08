import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { v7 } from "uuid";
import { downloadReport } from "../src/lib/reports";
const m = vi.hoisted(() => ({
  call: vi.fn<() => Promise<unknown>>(),
  fetch: vi.fn<(url: URL, init: RequestInit) => Promise<Response>>(),
}));
vi.mock("../src/lib/studio-setup", async (load) => ({
  ...(await load<typeof import("../src/lib/studio-setup")>()),
  setupCall: m.call,
}));
vi.mock("../src/lib/supabase/client", () => ({
  browserClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: { access_token: "synthetic" } }, error: null }),
    },
  }),
}));
beforeEach(() => {
  m.call.mockReset();
  m.fetch.mockReset();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "synthetic");
  vi.stubGlobal("fetch", m.fetch);
});
afterEach(() => vi.unstubAllGlobals());
const scope = { actorId: v7(), orgId: v7(), centerId: v7() };
test("the authenticated CSV uses the confirmed file, job and actor session without exposing a public link", async () => {
  const job = v7(),
    file = v7();
  m.call.mockResolvedValue({
    file_id: file,
    download_path: "/functions/v1/backend-v1/report_file_get_v1?download=csv",
    expires_at: "2099-01-01T00:00:00Z",
  });
  m.fetch.mockResolvedValue(
    new Response("subscriber_number\r\n1001\r\n", {
      headers: { "content-type": "text/csv; charset=utf-8", "cache-control": "no-store" },
    }),
  );
  const blob = await downloadReport(scope, job, file);
  expect(await blob.text()).toContain("1001");
  const [url, init] = m.fetch.mock.calls[0]!;
  expect(url.origin).toBe("https://project.invalid");
  expect(init.redirect).toBe("error");
  expect(init.cache).toBe("no-store");
  expect(JSON.parse(String(init.body))).toMatchObject({
    org_id: scope.orgId,
    center_id: scope.centerId,
    job_id: job,
  });
  expect(init.headers).toMatchObject({ authorization: "Bearer synthetic" });
});
test("a different returned file never triggers a CSV transfer", async () => {
  m.call.mockResolvedValue({
    file_id: v7(),
    download_path: "/functions/v1/backend-v1/report_file_get_v1?download=csv",
    expires_at: "2099-01-01T00:00:00Z",
  });
  await expect(downloadReport(scope, v7(), v7())).rejects.toThrow("OPERATION_RESULT_EXPIRED");
  expect(m.fetch).not.toHaveBeenCalled();
});
