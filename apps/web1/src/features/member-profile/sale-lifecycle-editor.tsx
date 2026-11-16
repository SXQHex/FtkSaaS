import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import type { ClientScope } from "../../lib/scoped-backend";
import type {
  EntitlementView,
  ProductView,
  ManagementStateView,
} from "../../lib/api-contracts/generated";
import { formatMinorAmount } from "../../lib/money";
import { SaleEventCancellation } from "./sale-event-cancellation";
import { MemberActionSheet, type MemberEffect } from "./member-action-sheet";
import { emptyMemberDraft, type MemberDraft } from "./member-draft";
import { saleProductDetail, type SaleProductNames } from "./sale-product-details";
import { readProfileCatalog, readProfileRights } from "./profile-read";
import { useMemberCommand } from "./use-member-command";
import {
  readSaleInventory,
  sameSaleInventory,
  previewSaleLifecycle,
  saleLifecycleIntent,
  writeSaleLifecycle,
  readSaleLifecycleReceipt,
  readSaleLifecycleResult,
  type SaleLifecycleAction,
  type LifecycleReview,
} from "./sale-lifecycle";
import { Field, FieldLabel, FieldError } from "../../components/ui/field";
import { NativeSelect, NativeSelectOption } from "../../components/ui/native-select";
import { Button } from "../../components/ui/button";
import { Alert, AlertDescription } from "../../components/ui/alert";

