import { useCallback } from "react";
import { useLoaderData, useSearch, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { MemberLayout } from "../member/member-layout";
import { MemberClassesContent } from "./member-classes-content";
export function MemberClassesRoutePage() {
  const account = useLoaderData({ from: "/member/classes" }),
    search = useSearch({ from: "/member/classes" }),
    navigate = useNavigate();
  const { t } = useTranslation();
  const onScope = useCallback(
    (selection: { org?: string; center?: string }) => {
      void navigate({ to: "/member/classes", search: selection, replace: true });
    },
    [navigate],
  );
  return (
    <MemberLayout
      key={`${account.id}:${search.org ?? ""}:${search.center ?? ""}`}
      account={account}
      initial={search}
      title={t(($) => $.memberClasses.title)}
      active="classes"
      onScope={onScope}
    >
      {({ scope, personId, timezone, onLockChange }) => (
        <MemberClassesContent
          key={`${scope.orgId}:${scope.centerId}:${personId}`}
          scope={scope}
          personId={personId}
          timezone={timezone}
          onLockChange={onLockChange}
        />
      )}
    </MemberLayout>
  );
}
