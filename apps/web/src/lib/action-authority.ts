import { validate } from "uuid";
import { ApiFailure } from "./api";
import { setupCall, type SetupInput, type SetupScope } from "./studio-setup";
type Action =
  | "reservation_capacity_override_v1"
  | "collection_record_v1"
  | "student_credit_refund_v1"
  | "student_credit_offset_v1"
  | "debt_adjust_v1"
  | "sale_refund_preview_v1";
type Selector = Extract<
  NonNullable<SetupInput<"management_state_get_v1">["selector"]>,
  { operation: Action }
>;
// These six readers share the native action-discovery projection, not a generic permission cache.
export async function actionAuthority(scope: SetupScope, selector: Selector): Promise<boolean> {
  if (!scope.centerId) throw Error("invalidActionAuthority");
  try {
    const page = await setupCall("management_state_get_v1", {
      org_id: scope.orgId,
      center_id: scope.centerId,
      operation: selector.operation,
      selector,
    });
    if (!page.items.length) return false;
    const key = selector.key;
    const source =
      "session_id" in key
        ? { type: "sessions", id: key.session_id }
        : "sale_id" in key
          ? { type: "sales", id: key.sale_id }
          : "debt_id" in key
            ? { type: "debts", id: key.debt_id }
            : { type: "people", id: key.person_id };
    const row = page.items[0];
    if (
      page.items.length !== 1 ||
      page.next_cursor ||
      !row ||
      row.operation !== selector.operation ||
      !row.exists ||
      !row.entity ||
      row.entity.type !== source.type ||
      row.entity.id !== source.id ||
      !validate(row.entity.id) ||
      row.current?.operation !== selector.operation ||
      row.versions.length !== 1 ||
      row.versions[0]?.entity.type !== source.type ||
      row.versions[0]?.entity.id !== source.id ||
      !Number.isSafeInteger(row.versions[0]?.version) ||
      row.versions[0]!.version <= 0
    )
      throw Error("invalidActionAuthority");
    // A different selector target is unavailable, preserving the existing no-authority result.
    if (
      Object.keys(row.current.values).length !== Object.keys(key).length ||
      !Object.entries(key).every(([name, value]) =>
        Object.entries(row.current!.values).some(
          ([returned, current]) => returned === name && current === value,
        ),
      )
    )
      return false;
    return true;
  } catch (cause) {
    if (
      cause instanceof ApiFailure &&
      ["FORBIDDEN", "NOT_FOUND"].includes(cause.failure.error.code)
    )
      return false;
    throw cause;
  }
}
