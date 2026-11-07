import { validate } from "uuid";
export const crmWrites = [
  "lead_save_v1",
  "crm_activity_save_v1",
  "trial_offer_create_v1",
  "trial_registration_confirm_v1",
  "lead_convert_v1",
  "public_application_review_v1",
  "publication_set_v1",
] as const;
export const crmFields = {
  lead_save_v1: ["lead_id", "person_id", "source", "interest", "assigned_to", "expected_version"],
  crm_activity_save_v1: [
    "lead_id",
    "person_id",
    "activity_id",
    "kind",
    "due_at",
    "outcome",
    "note",
    "expected_version",
  ],
  trial_offer_create_v1: ["lead_id", "product_version_id", "session_id", "booking_category"],
  trial_registration_confirm_v1: ["offer_id"],
  lead_convert_v1: ["lead_id"],
  public_application_review_v1: [
    "application_id",
    "action",
    "person_id",
    "expected_version",
    "target_center_id",
  ],
  publication_set_v1: ["session_id", "event_id", "published", "public_details", "expected_version"],
};
const uuid = (v: unknown) => typeof v === "string" && validate(v);
const text = (v: unknown) => typeof v === "string" && !!v.trim() && v.length <= 10000;
const version = (v: unknown) => Number.isSafeInteger(v) && Number(v) > 0;
export function validCrmCommand(
  op: string,
  v: Record<string, unknown>,
  centerId: string | undefined,
  slot: string,
) {
  if (
    op === "public_application_review_v1" &&
    v.action === "assign_center" &&
    !centerId &&
    v.center_id == null
  )
    return (
      uuid(v.application_id) &&
      slot === `crm-application:${v.application_id}` &&
      version(v.expected_version) &&
      uuid(v.target_center_id)
    );
  if (!centerId || v.center_id !== centerId) return false;
  switch (op) {
    case "lead_save_v1":
      return (
        uuid(v.person_id) &&
        slot === `crm-person:${v.person_id}` &&
        text(v.source) &&
        text(v.interest) &&
        (v.assigned_to == null || uuid(v.assigned_to)) &&
        (v.lead_id == null || (uuid(v.lead_id) && version(v.expected_version)))
      );
    case "crm_activity_save_v1":
      return (
        uuid(v.lead_id) &&
        (v.activity_id
          ? slot === `crm-activity:${v.activity_id}` &&
            uuid(v.activity_id) &&
            version(v.expected_version)
          : slot === `crm-lead:${v.lead_id}`) &&
        ["contact", "followup", "outcome"].includes(String(v.kind)) &&
        (v.kind !== "followup" ||
          (typeof v.due_at === "string" && Number.isFinite(Date.parse(v.due_at)))) &&
        (text(v.note) || text(v.outcome))
      );
    case "lead_convert_v1":
      return uuid(v.lead_id) && slot === `crm-lead:${v.lead_id}`;
    case "trial_offer_create_v1":
      return (
        uuid(v.lead_id) &&
        slot === `crm-lead:${v.lead_id}` &&
        uuid(v.product_version_id) &&
        (v.session_id == null || uuid(v.session_id)) &&
        (v.booking_category === undefined ||
          ["male", "female"].includes(String(v.booking_category)))
      );
    case "trial_registration_confirm_v1":
      return uuid(v.offer_id) && slot === `crm-offer:${v.offer_id}`;
    case "public_application_review_v1":
      return (
        uuid(v.application_id) &&
        slot === `crm-application:${v.application_id}` &&
        version(v.expected_version) &&
        ["match_existing", "create_candidate", "close", "assign_center"].includes(
          String(v.action),
        ) &&
        (v.action !== "match_existing" || uuid(v.person_id)) &&
        (v.action !== "assign_center" || uuid(v.target_center_id))
      );
    case "publication_set_v1": {
      if (
        typeof v.published !== "boolean" ||
        !!v.session_id === !!v.event_id ||
        !uuid(v.session_id || v.event_id) ||
        slot !== `publication:${v.session_id || v.event_id}`
      )
        return false;
      if (!v.published) return true;
      const d = v.public_details as Record<string, unknown> | undefined;
      return (
        !!d &&
        text(d.title) &&
        text(d.venue_public_label) &&
        text(d.public_conditions) &&
        typeof d.currency === "string" &&
        /^[A-Z]{3}$/.test(d.currency) &&
        typeof d.fee_minor === "string" &&
        /^(0|[1-9][0-9]{0,18})$/.test(d.fee_minor)
      );
    }
    default:
      return false;
  }
}
