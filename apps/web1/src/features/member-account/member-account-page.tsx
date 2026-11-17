import { useCallback } from "react";
import { useLoaderData, useSearch, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { MemberLayout } from "../member/member-layout";
import { MemberAccountContent } from "./member-account-content";
export function MemberAccountRoutePage() {
  const account = useLoaderData({ from: "/member/account" }),
    search = useSearch({ from: "/member/account" }),
    navigate = useNavigate();
  const { t } = useTranslation();
  const onScope = useCallback(
    (selection: { org?: string; center?: string }) => {
      void navigate({ to: "/member/account", search: selection, replace: true });
    },
    [navigate],
  );
  return (
    <MemberLayout
      key={`${account.id}:${search.org ?? ""}:${search.center ?? ""}`}
      account={account}
      initial={search}
      title={t(($) => $.memberAccount.title)}
      active="account"
      onScope={onScope}
    >
      {({ scope, personId, onLockChange }) => (
        <MemberAccountContent
          key={`${scope.orgId}:${scope.centerId}`}
          scope={scope}
          personId={personId}
          onLockChange={onLockChange}
        />
      )}
    </MemberLayout>
  );
}
