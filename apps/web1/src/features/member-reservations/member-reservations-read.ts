import type { ClientScope } from "../../lib/scoped-backend";
import { BackendError } from "../../lib/backend";
import { readMemberReservations } from "../member-profile/reservations";
import { readSessionHeader } from "../session-detail/session-detail-read";
export async function readOwnReservations(
  scope: ClientScope,
  personId: string,
  filter: "upcoming" | "past",
  cursor?: string,
) {
  const page = await readMemberReservations(scope, personId, cursor, filter, {
    sort: filter === "upcoming" ? "starts_at_asc" : "created_at_desc",
    includeSourceSummary: true,
  });
  const sessions = [
    ...new Map(
      page.items.filter((row) => row.session).map((row) => [row.session!.id, row.session!]),
    ).values(),
  ];
  const titles = new Map<string, string>();
  for (let index = 0; index < sessions.length; index += 4)
    await Promise.all(
      sessions.slice(index, index + 4).map(async (session) => {
        try {
          const header = await readSessionHeader(scope, session);
          titles.set(session.id, header.title);
        } catch (error) {
          if (
            error instanceof BackendError &&
            ["FORBIDDEN", "NOT_FOUND", "PLAN_FEATURE_UNAVAILABLE"].includes(error.code)
          )
            return;
          if (error instanceof Error && error.message === "SESSION_DETAIL_HEADER_UNAVAILABLE")
            return;
          throw error;
        }
      }),
    );
  return {
    ...page,
    items: page.items.map((row) => ({ ...row, title: titles.get(row.reservation.session_id) })),
  };
}
export type OwnReservations = Awaited<ReturnType<typeof readOwnReservations>>;
