import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Field, FieldLabel } from "../../components/ui/field";
import { BackendError } from "../../lib/backend";
import type { ClientScope } from "../../lib/scoped-backend";
import type { PersonSummary, PersonView } from "../../lib/api-contracts/generated";
import { MergePairPicker } from "./merge-pair-picker";
import {
  MergeView,
  type MergeDetail,
  type MergeComparisonField,
  type MergeFilter,
} from "./merge-view";
import { peopleRow } from "./people-summary";
import { readMergeDirectory, type MergeReviewState } from "./merge-directory";
import { useMergeCommand } from "./use-merge-command";
import {
  readMergePair,
  previewMerge,
  readMergeApprovals,
  readMergeApprovalPair,
  mergeApplyIntent,
  mergeApprovalIntent,
  type MergeSnapshot,
} from "./merge";

type Approval = Awaited<ReturnType<typeof readMergeApprovalPair>>;
type Review = Awaited<ReturnType<typeof readMergeDirectory>>["items"][number];
export function MergeContent({
  scope,
  onBack,
  onLockChange,
}: {
  scope: ClientScope;
  onBack: () => void;
  onLockChange: (locked: boolean) => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const queries = useQueryClient();
  const [records, setRecords] = useState<[PersonSummary | null, PersonSummary | null]>([
    null,
    null,
  ]);
  const [pair, setPair] = useState<[PersonView, PersonView]>();
  const [kept, setKept] = useState<"0" | "1">("0");
  const [preview, setPreview] = useState<MergeSnapshot>();
  const [approval, setApproval] = useState<Approval>();
  const [history, setHistory] = useState<Review>();
  const [selectedId, setSelectedId] = useState<string>();
  const [filter, setFilter] = useState<MergeFilter>("pending");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string>();
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [page, setPage] = useState(0);
  const actionLock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const state: MergeReviewState =
    filter === "pending" || filter === "approvals" ? "suggested" : filter;
  const directory = useQuery({
    queryKey: [
      "merge-directory",
      scope.accountId,
      scope.orgId,
      scope.centerId,
      filter,
      query,
      cursors[page],
    ],
    queryFn: async ({ queryKey }) => {
      try {
        return filter === "approvals"
          ? { kind: "approvals" as const, ...(await readMergeApprovals(scope, cursors[page])) }
          : {
              kind: "reviews" as const,
              ...(await readMergeDirectory(scope, state, query, cursors[page])),
            };
      } catch (error) {
        if (accessLost(error, queryKey)) command.abandon();
        throw error;
      }
    },
    retry: false,
  });
  const accessLost = useCallback(
    (error: unknown, preserveQuery?: readonly unknown[]) => {
      const code =
        error instanceof BackendError
          ? error.code
          : error instanceof Error
            ? error.message
            : undefined;
      if (
        !code ||
        !["AUTH_REQUIRED", "SESSION_REVOKED", "ACCOUNT_CHANGED", "FORBIDDEN"].includes(code)
      )
        return false;
      setPair(undefined);
      setPreview(undefined);
      setApproval(undefined);
      setHistory(undefined);
      setRecords([null, null]);
      setReason("");
      for (const key of ["merge-directory", "merge-approvals", "merge-people"])
        queries.removeQueries({
          queryKey: [key, scope.accountId, scope.orgId, scope.centerId],
          predicate: (query) =>
            !preserveQuery || JSON.stringify(query.queryKey) !== JSON.stringify(preserveQuery),
        });
      void router.invalidate();
      return true;
    },
    [queries, router, scope.accountId, scope.orgId, scope.centerId],
  );
  const command = useMergeCommand({
    onAccessLost: accessLost,
    onRefresh: async () => {
      await queries.invalidateQueries({
        queryKey: ["people", scope.accountId, scope.orgId, scope.centerId],
      });
      const result = await directory.refetch();
      if (result.error) throw result.error;
    },
  });
  const locked = busy || command.locked;
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  useEffect(() => {
    if (!locked && reasonError) document.getElementById("merge-reason")?.focus();
    else if (!busy && (notice || command.state !== "ready"))
      document.getElementById("merge-notice")?.focus();
  }, [busy, locked, notice, reasonError, command.state]);
  function clearSelection() {
    setPair(undefined);
    setPreview(undefined);
    setApproval(undefined);
    setHistory(undefined);
    setSelectedId(undefined);
    setReason("");
    setReviewed(false);
    setReasonError(undefined);
    setNotice(undefined);
    command.reset();
  }
  async function compare(sourceId?: string, targetId?: string, id?: string) {
    if (locked || actionLock.current) return;
    const source = sourceId ?? records[1]?.id,
      target = targetId ?? records[0]?.id;
    if (!source || !target || source === target) return;
    actionLock.current = true;
    setBusy(true);
    clearSelection();
    setSelectedId(id);
    try {
      const result = await readMergePair(scope, source, target);
      if (!mounted.current) return;
      setPair([result.target, result.source]);
      setKept("0");
    } catch (error) {
      if (mounted.current && !accessLost(error)) setNotice(t(($) => $.peopleMerge.readError));
    } finally {
      actionLock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function loadPreview(decision: "merge" | "not_duplicate" = "merge") {
    if (!pair || locked || approval || history || actionLock.current) return;
    if (!reason.trim() || reason.trim().length > 2000) {
      setReasonError(t(($) => $.peopleMerge.reasonRequired));
      return;
    }
    actionLock.current = true;
    setBusy(true);
    command.reset();
    setPreview(undefined);
    setReviewed(false);
    setNotice(undefined);
    setReasonError(undefined);
    try {
      const result = await previewMerge(
        scope,
        pair[kept === "0" ? 1 : 0].id,
        pair[kept === "0" ? 0 : 1].id,
        reason,
        decision,
      );
      if (!mounted.current) return;
      setPair(kept === "0" ? [result.target, result.source] : [result.source, result.target]);
      setPreview(result);
      setNotice(
        decision === "merge"
          ? t(($) => $.peopleMerge.previewLoaded)
          : t(($) => $.peopleMerge.notDuplicatePreview),
      );
    } catch (error) {
      if (mounted.current && !accessLost(error)) setNotice(t(($) => $.peopleMerge.previewFailed));
    } finally {
      actionLock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function inspect(id: string) {
    if (locked || actionLock.current || !directory.data) return;
    if (directory.data.kind === "reviews") {
      const row = directory.data.items.find((x) => x.id === id);
      if (!row) return;
      if (row.state === "suggested") {
        await compare(row.source.id, row.target.id, row.id);
        return;
      }
      clearSelection();
      setSelectedId(id);
      setHistory(row);
      return;
    }
    actionLock.current = true;
    setBusy(true);
    clearSelection();
    setSelectedId(id);
    try {
      const result = await readMergeApprovalPair(scope, id);
      if (!mounted.current) return;
      setApproval(result);
      setPair([result.target, result.source]);
      setKept("0");
      setReason(result.approval.reason ?? t(($) => $.peopleMerge.unknown));
    } catch (error) {
      if (mounted.current && !accessLost(error)) setNotice(t(($) => $.peopleMerge.previewFailed));
    } finally {
      actionLock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  // Intent creation checks expiry at the explicit click, before any writer.
  const canApply =
    reviewed &&
    !locked &&
    command.state === "ready" &&
    Boolean(
      approval
        ? approval.approval.required_approvals.some(
            (x) => x.center_id === scope.centerId && !x.approved,
          )
        : preview && preview.reason === reason.trim() && !preview.preview.blockers.length,
    );
  async function apply() {
    if (!canApply) return;
    try {
      await command.start(
        approval ? mergeApprovalIntent(scope, approval.approval) : mergeApplyIntent(preview!),
      );
    } catch (error) {
      if (!accessLost(error)) setNotice(t(($) => $.peopleMerge.previewFailed));
    }
  }
  const fields: MergeComparisonField[] = [
    "name",
    "email",
    "phone",
    "account",
    "createdBy",
    "status",
    "rights",
    "reservations",
    "payments",
    "debt",
    "documents",
  ];
  function cell(person: PersonView, field: MergeComparisonField): string | null {
    const summary = peopleRow(person, scope.centerId, t);
    if (field === "rights") return summary.entitlement?.label ?? null;
    if (field === "debt") return summary.debt;
    if (field === "name") return person.display_name;
    if (field === "email" || field === "phone")
      return (
        person.contacts
          ?.filter((contact) => contact.kind === (field === "email" ? "email" : "phone"))
          .map((contact) => contact.value)
          .join(", ") || null
      );
    if (field === "status") {
      const states = new Set(
        person.relationships
          .filter((item) => item.center_id === scope.centerId && item.kind === "student")
          .map((item) => item.state),
      );
      if (states.size === 1)
        return states.has("active")
          ? t(($) => $.people.states.active)
          : t(($) => $.people.states.inactive);
    }
    return null;
  }
  const notDuplicate = preview?.decision === "not_duplicate";
  const detail: MergeDetail | undefined = directory.isError
    ? undefined
    : history
      ? {
          id: history.id,
          title: t(($) => $.peopleMerge.pairDetail),
          description: `${history.source.display_name} · ${history.target.display_name}`,
          records: [
            { name: history.target.display_name, description: history.target.display_name },
            { name: history.source.display_name, description: history.source.display_name },
          ],
          comparison: [],
          effects: [],
          blockers: [],
          completed: true,
          notice: [
            history.state === "completed"
              ? t(($) => $.peopleMerge.completed)
              : t(($) => $.peopleMerge.filters.not_duplicate),
            history.source.display_name,
            history.target.display_name,
            `${t(($) => $.peopleMerge.recordedReason)}: ${history.reason ?? t(($) => $.peopleMerge.unknown)}`,
            `${t(($) => $.peopleMerge.recordedDate)}: ${history.recorded_at ? new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" }).format(new Date(history.recorded_at)) + " UTC" : t(($) => $.peopleMerge.unknown)}`,
          ].join(" · "),
        }
      : pair
        ? {
            id: selectedId ?? "selected-pair",
            title: t(($) => $.peopleMerge.pairDetail),
            description: approval
              ? t(($) => $.peopleMerge.approvalInspect)
              : t(($) => $.peopleMerge.chooseKept),
            records: [
              { name: pair[0].display_name, description: pair[0].display_name },
              { name: pair[1].display_name, description: pair[1].display_name },
            ],
            comparison: fields.map((field) => ({
              field,
              values: [cell(pair[0], field), cell(pair[1], field)],
            })),
            effects:
              preview || approval
                ? [
                    {
                      label: t(($) => $.peopleMerge.decisionEffect),
                      value: notDuplicate
                        ? t(($) => $.peopleMerge.notDuplicateEffect)
                        : t(($) => $.peopleMerge.mergeEffect),
                      description: notDuplicate
                        ? t(($) => $.peopleMerge.notDuplicateHint)
                        : t(($) => $.peopleMerge.historyDescription),
                    },
                    ...(preview?.decision === "merge"
                      ? [
                          {
                            label: t(($) => $.peopleMerge.approvals),
                            value: t(($) => $.peopleMerge.approvalsNeeded, {
                              count:
                                preview.preview.merge_summary!.required_approval_center_ids.length,
                            }),
                            description: null,
                          },
                        ]
                      : []),
                  ]
                : [],
            blockers:
              preview?.preview.blockers.map((blocker) =>
                blocker.code === "ACCOUNT_LINK_CONFLICT"
                  ? t(($) => $.peopleMerge.accountConflict)
                  : blocker.code === "RESERVATION_EXISTS"
                    ? t(($) => $.peopleMerge.reservationConflict)
                    : blocker.code === "RESOURCE_CONFLICT"
                      ? t(($) => $.peopleMerge.resourceConflict)
                      : t(($) => $.peopleMerge.blocked),
              ) ?? [],
            completed: command.state === "saved",
            notice: command.state === "saved" ? t(($) => $.peopleMerge.saved) : undefined,
          }
        : undefined;
  const commandNotice =
    command.state === "unknown"
      ? t(($) => $.peopleMerge.unknownWrite)
      : command.state === "saved-unread"
        ? t(($) => $.peopleMerge.savedUnread)
        : command.state === "stale"
          ? t(($) => $.peopleMerge.stale)
          : command.state === "rejected"
            ? t(($) => $.peopleMerge.rejected)
            : command.state === "pending"
              ? t(($) => $.peopleMerge.receiptPending)
              : command.state === "saved"
                ? t(($) => $.peopleMerge.saved)
                : undefined;
  const pageData = directory.data;
  const items = directory.isError
    ? []
    : pageData?.kind === "reviews"
      ? pageData.items.map((row) => ({
          id: row.id,
          name: `${row.target.display_name} · ${row.source.display_name}`,
          description:
            row.matching_kinds
              .map((kind) =>
                kind === "email"
                  ? t(($) => $.peopleMerge.matchingEmail)
                  : t(($) => $.peopleMerge.matchingPhone),
              )
              .join(" · ") ||
            t(($) => $.peopleMerge.filters[row.state === "suggested" ? "pending" : row.state]),
          detail: row.reason,
        }))
      : (pageData?.items.map((row, index) => ({
          id: row.preview.id,
          name: t(($) => $.peopleMerge.approvalItem, { number: index + 1 }),
          description: t(($) => $.peopleMerge.approvalScope),
          detail: t(($) => $.peopleMerge.expiry, {
            date:
              new Intl.DateTimeFormat("tr-TR", {
                dateStyle: "short",
                timeStyle: "short",
                timeZone: "UTC",
              }).format(new Date(row.expires_at)) + " UTC",
          }),
        })) ?? []);
  return (
    <MergeView
      items={items}
      selectedId={selectedId}
      filter={filter}
      pendingLabel={
        pageData?.kind === "reviews"
          ? t(($) => $.peopleMerge.directoryCount, { count: pageData.summary.filtered })
          : pageData
            ? t(($) => $.peopleMerge.approvalPage, { count: pageData.items.length })
            : null
      }
      detail={detail}
      keptRecord={kept}
      reason={reason}
      reviewed={reviewed}
      reasonError={reasonError}
      state={directory.isPending ? "loading" : directory.isError ? "error" : "ready"}
      locked={locked}
      canApply={canApply}
      onBack={onBack}
      onSelect={(id) => {
        void inspect(id);
      }}
      onFilter={(value) => {
        if (locked) return;
        clearSelection();
        setFilter(value);
        setCursors([undefined]);
        setPage(0);
        setQuery("");
        setSearch("");
      }}
      onKeep={
        !approval
          ? (value) => {
              setKept(value);
              setPreview(undefined);
              setReviewed(false);
              setNotice(undefined);
              command.reset();
            }
          : undefined
      }
      onReason={
        !approval
          ? (value) => {
              setReason(value);
              setReasonError(undefined);
              setPreview(undefined);
              setReviewed(false);
              setNotice(undefined);
              command.reset();
            }
          : undefined
      }
      onReviewed={setReviewed}
      onPreview={
        pair && !approval && !history
          ? () => {
              void loadPreview();
            }
          : undefined
      }
      onDismiss={
        pair && !approval && !history
          ? () => {
              void loadPreview("not_duplicate");
            }
          : undefined
      }
      onApply={() => {
        void apply();
      }}
      applyLabel={
        approval
          ? t(($) => $.peopleMerge.approve)
          : notDuplicate
            ? t(($) => $.peopleMerge.notDuplicateApply)
            : undefined
      }
      reviewHint={
        approval
          ? t(($) => $.peopleMerge.approvalInspect)
          : notDuplicate
            ? t(($) => $.peopleMerge.notDuplicateHint)
            : undefined
      }
      onRetry={() => {
        if (locked) return;
        setCursors([undefined]);
        setPage(0);
        void directory.refetch();
      }}
      listNotice={
        filter === "approvals"
          ? t(($) => $.peopleMerge.approvalListScope)
          : t(($) => $.peopleMerge.directoryScope)
      }
      listActions={
        <>
          {filter !== "approvals" && (
            <form
              className="flex w-full flex-wrap items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (locked) return;
                clearSelection();
                setCursors([undefined]);
                setPage(0);
                setQuery(search.trim());
              }}
            >
              <Field className="min-w-0 flex-1">
                <FieldLabel htmlFor="merge-directory-search">
                  {t(($) => $.peopleMerge.search)}
                </FieldLabel>
                <Input
                  id="merge-directory-search"
                  value={search}
                  disabled={locked}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </Field>
              <Button type="submit" variant="outline" isDisabled={locked}>
                {t(($) => $.peopleMerge.searchAction)}
              </Button>
            </form>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              isDisabled={locked || page === 0 || directory.isFetching}
              onPress={() => {
                clearSelection();
                setPage((value) => value - 1);
              }}
            >
              {t(($) => $.people.previous)}
            </Button>
            <Button
              variant="outline"
              size="sm"
              isDisabled={
                locked || directory.isFetching || directory.isError || !pageData?.next_cursor
              }
              onPress={() => {
                const next = pageData?.next_cursor;
                if (next) {
                  clearSelection();
                  setCursors((old) => [...old.slice(0, page + 1), next]);
                  setPage((value) => value + 1);
                }
              }}
            >
              {t(($) => $.people.next)}
            </Button>
          </div>
        </>
      }
      selectionControls={
        <>
          {!directory.isError && (
            <MergePairPicker
              scope={scope}
              records={records}
              locked={locked}
              onRecord={(index, person) => {
                setRecords((old) => (index === 0 ? [person, old[1]] : [old[0], person]));
                clearSelection();
              }}
              onCompare={() => {
                void compare();
              }}
            />
          )}
          {(notice || commandNotice) && (
            <Alert id="merge-notice" role="status" tabIndex={-1}>
              <AlertDescription>{commandNotice ?? notice}</AlertDescription>
              {command.state === "unknown" && (
                <Button
                  variant="outline"
                  isDisabled={command.busy}
                  onPress={() => {
                    void command.retry();
                  }}
                >
                  {t(($) => $.peopleMerge.retryWrite)}
                </Button>
              )}
              {["unknown", "pending", "saved-unread"].includes(command.state) && (
                <Button
                  variant="outline"
                  isDisabled={command.busy}
                  onPress={() => {
                    void command.readReceipt();
                  }}
                >
                  {command.state === "saved-unread"
                    ? t(($) => $.peopleMerge.readResult)
                    : t(($) => $.peopleMerge.readReceipt)}
                </Button>
              )}
            </Alert>
          )}
        </>
      }
    />
  );
}
