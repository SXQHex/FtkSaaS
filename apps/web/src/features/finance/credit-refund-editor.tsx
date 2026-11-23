import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { FinanceActionSheet, type FinanceDraft } from "./finance-action-sheet";
import {
  creditRefundIntent,
  readCreditRefundSource,
  type CreditRefundIntent,
} from "./credit-refund";
import { financeDraft, type FinanceSelection } from "./finance";
import { useFinanceCommand, type FinanceReadback } from "./use-finance-command";
import type { ClientScope } from "../../lib/scoped-backend";
import { BackendError } from "../../lib/backend";
import { Button } from "@ftksaas/ui/components/button";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { formatMinorAmount } from "../../lib/money";

export function CreditRefundEditor({
  scope,
  selection,
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
  timezone: string;
  personLabel: string;
  sourceAvailable: boolean;
  onClose: () => void;
  onRefresh: FinanceReadback;
  onLockChange: (locked: boolean) => void;
  onAccessLost: (error: unknown) => boolean;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(() => financeDraft(selection)),
    [review, setReview] = useState<{ intent: CreditRefundIntent; available: string }>(),
    [preparing, setPreparing] = useState(false),
    [accepted, setAccepted] = useState(false),
    [error, setError] = useState<string>(),
    [errors, setErrors] = useState<Partial<Record<keyof FinanceDraft, string>>>({});
  const mounted = useRef(true),
    executing = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const command = useFinanceCommand({
    onAccessLost,
    onRefresh,
  });
  const locked = preparing || command.locked;
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  async function prepare() {
    if (executing.current || command.locked || !sourceAvailable) return;
    executing.current = true;
    setPreparing(true);
    setError(undefined);
    setErrors({});
    try {
      const intent = await creditRefundIntent(scope, selection, timezone, draft);
      const source = await readCreditRefundSource(scope, selection);
      if (!mounted.current) return;
      if (BigInt(intent.request.amount_minor) > BigInt(source.credit_available_minor)) {
        setError(t(($) => $.finance.creditRefundInsufficient));
        return;
      }
      setReview({ intent, available: source.credit_available_minor });
      setAccepted(false);
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
            field === "reason"
          )
            next[field] = t(($) => $.finance.fieldErrors[field]);
        }
        setErrors(next);
        setError(t(($) => $.finance.invalid));
      } else if (failure instanceof Error && failure.message === "FINANCE_TIME_INVALID") {
        setErrors({ occurredAt: t(($) => $.finance.fieldErrors.occurredAt) });
        setError(t(($) => $.finance.invalid));
      } else if (failure instanceof BackendError && failure.code === "FORBIDDEN")
        setError(t(($) => $.finance.creditRefundAuthorityUnavailable));
      else if (!onAccessLost(failure)) setError(t(($) => $.finance.creditRefundReadError));
    } finally {
      executing.current = false;
      if (mounted.current) setPreparing(false);
    }
  }
  const status = command.state;
  const message =
    status === "writing"
      ? t(($) => $.finance.creditRefundWriting)
      : status === "saved"
        ? t(($) => $.finance.creditRefundSaved)
        : status === "saved-unread"
          ? t(($) => $.finance.creditRefundUnread)
          : status === "unknown"
            ? t(($) => $.finance.unknownWrite)
            : status === "pending"
              ? t(($) => $.finance.pending)
              : status === "rejected" || status === "stale"
                ? t(($) => $.finance.creditRefundRejected)
                : undefined;
  return (
    <FinanceActionSheet
      open
      action="credit-refund"
      sourceLabel={personLabel}
      draft={draft}
      people={[]}
      debts={[]}
      stage={review ? "review" : "edit"}
      effects={
        review
          ? [
              {
                id: "available",
                label: t(($) => $.finance.memberCredit),
                detail: formatMinorAmount(review.available, selection.currency),
              },
              {
                id: "refund",
                label: t(($) => $.finance.recordRefund),
                detail: formatMinorAmount(review.intent.request.amount_minor, selection.currency),
              },
            ]
          : []
      }
      accepted={accepted}
      errors={errors}
      pending={command.locked}
      readOnly={preparing || !sourceAvailable || status === "saved"}
      pinnedSelection
      notice={
        <>
          <p className="text-sm text-muted-foreground">
            {t(($) => $.finance.timezone, { timezone })}
          </p>
          <p className="text-sm text-muted-foreground">{t(($) => $.finance.creditRefundHint)}</p>
          {preparing && <p role="status">{t(($) => $.finance.loading)}</p>}
          {review && (
            <p>
              {t(($) => $.finance.reason)}: {review.intent.request.reason}
            </p>
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
        if (locked) return;
        setDraft(value);
        setReview(undefined);
        setAccepted(false);
        setError(undefined);
        setErrors({});
      }}
      onReview={
        sourceAvailable
          ? () => {
              void prepare();
            }
          : undefined
      }
      onConfirm={
        review && sourceAvailable && status === "ready"
          ? () => {
              if (accepted) void command.start(review.intent);
            }
          : undefined
      }
      onBack={() => {
        if (locked) return;
        command.reset();
        setReview(undefined);
        setAccepted(false);
        setError(undefined);
      }}
      onAccepted={setAccepted}
    />
  );
}
