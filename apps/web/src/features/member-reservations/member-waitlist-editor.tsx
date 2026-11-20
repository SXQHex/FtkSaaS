import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { ClientScope } from "../../lib/scoped-backend";
import { MemberClassSheet } from "../member-classes/member-class-sheet";
import { MemberDocumentsPanel } from "../member-documents/member-documents-panel";
import { readBookingRights } from "../session-detail/session-booking";
import { ownWaitlistIntent, type OwnWaitlistRow } from "./member-waitlist";
import {
  writeWaitlist,
  readWaitlistReceipt,
  readWaitlistResult,
  type WaitlistAction,
} from "../session-detail/session-waitlist";
import { useMemberCommand } from "../member-profile/use-member-command";
import { EventCommandNotice } from "../events/event-command-notice";
import { Checkbox } from "@ftksaas/ui/components/checkbox";
import { Field, FieldLabel, FieldDescription } from "@ftksaas/ui/components/field";
import { RadioGroup, RadioGroupItem } from "@ftksaas/ui/components/radio-group";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { Button } from "@ftksaas/ui/components/button";
export function MemberWaitlistEditor({
  scope,
  personId,
  before,
  action,
  onClose,
  onSaved,
  onLockChange,
  onAccessLost,
}: {
  scope: ClientScope;
  personId: string;
  before: OwnWaitlistRow;
  action: Exclude<WaitlistAction, "join">;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onLockChange: (value: boolean) => void;
  onAccessLost: (cause: unknown) => boolean;
}) {
  const { t } = useTranslation();
  const [reviewed, setReviewed] = useState(false),
    [saleId, setSaleId] = useState(""),
    [busy, setBusy] = useState(false),
    [documentsLocked, setDocumentsLocked] = useState(false),
    [error, setError] = useState(false);
  const executing = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const command = useMemberCommand({
    write: writeWaitlist,
    readReceipt: readWaitlistReceipt,
    readResult: readWaitlistResult,
    onRefresh: async () => {
      await onSaved();
      if (action === "accept") {
        const result = await rights.refetch();
        if (result.isError) throw Error("MEMBER_WAITLIST_RIGHTS_UNAVAILABLE");
      }
    },
    onAccessLost,
  });
  const locked = busy || documentsLocked || command.locked,
    readOnly = locked || command.state !== "ready";
  useEffect(() => {
    onLockChange(locked);
  }, [locked, onLockChange]);
  const rights = useQuery({
    queryKey: [
      "member-offer-doc-rights",
      scope.accountId,
      scope.orgId,
      scope.centerId,
      personId,
      before.session.id,
    ],
    queryFn: () => readBookingRights(scope, personId, before.session.id, "flexible"),
    enabled: action === "accept",
    retry: false,
  });
  useEffect(() => {
    if (rights.error) onAccessLost(rights.error);
  }, [rights.error, onAccessLost]);
  const documentLock = useCallback((value: boolean) => setDocumentsLocked(value), []),
    accepted = useCallback(() => setReviewed(false), []);
  const sources = rights.isError
    ? []
    : (rights.data?.filter((r) => r.state === "active" && r.booking_mode === "flexible") ?? []);
  const productVersion = sources.find((r) => r.sale_id === saleId)?.product_version_id;
  async function submit() {
    if (executing.current || readOnly || !reviewed) return;
    executing.current = true;
    setBusy(true);
    setError(false);
    try {
      const intent = await ownWaitlistIntent(scope, before, action, reviewed);
      if (mounted.current) await command.start(intent);
    } catch (cause) {
      if (mounted.current && !onAccessLost(cause)) {
        setReviewed(false);
        setError(true);
      }
    } finally {
      executing.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const label = t(($) => $.memberClasses[action]);
  return (
    <MemberClassSheet
      open
      onOpenChange={(open) => {
        if (!open && !locked) onClose();
      }}
      title={label}
      description={before.session.title}
      locked={locked}
      action={{
        label,
        disabled: readOnly || !reviewed,
        onPress: () => {
          void submit();
        },
      }}
    >
      <EventCommandNotice
        command={command}
        onReload={() => {
          command.reset();
          setReviewed(false);
          setError(false);
        }}
      />
      {error && (
        <Alert variant="destructive">
          <AlertDescription role="alert">
            {t(($) => $.memberReservations.waitlistChanged)}
          </AlertDescription>
        </Alert>
      )}
      {before.offer && (
        <p>
          {t(($) => $.memberClasses.offerExpires, {
            time: new Intl.DateTimeFormat("tr-TR", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: before.session.timezone,
            }).format(new Date(before.offer.expires_at)),
          })}
        </p>
      )}
      {action === "accept" && (
        <>
          <Field>
            <FieldLabel>{t(($) => $.memberDocuments.chooseContext)}</FieldLabel>
            <FieldDescription>{t(($) => $.memberDocuments.offerContext)}</FieldDescription>
            <RadioGroup
              aria-label={t(($) => $.memberDocuments.chooseContext)}
              value={saleId}
              isDisabled={readOnly || rights.isFetching}
              onChange={(value) => {
                setSaleId(value);
                setReviewed(false);
              }}
            >
              {sources.map((row) => (
                <RadioGroupItem key={row.sale_id} value={row.sale_id}>
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
                </RadioGroupItem>
              ))}
            </RadioGroup>
          </Field>
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
          <MemberDocumentsPanel
            key={saleId}
            binding={{
              scope,
              personId,
              context: {
                gate: "reservation",
                subject: { type: "sessions", id: before.session.id },
                ...(productVersion ? { product_version_id: productVersion } : {}),
              },
            }}
            disabled={busy || command.state !== "ready"}
            onLockChange={documentLock}
            onAccessLost={onAccessLost}
            onAccepted={accepted}
          />
        </>
      )}
      <Field orientation="horizontal">
        <Checkbox
          id="own-waitlist-review"
          isSelected={reviewed}
          isDisabled={readOnly}
          onChange={setReviewed}
        />
        <FieldLabel htmlFor="own-waitlist-review">{t(($) => $.memberClasses.review)}</FieldLabel>
      </Field>
    </MemberClassSheet>
  );
}
