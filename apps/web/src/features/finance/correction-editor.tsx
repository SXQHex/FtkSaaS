import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { FinanceActionSheet, type FinanceDraft } from "./finance-action-sheet";
import {
  readCorrectionBase,
  previewCorrection,
  correctionIntent,
  type CorrectionBase,
  type CorrectionReview,
} from "./correction";
import { financeDraft, type FinanceSelection } from "./finance";
import { useFinanceCommand, type FinanceReadback } from "./use-finance-command";
import type { ClientScope } from "../../lib/scoped-backend";
import { BackendError } from "../../lib/backend";
import { Button } from "@ftksaas/ui/components/button";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { formatMinorAmount } from "../../lib/money";
export function CorrectionEditor({
  scope,
  selection,
  id,
  timezone,
  personLabel,
  sourceAvailable,
  onClose,
  onRefresh,
  onLockChange,
  onAccessLost,
}: {
  scope: ClientScope;
  selection: FinanceSelection;
  id: string;
  timezone: string;
  personLabel: string;
  sourceAvailable: boolean;
  onClose: () => void;
  onRefresh: FinanceReadback;
  onLockChange: (locked: boolean) => void;
  onAccessLost: (error: unknown) => boolean;
}) {
  const { t } = useTranslation();
  const [base, setBase] = useState<CorrectionBase>(),
    [draft, setDraft] = useState(() => financeDraft(selection)),
    [review, setReview] = useState<CorrectionReview>(),
    [reading, setReading] = useState(true),
    [preparing, setPreparing] = useState(false),
    [accepted, setAccepted] = useState(false),
    [error, setError] = useState<string>(),
    [errors, setErrors] = useState<Partial<Record<keyof FinanceDraft, string>>>({});
  const mounted = useRef(true);
  const sourceFailure = useEffectEvent((failure: unknown) => {
    if (failure instanceof BackendError && failure.code === "FORBIDDEN")
      setError(t(($) => $.finance.authorityUnavailable));
    else if (!onAccessLost(failure)) setError(t(($) => $.finance.sourceError));
  });
  const command = useFinanceCommand({
    onAccessLost,
    onRefresh,
  });
  const locked = reading || preparing || command.locked;
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  const { accountId, orgId, centerId } = scope,
    { personId, currency } = selection;
  useEffect(() => {
    mounted.current = true;
    let active = true;
    void readCorrectionBase({ accountId, orgId, centerId }, { personId, currency }, id)
      .then((value) => {
        if (!active) return;
        setBase(value);
        setDraft({
          ...financeDraft(value.selection),
          method: value.movement.payment?.method ?? "",
        });
      })
      .catch((failure) => {
        if (!active) return;
        sourceFailure(failure);
      })
      .finally(() => {
        if (active) setReading(false);
      });
    return () => {
      active = false;
      mounted.current = false;
    };
  }, [accountId, orgId, centerId, personId, currency, id]);
  async function prepare() {
    if (!base || locked || !sourceAvailable) return;
    setPreparing(true);
    setError(undefined);
    setErrors({});
    try {
      const current = await readCorrectionBase(scope, selection, id);
      const next = await previewCorrection(current, timezone, draft);
      if (mounted.current) {
        setBase(current);
        setReview(next);
        setAccepted(false);
      }
    } catch (failure) {
      if (!mounted.current) return;
      if (failure instanceof z.ZodError) {
        const next: Partial<Record<keyof FinanceDraft, string>> = {};
        for (const issue of failure.issues) {
          const field = issue.path[0];
          if (
            field === "amount" ||
            field === "currency" ||
            field === "personId" ||
            field === "occurredAt" ||
            field === "reason" ||
            field === "direction"
          )
            next[field] = t(($) => $.finance.fieldErrors[field]);
        }
        setErrors(next);
        setError(t(($) => $.finance.invalid));
      } else if (failure instanceof Error && failure.message === "FINANCE_TIME_INVALID") {
        setErrors({ occurredAt: t(($) => $.finance.fieldErrors.occurredAt) });
        setError(t(($) => $.finance.invalid));
      } else if (failure instanceof BackendError && failure.code === "FORBIDDEN")
        setError(t(($) => $.finance.authorityUnavailable));
      else if (!onAccessLost(failure)) setError(t(($) => $.finance.previewError));
    } finally {
      if (mounted.current) setPreparing(false);
    }
  }
  function apply() {
    if (!review || !accepted || !sourceAvailable || command.state !== "ready") return;
    try {
      const intent = correctionIntent(review);
      void command.start(intent);
    } catch {
      setReview(undefined);
      setAccepted(false);
      setError(t(($) => $.finance.previewStale));
    }
  }
  const blockerMessage = (code: string) =>
    code === "INSUFFICIENT_STUDENT_CREDIT"
      ? t(($) => $.finance.creditInsufficient)
      : code === "CURRENCY_MISMATCH"
        ? t(($) => $.finance.currencyMismatch)
        : ["PLAN_FEATURE_UNAVAILABLE", "BILLING_OPERATION_RESTRICTED"].includes(code)
          ? t(($) => $.finance.planRestricted)
          : t(($) => $.finance.conditionsRejected);
  const status = command.state,
    message =
      status === "writing"
        ? t(($) => $.finance.correctionWriting)
        : status === "saved"
          ? t(($) => $.finance.correctionSaved)
          : status === "saved-unread"
            ? t(($) => $.finance.correctionUnread)
            : status === "unknown"
              ? t(($) => $.finance.unknownWrite)
              : status === "pending"
                ? t(($) => $.finance.pending)
                : status === "stale"
                  ? t(($) => $.finance.previewStale)
                  : status === "rejected"
                    ? t(($) => $.finance.correctionRejected)
                    : undefined;
  return (
    <FinanceActionSheet
      open
      action="correct"
      sourceLabel={personLabel}
      draft={draft}
      people={[]}
      debts={[]}
      effects={
        review
          ? review.preview.effects.map((effect, index) => ({
              id: String(index),
              label:
                effect.entity.type === "cash_movements"
                  ? t(($) =>
                      review.correction.direction === "increase"
                        ? $.finance.increase
                        : $.finance.decrease,
                    )
                  : effect.entity.type === "people"
                    ? t(($) => $.finance.memberCredit)
                    : t(($) =>
                        effect.action === "reverse"
                          ? $.finance.reverseAllocation
                          : $.finance.allocateCorrection,
                      ),
              detail: formatMinorAmount(effect.amount_minor!, effect.currency!),
            }))
          : []
      }
      stage={review ? "review" : "edit"}
      accepted={accepted}
      errors={errors}
      pending={command.locked}
      readOnly={reading || preparing || !base || !sourceAvailable || status === "saved"}
      pinnedSelection
      notice={
        <>
          <p className="text-sm text-muted-foreground">
            {t(($) => $.finance.timezone, { timezone })}
          </p>
          <p className="text-sm text-muted-foreground">{t(($) => $.finance.methodImmutable)}</p>
          {reading && <p role="status">{t(($) => $.finance.loading)}</p>}
          {base && (
            <p className="text-sm">
              {t(($) => $.finance.originalCollection)}:{" "}
              {formatMinorAmount(base.movement.amount_minor, base.movement.currency)}
            </p>
          )}
          {review && (
            <>
              <p>{t(($) => $.finance.linkedCorrectionHint)}</p>
              <p>
                {t(($) => $.finance.reason)}: {review.reason}
              </p>
            </>
          )}
          {review && review.preview.blockers.length > 0 && (
            <Alert variant="destructive">
              <AlertDescription>
                <p>{t(($) => $.finance.previewBlocked)}</p>
                {review.preview.blockers.map((blocker, index) => (
                  <p key={index}>{blockerMessage(blocker.code)}</p>
                ))}
              </AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {message && (
            <Alert>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}
          {["unknown", "pending", "saved-unread"].includes(status) && (
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
              {status === "unknown" && (
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
      onClose={() => {
        if (!command.locked) onClose();
      }}
      onDraft={(value) => {
        if (!locked) {
          setDraft(value);
          setReview(undefined);
          setAccepted(false);
          setError(undefined);
          setErrors({});
        }
      }}
      onReview={
        base && sourceAvailable
          ? () => {
              void prepare();
            }
          : undefined
      }
      onConfirm={
        review && !review.preview.blockers.length && status === "ready" && sourceAvailable
          ? apply
          : undefined
      }
      onBack={() => {
        if (!locked) {
          command.reset();
          setReview(undefined);
          setAccepted(false);
          setError(undefined);
        }
      }}
      onAccepted={setAccepted}
    />
  );
}
