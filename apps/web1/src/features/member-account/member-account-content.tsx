import { useCallback, useEffect, useState } from "react";
import { useBlocker } from "@tanstack/react-router";
import type { ClientScope } from "../../lib/scoped-backend";
import { ProfilePanel } from "../account/profile-panel";
import { DeletionPreviewPanel } from "../account/deletion-preview-panel";
import { MemberAccountView } from "./member-account-view";
import { MemberCalendarPanel } from "./member-calendar-panel";
import { MemberDocumentContextsPanel } from "./member-document-contexts-panel";
import { MemberPreferencesPanel } from "./member-preferences-panel";
export function MemberAccountContent({
  scope,
  personId,
  onLockChange,
}: {
  scope: ClientScope;
  personId: string;
  onLockChange: (locked: boolean) => void;
}) {
  const [profile, setProfile] = useState(false),
    [calendar, setCalendar] = useState(false),
    [preferences, setPreferences] = useState(false),
    [deletion, setDeletion] = useState(false),
    [documents, setDocuments] = useState(false);
  const profileLock = useCallback((value: boolean) => setProfile(value), []),
    calendarLock = useCallback((value: boolean) => setCalendar(value), []),
    preferencesLock = useCallback((value: boolean) => setPreferences(value), []),
    documentsLock = useCallback((value: boolean) => setDocuments(value), []),
    deletionLock = useCallback((value: boolean) => setDeletion(value), []);
  const locked = profile || calendar || preferences || deletion || documents;
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
      documents={
        <MemberDocumentContextsPanel
          scope={scope}
          personId={personId}
          disabled={profile || calendar || preferences || deletion}
          onLockChange={documentsLock}
        />
      }
      profile={
        <ProfilePanel
          accountId={scope.accountId}
          variant="member"
          disabled={calendar || preferences || deletion || documents}
          onLockChange={profileLock}
        />
      }
      deletion={
        <DeletionPreviewPanel
          accountId={scope.accountId}
          variant="member"
          disabled={profile || calendar || preferences || documents}
          onLockChange={deletionLock}
        />
      }
      calendar={
        <MemberCalendarPanel
          scope={scope}
          onLockChange={calendarLock}
          disabled={profile || preferences || deletion || documents}
        />
      }
      preferences={
        <MemberPreferencesPanel
          scope={scope}
          onLockChange={preferencesLock}
          disabled={profile || calendar || deletion || documents}
        />
      }
    />
  );
}
