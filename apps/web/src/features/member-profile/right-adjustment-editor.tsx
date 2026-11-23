import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { BackendError } from "../../lib/backend";
import { MemberActionSheet, type MemberEffect } from "./member-action-sheet";
import { emptyMemberDraft, type MemberDraft } from "./member-draft";
import {
  previewRightAdjustment,
  rightAdjustmentIntent,
  type RightReview,
  type RightAdjustmentResult,
} from "./right-adjustment";
import { useMemberCommand } from "./use-member-command";
import {
  writeRightAdjustment,
  readRightAdjustmentReceipt,
  readRightAdjustmentResult,
} from "./right-adjustment";
import type { ClientScope } from "../../lib/scoped-backend";
import { Button } from "@ftksaas/ui/components/button";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
export function RightAdjustmentEditor({
  scope,
  personId,
  personLabel,
  action,
  saleId,
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
  action: "adjust" | "extend";
  saleId: string;
  sourceLabel: string;
  endDate: string;
  timezone: string;
  sourceAvailable: boolean;
  onClose: () => void;
  onRefresh: (result: RightAdjustmentResult, assertCurrent: () => void) => Promise<void>;
  onLockChange: (value: boolean) => void;
  onAccessLost: (error: unknown) => boolean;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<MemberDraft>(() => ({
      ...emptyMemberDraft(),
      endDate,
    })),
    [review, setReview] = useState<RightReview>(),
    [preparing, setPreparing] = useState(false),
    [accepted, setAccepted] = useState(false),
    [error, setError] = useState<string>(),
    [errors, setErrors] = useState<Partial<Record<keyof MemberDraft, string>>>({});
  const mounted = useRef(true),
    command = useMemberCommand({
      write: writeRightAdjustment,
      readReceipt: readRightAdjustmentReceipt,
      readResult: readRightAdjustmentResult,
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
      const next = await previewRightAdjustment(scope, personId, saleId, action, draft);
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
          if (key === "quantity" || key === "reason" || key === "endDate")
            fields[key] = t(($) => $.memberProfile.rightErrors[key]);
        }
        setErrors(fields);
      } else if (
        (failure instanceof BackendError && failure.code === "FORBIDDEN") ||
        !onAccessLost(failure)
      )
        setError(t(($) => $.memberProfile.rightReadError));
    } finally {
      if (mounted.current) setPreparing(false);
    }
  }
  const stateMessage =
    command.state === "saved"
      ? t(($) => $.memberProfile.rightSaved)
      : command.state === "saved-unread"
        ? t(($) => $.memberProfile.rightUnread)
        : command.state === "unknown"
          ? t(($) => $.finance.unknownWrite)
          : command.state === "pending"
            ? t(($) => $.finance.pending)
            : command.state === "stale"
              ? t(($) => $.memberProfile.rightStale)
              : command.state === "rejected"
                ? t(($) => $.memberProfile.rightRejected)
                : undefined;
  const effects: MemberEffect[] = review
    ? [
        { id: "source", label: t(($) => $.memberProfile.product), value: sourceLabel },
        ...(review.change.kind === "credit_adjust"
          ? [
              {
                id: "quantity",
                label: t(($) =>
                  review.change.kind === "credit_adjust" && review.change.direction === "increase"
                    ? $.memberProfile.addCredit
                    : $.memberProfile.removeCredit,
                ),
                value: String(review.change.quantity),
              },
            ]
          : [
              {
                id: "end",
                label: t(($) => $.memberProfile.fields.endDate),
                value: review.change.end_date,
                detail: `${review.before.start_date} – ${review.before.end_date} · ${review.before.timezone}`,
              },
            ]),
        { id: "reason", label: t(($) => $.memberProfile.reason), value: review.reason },
        {
          id: "protection",
          label: t(($) => $.memberProfile.negativeProtection),
          value: String(review.affected.length),
          detail: t(($) => $.memberProfile.negativeProtectionHint),
        },
        ...review.affected.map((x) => ({
          id: x.id,
          label: t(($) => $.memberProfile.negativeProtectedReservation),
          value: new Intl.DateTimeFormat("tr-TR", {
            timeZone: timezone,
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(x.startsAt)),
        })),
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
        !review.preview.preview.blockers.length &&
        command.state === "ready"
          ? () => {
              void command.start(rightAdjustmentIntent(review));
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
          {review?.preview.preview.blockers.map((item, i) => (
            <Alert key={`${item.code}:${i}`} variant="destructive">
              <AlertDescription>{t(($) => $.memberProfile.negativeBlocked)}</AlertDescription>
            </Alert>
          ))}
          {preparing && <p role="status">{t(($) => $.memberProfile.rightReading)}</p>}
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
