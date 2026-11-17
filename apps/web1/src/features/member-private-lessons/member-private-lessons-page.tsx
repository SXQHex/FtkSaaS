import { useCallback } from "react";
import { useLoaderData, useSearch, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { MemberLayout } from "../member/member-layout";
import { MemberPrivateLessonsContent } from "./member-private-lessons-content";
export function MemberPrivateLessonsRoutePage() {
  const account = useLoaderData({ from: "/member/private-lessons" }),
    search = useSearch({ from: "/member/private-lessons" }),
    navigate = useNavigate();
  const { t } = useTranslation();
  const onScope = useCallback(
    (selection: { org?: string; center?: string }) => {
      void navigate({ to: "/member/private-lessons", search: selection, replace: true });
    },
    [navigate],
  );
  return (
    <MemberLayout
      key={`${account.id}:${search.org ?? ""}:${search.center ?? ""}`}
      account={account}
      initial={search}
      title={t(($) => $.memberPrivateLessons.title)}
      active="requests"
      onScope={onScope}
    >
      {({ scope, personId, timezone, onLockChange }) => (
        <MemberPrivateLessonsContent
          key={`${scope.orgId}:${scope.centerId}:${personId}`}
          scope={scope}
          personId={personId}
          requestId={search.request}
          timezone={timezone}
          onLockChange={onLockChange}
        />
      )}
    </MemberLayout>
  );
}
