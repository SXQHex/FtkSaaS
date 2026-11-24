import type { QueryClient } from "@tanstack/react-query";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { clearPrivateQueries } from "../../lib/cache-invalidation";
import { scopedBackend, type AccountReadContext } from "../../lib/scoped-backend";
import { getSupabaseClient } from "../../lib/supabase";
import { verifiedWorkspaceAccount } from "../auth/account-query";
import { nativeSessionId, sameNativeSession } from "../auth/native-session-id";
import { classifyAccessFailure } from "../auth/query-access-recovery";
import { refreshWorkspace } from "../workspace/workspace-query";

type Target =
  | { kind: "signedOut" }
  | { kind: "unavailable" }
  | { kind: "instructor" | "student"; center: string };

export async function resolveCalendarSession(
  queries: QueryClient,
  authUserId: string,
  org: string,
  sessionId: string,
  signal: AbortSignal,
): Promise<Target> {
  const auth = getSupabaseClient().auth;
  const initial = await auth.getSession();
  signal.throwIfAborted();
  if (initial.error) throw initial.error;
  const nativeSession = initial.data.session;
  if (!nativeSession) return { kind: "signedOut" };
  if (nativeSession.user.id !== authUserId) throw new Error("ACCOUNT_CHANGED");

  const confirmSession = async (lifetime = signal) => {
    const latest = await auth.getSession();
    lifetime.throwIfAborted();
    if (latest.error) throw latest.error;
    if (!latest.data.session || !sameNativeSession(nativeSession, latest.data.session))
      throw new Error("ACCOUNT_CHANGED");
  };

  try {
    const account = await verifiedWorkspaceAccount(queries, authUserId);
    await confirmSession();
    const readDiscovery = async (readContext: AccountReadContext) => {
      try {
        await confirmSession(readContext.signal);
        const backend = await scopedBackend({ accountId: account.id }, undefined, readContext);
        const session = await backend.call("session_get_v1", {
          client_api_version: 1,
          request_id: uuidv7(),
          org_id: org,
          session_id: sessionId,
          include_center_id: true,
        });
        return { session };
      } catch (error) {
        // Let this loader preserve its validated return path on session loss.
        if (classifyAccessFailure(error) === "session") return { error };
        throw error;
      }
    };
    // Auth can invalidate the route while its first loader is still pending.
    // Share the exact read only within an identified native session.
    const nativeId = nativeSessionId(nativeSession);
    const discovery = nativeId
      ? await queries.query({
          queryKey: ["calendar-session", account.id, authUserId, nativeId, org, sessionId],
          queryFn: readDiscovery,
          gcTime: 0,
          staleTime: 0,
          retry: false,
        })
      : await readDiscovery({ client: queries, signal });
    await confirmSession();
    if (!discovery.session) throw discovery.error;
    const { session } = discovery;
    const center = z.uuid().parse(session.center_id);
    if (session.id !== sessionId) throw new Error("CALENDAR_SESSION_PROJECTION_INVALID");

    // Refresh the same workspace Query used by the destination. Current
    // membership is required even when a separate role can read the session.
    const workspace = await refreshWorkspace(queries, account.id, org);
    await confirmSession();
    const self = workspace.selected?.self_context;
    const membership = self?.centers.find((row) => row.center_id === center);
    if (
      !self ||
      !membership ||
      !workspace.centers.some((row) => row.id === center && row.accessible)
    )
      return { kind: "unavailable" };

    const assigned = session.assignments.some(
      ({ person_id, duty }) => person_id === self.person_id && membership[duty] === true,
    );
    if (assigned) return { kind: "instructor", center };
    // The destination's exact reservation reads verify ownership.
    if (membership.student) return { kind: "student", center };
    return { kind: "unavailable" };
  } catch (error) {
    await confirmSession();
    if (classifyAccessFailure(error) === "session") {
      clearPrivateQueries(queries);
      return { kind: "signedOut" };
    }
    throw error;
  }
}
