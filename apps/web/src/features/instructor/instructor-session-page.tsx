import { useCallback } from "react";
import { useSearch, useParams, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useAccountProjection } from "../auth/use-account-projection";
import type { WorkspaceSelection } from "../workspace/workspace-layout";
import { InstructorLayout } from "./instructor-layout";
import { InstructorSessionContent } from "./instructor-session-content";
export function InstructorSessionRoutePage() {
  const account = useAccountProjection(),
    search = useSearch({ from: "/instructor/sessions/$sessionId" }),
    { sessionId } = useParams({ from: "/instructor/sessions/$sessionId" }),
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
      key={`${account.id}:${search.org ?? ""}:${search.center ?? ""}:${sessionId}`}
      account={account}
      initial={search}
      title={t(($) => $.instructorSession.title)}
      onScope={resolve}
    >
      {({ scope, onLockChange, preservePending }) => (
        <InstructorSessionContent
          scope={scope}
          sessionId={sessionId}
          onLockChange={onLockChange}
          preservePending={preservePending}
          onBack={() => {
            void navigate({
              to: "/instructor/today",
              search: { org: scope.orgId, center: scope.centerId },
            });
          }}
        />
      )}
    </InstructorLayout>
  );
}
