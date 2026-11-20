import { useCallback } from "react";
import { useLoaderData, useSearch, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { WorkspaceSelection } from "../workspace/workspace-layout";
import { InstructorLayout } from "./instructor-layout";
import { InstructorTodayContent } from "./instructor-today-content";
export function InstructorTodayRoutePage() {
  const account = useLoaderData({ from: "/instructor/today" }),
    search = useSearch({ from: "/instructor/today" }),
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
          to: "/instructor/today",
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
      title={t(($) => $.instructorToday.title)}
      onScope={resolve}
    >
      {({ scope, weekStart }) => (
        <InstructorTodayContent
          key={`${scope.orgId}:${scope.centerId}`}
          scope={scope}
          weekStart={weekStart}
          onSchedule={() => {
            void navigate({
              to: "/instructor/schedule",
              search: { org: scope.orgId, center: scope.centerId },
            });
          }}
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
