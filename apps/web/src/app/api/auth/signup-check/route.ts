import { handleAccountSignupCheck } from "../../../../../../backend/transports/account-signup-gateway.mjs";
import { appOrigin, publicConfig } from "../../../../lib/config";

export const runtime = "nodejs";
export function POST(request: Request) {
  const config = publicConfig();
  let hostname: string | undefined;
  try {
    hostname = new URL(appOrigin()).host;
  } catch {
    // Missing or invalid configuration remains a transport-level 503.
  }
  return handleAccountSignupCheck(request, {
    NODE_ENV: process.env.NODE_ENV,
    FTK_SIGNUP_HOSTNAME: hostname,
    FTK_PUBLIC_BACKEND_ORIGIN: config?.url,
    FTK_PUBLIC_ANON_KEY: config?.publishableKey,
    FTK_PUBLIC_INGRESS_SECRET: process.env.FTK_PUBLIC_INGRESS_SECRET,
  });
}
