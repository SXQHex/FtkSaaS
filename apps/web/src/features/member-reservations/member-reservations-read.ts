import type { MemberLessonCancellation } from "@ftksaas/api-contracts";
import { readMemberClasses } from "../member-classes/member-classes-read";
import type { ClientScope } from "../../lib/scoped-backend";
import { BackendError } from "../../lib/backend";
import { readMemberReservations } from "../member-profile/reservations";
import { readSessionHeader } from "../session-detail/session-detail-read";
export async function readOwnReservations(
  scope: ClientScope,
  personId: string,
  filter: "upcoming" | "past",
  cursor?: string,
  sessionId?: string,
) {
  const page = await readMemberReservations(scope, personId, cursor, filter, {
    sort: filter === "upcoming" ? "starts_at_asc" : "created_at_desc",
    includeSourceSummary: true,
    sessionId,
  });
  const sessions = [
    ...new Map(
      page.items.filter((row) => row.session).map((row) => [row.session!.id, row.session!]),
    ).values(),
  ];
  const titles = new Map<string, string>();
  const details = new Map<
    string,
    { instructors: string[]; rooms: string[]; cancellation: MemberLessonCancellation }
  >();
  for (let index = 0; index < sessions.length; index += 4)
    await Promise.all(
      sessions.slice(index, index + 4).map(async (session) => {
        try {
          if (filter === "upcoming" && session.state === "planned") {
            const native = (
              await readMemberClasses(scope, {
                starts_at: session.starts_at,
                ends_at: session.ends_at,
              })
            ).find((row) => row.id === session.id);
            if (native) {
              titles.set(session.id, native.title);
              const own = native.member_lesson.own_reservation;
              if (
                own &&
                page.items.some(
                  (row) =>
                    row.reservation.id === own.id &&
                    row.reservation.version === own.version &&
                    row.reservation.session_id === session.id,
                ) &&
                own.cancellation.source === "reservation_policy"
              )
                details.set(session.id, {
                  instructors: native.member_lesson.instructor_labels,
                  rooms: native.member_lesson.room_labels,
                  cancellation: own.cancellation,
                });
              return;
            }
          }
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
    items: page.items.map((row) => ({
      ...row,
      title: titles.get(row.reservation.session_id),
      lesson: details.get(row.reservation.session_id),
    })),
  };
}
export type OwnReservations = Awaited<ReturnType<typeof readOwnReservations>>;
