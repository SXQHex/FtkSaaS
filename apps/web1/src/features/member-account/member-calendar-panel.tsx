import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useBlocker, useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { v7 as uuidv7 } from "uuid";
import type { ClientScope } from "../../lib/scoped-backend";
import { BackendError } from "../../lib/backend";
import type { PersonalCalendarMutation } from "../../lib/api-contracts/generated";
import {
  readMemberCalendars,
  writeMemberCalendar,
  calendarCredential,
  type CalendarIntent,
} from "./member-calendar";
import { AccountCalendarView } from "./member-account-view";
import { Button } from "../../components/ui/button";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { Checkbox } from "../../components/ui/checkbox";
import {
  ItemGroup,
  Item,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "../../components/ui/item";
import {
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "../../components/ui/sheet";
export function MemberCalendarPanel({
  scope,
  onLockChange,
  disabled = false,
}: {
  scope: ClientScope;
  onLockChange: (locked: boolean) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation(),
    router = useRouter();
  const query = useQuery({
    queryKey: ["member-calendar", scope.accountId, scope.orgId],
    queryFn: () => readMemberCalendars(scope),
    retry: false,
  });
  const [intent, setIntent] = useState<CalendarIntent>(),
    [reviewed, setReviewed] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState<
      "ready" | "unknown" | "saved-unread" | "saved" | "stale" | "rejected"
    >("ready"),
    [credential, setCredential] = useState<string>(),
    [copied, setCopied] = useState(false),
    [copyFailed, setCopyFailed] = useState(false);
  const executing = useRef(false),
    ack = useRef<PersonalCalendarMutation>(undefined);
  const locked = busy || notice === "unknown" || notice === "saved-unread";
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  useBlocker({
    shouldBlockFn: () => executing.current || locked,
    enableBeforeUnload: locked,
    disabled: !locked,
  });
  function select(next: CalendarIntent) {
    if (locked || disabled) return;
    ack.current = undefined;
    setIntent(next);
    setReviewed(false);
    setNotice("ready");
    setCredential(undefined);
    setCopied(false);
    setCopyFailed(false);
  }
  async function reread() {
    const result = ack.current;
    if (!result) throw new Error("CALENDAR_ACK_REQUIRED");
    if (
      result.primary_id !== scope.accountId ||
      result.link.org_id !== scope.orgId ||
      !intent ||
      (intent.action !== "create" && result.link.id !== intent.link.id) ||
      (intent.action === "create" &&
        (result.link.kinds.length !== 1 || result.link.kinds[0] !== "lessons"))
    )
      throw new Error("CALENDAR_RESULT_MISMATCH");
    const next = await query.refetch({ throwOnError: true });
    const current = next.data?.links.find((row) => row.id === result.link.id);
    if (
      !current ||
      current.version < result.link.version ||
      current.state !== (intent.action === "revoke" ? "revoked" : "active")
    )
      throw new Error("CALENDAR_RESULT_UNREAD");
    if (current.version !== result.link.version) setCredential(undefined);
    setNotice("saved");
  }
  async function execute() {
    if (!intent || executing.current || (!reviewed && notice === "ready")) return;
    executing.current = true;
    setBusy(true);
    try {
      if (!ack.current) {
        if (notice === "ready" && intent.action !== "create") {
          const current = await readMemberCalendars(scope),
            row = current.links.find((row) => row.id === intent.link.id);
          if (!row || row.version !== intent.link.version || row.state !== "active") {
            setNotice("stale");
            await query.refetch();
            return;
          }
        }
        const result = await writeMemberCalendar(scope, intent);
        ack.current = result;
        setNotice("saved-unread");
        if (
          result.primary_id !== scope.accountId ||
          result.link.org_id !== scope.orgId ||
          (intent.action !== "create" && result.link.id !== intent.link.id)
        )
          throw new Error("CALENDAR_RESULT_MISMATCH");
        if ("subscription_url" in result && typeof result.subscription_url === "string")
          setCredential(calendarCredential(result.subscription_url));
      }
      await reread();
    } catch (error) {
      if (
        (error instanceof Error && ["ACCOUNT_CHANGED", "AUTH_REQUIRED"].includes(error.message)) ||
        (error instanceof BackendError && ["AUTH_REQUIRED", "SESSION_REVOKED"].includes(error.code))
      ) {
        setCredential(undefined);
        setNotice("rejected");
        void router.invalidate();
      } else if (ack.current) setNotice("saved-unread");
      else if (error instanceof BackendError && error.code === "VERSION_CONFLICT")
        setNotice("stale");
      else if (
        error instanceof BackendError &&
        !error.retryable &&
        error.code !== "TRANSPORT_ERROR"
      )
        setNotice("rejected");
      else setNotice("unknown");
    } finally {
      executing.current = false;
      setBusy(false);
    }
  }
  async function copyCredential() {
    if (!credential) return;
    try {
      await navigator.clipboard.writeText(credential);
      setCopied(true);
      setCopyFailed(false);
    } catch {
      setCopyFailed(true);
    }
  }
  const noticeMessage = {
    ready: "",
    unknown: t(($) => $.memberAccount.calendarNotices.unknown),
    "saved-unread": t(($) => $.memberAccount.calendarNotices["saved-unread"]),
    saved: t(($) => $.memberAccount.calendarNotices.saved),
    stale: t(($) => $.memberAccount.calendarNotices.stale),
    rejected: t(($) => $.memberAccount.calendarNotices.rejected),
  }[notice];
  const names = {
    create: t(($) => $.memberAccount.calendarCreate),
    rotate: t(($) => $.memberAccount.calendarRotate),
    revoke: t(($) => $.memberAccount.calendarRevoke),
  };
  return (
    <>
      {query.data && (
        <ItemGroup>
          {query.data.links.map((link) => (
            <Item role="listitem" key={link.id} size="xs">
              <ItemContent>
                <ItemTitle>
                  {t(($) => $.memberAccount.calendarTitle)}{" "}
                  <Badge variant={link.state === "active" ? "success" : "secondary"}>
                    {t(($) => $.memberAccount.calendarStates[link.state])}
                  </Badge>
                </ItemTitle>
                <ItemDescription>
                  {link.kinds
                    .map((kind) => t(($) => $.memberAccount.calendarKinds[kind]))
                    .join(" · ")}{" "}
                  ·{" "}
                  {new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(
                    new Date(link.created_at),
                  )}
                </ItemDescription>
              </ItemContent>
              {link.state === "active" && (
                <ItemActions className="flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    isDisabled={disabled || locked || query.isError || !query.data.ready}
                    onPress={() => select({ action: "rotate", link, key: uuidv7() })}
                  >
                    {names.rotate}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    isDisabled={disabled || locked || query.isError}
                    onPress={() => select({ action: "revoke", link, key: uuidv7() })}
                  >
                    {names.revoke}
                  </Button>
                </ItemActions>
              )}
            </Item>
          ))}
        </ItemGroup>
      )}
      <AccountCalendarView
        notice={
          <>
            {query.isPending && <p role="status">{t(($) => $.memberAccount.loading)}</p>}
            {query.isError && (
              <Alert variant="destructive">
                <AlertDescription>
                  {t(($) => $.memberAccount.calendarReadFailed)}{" "}
                  <Button
                    variant="outline"
                    size="sm"
                    isDisabled={locked}
                    onPress={() => void query.refetch()}
                  >
                    {t(($) => $.auth.retry)}
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            {query.data && !query.data.links.length && (
              <p>{t(($) => $.memberAccount.calendarEmpty)}</p>
            )}
            {query.data && !query.data.ready && (
              <p>{t(($) => $.memberAccount.calendarUnavailable)}</p>
            )}
          </>
        }
        actions={
          <Button
            isDisabled={
              disabled || locked || query.isError || !query.data?.ready || !query.data.lessons
            }
            onPress={() => select({ action: "create", key: uuidv7() })}
          >
            {names.create}
          </Button>
        }
      />
      <Sheet
        isOpen={Boolean(intent)}
        onOpenChange={(open) => {
          if (!open && !locked) {
            setIntent(undefined);
            setCredential(undefined);
          }
        }}
        isDismissable={!locked}
        isKeyboardDismissDisabled={locked}
      >
        <SheetHeader>
          <SheetTitle>{intent ? names[intent.action] : names.create}</SheetTitle>
          <SheetDescription>{t(($) => $.memberAccount.calendarConfirm)}</SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
          {notice === "ready" && (
            <Checkbox isSelected={reviewed} isDisabled={busy} onChange={setReviewed}>
              {t(($) => $.memberAccount.calendarReview)}
            </Checkbox>
          )}
          {notice !== "ready" && (
            <Alert
              variant={notice === "unknown" || notice === "rejected" ? "destructive" : "default"}
            >
              <AlertDescription>{noticeMessage}</AlertDescription>
            </Alert>
          )}
          {credential && (
            <AccountCalendarView
              credential={credential}
              actions={
                <Button
                  variant="outline"
                  isDisabled={busy}
                  onPress={() => {
                    void copyCredential();
                  }}
                >
                  {t(($) => $.memberAccount.calendarCopy)}
                </Button>
              }
              notice={
                copied ? (
                  <p role="status">{t(($) => $.memberAccount.copied)}</p>
                ) : copyFailed ? (
                  <p role="alert">{t(($) => $.memberAccount.copyFailed)}</p>
                ) : undefined
              }
            />
          )}
        </div>
        <SheetFooter className="flex-wrap">
          <Button
            variant="outline"
            isDisabled={locked}
            onPress={() => {
              setIntent(undefined);
              setCredential(undefined);
            }}
          >
            {t(($) => $.accountDeletion.close)}
          </Button>
          {(notice === "ready" || notice === "unknown" || notice === "saved-unread") && (
            <Button
              isDisabled={busy || (notice === "ready" && !reviewed)}
              variant={intent?.action === "revoke" ? "destructive" : "default"}
              onPress={() => void execute()}
            >
              {notice === "ready" && intent ? names[intent.action] : t(($) => $.auth.retry)}
            </Button>
          )}
        </SheetFooter>
      </Sheet>
    </>
  );
}
