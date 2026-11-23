import type { Session } from "@supabase/supabase-js";
import { z } from "zod";

// This identifies the local native session, not an authorization decision.
// The backend independently verifies JWT signatures, actor and tenant rights.
const claimsSchema = z.object({ sub: z.string().min(1), session_id: z.uuid() });

export function nativeSessionId(session: Session): string | undefined {
  try {
    const encoded = session.access_token.split(".")[1];
    if (!encoded) return undefined;
    const payload: unknown = JSON.parse(atob(encoded.replaceAll("-", "+").replaceAll("_", "/")));
    const claims = claimsSchema.parse(payload);
    return claims.sub === session.user.id ? claims.session_id : undefined;
  } catch {
    // An unrecognizable bearer must never be mistaken for a known session.
    return undefined;
  }
}
