import { handleAccountSignupCheck } from "../../../../../../backend/transports/account-signup-gateway.mjs";

export const runtime = "nodejs";
export function POST(request: Request) {
  return handleAccountSignupCheck(request);
}
