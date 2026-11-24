import { readPublicGatewayUrl } from "./public-config";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import type { RequestAccountSignupCheck } from "@ftksaas/api-contracts";
import { readEnvelope } from "./backend";

const signupCheckResult = z.object({ status: z.enum(["account_exists", "available"]) });

export async function checkSignup(email: string) {
  const baseUrl = readPublicGatewayUrl();
  if (!baseUrl) throw new Error("Public gateway yapılandırması eksik.");
  const request: RequestAccountSignupCheck = { client_api_version: 1, request_id: uuidv7(), email };
  const response = await fetch(`${baseUrl}/api/auth/signup-check`, {
    method: "POST",
    credentials: "omit",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
  const result = signupCheckResult.safeParse(await readEnvelope(response));
  if (!result.success) throw new Error("SIGNUP_CHECK_INVALID");
  return result.data;
}
