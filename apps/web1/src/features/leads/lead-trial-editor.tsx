import { useCallback, useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useBlocker, useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { ClientScope } from "../../lib/scoped-backend";
import { BackendError } from "../../lib/backend";
import { formatMinorAmount } from "../../lib/money";
import type { LeadDetail } from "./leads-read";
import { leadDraft } from "./leads-command";
import type { LeadDraft } from "./lead-draft";
import { LeadSheet } from "./lead-sheet";
import { TrialSessionFields, TrialProductTerms, TrialHistory } from "./lead-trial-view";
import {
  readTrialProducts,
  readTrialHistory,
  readTrialSessions,
  trialOfferIntent,
  trialConfirmIntent,
  writeTrial,
  readTrialReceipt,
  readTrialResult,
} from "./lead-trial";
import { useMemberCommand } from "../member-profile/use-member-command";
import { LeadCommandNotice } from "./lead-command-notice";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";

export function LeadTrialEditor({
  scope,
  lead,
  mode,
  name,
  timezone,
  onClose,
  onSaved,
  onLockChange,
}: {
  scope: ClientScope;
  lead: LeadDetail;
  mode: "offer" | "confirm";
  name?: string;
  timezone: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onLockChange: (locked: boolean) => void;
}) {
  const { t } = useTranslation(),
    router = useRouter();
  const [draft, setDraft] = useState<LeadDraft>(() => leadDraft(lead)),
    [day, setDay] = useState(""),
    [category, setCategory] = useState(""),
    [categoryError, setCategoryError] = useState(""),
    [preparing, setPreparing] = useState(false),
    [error, setError] = useState(""),
    [errors, setErrors] = useState<Partial<Record<keyof LeadDraft, string>>>({});
  const busy = useRef(false),
    active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const products = useInfiniteQuery({
    queryKey: ["lead-trial-products", scope.accountId, scope.orgId, scope.centerId, lead.id],
    queryFn: ({ pageParam }) => readTrialProducts(scope, lead.id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled: mode === "offer",
    retry: false,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const history = useInfiniteQuery({
    queryKey: ["lead-trial-history", scope.accountId, scope.orgId, scope.centerId, lead.id],
    queryFn: ({ pageParam }) => readTrialHistory(scope, lead.id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    retry: false,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const sessions = useQuery({
    queryKey: ["lead-trial-sessions", scope.accountId, scope.orgId, scope.centerId, timezone, day],
    queryFn: () => readTrialSessions(scope, timezone, day),
    enabled: mode === "offer",
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const accessLost = useCallback(
    (cause: unknown) => {
      const lost =
        (cause instanceof Error && ["ACCOUNT_CHANGED", "AUTH_REQUIRED"].includes(cause.message)) ||
        (cause instanceof BackendError &&
          ["AUTH_REQUIRED", "SESSION_REVOKED"].includes(cause.code));
      if (lost) void router.invalidate();
      return lost;
    },
    [router],
  );
  const command = useMemberCommand({
    write: writeTrial,
    readReceipt: readTrialReceipt,
    readResult: readTrialResult,
    onAccessLost: accessLost,
    onRefresh: async () => {
      await history.refetch({ throwOnError: true });
      if (mode === "offer") await products.refetch({ throwOnError: true });
      await onSaved();
    },
  });
  const locked = preparing || command.locked;
  useBlocker({
    shouldBlockFn: () => busy.current,
    enableBeforeUnload: preparing,
    disabled: !preparing,
  });
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  useEffect(() => {
    for (const cause of [products.error, history.error, sessions.error])
      if (cause) accessLost(cause);
  }, [products.error, history.error, sessions.error, accessLost]);
  const productRows =
      !products.isError && !products.isFetching
        ? (products.data?.pages.flatMap((page) => page.items) ?? [])
        : [],
    historyRows =
      !history.isError && !history.isFetching
        ? (history.data?.pages.flatMap((page) => page.items) ?? [])
        : [],
    sessionRows =
      !sessions.isError && !sessions.isFetching
        ? (sessions.data?.entries.flatMap((entry) => (entry.type === "session" ? [entry] : [])) ??
          [])
        : [];
  const product = productRows.find((row) => row.product_version_id === draft.productVersionId),
    offer = historyRows.find((row) => row.offer_id === draft.offerId),
    session = sessionRows.find((row) => row.session.id === draft.sessionId)?.session;
  const readError = history.isError || (mode === "offer" && products.isError);
  const ready =
    !readError &&
    history.isFetchedAfterMount &&
    !history.isFetching &&
    (mode === "confirm" ||
      (products.isFetchedAfterMount &&
        !products.isFetching &&
        sessions.isFetched &&
        !sessions.isFetching));
  const date = (value: string) =>
    new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: timezone,
    }).format(new Date(value));
  async function submit() {
    if (!ready || locked || busy.current || command.state !== "ready" || !draft.reviewed) return;
    if (mode === "offer" && !product) {
      setErrors({ productVersionId: t(($) => $.leads.required) });
      return;
    }
    if (mode === "confirm" && !offer) {
      setErrors({ offerId: t(($) => $.leads.required) });
      return;
    }
    if (mode === "offer" && draft.sessionId && !session) {
      setErrors({ sessionId: t(($) => $.leads.readFailed) });
      return;
    }
    if (
      mode === "offer" &&
      session?.capacity.category_remaining != null &&
      !["male", "female"].includes(category)
    ) {
      setCategoryError(t(($) => $.leads.required));
      return;
    }
    busy.current = true;
    setPreparing(true);
    setError("");
    setErrors({});
    setCategoryError("");
    try {
      const intent =
        mode === "offer"
          ? await trialOfferIntent(scope, lead, product!, session, category, draft.reviewed)
          : await trialConfirmIntent(scope, lead, offer!, draft.reviewed);
      if (active.current) await command.start(intent);
    } catch (cause) {
      if (active.current && !accessLost(cause))
        setError(
          t(($) =>
            cause instanceof Error && cause.message === "TRIAL_SOURCE_CHANGED"
              ? $.leads.sourceChanged
              : $.leads.validationFailed,
          ),
        );
    } finally {
      busy.current = false;
      if (active.current) setPreparing(false);
    }
  }
  return (
    <LeadSheet
      mode={mode}
      name={name}
      draft={draft}
      onDraft={(value) => {
        if (locked || command.state !== "ready") return;
        if (value.sessionId !== draft.sessionId) setCategory("");
        setDraft({
          ...value,
          reviewed: value.reviewed !== draft.reviewed ? value.reviewed : false,
        });
        setErrors({});
        setError("");
      }}
      stages={[]}
      tags={[]}
      owners={[]}
      products={productRows.map((row) => ({
        id: row.product_version_id,
        name: `${row.product_name} · ${formatMinorAmount(row.price_minor, row.currency)}`,
      }))}
      sessions={sessionRows.map((row) => ({
        id: row.session.id,
        name: `${date(row.session.starts_at)} · ${row.item.title}`,
      }))}
      offers={historyRows
        .filter((row) => row.state === "active" && row.session_id !== null)
        .map((row) => ({
          id: row.offer_id,
          name: `${formatMinorAmount(row.price_minor, row.currency)} · ${date(row.expires_at)}`,
        }))}
      disabled={locked}
      readOnly={!ready || command.state !== "ready" || command.unavailable}
      errors={errors}
      sessionContent={
        <>
          <TrialSessionFields
            day={day || sessions.data?.day || ""}
            onDay={(value) => {
              setDay(value);
              setCategory("");
              setDraft((value) => ({ ...value, sessionId: "", reviewed: false }));
            }}
            category={category}
            onCategory={(value) => {
              setCategory(value);
              setCategoryError("");
              setDraft((value) => ({ ...value, reviewed: false }));
            }}
            split={session?.capacity.category_remaining != null}
            error={categoryError}
            disabled={locked || command.state !== "ready"}
          />
          <p className="text-sm text-muted-foreground">{t(($) => $.leads.trialNoSessionHint)}</p>
        </>
      }
      trialContent={
        mode === "offer" ? (
          <>
            <TrialProductTerms product={product} />
            {products.hasNextPage && (
              <Button
                type="button"
                variant="outline"
                isDisabled={locked || products.isFetching}
                onPress={() => void products.fetchNextPage()}
              >
                {t(($) => $.people.next)}
              </Button>
            )}
          </>
        ) : offer ? (
          <div className="flex flex-col gap-2 text-sm">
            <p>{formatMinorAmount(offer.price_minor, offer.currency)}</p>
            <p>
              {t(($) =>
                BigInt(offer.price_minor) > 0n ? $.leads.trialPaidRequired : $.leads.trialFree,
              )}
            </p>
            <p>{t(($) => $.leads.trialChecks)}</p>
          </div>
        ) : undefined
      }
      history={
        <>
          {history.isSuccess &&
            !history.isFetching &&
            !history.isError &&
            history.isFetchedAfterMount && <TrialHistory rows={historyRows} timezone={timezone} />}
          {history.hasNextPage && (
            <Button
              type="button"
              variant="outline"
              isDisabled={locked || history.isFetching}
              onPress={() => void history.fetchNextPage()}
            >
              {t(($) => $.people.next)}
            </Button>
          )}
        </>
      }
      onClose={() => {
        if (!locked) onClose();
      }}
      onSubmit={
        ready &&
        command.state === "ready" &&
        (mode !== "offer" || !product || product.offer_policy_state === "available")
          ? () => void submit()
          : undefined
      }
      recovery={
        <>
          {mode === "offer" && sessions.isError && (
            <Alert role="alert" variant="destructive">
              <AlertDescription>
                {t(($) => $.leads.trialSessionReadFailed)}{" "}
                <Button
                  type="button"
                  variant="outline"
                  isDisabled={locked || sessions.isFetching}
                  onPress={() => void sessions.refetch()}
                >
                  {t(($) => $.auth.retry)}
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {(readError || error) && (
            <Alert role="alert" variant="destructive">
              <AlertDescription>
                {error || t(($) => $.leads.readFailed)}{" "}
                <Button variant="outline" isDisabled={locked} onPress={onClose}>
                  {t(($) => $.leads.reload)}
                </Button>
              </AlertDescription>
            </Alert>
          )}
          <LeadCommandNotice command={command} onReload={onClose} />
        </>
      }
    />
  );
}
