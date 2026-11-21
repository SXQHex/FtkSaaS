import { useCallback } from "react";
import { useSearch, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useAccountProjection } from "../auth/use-account-projection";
import type { WorkspaceSelection } from "../workspace/workspace-layout";
import { InstructorLayout } from "./instructor-layout";
import { InstructorEarningsContent } from "./instructor-earnings-content";
export function InstructorEarningsRoutePage() {
  const account = useAccountProjection(),
    search = useSearch({ from: "/instructor/earnings" }),
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
          to: "/instructor/earnings",
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
      title={t(($) => $.instructorEarnings.title)}
      onScope={resolve}
    >
      {({ scope, onLockChange, preservePending }) => (
        <InstructorEarningsContent
          key={`${scope.orgId}:${scope.centerId}`}
          scope={scope}
          onLockChange={onLockChange}
          preservePending={preservePending}
        />
      )}
    </InstructorLayout>
  );
}
