import { useTranslation } from "react-i18next";
import type { TeamPermission } from "./settings-team";

export function useTeamPermissionLabels() {
  const { t } = useTranslation();
  const labels = t(($) => $.settings.teamNative.permissions, { returnObjects: true });
  return {
    "person.manage": labels.person.manage,
    "person.activate": labels.person.activate,
    "invite.student": labels.invite.student,
    "reservation.write": labels.reservation.write,
    "attendance.draft": labels.attendance.draft,
    "sale.write": labels.sale.write,
    "finance.collect": labels.finance.collect,
    "sale.discount": labels.sale.discount,
    "reservation.capacity_override": labels.reservation.capacity_override,
    "request.write": labels.request.write,
    "request.resolve": labels.request.resolve,
    "crm.daily": labels.crm.daily,
  } satisfies Record<TeamPermission, string>;
}
