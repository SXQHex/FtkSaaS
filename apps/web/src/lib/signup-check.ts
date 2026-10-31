import { v7 } from "uuid";
import type { FailureEnvelope, Operations } from "@ftksaas/api-contracts";

type Check = Operations["account_signup_check_v1"];
export async function checkSignup(email: string) {
  const input: Check["request"] = { client_api_version: 1, request_id: v7(), email };
  const response = await fetch("/api/auth/signup-check", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
  let result: Check["response"] | FailureEnvelope;
  try {
    result = await response.json();
  } catch {
    throw new Error("signupCheckUnavailable");
  }
  if (result && result.ok === false && result.error?.code) return result;
  if (
    !response.ok ||
    !result ||
    result.ok !== true ||
    !["account_exists", "available"].includes(result.data?.status)
  )
    throw new Error("signupCheckUnavailable");
  return result;
}
