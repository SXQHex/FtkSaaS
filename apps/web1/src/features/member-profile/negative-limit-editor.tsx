import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { BackendError } from "../../lib/backend";
import { MemberActionSheet, type MemberEffect } from "./member-action-sheet";
import { emptyMemberDraft, type MemberDraft } from "./member-draft";
import {
  previewNegativeLimit,
  negativeLimitIntent,
  type NegativeLimitReview,
  type NegativeLimitResult,
} from "./negative-limit";
import { useNegativeLimitCommand } from "./use-negative-limit-command";
import type { ClientScope } from "../../lib/scoped-backend";
import { Button } from "../../components/ui/button";
import { Alert, AlertDescription } from "../../components/ui/alert";
export function NegativeLimitEditor({
  scope,
  personId,
  personLabel,
  discipline,
  initialLimit,
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
  discipline: { id: string; name: string };
  initialLimit: number | null;
  timezone: string;
  sourceAvailable: boolean;
  onClose: () => void;
  onRefresh: (result: NegativeLimitResult) => Promise<void>;
  onLockChange: (value: boolean) => void;
  onAccessLost: (error: unknown) => boolean;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<MemberDraft>(() => ({
      ...emptyMemberDraft(),
      disciplineId: discipline.id,
      quantity: initialLimit === null ? "" : String(initialLimit),
    })),
    [review, setReview] = useState<NegativeLimitReview>(),
    [preparing, setPreparing] = useState(false),
    [accepted, setAccepted] = useState(false),
    [error, setError] = useState<string>(),
    [errors, setErrors] = useState<Partial<Record<keyof MemberDraft, string>>>({});
  const mounted = useRef(true),
    command = useNegativeLimitCommand({
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
      if (draft.disciplineId !== discipline.id)
        throw new Error("PROFILE_NEGATIVE_SOURCE_UNAVAILABLE");
      const next = await previewNegativeLimit(scope, personId, draft);
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
          if (key === "quantity" || key === "reason" || key === "disciplineId")
            fields[key] = t(($) => $.memberProfile.negativeErrors[key]);
        }
        setErrors(fields);
      } else if (
        (failure instanceof BackendError && failure.code === "FORBIDDEN") ||
        !onAccessLost(failure)
      )
        setError(
          t(($) =>
            failure instanceof Error && failure.message === "PERSONAL_LIMIT_DISABLED"
              ? $.memberProfile.personalLimitDisabled
              : $.memberProfile.negativeReadError,
          ),
        );
    } finally {
      if (mounted.current) setPreparing(false);
    }
  }
  const stateMessage =
    command.state === "saved"
      ? t(($) => $.memberProfile.negativeSaved)
      : command.state === "saved-unread"
        ? t(($) => $.memberProfile.negativeUnread)
        : command.state === "unknown"
          ? t(($) => $.finance.unknownWrite)
          : command.state === "pending"
            ? t(($) => $.finance.pending)
            : command.state === "stale"
              ? t(($) => $.memberProfile.negativeStale)
              : command.state === "rejected"
                ? t(($) => $.memberProfile.negativeRejected)
                : undefined;
  const effects: MemberEffect[] = review
    ? [
        {
          id: "discipline",
          label: t(($) => $.memberProfile.fields.disciplineId),
          value: discipline.name,
        },
        {
          id: "limit",
          label: t(($) => $.memberProfile.limitLabel),
          value: String(review.value.quantity),
          detail: t(($) => $.memberProfile.negativeBefore, {
            value: review.before.effective_limit ?? t(($) => $.memberProfile.unknown),
          }),
        },
        { id: "reason", label: t(($) => $.memberProfile.reason), value: review.value.reason },
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
      action="negative"
      personLabel={personLabel}
      sourceLabel={discipline.name}
      draft={draft}
      products={[]}
      disciplines={[discipline]}
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
              void command.start(negativeLimitIntent(review));
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
          {preparing && <p role="status">{t(($) => $.memberProfile.negativeReading)}</p>}
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
