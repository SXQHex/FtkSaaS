import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BackendError } from "../../lib/backend";
import type { ClientScope } from "../../lib/scoped-backend";
import { FinanceActionSheet } from "./finance-action-sheet";
import { financeDraft } from "./finance";
import {
  previewSaleRefund,
  saleRefundIntent,
  writeSaleRefund,
  readSaleRefundReceipt,
  readSaleRefundResult,
  type SaleRefundReview,
  type SaleRefundSource,
  type SaleRefundResult,
} from "./sale-refund";
import { useMemberCommand } from "../member-profile/use-member-command";
import { Button } from "@ftksaas/ui/components/button";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { formatMinorAmount } from "../../lib/money";
export function SaleRefundEditor({
  scope,
  source,
  sourceAvailable,
  onClose,
  onRefresh,
  onLockChange,
  onAccessLost,
}: {
  scope: ClientScope;
  source: SaleRefundSource;
  sourceAvailable: boolean;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onLockChange: (locked: boolean) => void;
  onAccessLost: (error: unknown) => boolean;
}) {
  const { t } = useTranslation(),
    mounted = useRef(true);
  const [draft, setDraft] = useState(() =>
      financeDraft({ personId: source.personId, currency: source.currency }),
    ),
    [review, setReview] = useState<SaleRefundReview>(),
    [preparing, setPreparing] = useState(false),
    [accepted, setAccepted] = useState(false),
    [error, setError] = useState<string>(),
    [invalid, setInvalid] = useState(false),
    [result, setResult] = useState<SaleRefundResult>();
  const command = useMemberCommand({
    write: writeSaleRefund,
    readReceipt: readSaleRefundReceipt,
    readResult: readSaleRefundResult,
    onRefresh: async (value) => {
      await onRefresh();
      if (mounted.current) setResult(value);
    },
    onAccessLost,
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
    if (locked || !sourceAvailable || command.state !== "ready") return;
    if (!draft.reason.trim()) {
      setInvalid(true);
      return;
    }
    setPreparing(true);
    setError(undefined);
    try {
      const next = await previewSaleRefund(scope, source, draft.reason);
      if (mounted.current) {
        setReview(next);
        setAccepted(false);
      }
    } catch (failure) {
      if (mounted.current && !onAccessLost(failure))
        setError(
          t(($) =>
            failure instanceof BackendError && failure.code === "FORBIDDEN"
              ? $.finance.saleRefundDenied
              : $.finance.saleRefundError,
          ),
        );
    } finally {
      if (mounted.current) setPreparing(false);
    }
  }
  const status = command.state,
    message =
      status === "saved"
        ? t(($) => $.finance.saleRefundSaved)
        : status === "saved-unread"
          ? t(($) => $.finance.saleRefundUnread)
          : status === "unknown"
            ? t(($) => $.finance.unknownWrite)
            : status === "pending"
              ? t(($) => $.finance.pending)
              : status === "stale"
                ? t(($) => $.finance.previewStale)
                : status === "rejected"
                  ? t(($) => $.finance.conditionsRejected)
                  : undefined;
  return (
    <FinanceActionSheet
      open
      action="sale-refund"
      sourceLabel={source.label}
      draft={draft}
      people={[]}
      debts={[]}
      effects={
        review?.preview.effects.map((effect, index) => ({
          id: String(index),
          label: t(($) => $.finance.saleRefundReduction),
          detail: formatMinorAmount(effect.amount_minor!, effect.currency!),
        })) ?? []
      }
      stage={review ? "review" : "edit"}
      accepted={accepted}
      pending={locked}
      readOnly={!sourceAvailable || status === "saved" || command.unavailable}
      pinnedSelection
      errors={invalid ? { reason: t(($) => $.finance.reasonRequired) } : {}}
      onClose={() => {
        if (!locked) onClose();
      }}
      onDraft={(value) => {
        setDraft(value);
        setInvalid(false);
        setReview(undefined);
        setAccepted(false);
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
          setResult(undefined);
        }
      }}
      onAccepted={setAccepted}
      onConfirm={
        review &&
        accepted &&
        !locked &&
        sourceAvailable &&
        status === "ready" &&
        !review.preview.blockers.length
          ? () => {
              try {
                void command.start(saleRefundIntent(review));
              } catch {
                setError(t(($) => $.finance.previewStale));
                setAccepted(false);
              }
            }
          : undefined
      }
      notice={
        <>
          <p className="text-sm text-muted-foreground">{t(($) => $.finance.saleRefundHint)}</p>
          {review && (
            <p>
              {t(($) => $.finance.reason)}: {review.reason}
            </p>
          )}
          {review && review.preview.blockers.length > 0 && (
            <Alert variant="destructive">
              <AlertDescription>{t(($) => $.finance.conditionsRejected)}</AlertDescription>
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
          {result && (
            <p>
              {t(($) => $.finance.openDebt)}:{" "}
              {formatMinorAmount(
                result.finance.debts
                  .reduce((sum, row) => sum + BigInt(row.remaining_minor), 0n)
                  .toString(),
                source.currency,
              )}{" "}
              · {t(($) => $.finance.memberCredit)}:{" "}
              {formatMinorAmount(result.finance.credit_available_minor, source.currency)}
              {!result.rights && ` · ${t(($) => $.finance.saleRefundRightsRestricted)}`}
            </p>
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
    />
  );
}
