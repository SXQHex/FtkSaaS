import { useCallback } from "react";
import { useLoaderData, useSearch, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { MemberLayout } from "../member/member-layout";
import { MemberReservationsContent } from "./member-reservations-content";
export function MemberReservationsRoutePage() {
  const account = useLoaderData({ from: "/member/reservations" }),
    search = useSearch({ from: "/member/reservations" }),
    navigate = useNavigate();
  const { t } = useTranslation();
  const onScope = useCallback(
    (selection: { org?: string; center?: string }) => {
      void navigate({ to: "/member/reservations", search: selection, replace: true });
    },
    [navigate],
  );
  return (
    <MemberLayout
      key={`${account.id}:${search.org ?? ""}:${search.center ?? ""}`}
      account={account}
      initial={search}
      title={t(($) => $.memberReservations.title)}
      active="reservations"
      onScope={onScope}
    >
      {({ scope, personId, timezone, onLockChange }) => (
        <MemberReservationsContent
          key={`${scope.orgId}:${scope.centerId}:${personId}:${search.session ?? ""}:${search.offer ?? ""}`}
          scope={scope}
          personId={personId}
          sessionId={search.session}
          offerId={search.offer}
          timezone={timezone}
          onLockChange={onLockChange}
        />
      )}
    </MemberLayout>
  );
}
