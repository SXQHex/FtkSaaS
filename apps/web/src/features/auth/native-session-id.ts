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

// Compare verified session scope for late reads. If the bearer cannot expose
// a session UUID, reusing the exact bearer is safe; a changed opaque bearer is not.
export function sameNativeSession(start: Session, latest: Session): boolean {
  if (start.user.id !== latest.user.id) return false;
  const startedId = nativeSessionId(start);
  return startedId
    ? startedId === nativeSessionId(latest)
    : start.access_token === latest.access_token;
}
