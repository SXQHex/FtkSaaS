import { useCallback } from "react";
import { useLoaderData, useSearch, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { MemberLayout } from "../member/member-layout";
import { MemberEntitlementsContent } from "./member-entitlements-content";
export function MemberEntitlementsRoutePage() {
  const account = useLoaderData({ from: "/member/entitlements" }),
    search = useSearch({ from: "/member/entitlements" }),
    navigate = useNavigate();
  const { t } = useTranslation();
  const onScope = useCallback(
    (selection: { org?: string; center?: string }) => {
      void navigate({ to: "/member/entitlements", search: selection, replace: true });
    },
    [navigate],
  );
  return (
    <MemberLayout
      key={`${account.id}:${search.org ?? ""}:${search.center ?? ""}`}
      account={account}
      initial={search}
      title={t(($) => $.memberEntitlements.title)}
      active="entitlements"
      onScope={onScope}
    >
      {({ scope, personId, timezone }) => (
        <MemberEntitlementsContent
          key={`${scope.orgId}:${scope.centerId}:${personId}`}
          scope={scope}
          personId={personId}
          timezone={timezone}
        />
      )}
    </MemberLayout>
  );
}
