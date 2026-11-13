import { v7 as uuidv7 } from "uuid";
import type {
  RequestAccountSignupCheck,
  SuccessAccountSignupCheck,
} from "./api-contracts/generated";
import { readEnvelope } from "./backend";

export async function checkSignup(email: string) {
  const baseUrl = import.meta.env.VITE_PUBLIC_GATEWAY_URL?.trim();
  if (!baseUrl) throw new Error("Public gateway yapılandırması eksik.");
  const request: RequestAccountSignupCheck = { client_api_version: 1, request_id: uuidv7(), email };
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/auth/signup-check`, {
    method: "POST",
    credentials: "omit",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
  return readEnvelope<SuccessAccountSignupCheck>(response);
}