export function SaleLifecycleEditor({
  scope,
  personId,
  personLabel,
  action,
  initialSaleId,
  sources,
  products,
  productNames,
  sourceAvailable,
  onClose,
  onLockChange,
  onAccessLost,
  onRefresh,
}: {
  scope: ClientScope;
  personId: string;
  personLabel: string;
  action: SaleLifecycleAction;
  initialSaleId?: string;
  sources: EntitlementView[];
  products: ProductView[];
  productNames: SaleProductNames;
  sourceAvailable: boolean;
  onClose: () => void;
  onLockChange: (value: boolean) => void;
  onAccessLost: (error: unknown) => boolean;
  onRefresh: (result: Awaited<ReturnType<typeof readSaleLifecycleResult>>) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [saleId, setSaleId] = useState(initialSaleId ?? ""),
    [draft, setDraft] = useState(emptyMemberDraft),
    [review, setReview] = useState<LifecycleReview>(),
    [accepted, setAccepted] = useState(false),
    [preparing, setPreparing] = useState(false),
    [eventLocked, setEventLocked] = useState(false),
    [eventTarget, setEventTarget] = useState<ManagementStateView>(),
    [error, setError] = useState(false),
    [errors, setErrors] = useState<Partial<Record<keyof MemberDraft, string>>>({}),
    [invalidSource, setInvalidSource] = useState(false);
  const sourceInput = useRef<HTMLSelectElement>(null),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const source = sources.find((row) => row.sale_id === saleId);
  const inventory = useQuery({
    queryKey: [
      "sale-lifecycle-inventory",
      scope.accountId,
      scope.orgId,
      scope.centerId,
      personId,
      saleId,
    ],
    queryFn: () => readSaleInventory(scope, saleId),
    enabled: action === "change" && Boolean(source) && sourceAvailable,
    retry: false,
  });
  useEffect(() => {
    if (inventory.error) onAccessLost(inventory.error);
  }, [inventory.error, onAccessLost]);
  const command = useMemberCommand({
    write: writeSaleLifecycle,
    readReceipt: readSaleLifecycleReceipt,
    readResult: readSaleLifecycleResult,
    onAccessLost,
    onRefresh,
  });
  const locked = preparing || command.locked || eventLocked;
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  async function prepare() {
    if (locked || !sourceAvailable || !["ready", "stale", "rejected"].includes(command.state))
      return;
    setError(false);
    setErrors({});
    if (!source) {
      setInvalidSource(true);
      sourceInput.current?.focus();
      return;
    }
    const shape =
      action === "terminate"
        ? z.object({ reason: z.string().trim().min(1) })
        : z.object({
            productVersionId: z.uuid(),
            startDate: z.iso.date(),
            endDate: z.iso.date(),
            ...(action === "change" ? { reason: z.string().trim().min(1) } : {}),
          });
    const parsed = shape.safeParse(draft);
    if (!parsed.success) {
      const next: Partial<Record<keyof MemberDraft, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof MemberDraft;
        next[key] = t(($) => $.memberProfile.lifecycle.required);
      }
      setErrors(next);
      return;
    }
    setPreparing(true);
    try {
      const [rights, catalog, currentInventory] = await Promise.all([
        readProfileRights(scope, personId),
        action === "terminate" ? Promise.resolve([]) : readProfileCatalog(scope),
        action === "change" ? readSaleInventory(scope, saleId) : Promise.resolve(undefined),
      ]);
      const current = rights.find((row) => row.sale_id === saleId);
      if (
        !current ||
        current.sale_version !== source.sale_version ||
        current.end_date !== source.end_date ||
        (action === "change" &&
          (!inventory.data ||
            inventory.isError ||
            !currentInventory ||
            !sameSaleInventory(currentInventory, inventory.data)))
      )
        throw new Error("SALE_LIFECYCLE_SOURCE_CHANGED");
      const next = await previewSaleLifecycle(
        scope,
        personId,
        current,
        action,
        draft,
        catalog.find((row) => row.version_id === draft.productVersionId),
        currentInventory,
      );
      if (mounted.current) {
        command.reset();
        setReview(next);
        setAccepted(false);
      }
    } catch (failure) {
      if (mounted.current && !onAccessLost(failure)) {
        setError(true);
        if (action === "change") void inventory.refetch();
      }
    } finally {
      if (mounted.current) setPreparing(false);
    }
  }
  const effects: MemberEffect[] = review
    ? [
        ...review.preview.effects.map((effect, index) => ({
          id: `native-${index}`,
          label: t(($) => $.memberProfile.lifecycle.effect),
          value:
            effect.amount_minor != null && effect.currency
              ? formatMinorAmount(effect.amount_minor, effect.currency)
              : t(($) => $.sessionDetail.effectActions[effect.action]),
          detail: effect.entity.id,
        })),
        ...(review.preview.sale_lifecycle
          ? [
              {
                id: "dates",
                label: t(($) => $.memberProfile.saleDates),
                value: `${review.preview.sale_lifecycle.start_date} – ${review.preview.sale_lifecycle.end_date}`,
              },
              {
                id: "gap",
                label: t(($) => $.memberProfile.lifecycle.gap),
                value: String(review.preview.sale_lifecycle.gap_days),
              },
              {
                id: "overlap",
                label: t(($) => $.memberProfile.lifecycle.overlap),
                value: String(review.preview.sale_lifecycle.overlap_days),
              },
              ...(review.preview.sale_lifecycle.refund
                ? [
                    {
                      id: "refund",
                      label: t(($) => $.memberProfile.lifecycle.debtReduction),
                      value: formatMinorAmount(
                        review.preview.sale_lifecycle.refund.debt_reduction_minor,
                        review.preview.sale_lifecycle.refund.currency,
                      ),
                    },
                    {
                      id: "credit",
                      label: t(($) => $.memberProfile.lifecycle.creditAdded),
                      value: formatMinorAmount(
                        review.preview.sale_lifecycle.refund.credit_added_minor,
                        review.preview.sale_lifecycle.refund.currency,
                      ),
                    },
                  ]
                : []),
            ]
          : []),
        {
          id: "expires",
          label: t(($) => $.memberProfile.lifecycle.expires),
          value: new Intl.DateTimeFormat("tr-TR", {
            dateStyle: "short",
            timeStyle: "short",
            timeZone: review.source.timezone,
          }).format(new Date(review.preview.expires_at)),
        },
      ]
    : [];
  const hasEvents = inventory.data?.items.some((row) => row.entity?.type === "event_registrations");
  return (
    <MemberActionSheet
      action={action}
      personLabel={personLabel}
      sourceLabel={
        source ? `${source.start_date} – ${source.end_date} · ${source.sale_id.slice(-8)}` : ""
      }
      draft={draft}
      onDraft={(value) => {
        if (!locked) {
          setDraft(value);
          setErrors({});
          setReview(undefined);
          setAccepted(false);
          command.reset();
        }
      }}
      sourceSelection={
        <Field data-invalid={invalidSource}>
          <FieldLabel htmlFor="lifecycle-sale">
            {t(($) => $.memberProfile.lifecycle.source)}
          </FieldLabel>
          <NativeSelect
            ref={sourceInput}
            id="lifecycle-sale"
            name="sourceSaleId"
            value={saleId}
            disabled={locked || Boolean(initialSaleId)}
            required
            aria-invalid={invalidSource}
            aria-describedby={invalidSource ? "lifecycle-source-error" : undefined}
            onChange={(event) => {
              setSaleId(event.target.value);
              setEventTarget(undefined);
              setDraft(emptyMemberDraft());
              setInvalidSource(false);
              setReview(undefined);
              setAccepted(false);
              command.reset();
            }}
          >
            <NativeSelectOption value="">{t(($) => $.memberProfile.choose)}</NativeSelectOption>
            {sources.map((row) => (
              <NativeSelectOption key={row.sale_id} value={row.sale_id}>
                {row.start_date} – {row.end_date} · {row.sale_id.slice(-8)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <FieldError id="lifecycle-source-error">
            {invalidSource ? t(($) => $.memberProfile.lifecycle.required) : undefined}
          </FieldError>
        </Field>
      }
      products={products.map((row) => ({
        id: row.version_id,
        name: row.terms.name,
        detail: saleProductDetail(row, productNames, t),
      }))}
      disciplines={[]}
      reservations={
        inventory.isError
          ? []
          : (inventory.data?.items
              .filter((row) => row.entity?.type === "reservations")
              .map((row) => ({
                id: row.entity!.id,
                label: row.sale_change_record!.starts_at,
                detail: `${row.sale_change_record!.parent.id} · ${row.entity!.id}`,
              })) ?? [])
      }
      inventoryAvailable={!inventory.isError && Boolean(inventory.data) && !hasEvents}
      stage={review ? "review" : "edit"}
      effects={effects}
      accepted={accepted}
      errors={errors}
      pending={command.locked || eventLocked}
      readOnly={preparing || !sourceAvailable || command.state === "saved"}
      onClose={() => {
        if (!locked) onClose();
      }}
      onReview={() => {
        void prepare();
      }}
      onBack={() => {
        if (!locked) {
          setReview(undefined);
          setAccepted(false);
          command.reset();
        }
      }}
      onAccepted={setAccepted}
      onConfirm={
        review &&
        accepted &&
        !review.preview.blockers.length &&
        !locked &&
        command.state === "ready"
          ? () => {
              try {
                void command.start(saleLifecycleIntent(review));
              } catch {
                setReview(undefined);
                setAccepted(false);
                setError(true);
              }
            }
          : undefined
      }
      notice={
        <>
          {(error || inventory.isError) && (
            <Alert variant="destructive">
              <AlertDescription>{t(($) => $.memberProfile.lifecycle.sourceError)}</AlertDescription>
            </Alert>
          )}
          {!inventory.isError &&
            inventory.data?.items
              .filter((row) => row.entity?.type === "event_registrations")
              .map((row) => (
                <Button
                  key={row.entity!.id}
                  variant="outline"
                  isDisabled={locked || !sourceAvailable}
                  onPress={() => setEventTarget(structuredClone(row))}
                >
                  {t(($) => $.memberProfile.lifecycle.eventCancellation)} ·{" "}
                  {row.sale_change_record!.starts_at}
                </Button>
              ))}
          {eventTarget && (
            <>
              <SaleEventCancellation
                key={eventTarget.entity!.id}
                scope={scope}
                row={eventTarget}
                disabled={preparing || command.locked || !sourceAvailable}
                onLockChange={setEventLocked}
                onAccessLost={onAccessLost}
                onRefresh={async () => {
                  const rows = await readProfileRights(scope, personId);
                  await onRefresh({ rows, finance: undefined });
                }}
              />
              <Button
                variant="outline"
                isDisabled={locked}
                onPress={() => setEventTarget(undefined)}
              >
                {t(($) => $.memberProfile.close)}
              </Button>
            </>
          )}
          {hasEvents && (
            <Alert>
              <AlertDescription>{t(($) => $.memberProfile.lifecycle.eventsBlock)}</AlertDescription>
            </Alert>
          )}
          {review?.preview.blockers.length ? (
            <Alert variant="destructive">
              <AlertDescription>
                {t(($) => $.memberProfile.saleBlocked)}
                {review.preview.blockers.map((row, index) => (
                  <p key={index}>
                    {row.code === "DOCUMENT_REQUIRED"
                      ? t(($) => $.memberProfile.saleDocumentRequired)
                      : t(($) => $.finance.conditionsRejected)}
                  </p>
                ))}
              </AlertDescription>
            </Alert>
          ) : null}
          {command.state !== "ready" && (
            <p role="status">{t(($) => $.memberProfile.lifecycle.states[command.state])}</p>
          )}
          {["unknown", "pending", "saved-unread"].includes(command.state) && (
            <Button
              variant="outline"
              isDisabled={command.busy}
              onPress={() => {
                void command.readReceipt();
              }}
            >
              {t(($) => $.finance.readResult)}
            </Button>
          )}
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
          {action === "change" && (
            <Button
              variant="outline"
              isDisabled={locked || inventory.isFetching}
              onPress={() => {
                setDraft((value) => ({ ...value, reservations: {} }));
                setEventTarget(undefined);
                setReview(undefined);
                setAccepted(false);
                void inventory.refetch();
              }}
            >
              {t(($) => $.memberProfile.lifecycle.readInventory)}
            </Button>
          )}
          <p className="text-sm text-muted-foreground">
            {t(($) => $.memberProfile.lifecycle.note)}
          </p>
        </>
      }
    />
  );
}
