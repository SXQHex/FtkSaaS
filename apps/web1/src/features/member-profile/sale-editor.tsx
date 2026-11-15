import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { MemberActionSheet, type MemberEffect } from "./member-action-sheet";
import { emptyMemberDraft, type MemberDraft } from "./member-draft";
import { previewSale, saleIntent, type SaleReview, type SaleResult } from "./sale";
import {
  saleProductDetail,
  saleProductConditions,
  type SaleProductNames,
} from "./sale-product-details";
import { readProfileCatalog } from "./profile-read";
import { useMemberCommand } from "./use-member-command";
import { writeSale, readSaleReceipt, readSaleResult } from "./sale";
import type { ClientScope } from "../../lib/scoped-backend";
import type { ProductView } from "../../lib/api-contracts/generated";
import { BackendError } from "../../lib/backend";
import { formatMinorAmount } from "../../lib/money";
import { Button } from "../../components/ui/button";
import { Alert, AlertDescription } from "../../components/ui/alert";
export function SaleEditor({
  scope,
  personId,
  personLabel,
  timezone,
  products,
  productNames,
  sourceAvailable,
  onClose,
  onRefresh,
  onCollect,
  onLockChange,
  onAccessLost,
}: {
  scope: ClientScope;
  personId: string;
  personLabel: string;
  timezone: string;
  products: ProductView[];
  productNames: SaleProductNames;
  sourceAvailable: boolean;
  onClose: () => void;
  onRefresh: (result: SaleResult) => Promise<void>;
  onCollect: (currency: string) => void;
  onLockChange: (locked: boolean) => void;
  onAccessLost: (error: unknown) => boolean;
}) {
  const { t } = useTranslation(),
    [draft, setDraft] = useState(emptyMemberDraft),
    [review, setReview] = useState<SaleReview>(),
    [preparing, setPreparing] = useState(false),
    [accepted, setAccepted] = useState(false),
    [error, setError] = useState<string>(),
    [errors, setErrors] = useState<Partial<Record<keyof MemberDraft, string>>>({});
  const mounted = useRef(true),
    executing = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const command = useMemberCommand({
    write: writeSale,
    readReceipt: readSaleReceipt,
    readResult: readSaleResult,
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
    setErrors({});
    setError(undefined);
    try {
      const catalog = await readProfileCatalog(scope);
      if (!mounted.current) return;
      const product = catalog.find((x) => x.version_id === draft.productVersionId);
      if (!product) {
        setErrors({ productVersionId: t(($) => $.memberProfile.saleErrors.productVersionId) });
        return;
      }
      const next = await previewSale(scope, personId, timezone, product, draft);
      if (mounted.current) {
        setReview(next);
        setAccepted(false);
      }
    } catch (failure) {
      if (!mounted.current) return;
      if (failure instanceof z.ZodError) {
        const fields: Partial<Record<keyof MemberDraft, string>> = {};
        for (const issue of failure.issues) {
          const field = issue.path[0];
          if (
            field === "productVersionId" ||
            field === "startDate" ||
            field === "endDate" ||
            field === "netMinor"
          )
            fields[field] = t(($) => $.memberProfile.saleErrors[field]);
        }
        setErrors(fields);
        setError(t(($) => $.memberProfile.saleInvalid));
      } else if (failure instanceof BackendError && failure.code === "FORBIDDEN")
        setError(t(($) => $.memberProfile.saleAuthorityUnavailable));
      else if (!onAccessLost(failure)) setError(t(($) => $.memberProfile.salePreviewError));
    } finally {
      executing.current = false;
      if (mounted.current) setPreparing(false);
    }
  }
  function apply() {
    if (!review || !accepted || !sourceAvailable || command.state !== "ready") return;
    try {
      void command.start(saleIntent(review));
    } catch {
      setReview(undefined);
      setAccepted(false);
      setError(t(($) => $.memberProfile.saleStale));
    }
  }
  const effects: MemberEffect[] = review
    ? [
        {
          id: "product",
          label: t(($) => $.memberProfile.product),
          value: review.product.terms.name,
        },
        {
          id: "conditions",
          label: t(($) => $.products.scopes),
          value: saleProductConditions(review.product, productNames, t),
        },
        {
          id: "dates",
          label: t(($) => $.memberProfile.saleDates),
          value: `${review.preview.sale.start_date} – ${review.preview.sale.end_date}`,
          detail: review.preview.sale.timezone,
        },
        ...(review.request.net_minor != null
          ? [
              {
                id: "list-price",
                label: t(($) => $.memberProfile.saleListPrice),
                value: formatMinorAmount(
                  review.product.terms.price_minor,
                  review.product.terms.currency,
                ),
              },
            ]
          : []),
        {
          id: "debt",
          label: t(($) => $.memberProfile.saleDebt),
          value: formatMinorAmount(review.preview.sale.debt_minor, review.preview.sale.currency),
        },
        ...(review.preview.sale.kind === "credits"
          ? (["granted", "available", "reserved", "consumed"] as const).map((key) => ({
              id: key,
              label: t(($) => $.memberProfile.saleCounts[key]),
              value: String(review.preview.sale[key]),
            }))
          : [
              {
                id: "timed",
                label: t(($) => $.memberProfile.saleTimed),
                value: review.preview.sale.quota
                  ? `${review.preview.sale.quota.limit} · ${t(($) => $.products[review.preview.sale.quota!.period])}`
                  : t(($) => $.memberProfile.saleUnlimited),
              },
            ]),
        ...review.preview.sale.deficits.map((row, index) => ({
          id: `deficit-${index}`,
          label: t(($) =>
            row.state === "consumed"
              ? $.memberProfile.saleConsumedDeficit
              : $.memberProfile.saleReservedDeficit,
          ),
          value: `${row.quantity} · ${t(($) => (row.settles ? $.memberProfile.saleSettles : $.memberProfile.saleUnsettled))}`,
        })),
        ...review.preview.effects.map((row, index) => ({
          id: `native-${index}`,
          label: t(($) => $.memberProfile.saleSourceEffect),
          value:
            row.amount_minor != null && row.currency
              ? formatMinorAmount(row.amount_minor, row.currency)
              : row.quantity != null
                ? String(row.quantity)
                : t(($) => $.memberProfile.saleSourceChanged),
        })),
      ]
    : [];
  const state = command.state,
    message =
      state === "writing"
        ? t(($) => $.memberProfile.saleWriting)
        : state === "saved"
          ? t(($) => $.memberProfile.saleSaved)
          : state === "saved-unread"
            ? t(($) => $.memberProfile.saleUnread)
            : state === "unknown"
              ? t(($) => $.finance.unknownWrite)
              : state === "pending"
                ? t(($) => $.finance.pending)
                : state === "stale"
                  ? t(($) => $.memberProfile.saleStale)
                  : state === "rejected"
                    ? t(($) => $.memberProfile.saleRejected)
                    : undefined;
  return (
    <MemberActionSheet
      action="allocate"
      personLabel={personLabel}
      sourceLabel=""
      draft={draft}
      products={products.map((row) => ({
        id: row.version_id,
        name: row.terms.name,
        detail: saleProductDetail(row, productNames, t),
      }))}
      disciplines={[]}
      reservations={[]}
      inventoryAvailable={false}
      stage={review ? "review" : "edit"}
      effects={effects}
      accepted={accepted}
      errors={errors}
      pending={command.locked}
      readOnly={preparing || !sourceAvailable || state === "saved"}
      notice={
        <>
          {preparing && <p role="status">{t(($) => $.memberProfile.salePreparing)}</p>}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {review && review.preview.blockers.length > 0 && (
            <Alert variant="destructive">
              <AlertDescription>
                <p>{t(($) => $.memberProfile.saleBlocked)}</p>
                {review.preview.blockers.map((blocker, index) => (
                  <p key={index}>
                    {t(($) =>
                      blocker.code === "DOCUMENT_REQUIRED"
                        ? $.memberProfile.saleDocumentRequired
                        : [
                              "PLAN_FEATURE_UNAVAILABLE",
                              "SUBSCRIPTION_RESTRICTED",
                              "BILLING_OPERATION_RESTRICTED",
                            ].includes(blocker.code)
                          ? $.finance.planRestricted
                          : $.finance.conditionsRejected,
                    )}
                  </p>
                ))}
              </AlertDescription>
            </Alert>
          )}
          {message && (
            <Alert>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}
          {["unknown", "pending", "saved-unread"].includes(state) && (
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
              {state === "unknown" && (
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
          {state === "saved" && review?.collectAfterSale && (
            <Button
              isDisabled={!sourceAvailable || command.busy}
              onPress={() => onCollect(review.preview.sale.currency)}
            >
              {t(($) => $.memberProfile.actions.collect)}
            </Button>
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
          setErrors({});
          setError(undefined);
        }
      }}
      onReview={
        sourceAvailable
          ? () => {
              void prepare();
            }
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
      onConfirm={
        review && !review.preview.blockers.length && state === "ready" && sourceAvailable
          ? apply
          : undefined
      }
      onAccepted={setAccepted}
    />
  );
}
