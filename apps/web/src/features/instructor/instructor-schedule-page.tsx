import { useCallback } from "react";
import { useSearch, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useAccountProjection } from "../auth/use-account-projection";
import type { WorkspaceSelection } from "../workspace/workspace-layout";
import { InstructorLayout } from "./instructor-layout";
import { InstructorScheduleContent } from "./instructor-schedule-content";
export function InstructorScheduleRoutePage() {
  const account = useAccountProjection(),
    search = useSearch({ from: "/instructor/schedule" }),
    navigate = useNavigate();
  const { t } = useTranslation();
  const resolve = useCallback(
    (selection: WorkspaceSelection) => {
      if (
        selection.organizationId &&
        selection.centerId &&
        (selection.organizationId !== search.org || selection.centerId !== search.center)
      )
        void navigate({
          to: "/instructor/schedule",
          search: { org: selection.organizationId, center: selection.centerId },
          replace: true,
        });
    },
    [navigate, search.org, search.center],
  );
  return (
    <InstructorLayout
      key={`${account.id}:${search.org ?? ""}:${search.center ?? ""}`}
      account={account}
      initial={search}
      title={t(($) => $.instructorSchedule.title)}
      onScope={resolve}
    >
      {({ scope, weekStart }) => (
        <InstructorScheduleContent
          key={`${scope.orgId}:${scope.centerId}`}
          scope={scope}
          weekStart={weekStart}
          onOpen={(sessionId) => {
            void navigate({
              to: "/instructor/sessions/$sessionId",
              params: { sessionId },
              search: { org: scope.orgId, center: scope.centerId },
            });
          }}
        />
      )}
    </InstructorLayout>
  );
}
