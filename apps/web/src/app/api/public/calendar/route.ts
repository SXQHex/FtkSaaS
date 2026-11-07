import { publicTransport } from "../../../../lib/public-transport";
export const runtime = "nodejs";
export function POST(request: Request) {
  return publicTransport(request, "public_calendar_get_v1");
}
