import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { BackendError } from "../../lib/backend";
import { MemberActionSheet, type MemberEffect } from "./member-action-sheet";
import { emptyMemberDraft, type MemberDraft } from "./member-draft";
import { previewFreeze, freezeIntent, type FreezeReview, type FreezeResult } from "./freeze";
import { useMemberCommand } from "./use-member-command";
import { writeFreeze, readFreezeReceipt, readFreezeResult } from "./freeze";
import type { ClientScope } from "../../lib/scoped-backend";
import { Button } from "@ftksaas/ui/components/button";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
export function FreezeEditor({
  scope,
  personId,
  personLabel,
  action,
  saleId,
  freezeId,
  sourceLabel,
  endDate,
  timezone,
  sourceAvailable,
  onClose,
  onRefresh,
  onLockChange,
  onAccessLost,
}: {
  scope: ClientScope;
  personId: string;
  personLabel: string;
  action: "freeze" | "unfreeze" | "cancelFreeze";
  saleId: string;
  freezeId?: string;
  sourceLabel: string;
  endDate: string;
  timezone: string;
  sourceAvailable: boolean;
  onClose: () => void;
  onRefresh: (result: FreezeResult) => Promise<void>;
  onLockChange: (value: boolean) => void;
  onAccessLost: (error: unknown) => boolean;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<MemberDraft>(() => ({
      ...emptyMemberDraft(),
      endDate,
    })),
    [review, setReview] = useState<FreezeReview>(),
    [preparing, setPreparing] = useState(false),
    [accepted, setAccepted] = useState(false),
    [error, setError] = useState<string>(),
    [errors, setErrors] = useState<Partial<Record<keyof MemberDraft, string>>>({});
  const mounted = useRef(true),
    command = useMemberCommand({
      write: writeFreeze,
      readReceipt: readFreezeReceipt,
      readResult: readFreezeResult,
      onRefresh,
      onAccessLost: (failure) =>
        !(failure instanceof BackendError && failure.code === "FORBIDDEN") && onAccessLost(failure),
    });
  const locked = preparing || command.locked;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  async function prepare() {
    if (!sourceAvailable || locked || command.state !== "ready") return;
    setPreparing(true);
    setErrors({});
    setError(undefined);
    try {
      const next = await previewFreeze(scope, personId, saleId, action, draft, freezeId);
      if (mounted.current) {
        setReview(next);
        setAccepted(false);
      }
    } catch (failure) {
      if (!mounted.current) return;
      if (failure instanceof z.ZodError) {
        const fields: Partial<Record<keyof MemberDraft, string>> = {};
        for (const issue of failure.issues) {
          const key = issue.path[0];
          if (key === "startDate" || key === "reason" || key === "endDate")
            fields[key] = t(($) => $.memberProfile.freezeErrors[key]);
        }
        setErrors(fields);
      } else if (
        (failure instanceof BackendError && failure.code === "FORBIDDEN") ||
        !onAccessLost(failure)
      )
        setError(
          t(($) =>
            failure instanceof Error && failure.message === "FREEZE_CANCEL_UNAVAILABLE"
              ? $.memberProfile.freezeCancelUnavailable
              : $.memberProfile.freezeReadError,
          ),
        );
    } finally {
      if (mounted.current) setPreparing(false);
    }
  }
  const stateMessage =
    command.state === "saved"
      ? t(($) => $.memberProfile.freezeSaved)
      : command.state === "saved-unread"
        ? t(($) => $.memberProfile.freezeUnread)
        : command.state === "unknown"
          ? t(($) => $.finance.unknownWrite)
          : command.state === "pending"
            ? t(($) => $.finance.pending)
            : command.state === "stale"
              ? t(($) => $.memberProfile.freezeStale)
              : command.state === "rejected"
                ? t(($) => $.memberProfile.freezeRejected)
                : undefined;
  const formatInstant = (value: string) =>
    new Intl.DateTimeFormat("tr-TR", {
      timeZone: timezone,
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  const effects: MemberEffect[] = review
    ? [
        { id: "source", label: t(($) => $.memberProfile.product), value: sourceLabel },
        {
          id: "dates",
          label: t(($) => $.memberProfile.freezePeriods),
          value:
            "dates" in review.request
              ? `${review.request.dates.start_date} – ${review.request.dates.end_date}`
              : "end_date" in review.request
                ? review.request.end_date
                : `${formatInstant(review.freeze!.starts_at)} – ${formatInstant(review.freeze!.planned_end)}`,
          detail: timezone,
        },
        {
          id: "validity",
          label: t(($) => $.memberProfile.freezeValidity),
          value: review.cancellation
            ? `${review.cancellation.previous_end_date} → ${review.cancellation.end_date}`
            : review.before.end_date,
          detail: review.cancellation
            ? t(($) => $.memberProfile.freezeCancelImpact, {
                days: review.cancellation.removed_extension_days,
                until: new Intl.DateTimeFormat("tr-TR", {
                  dateStyle: "short",
                  timeStyle: "short",
                  timeZone: timezone,
                }).format(new Date(review.cancellation.valid_until)),
              })
            : t(($) => $.memberProfile.freezeValidityHint),
        },
        { id: "reason", label: t(($) => $.memberProfile.reason), value: review.request.reason },
        {
          id: "protection",
          label: t(($) => $.memberProfile.negativeProtection),
          value: String(review.bindings.length),
          detail: t(($) => $.memberProfile.negativeProtectionHint),
        },
      ]
    : [];
  return (
    <MemberActionSheet
      action={action}
      personLabel={personLabel}
      sourceLabel={sourceLabel}
      draft={draft}
      products={[]}
      disciplines={[]}
      reservations={[]}
      inventoryAvailable={true}
      stage={review ? "review" : "edit"}
      effects={effects}
      accepted={accepted}
      errors={errors}
      pending={locked}
      readOnly={command.state === "saved" || command.unavailable}
      onDraft={(value) => {
        setDraft(value);
        setErrors({});
        setAccepted(false);
        setReview(undefined);
      }}
      onClose={() => {
        if (!locked) onClose();
      }}
      onReview={() => {
        void prepare();
      }}
      onBack={() => {
        if (!locked) {
          command.reset();
          setReview(undefined);
          setAccepted(false);
          setError(undefined);
        }
      }}
      onAccepted={setAccepted}
      onConfirm={
        review &&
        sourceAvailable &&
        accepted &&
        !review.preview.blockers.length &&
        command.state === "ready"
          ? () => {
              try {
                void command.start(freezeIntent(review));
              } catch {
                setError(t(($) => $.memberProfile.freezeStale));
                setAccepted(false);
              }
            }
          : undefined
      }
      notice={
        <>
          {(error || stateMessage) && (
            <Alert variant={error ? "destructive" : "default"}>
              <AlertDescription>{error ?? stateMessage}</AlertDescription>
            </Alert>
          )}
          {review?.preview.blockers.map((item, i) => (
            <Alert key={`${item.code}:${i}`} variant="destructive">
              <AlertDescription>{t(($) => $.memberProfile.negativeBlocked)}</AlertDescription>
            </Alert>
          ))}
          {preparing && <p role="status">{t(($) => $.memberProfile.freezeReading)}</p>}
          {["unknown", "pending", "saved-unread"].includes(command.state) && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                isDisabled={command.busy}
                onPress={() => {
                  void command.readReceipt();
                }}
              >
                {t(($) => $.finance.readResult)}
              </Button>
              {command.state === "unknown" && (
                <Button
                  variant="outline"
                  isDisabled={command.busy}
                  onPress={() => {
                    void command.retry();
                  }}
                >
                  {t(($) => $.finance.retrySame)}
                </Button>
              )}
            </div>
          )}
        </>
      }
    />
  );
}
