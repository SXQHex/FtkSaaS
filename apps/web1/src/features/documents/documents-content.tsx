import { useCallback, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BackendError } from "../../lib/backend";
import type { ClientScope } from "../../lib/scoped-backend";
import { DocumentsView } from "./documents-view";
import { DocumentEditor } from "./document-editor";
import { Alert, AlertDescription } from "../../components/ui/alert";
export function DocumentsContent({
  scope,
  onLockChange,
}: {
  scope: ClientScope;
  onLockChange: (locked: boolean) => void;
  preservePending?: boolean;
}) {
  const { t } = useTranslation(),
    router = useRouter();
  const [open, setOpen] = useState(false),
    [locked, setLocked] = useState(false),
    [saved, setSaved] = useState<string>();
  const [tab, setTab] = useState<"documents" | "acceptance">("documents"),
    [filter, setFilter] = useState<"pending" | "all">("pending");
  const lock = useCallback(
    (value: boolean) => {
      setLocked(value);
      onLockChange(value);
    },
    [onLockChange],
  );
  const accessLost = useCallback(
    (cause: unknown) => {
      if (
        (cause instanceof BackendError &&
          ["AUTH_REQUIRED", "SESSION_REVOKED"].includes(cause.code)) ||
        (cause instanceof Error && ["AUTH_REQUIRED", "ACCOUNT_CHANGED"].includes(cause.message))
      ) {
        void router.invalidate();
        return true;
      }
      return false;
    },
    [router],
  );
  return (
    <>
      <DocumentsView
        documents={null}
        acceptances={null}
        tab={tab}
        onTab={setTab}
        filter={filter}
        onFilter={setFilter}
        summary={{ published: null, draft: null, pending: null, lastPublished: null }}
        locked={locked}
        onAdd={() => {
          setSaved(undefined);
          setOpen(true);
        }}
        notice={
          <>
            <Alert>
              <AlertDescription>{t(($) => $.documents.directoryUnavailable)}</AlertDescription>
            </Alert>
            {saved && (
              <Alert>
                <AlertDescription role="status">
                  {t(($) => $.documents.publishedVersion, { version: saved })}
                </AlertDescription>
              </Alert>
            )}
          </>
        }
      />
      {open && (
        <DocumentEditor
          scope={scope}
          onLockChange={lock}
          onAccessLost={accessLost}
          onSaved={setSaved}
          onClose={() => {
            if (!locked) {
              setOpen(false);
              lock(false);
            }
          }}
        />
      )}
    </>
  );
}
