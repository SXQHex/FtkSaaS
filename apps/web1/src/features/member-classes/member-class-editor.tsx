import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { ClientScope } from "../../lib/scoped-backend";
import type { MemberClass } from "./member-classes-read";
import type { SessionBookingDraft } from "../session-detail/session-detail-panels";
import { readBookingRights } from "../session-detail/session-booking";
import { useMemberCommand } from "../member-profile/use-member-command";
import { EventCommandNotice } from "../events/event-command-notice";
import { BackendError } from "../../lib/backend";
import { scheduleBackendError } from "../schedule/schedule-presentation";
import {
  memberClassIntent,
  writeMemberClass,
  readMemberClassReceipt,
  readMemberClassResult,
  type ClassAction,
} from "./member-class-command";
import { MemberClassSheet } from "./member-class-sheet";
import { Button } from "../../components/ui/button";
import { Field, FieldGroup, FieldLabel, FieldDescription } from "../../components/ui/field";
import { NativeSelect, NativeSelectOption } from "../../components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "../../components/ui/radio-group";
import { Checkbox } from "../../components/ui/checkbox";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { MemberCancellationPolicy } from "./member-cancellation-policy";
import { MemberDocumentsPanel } from "../member-documents/member-documents-panel";
export function MemberClassEditor({
  scope,
  personId,
  before,
  action,
  timezone,
  onSaved,
  onClose,
  onLockChange,
  onAccessLost,
}: {
  scope: ClientScope;
  personId: string;
  before: MemberClass;
  action: ClassAction;
  timezone: string;
  onSaved: () => Promise<void>;
  onClose: () => void;
  onLockChange: (locked: boolean) => void;
  onAccessLost: (cause: unknown) => boolean;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<SessionBookingDraft>({
      query: "",
      personId,
      saleId: "",
      mode: action === "accept" ? "flexible" : "priority",
      category: "",
      override: false,
      reason: "",
      reviewed: false,
    }),
    [preparing, setPreparing] = useState(false),
    [documentsLocked, setDocumentsLocked] = useState(false),
    [error, setError] = useState<string>();
  const executing = useRef(false),
    mounted = useRef(true),
    alert = useRef<HTMLDivElement>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const command = useMemberCommand({
    write: writeMemberClass,
    readReceipt: readMemberClassReceipt,
    readResult: readMemberClassResult,
    onRefresh: onSaved,
    onAccessLost,
  });
  const documentLock = useCallback((value: boolean) => setDocumentsLocked(value), []);
  const acceptedDocument = useCallback(
    () => setDraft((value) => ({ ...value, reviewed: false })),
    [],
  );
  const locked = preparing || command.locked || documentsLocked,
    readOnly = locked || command.state !== "ready";
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  useEffect(() => {
    if (error) alert.current?.focus();
  }, [error]);
  const rights = useQuery({
    queryKey: [
      "member-class-rights",
      scope.accountId,
      scope.orgId,
      scope.centerId,
      personId,
      before.id,
      draft.mode,
    ],
    queryFn: () => readBookingRights(scope, personId, before.id, draft.mode),
    enabled: action === "book" || action === "accept",
    retry: false,
  });
  useEffect(() => {
    if (rights.error) onAccessLost(rights.error);
  }, [rights.error, onAccessLost]);
  const joining =
    action === "join" ||
    (action === "book" &&
      !!draft.category &&
      before.capacity.category_remaining?.[draft.category] === 0);
  const targetAction = joining ? "join" : action;
  const label =
    targetAction === "book"
      ? t(($) => $.memberClasses.confirm)
      : t(($) => $.memberClasses[targetAction]);
  const categoryNeeded = Boolean(before.capacity.categories);
  const unavailable = joining && !before.member_lesson.waitlist_enabled;
  async function submit(chosen: ClassAction = targetAction) {
    if (executing.current || readOnly || unavailable) return;
    if (
      !draft.reviewed ||
      (categoryNeeded && !draft.category && (chosen === "book" || chosen === "join")) ||
      (chosen === "book" && !draft.saleId)
    ) {
      setError(t(($) => $.memberClasses.invalid));
      return;
    }
    executing.current = true;
    setPreparing(true);
    setError(undefined);
    try {
      const intent = await memberClassIntent(scope, personId, before, chosen, draft);
      if (mounted.current) await command.start(intent);
    } catch (cause) {
      if (mounted.current && !onAccessLost(cause))
        setError(
          cause instanceof BackendError
            ? scheduleBackendError(cause.code, t)
            : t(($) => $.memberClasses.invalid),
        );
    } finally {
      executing.current = false;
      if (mounted.current) setPreparing(false);
    }
  }
  const date = new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  });
  const sources = rights.isError
    ? []
    : (rights.data?.filter((row) => row.state === "active" && row.booking_mode === draft.mode) ??
      []);
  return (
    <MemberClassSheet
      open
      title={
        action === "book"
          ? t(($) => $.memberClasses.book)
          : action === "accept"
            ? t(($) => $.memberClasses.offer)
            : t(($) => $.memberClasses[action])
      }
      description={`${before.title} · ${date.format(new Date(before.starts_at))}`}
      locked={locked}
      onOpenChange={(open) => {
        if (!open && !locked) onClose();
      }}
      action={{
        label,
        disabled:
          readOnly ||
          unavailable ||
          (!joining && action === "book" && (rights.isFetching || rights.isError)),
        onPress: () => {
          void submit();
        },
      }}
    >
      <EventCommandNotice command={command} onReload={onClose} />
      <FieldGroup>
        {(action === "book" || action === "accept") && (
          <>
            {action === "book" && (
              <Field>
                <FieldLabel htmlFor="member-class-mode">
                  {t(($) => $.memberClasses.chooseMode)}
                </FieldLabel>
                <NativeSelect
                  id="member-class-mode"
                  value={draft.mode}
                  disabled={readOnly}
                  onChange={(e) => {
                    const mode = e.target.value;
                    if (mode === "priority" || mode === "flexible")
                      setDraft({ ...draft, mode, saleId: "", reviewed: false });
                  }}
                >
                  <NativeSelectOption value="priority">
                    {t(($) => $.memberClasses.modes.priority)}
                  </NativeSelectOption>
                  <NativeSelectOption value="flexible">
                    {t(($) => $.memberClasses.modes.flexible)}
                  </NativeSelectOption>
                </NativeSelect>
              </Field>
            )}
            {!joining && (
              <Field>
                <FieldLabel id="member-class-rights">
                  {action === "accept"
                    ? t(($) => $.memberDocuments.chooseContext)
                    : t(($) => $.memberClasses.chooseRight)}
                </FieldLabel>
                {action === "accept" && (
                  <FieldDescription>{t(($) => $.memberDocuments.offerContext)}</FieldDescription>
                )}
                <RadioGroup
                  aria-labelledby="member-class-rights"
                  value={draft.saleId}
                  isDisabled={readOnly || rights.isFetching}
                  onChange={(saleId) => setDraft({ ...draft, saleId, reviewed: false })}
                >
                  {sources.map((row) => (
                    <RadioGroupItem
                      key={row.sale_id}
                      value={row.sale_id}
                      className="h-auto w-full items-center gap-3 rounded-md border p-3"
                    >
                      <span>
                        {t(($) => $.memberClasses.rightLabel, {
                          start: row.start_date,
                          end: row.end_date,
                          amount:
                            row.kind === "timed"
                              ? t(($) => $.memberClasses.timed)
                              : t(($) => $.memberClasses.credits, {
                                  count: row.available_at_session ?? row.available,
                                }),
                        })}
                      </span>
                    </RadioGroupItem>
                  ))}
                </RadioGroup>
                {!rights.isFetching && !sources.length && (
                  <FieldDescription>{t(($) => $.memberClasses.noRights)}</FieldDescription>
                )}
              </Field>
            )}
            {rights.isError && (
              <Button
                variant="outline"
                isDisabled={readOnly}
                onPress={() => {
                  void rights.refetch();
                }}
              >
                {t(($) => $.memberClasses.readRights)}
              </Button>
            )}
          </>
        )}
        {(action === "book" || action === "join") && categoryNeeded && (
          <Field>
            <FieldLabel htmlFor="member-class-category">
              {t(($) => $.memberClasses.category)}
            </FieldLabel>
            <NativeSelect
              id="member-class-category"
              value={draft.category}
              disabled={readOnly}
              onChange={(e) => {
                const category = e.target.value;
                if (category === "" || category === "male" || category === "female")
                  setDraft({ ...draft, category, reviewed: false });
              }}
            >
              <NativeSelectOption value="">{t(($) => $.memberClasses.choose)}</NativeSelectOption>
              {(["male", "female"] as const).map((category) => (
                <NativeSelectOption key={category} value={category}>
                  {t(($) => $.memberClasses.categories[category])}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        )}
        {((action === "book" && !joining && draft.saleId) || action === "accept") && (
          <MemberDocumentsPanel
            key={`${draft.mode}:${draft.saleId}`}
            binding={{
              scope,
              personId,
              context: {
                gate: "reservation",
                subject: { type: "sessions", id: before.id },
                ...(sources.find((row) => row.sale_id === draft.saleId)?.product_version_id
                  ? {
                      product_version_id: sources.find((row) => row.sale_id === draft.saleId)!
                        .product_version_id,
                    }
                  : {}),
              },
            }}
            disabled={preparing || command.state !== "ready"}
            onLockChange={documentLock}
            onAccepted={acceptedDocument}
            onAccessLost={onAccessLost}
          />
        )}
        <MemberCancellationPolicy
          value={
            before.member_lesson.own_reservation?.cancellation ?? before.member_lesson.cancellation
          }
          timezone={timezone}
        />
        {joining && <p>{t(($) => $.memberClasses.waitlistHint)}</p>}
        {unavailable && <p>{t(($) => $.memberClasses.waitlistOff)}</p>}
        {action === "accept" && before.member_lesson.own_waitlist?.offer && (
          <p>
            {t(($) => $.memberClasses.offerExpires, {
              time: date.format(new Date(before.member_lesson.own_waitlist.offer.expires_at)),
            })}
          </p>
        )}
        <FieldDescription>{t(($) => $.memberClasses.noOverride)}</FieldDescription>
        <Field orientation="horizontal">
          <Checkbox
            id="member-class-review"
            isSelected={draft.reviewed}
            isDisabled={readOnly}
            onChange={(reviewed) => setDraft({ ...draft, reviewed })}
          />
          <FieldLabel htmlFor="member-class-review">{t(($) => $.memberClasses.review)}</FieldLabel>
        </Field>
      </FieldGroup>
      {action === "accept" && (
        <Button
          variant="outline"
          isDisabled={readOnly}
          onPress={() => {
            void submit("reject");
          }}
        >
          {t(($) => $.memberClasses.reject)}
        </Button>
      )}
      {error && (
        <Alert ref={alert} tabIndex={-1} variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </MemberClassSheet>
  );
}
