import { expect, it } from "vitest";
import { parseCompletionRequest, requestsFor, uid } from "../e2e/pro-completion-fixture.js";

const accountRequest = { client_api_version: 1, request_id: uid(1), include_platform_scope: true };

it("records the operation with its contract-validated payload", () => {
  const account = parseCompletionRequest("account_get_v1", accountRequest);
  expect(requestsFor([account], "account_get_v1")[0]?.r).toBe(accountRequest);
});

it("rejects malformed authentication, finance and selector requests", () => {
  expect(() =>
    parseCompletionRequest("account_get_v1", { ...accountRequest, include_platform_scope: "true" }),
  ).toThrow("Invalid native fixture request: account_get_v1");
  expect(() => parseCompletionRequest("operation_status_get_v1", accountRequest)).toThrow(
    "Invalid native fixture request: operation_status_get_v1",
  );
  expect(() => parseCompletionRequest("management_state_get_v1", null)).toThrow(
    "Invalid native fixture request: management_state_get_v1",
  );
  expect(() => parseCompletionRequest("unknown_v1", accountRequest)).toThrow(
    "Invalid native fixture request: unknown_v1",
  );
});
