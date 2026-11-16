import { useCallback, useEffect, useState } from "react";
import { useBlocker } from "@tanstack/react-router";
import type { ClientScope } from "../../lib/scoped-backend";
import { ProfilePanel } from "../account/profile-panel";
import { DeletionPreviewPanel } from "../account/deletion-preview-panel";
import { MemberAccountView } from "./member-account-view";
import { MemberCalendarPanel } from "./member-calendar-panel";
import { MemberPreferencesPanel } from "./member-preferences-panel";
export function MemberAccountContent({
  scope,
  onLockChange,
}: {
  scope: ClientScope;
  onLockChange: (locked: boolean) => void;
}) {
  const [profile, setProfile] = useState(false),
    [calendar, setCalendar] = useState(false),
    [preferences, setPreferences] = useState(false),
    [deletion, setDeletion] = useState(false);
  const profileLock = useCallback((value: boolean) => setProfile(value), []),
    calendarLock = useCallback((value: boolean) => setCalendar(value), []),
    preferencesLock = useCallback((value: boolean) => setPreferences(value), []),
    deletionLock = useCallback((value: boolean) => setDeletion(value), []);
  const locked = profile || calendar || preferences || deletion;
  useBlocker({
    shouldBlockFn: () => profile || deletion,
    enableBeforeUnload: profile || deletion,
    disabled: !profile && !deletion,
  });
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  return (
    <MemberAccountView
      navigationDisabled={locked}
      profile={
        <ProfilePanel
          accountId={scope.accountId}
          variant="member"
          disabled={calendar || preferences || deletion}
          onLockChange={profileLock}
        />
      }
      deletion={
        <DeletionPreviewPanel
          accountId={scope.accountId}
          variant="member"
          disabled={profile || calendar || preferences}
          onLockChange={deletionLock}
        />
      }
      calendar={
        <MemberCalendarPanel
          scope={scope}
          onLockChange={calendarLock}
          disabled={profile || preferences || deletion}
        />
      }
      preferences={
        <MemberPreferencesPanel
          scope={scope}
          onLockChange={preferencesLock}
          disabled={profile || calendar || deletion}
        />
      }
    />
  );
}
