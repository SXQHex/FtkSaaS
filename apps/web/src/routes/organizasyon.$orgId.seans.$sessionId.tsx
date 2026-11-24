import { createFileRoute, isRedirect, notFound, redirect } from "@tanstack/react-router";
import { calendarSessionReturn } from "../features/auth/calendar-session-return";
import { requireAccountSession } from "../features/auth/account-guard";
import { resolveCalendarSession } from "../features/calendar-links/calendar-session";

export const Route = createFileRoute("/organizasyon/$orgId/seans/$sessionId")({
  beforeLoad: async ({ params }) => {
    const next = calendarSessionReturn(`/organizasyon/${params.orgId}/seans/${params.sessionId}`);
    if (!next) throw notFound();
    try {
      return { ...(await requireAccountSession()), calendarReturn: next };
    } catch (error) {
      if (isRedirect(error)) {
        if (error.options.to === "/login")
          throw redirect({ to: "/login", search: { next }, replace: true });
        if (error.options.to === "/mfa")
          throw redirect({ to: "/mfa", search: { next }, replace: true });
      }
      throw error;
    }
  },
  loader: async ({ params, context, abortController }) => {
    const org = params.orgId.toLowerCase();
    const session = params.sessionId.toLowerCase();
    const target = await resolveCalendarSession(
      context.queryClient,
      context.authUserId,
      org,
      session,
      abortController.signal,
    );
    if (target.kind === "signedOut")
      throw redirect({ to: "/login", search: { next: context.calendarReturn }, replace: true });
    if (target.kind === "unavailable") throw notFound();
    if (target.kind === "instructor")
      throw redirect({
        to: "/instructor/sessions/$sessionId",
        params: { sessionId: session },
        search: { org, center: target.center },
        replace: true,
      });
    throw redirect({
      to: "/member/reservations",
      search: { org, center: target.center, session },
      replace: true,
    });
  },
});
