import { financeKeys, invalidateFinanceViews } from "./finance-query";
import { useWorkspaceQuery } from "../workspace/workspace-query";
import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { FinanceView, type FinanceTab, type FinanceMovementRow } from "./finance-view";
import { DebtEditor } from "./debt-editor";
import type { DebtAction } from "./debt-command";
import { CreditRefundEditor } from "./credit-refund-editor";
import { CorrectionEditor } from "./correction-editor";
import { FinanceActionSheet } from "./finance-action-sheet";
import { PreparationPicker } from "../settings/preparation-picker";
import {
  readFinancePage,
  readCollectionAuthority,
  collectionIntent,
  financeDraft,
  type FinanceSelection,
  type CollectionIntent,
} from "./finance";
import { useFinanceCommand } from "./use-finance-command";
import type { ClientScope } from "../../lib/scoped-backend";

import { readPeoplePage } from "../people/people";
import { BackendError } from "../../lib/backend";
import { formatMinorAmount } from "../../lib/money";
import { Button } from "@ftksaas/ui/components/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@ftksaas/ui/components/card";
import { Field, FieldGroup, FieldLabel, FieldError } from "@ftksaas/ui/components/field";
import { Input } from "@ftksaas/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@ftksaas/ui/components/native-select";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";

export interface FinanceInitialContext {
  selection?: FinanceSelection;
  label: string;
  action?: "collect" | "correct" | "credit-refund" | "offset" | "adjust";
  entityId?: string;
}
export function FinanceContent({
  scope,
  onLockChange,
  preservePending = false,
  initialContext,
  onDirectoryReadback,
}: {
  scope: ClientScope;
  onLockChange: (locked: boolean) => void;
  preservePending?: boolean;
  initialContext?: FinanceInitialContext;
  onDirectoryReadback?: () => Promise<void>;
}) {
  const { t } = useTranslation(),
    router = useRouter(),
    queries = useQueryClient();
  const [tab, setTab] = useState<FinanceTab>("movements"),
    [selection, setSelection] = useState<FinanceSelection | undefined>(initialContext?.selection),
    [draftSelection, setDraftSelection] = useState<FinanceSelection>(
      initialContext?.selection ?? {
        personId: "",
        currency: "",
      },
    ),
    [search, setSearch] = useState(""),
    [personCursors, setPersonCursors] = useState<(string | undefined)[]>([undefined]),
    [personPage, setPersonPage] = useState(0),
    [cursors, setCursors] = useState<(string | undefined)[]>([undefined]),
    [pageIndex, setPageIndex] = useState(0),
    [collect, setCollect] = useState(initialContext?.action === "collect"),
    [correctionId, setCorrectionId] = useState<string | undefined>(
      initialContext?.action === "correct" ? initialContext.entityId : undefined,
    ),
    [creditRefund, setCreditRefund] = useState(initialContext?.action === "credit-refund"),
    [debtAction, setDebtAction] = useState<
      { id: string; action: DebtAction; label: string } | undefined
    >(
      initialContext?.entityId &&
        (initialContext.action === "offset" || initialContext.action === "adjust")
        ? {
            id: initialContext.entityId,
            action: initialContext.action,
            label: initialContext.label,
          }
        : undefined,
    ),
    [locked, setLocked] = useState(false),
    [invalid, setInvalid] = useState(false);
  const workspace = useWorkspaceQuery(scope.accountId, scope.orgId, false);
  const current =
      (!workspace.isError || preservePending) && workspace.data?.selected?.id === scope.orgId
        ? workspace.data
        : undefined,
    center = current?.centers.find((row) => row.id === scope.centerId && row.accessible);
  const people = useQuery({
    queryKey: [
      "finance-people",
      scope.accountId,
      scope.orgId,
      scope.centerId,
      search,
      personCursors[personPage],
    ],
    queryFn: ({ signal, client }) =>
      readPeoplePage(scope, search, personCursors[personPage], undefined, false, signal, {
        client,
        signal,
      }),
    enabled: Boolean(center) && !locked,
    retry: false,
  });
  const selfContext = current?.selected?.self_context;
  const selfId = selfContext?.centers.some(
    (row) => row.center_id === scope.centerId && (row.student || row.instructor || row.assistant),
  )
    ? selfContext.person_id
    : undefined;
  const visiblePeople = people.isError ? [] : (people.data?.items ?? []);
  const knownPeople = [
    ...(initialContext?.selection
      ? [{ id: initialContext.selection.personId, display_name: initialContext.label }]
      : []),
    ...(selfId && selfId !== initialContext?.selection?.personId
      ? [{ id: selfId, display_name: t(($) => $.finance.self) }]
      : []),
  ].filter((row) => !visiblePeople.some((person) => person.id === row.id));
  const selectedPerson = [...visiblePeople, ...knownPeople].find(
    (row) => row.id === draftSelection.personId,
  );
  const [personLabel, setPersonLabel] = useState(initialContext?.label ?? "");
  const finance = useQuery({
    queryKey: [
      "finance",
      scope.accountId,
      scope.orgId,
      scope.centerId,
      selection?.personId,
      selection?.currency,
      cursors[pageIndex],
    ],
    queryFn: ({ signal, client }) =>
      readFinancePage(scope, selection!, cursors[pageIndex], signal, { client, signal }),
    enabled: Boolean(center && selection),
    retry: false,
  });
  const authority = useQuery({
    queryKey: [
      "finance-collect-authority",
      scope.accountId,
      scope.orgId,
      scope.centerId,
      selection?.personId,
    ],
    queryFn: (readContext) => readCollectionAuthority(scope, selection!.personId, readContext),
    enabled: Boolean(center && selection),
    retry: false,
  });
  const source =
    Boolean(center) &&
    !finance.isError &&
    finance.data &&
    finance.data.person_id === selection?.personId &&
    finance.data.currency === selection?.currency
      ? finance.data
      : undefined;
  const accessLost = useCallback(
    (error: unknown) => {
      if (
        (error instanceof BackendError &&
          ["AUTH_REQUIRED", "SESSION_REVOKED", "FORBIDDEN"].includes(error.code)) ||
        (error instanceof Error && ["AUTH_REQUIRED", "ACCOUNT_CHANGED"].includes(error.message))
      ) {
        void router.invalidate();
        return true;
      }
      return false;
    },
    [router],
  );
  useEffect(() => {
    if (finance.error) accessLost(finance.error);
  }, [finance.error, accessLost]);
  const changeLock = useCallback(
    (value: boolean) => {
      setLocked(value);
      onLockChange(value);
    },
    [onLockChange],
  );
  async function refreshFinance() {
    if (!selection) throw new Error("FINANCE_SELECTION_UNAVAILABLE");
    await invalidateFinanceViews(queries, scope, selection.personId, selection.currency);
    // All existing movement cursors predate this write. Refresh only the
    // selected person's first page and never replay an old continuation.
    await queries.fetchQuery({
      queryKey: [...financeKeys.person(scope, selection.personId, selection.currency), undefined],
      queryFn: ({ signal }) => readFinancePage(scope, selection, undefined, signal),
      staleTime: 0,
      retry: false,
    });
    await onDirectoryReadback?.();
    setCursors([undefined]);
    setPageIndex(0);
  }
  const formatDate = (value: string) =>
    new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: center?.timezone,
    }).format(new Date(value));
  const movementRows: FinanceMovementRow[] = source
    ? source.movements.items.map((row) => ({
        id: row.id,
        date: formatDate(row.occurred_at),
        person: personLabel,
        kind: t(($) => $.finance.movementKinds[row.kind]),
        detail: row.payment
          ? `${t(($) => (row.payment!.method === "cash" ? $.finance.cash : row.payment!.method === "card_pos" ? $.finance.card : $.finance.bank))}${row.payment.reference ? ` · ${row.payment.reference}` : ""}`
          : t(($) => $.finance.unknown),
        amount: formatMinorAmount(row.amount_minor, row.currency),
        actions:
          row.kind === "collection" && !workspace.isError && !locked
            ? [{ kind: "correct" as const, onPress: () => setCorrectionId(row.id) }]
            : [],
      }))
    : [];
  const context = (
    <Card className="mx-4 mt-4 sm:mx-6 sm:mt-6">
      <CardHeader>
        <CardTitle>{t(($) => $.finance.scopeTitle)}</CardTitle>
        <CardDescription>{t(($) => $.finance.contextHint)}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          method="post"
          aria-label={t(($) => $.finance.context)}
          onSubmit={(event) => {
            event.preventDefault();
            if (locked) return;
            if (!selectedPerson || !/^[A-Z]{3}$/.test(draftSelection.currency)) {
              setInvalid(true);
              return;
            }
            setPersonLabel(selectedPerson.display_name);
            setSelection({ ...draftSelection });
            setCursors([undefined]);
            setPageIndex(0);
            setInvalid(false);
          }}
        >
          <FieldGroup className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_8rem_auto] lg:items-end">
            <Field>
              <FieldLabel htmlFor="finance-person-search">
                {t(($) => $.finance.personSearch)}
              </FieldLabel>
              <Input
                id="finance-person-search"
                name="personSearch"
                value={search}
                disabled={locked}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPersonCursors([undefined]);
                  setPersonPage(0);
                  setDraftSelection((old) => ({ ...old, personId: "" }));
                }}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="finance-selected-person">
                {t(($) => $.finance.member)}
              </FieldLabel>
              <NativeSelect
                id="finance-selected-person"
                name="selectedPerson"
                value={draftSelection.personId}
                disabled={locked || ((people.isFetching || people.isError) && !knownPeople.length)}
                required
                onChange={(event) =>
                  setDraftSelection((old) => ({ ...old, personId: event.target.value }))
                }
              >
                <NativeSelectOption value="">{t(($) => $.finance.choose)}</NativeSelectOption>
                {[...visiblePeople, ...knownPeople].map((row) => (
                  <NativeSelectOption key={row.id} value={row.id}>
                    {row.display_name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="finance-selected-currency">
                {t(($) => $.finance.currency)}
              </FieldLabel>
              <Input
                id="finance-selected-currency"
                name="selectedCurrency"
                value={draftSelection.currency}
                pattern="[A-Z]{3}"
                maxLength={3}
                required
                autoComplete="off"
                disabled={locked}
                onChange={(event) => {
                  setDraftSelection((old) => ({ ...old, currency: event.target.value }));
                  setInvalid(false);
                }}
              />
            </Field>
            <Button type="submit" isDisabled={locked || people.isFetching}>
              {t(($) => $.finance.read)}
            </Button>
          </FieldGroup>
          {invalid && <FieldError>{t(($) => $.finance.invalid)}</FieldError>}
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            isDisabled={locked || personPage === 0 || people.isFetching}
            onPress={() => setPersonPage((index) => index - 1)}
          >
            {t(($) => $.finance.previousPeople)}
          </Button>
          <Button
            size="sm"
            variant="outline"
            isDisabled={locked || !people.data?.next_cursor || people.isFetching || people.isError}
            onPress={() => {
              const next = people.data?.next_cursor;
              if (next) {
                setPersonCursors((old) => [...old.slice(0, personPage + 1), next]);
                setPersonPage((index) => index + 1);
              }
            }}
          >
            {t(($) => $.finance.nextPeople)}
          </Button>
          {people.isError && (
            <Button
              variant="outline"
              size="sm"
              onPress={() => {
                void people.refetch();
              }}
            >
              {t(($) => $.finance.retry)}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
  return (
    <>
      {context}
      <FinanceView
        tab={tab}
        onTab={setTab}
        summary={{
          periodLabel: t(($) => $.finance.selectedScope),
          sales: null,
          collections: null,
          debt: null,
          credit: null,
          debtCount: null,
          creditCount: null,
        }}
        movements={movementRows}
        debts={
          source
            ? source.debts.map((row) => ({
                id: row.id,
                person: personLabel,
                lastSale: null,
                amount: formatMinorAmount(row.remaining_minor, source.currency),
                actions:
                  !workspace.isError && !locked
                    ? (["offset", "adjust"] as const).map((action) => ({
                        kind: action,
                        onPress: () =>
                          setDebtAction({
                            id: row.id,
                            action,
                            label: `${personLabel} · ${formatDate(row.due_at)}`,
                          }),
                      }))
                    : [],
              }))
            : []
        }
        credits={
          source
            ? [
                {
                  id: source.person_id,
                  person: personLabel,
                  amount: formatMinorAmount(source.credit_available_minor, source.currency),
                  debt: formatMinorAmount(
                    source.debts
                      .reduce((sum, row) => sum + BigInt(row.remaining_minor), 0n)
                      .toString(),
                    source.currency,
                  ),
                  actions:
                    !workspace.isError && !locked && BigInt(source.credit_available_minor) > 0n
                      ? [{ kind: "credit-refund" as const, onPress: () => setCreditRefund(true) }]
                      : [],
                },
              ]
            : []
        }
        state={finance.isError ? "error" : selection && finance.isPending ? "loading" : "ready"}
        search=""
        filter="all"
        method=""
        counts={{
          movements: t(($) => $.finance.count, { count: movementRows.length }),
          debts: t(($) => $.finance.count, { count: source?.debts.length ?? 0 }),
          credits: source
            ? t(($) => $.finance.personContext, { currency: source.currency })
            : t(($) => $.finance.readRequired),
        }}
        onCollect={
          source &&
          center &&
          authority.data === true &&
          !authority.isError &&
          !finance.isError &&
          !workspace.isError
            ? () => setCollect(true)
            : undefined
        }
        notice={
          <Alert>
            <AlertDescription>
              {selection ? t(($) => $.finance.sourceScope) : t(($) => $.finance.readRequired)}
              <p className="mt-1">{t(($) => $.finance.unavailable)}</p>
              {selection && (authority.data === false || authority.isError) && (
                <p className="mt-1">{t(($) => $.finance.authorityUnavailable)}</p>
              )}
              {authority.isError && (
                <Button
                  variant="outline"
                  onPress={() => {
                    void authority.refetch();
                  }}
                >
                  {t(($) => $.finance.retry)}
                </Button>
              )}
              {finance.isError && (
                <Button
                  variant="outline"
                  onPress={() => {
                    void finance.refetch();
                  }}
                >
                  {t(($) => $.finance.retry)}
                </Button>
              )}
            </AlertDescription>
          </Alert>
        }
        pagination={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              isDisabled={pageIndex === 0 || finance.isFetching || locked}
              onPress={() => setPageIndex((index) => index - 1)}
            >
              {t(($) => $.finance.previous)}
            </Button>
            <Button
              size="sm"
              variant="outline"
              isDisabled={!source?.movements.next_cursor || finance.isFetching || locked}
              onPress={() => {
                const next = source?.movements.next_cursor;
                if (next) {
                  setCursors((old) => [...old.slice(0, pageIndex + 1), next]);
                  setPageIndex((index) => index + 1);
                }
              }}
            >
              {t(($) => $.finance.next)}
            </Button>
          </div>
        }
      />
      {debtAction && selection && center && (
        <DebtEditor
          key={`${selection.personId}:${selection.currency}:${debtAction.id}:${debtAction.action}`}
          scope={scope}
          selection={selection}
          id={debtAction.id}
          action={debtAction.action}
          debtLabel={debtAction.label}
          personLabel={personLabel}
          sourceAvailable={!workspace.isError}
          onClose={() => setDebtAction(undefined)}
          onRefresh={async () => {
            await refreshFinance();
          }}
          onLockChange={changeLock}
          onAccessLost={accessLost}
        />
      )}
      {creditRefund && selection && center && (
        <CreditRefundEditor
          key={`${selection.personId}:${selection.currency}`}
          scope={scope}
          selection={selection}
          timezone={center.timezone}
          personLabel={personLabel}
          sourceAvailable={!workspace.isError}
          onClose={() => setCreditRefund(false)}
          onRefresh={async () => {
            await refreshFinance();
          }}
          onLockChange={changeLock}
          onAccessLost={accessLost}
        />
      )}
      {correctionId && selection && center && (
        <CorrectionEditor
          key={`${selection.personId}:${selection.currency}:${correctionId}`}
          scope={scope}
          selection={selection}
          timezone={center.timezone}
          id={correctionId}
          personLabel={personLabel}
          sourceAvailable={!workspace.isError}
          onClose={() => setCorrectionId(undefined)}
          onRefresh={async () => {
            await refreshFinance();
          }}
          onLockChange={changeLock}
          onAccessLost={accessLost}
        />
      )}
      {collect && selection && center && (
        <CollectionEditor
          key={`${selection.personId}:${selection.currency}`}
          scope={scope}
          selection={selection}
          timezone={center.timezone}
          personLabel={personLabel}
          onClose={() => setCollect(false)}
          canWrite={!workspace.isError && !authority.isError && authority.data === true}
          onRefresh={async () => {
            await refreshFinance();
          }}
          onAccessLost={accessLost}
          onLockChange={changeLock}
        />
      )}
    </>
  );
}
export function CollectionEditor({
  scope,
  selection,
  timezone,
  personLabel,
  canWrite,
  onClose,
  onRefresh,
  onAccessLost,
  onLockChange,
}: {
  scope: ClientScope;
  selection: FinanceSelection;
  timezone: string;
  personLabel: string;
  canWrite: boolean;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onAccessLost: (error: unknown) => boolean;
  onLockChange: (locked: boolean) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(() => financeDraft(selection)),
    [review, setReview] = useState<CollectionIntent>(),
    [accepted, setAccepted] = useState(false),
    [prepareError, setPrepareError] = useState<string>(),
    [preparing, setPreparing] = useState(false),
    [errors, setErrors] = useState<Partial<Record<keyof ReturnType<typeof financeDraft>, string>>>(
      {},
    );
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
    if (locked || !canWrite) return;
    setPreparing(true);
    setPrepareError(undefined);
    setErrors({});
    try {
      if (!(await readCollectionAuthority(scope, selection.personId)))
        throw new Error("FINANCE_AUTHORITY_UNAVAILABLE");
      setReview(await collectionIntent(scope, selection, timezone, draft));
      setAccepted(false);
    } catch (error) {
      if (!onAccessLost(error)) {
        setPrepareError(
          error instanceof z.ZodError ||
            (error instanceof Error && error.message === "FINANCE_TIME_INVALID")
            ? t(($) => $.finance.invalid)
            : error instanceof Error && error.message === "FINANCE_AUTHORITY_UNAVAILABLE"
              ? t(($) => $.finance.authorityUnavailable)
              : t(($) => $.finance.sourceError),
        );
        if (error instanceof z.ZodError) {
          const next: Partial<Record<keyof ReturnType<typeof financeDraft>, string>> = {};
          for (const issue of error.issues) {
            const field = issue.path[0];
            if (
              field === "amount" ||
              field === "currency" ||
              field === "personId" ||
              field === "method" ||
              field === "reference" ||
              field === "occurredAt"
            )
              next[field] = t(($) => $.finance.fieldErrors[field]);
          }
          setErrors(next);
        } else if (error instanceof Error && error.message === "FINANCE_TIME_INVALID")
          setErrors({ occurredAt: t(($) => $.finance.fieldErrors.occurredAt) });
      }
    } finally {
      setPreparing(false);
    }
  }
  const status = command.state,
    notice =
      status === "writing"
        ? t(($) => $.finance.writing)
        : status === "saved"
          ? t(($) => $.finance.saved)
          : status === "saved-unread"
            ? t(($) => $.finance.savedUnread)
            : status === "unknown"
              ? t(($) => $.finance.unknownWrite)
              : status === "pending"
                ? t(($) => $.finance.pending)
                : ["rejected", "stale"].includes(status)
                  ? t(($) => $.finance.rejected)
                  : undefined;
  return (
    <FinanceActionSheet
      open
      action="collect"
      sourceLabel={personLabel}
      draft={draft}
      errors={errors}
      pinnedSelection
      people={[{ id: selection.personId, label: personLabel }]}
      debts={[]}
      effects={
        review
          ? [
              {
                id: "amount",
                label: t(($) => $.finance.amountReview),
                detail: formatMinorAmount(review.request.amount_minor, review.request.currency),
              },
              {
                id: "effect",
                label: t(($) => $.finance.effects),
                detail: t(($) => $.finance.collectionEffect),
              },
            ]
          : []
      }
      stage={review ? "review" : "edit"}
      accepted={accepted}
      pending={locked}
      readOnly={!canWrite || status === "saved"}
      notice={
        <>
          <p className="text-sm text-muted-foreground">
            {t(($) => $.finance.timezone, { timezone })}
          </p>
          {!review && canWrite && status === "ready" && (
            <PreparationPicker
              scope={scope}
              kind="collection"
              collectionCurrency={selection.currency}
              disabled={locked}
              onApply={(preparation) => {
                if (preparation.kind !== "collection") return;
                const method = preparation.defaults.payment_method;
                setDraft((current) => ({
                  ...current,
                  method,
                  reference: current.method === method ? current.reference : "",
                }));
                setPrepareError(undefined);
                setErrors({});
              }}
            />
          )}
          {prepareError && (
            <Alert variant="destructive">
              <AlertDescription>{prepareError}</AlertDescription>
            </Alert>
          )}
          {notice && (
            <Alert>
              <AlertDescription>{notice}</AlertDescription>
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
        if (!locked) onClose();
      }}
      onDraft={(value) => {
        if (!locked) {
          setDraft(value);
          setReview(undefined);
          setPrepareError(undefined);
          setErrors({});
          setAccepted(false);
        }
      }}
      onReview={() => {
        void prepare();
      }}
      onConfirm={
        review && canWrite && status === "ready"
          ? () => {
              if (accepted) void command.start(review);
            }
          : undefined
      }
      onBack={() => {
        if (!locked) {
          command.reset();
          setReview(undefined);
          setAccepted(false);
        }
      }}
      onAccepted={setAccepted}
    />
  );
}
