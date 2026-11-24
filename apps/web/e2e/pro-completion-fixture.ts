import { expect, type Page, type Route } from "@playwright/test";
import { mockStudio, studioIds as I } from "./studio-fixture.js";
import { origin } from "./auth-fixture.js";
import type { Operations } from "@ftksaas/api-contracts";
import * as validators from "@ftksaas/api-contracts/validators";
export const at = "2026-11-17T12:00:00Z";
export const uid = (n: number) => `019ab7b0-0000-7000-8000-${String(n).padStart(12, "0")}`;
export type NativeRequest = Record<string, unknown>;
interface CompletionActions {
  route: Route;
  send: (data: unknown) => Promise<void>;
  fail: (code: string) => Promise<void>;
  abort: () => Promise<void>;
}

// A mixed log exposes these inspection fields as unknown. Narrowing the
// operation recovers its published request type.
type RequestInspectionFields = {
  patch?: unknown;
  report?: unknown;
  kept_scope?: unknown;
};

export type RecordedRequest = {
  [Operation in keyof Operations]: {
    op: Operation;
    r: Operations[Operation]["request"] & RequestInspectionFields;
  };
}[keyof Operations];

const wireValidators: Partial<Record<string, (value: unknown) => boolean>> = validators;

function isRecordedRequest(value: { op: string; r: unknown }): value is RecordedRequest {
  const key = `request_${value.op}`;
  return Object.hasOwn(wireValidators, key) && wireValidators[key]?.(value.r) === true;
}

export function parseCompletionRequest(op: string, body: unknown): RecordedRequest {
  const request = { op, r: body };
  if (!isRecordedRequest(request)) throw new Error(`Invalid native fixture request: ${op}`);
  return request;
}

export function requestsFor<Operation extends keyof Operations>(
  rows: readonly RecordedRequest[],
  operation: Operation,
): Extract<RecordedRequest, { op: Operation }>[] {
  return rows.filter(
    (row): row is Extract<RecordedRequest, { op: Operation }> => row.op === operation,
  );
}

export type CompletionRequest = {
  [Operation in keyof Operations]: CompletionActions & {
    op: Operation;
    r: Operations[Operation]["request"];
  };
}[keyof Operations];
export async function mockCompletion(
  page: Page,
  handler: (request: CompletionRequest) => Promise<void>,
) {
  const studio = await mockStudio(page);
  const requests: RecordedRequest[] = [];
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const incoming = route.request();
    const op = new URL(incoming.url()).pathname.split("/").at(-1) ?? "";
    let body: unknown;
    try {
      body = incoming.postDataJSON();
    } catch {
      throw new Error(`Invalid JSON in native fixture request: ${op}`);
    }
    const request = parseCompletionRequest(op, body);
    requests.push(request);
    let handled = false;
    const send = async (data: unknown) => {
      handled = true;
      await route.fulfill({ json: { ok: true, data, trace_id: uid(990) } });
    };
    const fail = async (code: string) => {
      handled = true;
      await route.fulfill({
        status: 403,
        json: { ok: false, error: { code, retryable: false, trace_id: uid(990) } },
      });
    };
    const abort = async () => {
      handled = true;
      await route.abort("failed");
    };
    await handler({ ...request, route, send, fail, abort });
    if (!handled) await route.fallback();
  });
  await page.goto(`${origin}/login`);
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("Fixture123");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/account`);
  await expect(page.getByRole("heading", { name: "Hesabım", exact: true })).toBeVisible();
  return { studio, requests };
}
export const completionUrl = (name: "documents" | "reports" | "audit" | "settings") =>
  `${origin}/o/${I.org}/c/${I.center}/${name}`;
export const nativePage = (items: unknown[], next_cursor: string | null = null) => ({
  items,
  next_cursor,
  as_of: at,
});
export const nativeMutation = (primary_id: string) => ({
  primary_id,
  operation_id: uid(991),
  version: 2,
  replayed: false,
  related: [],
});
export function metadata(
  operation: string,
  type: string,
  id: string,
  values: unknown,
  version = 2,
  state = "active",
) {
  return {
    operation,
    entity: { type, id },
    exists: true,
    state,
    versions: [{ entity: { type, id }, version }],
    current: { operation, values },
    as_of: at,
  };
}
