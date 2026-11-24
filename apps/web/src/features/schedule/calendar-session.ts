import type { CalendarItem, SessionView } from "@ftksaas/api-contracts";

export function sessionIdentity<
  T extends Pick<SessionView, "id" | "version" | "state" | "capacity">,
>(session: T, id: string) {
  if (
    session.id !== id ||
    !Number.isSafeInteger(session.version) ||
    session.version < 1 ||
    !["planned", "occurred", "cancelled"].includes(session.state) ||
    [session.capacity.total, session.capacity.held, session.capacity.remaining].some(
      (value) => !Number.isSafeInteger(value) || value < 0,
    )
  )
    throw new Error("SCHEDULE_SESSION_UNAVAILABLE");
  return session;
}

export function calendarSessionProjection(item: CalendarItem) {
  const { id, starts_at, ends_at, session_summary, capacity, room_labels } = item;
  if (item.type !== "session" || !session_summary || !capacity || !("held" in capacity)) return;
  return sessionIdentity({ ...session_summary, id, starts_at, ends_at, capacity, room_labels }, id);
}

export function calendarSessionWithDiscipline(item: CalendarItem): SessionView | undefined {
  if (!item.discipline_id) return;
  const session = calendarSessionProjection(item);
  if (session) return { ...session, discipline_id: item.discipline_id };
}
