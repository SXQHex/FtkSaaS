import type { MemberLessonCancellation } from "@ftksaas/api-contracts";
import { readMemberClasses } from "../member-classes/member-classes-read";
import type { ClientScope, AccountReadContext } from "../../lib/scoped-backend";
import { BackendError } from "../../lib/backend";
import { readMemberReservations } from "../member-profile/reservations";
import { readSessionHeader } from "../session-detail/session-detail-read";
export async function readOwnReservations(
  scope: ClientScope,
  personId: string,
  filter: "upcoming" | "past",
  cursor?: string,
  sessionId?: string,
  readContext?: AccountReadContext,
) {
  const page = await readMemberReservations(
    scope,
    personId,
    cursor,
    filter,
    {
      sort: filter === "upcoming" ? "starts_at_asc" : "created_at_desc",
      includeSourceSummary: true,
      includeSelfSummary: true,
      ...(filter === "upcoming" ? { includeAttendance: false } : {}),
      sessionId,
    },
    ...(readContext ? ([readContext] as const) : []),
  );
  const sessions = [
    ...new Map(
      page.items.filter((row) => row.session).map((row) => [row.session!.id, row.session!]),
    ).values(),
  ];
  const titles = new Map<string, string>();
  const discoveryReads = new Map<string, ReturnType<typeof readMemberClasses>>();
  const details = new Map<
    string,
    { instructors: string[]; rooms: string[]; cancellation: MemberLessonCancellation }
  >();
  for (const { reservation, session } of page.items) {
    const summary = reservation.self_summary;
    if (
      reservation.person_id !== personId ||
      session?.id !== reservation.session_id ||
      typeof summary?.title !== "string" ||
      !summary.title ||
      Date.parse(summary.starts_at) !== Date.parse(session.starts_at) ||
      Date.parse(summary.ends_at) !== Date.parse(session.ends_at)
    )
      continue;
    if (
      summary.session_version === undefined
        ? filter === "upcoming"
        : summary.session_version !== session.version
    )
      continue;
    titles.set(session.id, summary.title);
    if (
      filter === "upcoming" &&
      session.state === "planned" &&
      summary.cancellation?.source === "reservation_policy" &&
      Array.isArray(summary.instructor_labels) &&
      Array.isArray(summary.room_labels)
    )
      details.set(reservation.id, {
        instructors: summary.instructor_labels,
        rooms: summary.room_labels,
        cancellation: summary.cancellation,
      });
  }
  const unresolved = sessions.filter((session) => !titles.has(session.id));
  for (let index = 0; index < unresolved.length; index += 4)
    await Promise.all(
      unresolved.slice(index, index + 4).map(async (session) => {
        try {
          if (filter === "upcoming" && session.state === "planned") {
            const interval = { starts_at: session.starts_at, ends_at: session.ends_at };
            const intervalKey = interval.starts_at + "/" + interval.ends_at;
            let read = discoveryReads.get(intervalKey);
            if (!read) {
              read = readMemberClasses(
                scope,
                interval,
                ...(readContext ? ([readContext] as const) : []),
              );
              discoveryReads.set(intervalKey, read);
            }
            const native = (await read).find((row) => row.id === session.id);
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
                details.set(own.id, {
                  instructors: native.member_lesson.instructor_labels,
                  rooms: native.member_lesson.room_labels,
                  cancellation: own.cancellation,
                });
              return;
            }
          }
          const header = await readSessionHeader(
            scope,
            session,
            ...(readContext ? ([readContext] as const) : []),
          );
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
      lesson: details.get(row.reservation.id),
    })),
  };
}
export type OwnReservations = Awaited<ReturnType<typeof readOwnReservations>>;
