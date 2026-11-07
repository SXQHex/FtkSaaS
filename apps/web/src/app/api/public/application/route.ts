import { publicTransport } from "../../../../lib/public-transport";
export const runtime = "nodejs";
export function POST(request: Request) {
  return publicTransport(request, "public_application_submit_v1");
}
