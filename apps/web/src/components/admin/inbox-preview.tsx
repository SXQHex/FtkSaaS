"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { NotificationView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Preferences } from "../preferences";
import { InboxFeedView } from "../inbox/inbox-feed";
import { NotificationPreferenceView } from "../inbox/notification-preferences";
import type { useSetupCommand } from "../setup/setup-command";
import type { PendingSetup } from "../../lib/studio-setup";
import type { listAudit, listInbox } from "../../lib/inbox";
const id = "019a2b3c-4d5e-7000-8000-000000000080",
  other = "019a2b3c-4d5e-7000-8000-000000000081";
const scope = { actorId: id, orgId: other };
const notice: NotificationView = {
  id,
  kind: "session_change",
  payload: {
    template_key: "session_change",
    subject: { type: "sessions", id },
    title: "Örnek program değişikliği",
    body: "Sentetik bildirim. Kayıt geçmişi ayrı yetkiyle okunur.",
  },
  created_at: "2026-11-05T08:00:00Z",
  read_at: null,
};
const historyList: typeof listAudit = async (_scope, subject, _interval, cursor) => ({
  items: [
    {
      id: cursor ? other : id,
      subject,
      action: "session_change_apply_v1",
      actor_display: cursor ? "İkinci örnek aktör" : "Örnek yönetici",
      created_at: "2026-11-05T08:00:00Z",
      reason: cursor ? "İkinci örnek gerekçe" : "Örnek saat düzeltmesi",
      diff: {
        changes: [{ field: "private_payload", old_value: "private-old", new_value: "private-new" }],
      },
    },
  ],
  next_cursor: cursor ? null : "synthetic-history-page",
  as_of: "2026-11-05T08:00:00Z",
});
export function InboxPreview() {
  const t = useTranslations("inbox");
  const [unread, setUnread] = useState(true),
    [read, setRead] = useState(false),
    [revision, setRevision] = useState(0),
    [lost, setLost] = useState(false),
    [pending, setPending] = useState<PendingSetup | null>(null),
    [message, setMessage] = useState("");
  const [marketing, setMarketing] = useState(false),
    [preferenceRevision, setPreferenceRevision] = useState(0);
  function saved() {
    setPending(null);
    setMessage("saved");
    setRead(true);
    setRevision((n) => n + 1);
  }
  const command: ReturnType<typeof useSetupCommand> = {
    pending,
    busy: false,
    message,
    run: async (input) => {
      if (pending) {
        saved();
        return;
      }
      if (input?.operation !== "notification_mark_read_v1")
        throw Error("Unexpected design command");
      if (lost) {
        setPending({ command: input });
        setLost(false);
        setMessage("uncertain");
      } else saved();
    },
    check: async () => {
      if (!pending) throw Error("No pending design command");
      saved();
    },
  };
  const preferenceCommand: ReturnType<typeof useSetupCommand> = {
    pending: null,
    busy: false,
    message: preferenceRevision ? "saved" : "",
    run: async (input) => {
      if (
        input?.operation !== "settings_update_v1" ||
        input.input.scope !== "member" ||
        !("in_app_marketing" in input.input.patch) ||
        typeof input.input.patch.in_app_marketing !== "boolean"
      )
        throw Error("Unexpected design preference");
      setMarketing(input.input.patch.in_app_marketing);
      setPreferenceRevision((n) => n + 1);
    },
    check: async () => {
      throw Error("No pending design preference");
    },
  };
  const list = useCallback<typeof listInbox>(
    async (_scope, onlyUnread, cursor) => ({
      items:
        read && onlyUnread
          ? []
          : [
              {
                ...notice,
                id: cursor ? other : id,
                payload: {
                  ...notice.payload,
                  title: cursor ? "Örnek ikinci bildirim" : notice.payload.title,
                },
                read_at: read ? "2026-11-05T08:01:00Z" : null,
              },
            ],
      next_cursor: cursor || read ? null : "synthetic-inbox-page",
      as_of: "2026-11-05T08:00:00Z",
    }),
    [read],
  );
  const preferenceRead = useCallback(
    async () => ({ enabled: marketing, version: preferenceRevision, writable: true }),
    [marketing, preferenceRevision],
  );
  return (
    <main
      id="main-content"
      className="mx-auto w-full min-w-0 max-w-3xl space-y-7 px-5 py-8 wrap-anywhere"
    >
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/tasarim" className="text-sm underline underline-offset-4">
          FtkSaaS
        </Link>
        <Preferences />
      </header>
      <h1 className="text-2xl font-semibold">{t("demoTitle")}</h1>
      <p className="text-sm text-muted-foreground">{t("demoHint")}</p>
      <NotificationPreferenceView
        key={`preference:${preferenceRevision}`}
        scope={scope}
        read={preferenceRead}
        command={preferenceCommand}
      />
      <Button
        className="h-auto min-h-11 max-w-full whitespace-normal"
        variant="outline"
        disabled={lost || !!pending}
        onClick={() => setLost(true)}
      >
        {t(lost ? "demoLostArmed" : "demoLostResponse")}
      </Button>
      <InboxFeedView
        key={`inbox:${revision}`}
        scope={scope}
        unread={unread}
        onUnreadChange={setUnread}
        command={command}
        list={list}
        version={async () => 3}
        historyList={historyList}
      />
    </main>
  );
}
