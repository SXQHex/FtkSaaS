import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { FinanceActionSheet, type FinanceDraft } from "./finance-action-sheet";
import {
  debtIntent,
  readDebtBase,
  type DebtIntent,
  type DebtBase,
  type DebtAction,
} from "./debt-command";
import { financeDraft, type FinanceSelection } from "./finance";
import { useFinanceCommand } from "./use-finance-command";
import type { ClientScope } from "../../lib/scoped-backend";
import { BackendError } from "../../lib/backend";
import { Button } from "@ftksaas/ui/components/button";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { formatMinorAmount } from "../../lib/money";

export function DebtEditor({
  scope,
  selection,
  id,
  action,
  debtLabel,
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
  action: DebtAction;
  debtLabel: string;
  personLabel: string;
  sourceAvailable: boolean;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onLockChange: (locked: boolean) => void;
  onAccessLost: (error: unknown) => boolean;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(() => ({ ...financeDraft(selection), debtId: id })),
    [review, setReview] = useState<{ intent: DebtIntent; base: DebtBase }>(),
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
    onRefresh: async () => {
      await onRefresh();
    },
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
      const base = await readDebtBase(scope, selection, id, action);
      const intent = debtIntent(base, draft);
      if (!mounted.current) return;
      setReview({ intent, base });
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
            field === "debtId" ||
            field === "direction" ||
            field === "reason"
          )
            next[field] = t(($) => $.finance.fieldErrors[field]);
        }
        setErrors(next);
        setError(t(($) => $.finance.invalid));
      } else if (failure instanceof Error && failure.message === "FINANCE_OFFSET_INSUFFICIENT") {
        setError(t(($) => $.finance.offsetInsufficient));
      } else if (failure instanceof BackendError && failure.code === "FORBIDDEN")
        setError(t(($) => $.finance.debtAuthorityUnavailable));
      else if (!onAccessLost(failure)) setError(t(($) => $.finance.debtReadError));
    } finally {
      executing.current = false;
      if (mounted.current) setPreparing(false);
    }
  }
  const status = command.state;
  const message =
    status === "writing"
      ? t(($) => $.finance.debtWriting)
      : status === "saved"
        ? t(($) => $.finance.debtSaved)
        : status === "saved-unread"
          ? t(($) => $.finance.debtUnread)
          : status === "unknown"
            ? t(($) => $.finance.unknownWrite)
            : status === "pending"
              ? t(($) => $.finance.pending)
              : status === "rejected" || status === "stale"
                ? t(($) => $.finance.debtRejected)
                : undefined;
  return (
    <FinanceActionSheet
      open
      action={action}
      sourceLabel={personLabel}
      draft={draft}
      people={[]}
      debts={[{ id, label: debtLabel }]}
      stage={review ? "review" : "edit"}
      effects={
        review
          ? [
              {
                id: "debt",
                label: t(($) => $.finance.currentDebt),
                detail: formatMinorAmount(review.base.debt.remaining_minor, selection.currency),
              },
              ...(action === "offset"
                ? [
                    {
                      id: "credit",
                      label: t(($) => $.finance.memberCredit),
                      detail: formatMinorAmount(review.base.available, selection.currency),
                    },
                  ]
                : []),
              {
                id: "change",
                label:
                  action === "offset"
                    ? t(($) => $.finance.applyOffset)
                    : t(($) =>
                        review.intent.operation === "debt_adjust_v1" &&
                        review.intent.request.direction === "increase"
                          ? $.finance.increase
                          : $.finance.decrease,
                      ),
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
          <p className="text-sm">{debtLabel}</p>
          <p className="text-sm text-muted-foreground">
            {t(($) => (action === "offset" ? $.finance.offsetHint : $.finance.debtAdjustHint))}
          </p>
          {preparing && <p role="status">{t(($) => $.finance.loading)}</p>}
          {review && review.intent.operation === "debt_adjust_v1" && (
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
