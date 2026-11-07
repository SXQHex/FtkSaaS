import { validate } from "uuid";
import type { WaitlistEntryView } from "@ftksaas/api-contracts";
import { setupCall, type SetupScope } from "./studio-setup";
export { waitlistCommand, validWaitlistCommand } from "./waitlist-command";
export const waitlistApi = {
  list: async (scope: SetupScope, sessionId: string, personId: string, cursor?: string) => {
    if (!scope.centerId) throw Error("invalidWaitlist");
    const page = await setupCall("management_state_get_v1", {
      org_id: scope.orgId,
      center_id: scope.centerId,
      operation: "waitlist_join_v1",
      selector: {
        operation: "waitlist_join_v1",
        key: { session_id: sessionId, person_id: personId },
      },
      page: { limit: 25, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
    });
    const ids = new Set<string>(),
      offers = new Set<string>();
    const items: WaitlistEntryView[] = page.items.map((item) => {
      const row = item.waitlist_detail;
      if (
        item.operation !== "waitlist_join_v1" ||
        !row ||
        !item.exists ||
        item.entity?.type !== "waitlist_entries" ||
        item.entity.id !== row.id ||
        !validate(row.id) ||
        ids.has(row.id) ||
        row.person_id !== personId ||
        row.session_id !== sessionId ||
        row.center_id !== scope.centerId ||
        !Number.isSafeInteger(row.version) ||
        row.version < 1 ||
        !item.versions.some(
          (v) =>
            v.entity.type === "waitlist_entries" &&
            v.entity.id === row.id &&
            v.version === row.version,
        ) ||
        !["waiting", "offered", "converted", "left", "closed"].includes(row.state) ||
        ![row.created_at, row.joined_at].every((x) => Number.isFinite(Date.parse(x)))
      )
        throw Error("invalidWaitlist");
      ids.add(row.id);
      for (const offer of row.offers) {
        if (
          !validate(offer.id) ||
          offers.has(offer.id) ||
          offer.entry_id !== row.id ||
          offer.person_id !== personId ||
          offer.session_id !== sessionId ||
          !Number.isSafeInteger(offer.version) ||
          offer.version < 1 ||
          !["active", "accepted", "rejected", "expired", "withdrawn"].includes(offer.state) ||
          ![offer.created_at, offer.expires_at].every((x) => Number.isFinite(Date.parse(x)))
        )
          throw Error("invalidWaitlist");
        offers.add(offer.id);
      }
      return row;
    });
    if (cursor && page.next_cursor === cursor) throw Error("invalidWaitlist");
    return { items, next_cursor: page.next_cursor };
  },
};
export type WaitlistApi = typeof waitlistApi;
