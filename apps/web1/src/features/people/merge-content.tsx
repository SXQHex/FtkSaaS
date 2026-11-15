import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { BackendError } from "../../lib/backend";
import type { ClientScope } from "../../lib/scoped-backend";
import type { PersonSummary, PersonView } from "../../lib/api-contracts/generated";
import { MergePairPicker } from "./merge-pair-picker";
import { MergeView, type MergeDetail, type MergeComparisonField } from "./merge-view";
import {
  readMergePair,
  previewMerge,
  readMergeApprovals,
  readMergeApprovalPair,
  type MergeSnapshot,
} from "./merge";

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
  const [approvalHistory, setApprovalHistory] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  const [reviewer, setReviewer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [page, setPage] = useState(0);
  const approvals = useQuery({
    queryKey: ["merge-approvals", scope.accountId, scope.orgId, scope.centerId, cursors[page]],
    queryFn: () => readMergeApprovals(scope, cursors[page]),
    retry: false,
  });
  const accessLost = useCallback(
    (error: unknown) => {
      const code =
        error instanceof BackendError
          ? error.code
          : error instanceof Error
            ? error.message
            : undefined;
      if (
        code &&
        ["AUTH_REQUIRED", "SESSION_REVOKED", "ACCOUNT_CHANGED", "FORBIDDEN"].includes(code)
      ) {
        setPair(undefined);
        setPreview(undefined);
        setRecords([null, null]);
        queries.removeQueries({
          queryKey: ["merge-approvals", scope.accountId, scope.orgId, scope.centerId],
        });
        queries.removeQueries({
          queryKey: ["merge-people", scope.accountId, scope.orgId, scope.centerId],
        });
        void router.invalidate();
        return true;
      }
      return false;
    },
    [queries, router, scope.accountId, scope.orgId, scope.centerId],
  );
  useEffect(() => {
    const error = approvals.error;
    const code =
      error instanceof BackendError
        ? error.code
        : error instanceof Error
          ? error.message
          : undefined;
    if (
      code &&
      ["AUTH_REQUIRED", "SESSION_REVOKED", "ACCOUNT_CHANGED", "FORBIDDEN"].includes(code)
    ) {
      queries.removeQueries({
        queryKey: ["merge-people", scope.accountId, scope.orgId, scope.centerId],
      });
      void router.invalidate();
    }
  }, [approvals.error, queries, router, scope.accountId, scope.orgId, scope.centerId]);
  useEffect(() => {
    onLockChange(busy);
    return () => onLockChange(false);
  }, [busy, onLockChange]);
  useEffect(() => {
    if (!busy && notice) document.getElementById("merge-notice")?.focus();
  }, [busy, notice]);
  async function compare() {
    if (busy || !records[0] || !records[1] || records[0].id === records[1].id) return;
    setBusy(true);
    setNotice(undefined);
    setPair(undefined);
    setPreview(undefined);
    setSelectedId(undefined);
    setReviewer(false);
    setApprovalHistory(false);
    try {
      const result = await readMergePair(scope, records[1].id, records[0].id);
      setPair([result.target, result.source]);
      setKept("0");
    } catch (error) {
      if (!accessLost(error)) setNotice(t(($) => $.peopleMerge.readError));
    } finally {
      setBusy(false);
    }
  }
  async function loadPreview() {
    if (!pair || busy || reviewer) return;
    setBusy(true);
    setPreview(undefined);
    setNotice(undefined);
    try {
      const result = await previewMerge(
        scope,
        pair[kept === "0" ? 1 : 0].id,
        pair[kept === "0" ? 0 : 1].id,
      );
      setPair(kept === "0" ? [result.target, result.source] : [result.source, result.target]);
      setPreview(result);
      setNotice(t(($) => $.peopleMerge.previewLoaded));
    } catch (error) {
      if (!accessLost(error)) setNotice(t(($) => $.peopleMerge.previewFailed));
    } finally {
      setBusy(false);
    }
  }
  async function inspectApproval(id: string) {
    if (busy) return;
    setBusy(true);
    setPair(undefined);
    setPreview(undefined);
    setNotice(undefined);
    setSelectedId(id);
    setReviewer(true);
    setApprovalHistory(false);
    try {
      const result = await readMergeApprovalPair(scope, id);
      setPair([result.target, result.source]);
      setKept("0");
      setApprovalHistory(result.approval.linked_history);
      setNotice(t(($) => $.peopleMerge.approvalInspect));
    } catch (error) {
      if (!accessLost(error)) setNotice(t(($) => $.peopleMerge.previewFailed));
    } finally {
      setBusy(false);
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
  const detail: MergeDetail | undefined =
    pair && !approvals.isError
      ? {
          id: selectedId ?? "selected-pair",
          title: t(($) => $.peopleMerge.pairDetail),
          description: reviewer
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
            preview || (reviewer && approvalHistory)
              ? [
                  {
                    label: t(($) => $.peopleMerge.history),
                    value: t(($) => $.peopleMerge.historyKept),
                    description: t(($) => $.peopleMerge.historyDescription),
                  },
                ]
              : [],
          blockers:
            preview?.preview.blockers.map((blocker) => {
              if (blocker.code === "ACCOUNT_LINK_CONFLICT")
                return t(($) => $.peopleMerge.accountConflict);
              if (blocker.code === "RESERVATION_EXISTS")
                return t(($) => $.peopleMerge.reservationConflict);
              if (blocker.code === "RESOURCE_CONFLICT")
                return t(($) => $.peopleMerge.resourceConflict);
              return t(($) => $.peopleMerge.blocked);
            }) ?? [],
          notice: t(($) => $.peopleMerge.writeUnavailable),
        }
      : undefined;
  return (
    <MergeView
      items={
        approvals.isError
          ? []
          : (approvals.data?.items.map((item, index) => ({
              id: item.preview.id,
              name: t(($) => $.peopleMerge.approvalItem, { number: index + 1 }),
              description: t(($) => $.peopleMerge.approvalScope),
              detail: t(($) => $.peopleMerge.expiry, {
                date: new Intl.DateTimeFormat("tr-TR", {
                  dateStyle: "short",
                  timeStyle: "short",
                  timeZone: "Europe/Istanbul",
                }).format(new Date(item.expires_at)),
              }),
            })) ?? [])
      }
      selectedId={selectedId}
      filter="pending"
      completedAvailable={false}
      pendingLabel={
        approvals.isSuccess
          ? t(($) => $.peopleMerge.approvalPage, { count: approvals.data.items.length })
          : null
      }
      detail={detail}
      keptRecord={kept}
      reason=""
      reviewed={false}
      state={approvals.isPending ? "loading" : approvals.isError ? "error" : "ready"}
      locked={busy}
      onBack={onBack}
      onSelect={(id) => {
        void inspectApproval(id);
      }}
      onKeep={
        !reviewer
          ? (value) => {
              setKept(value);
              setPreview(undefined);
              setNotice(undefined);
            }
          : undefined
      }
      onPreview={
        pair && !reviewer
          ? () => {
              void loadPreview();
            }
          : undefined
      }
      onRetry={() => {
        void approvals.refetch();
      }}
      listNotice={t(($) => $.peopleMerge.approvalListScope)}
      listActions={
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            isDisabled={busy || page === 0 || approvals.isFetching}
            onPress={() => setPage((value) => value - 1)}
          >
            {t(($) => $.people.previous)}
          </Button>
          <Button
            variant="outline"
            size="sm"
            isDisabled={
              busy || approvals.isFetching || approvals.isError || !approvals.data?.next_cursor
            }
            onPress={() => {
              const next = approvals.data?.next_cursor;
              if (next) {
                setCursors((old) => [...old.slice(0, page + 1), next]);
                setPage((value) => value + 1);
              }
            }}
          >
            {t(($) => $.people.next)}
          </Button>
        </div>
      }
      selectionControls={
        <>
          {!approvals.isError && (
            <MergePairPicker
              scope={scope}
              records={records}
              locked={busy}
              onRecord={(index, person) => {
                setRecords((old) => (index === 0 ? [person, old[1]] : [old[0], person]));
                setPair(undefined);
                setPreview(undefined);
                setNotice(undefined);
              }}
              onCompare={() => {
                void compare();
              }}
            />
          )}
          {notice && (
            <Alert id="merge-notice" role="status" tabIndex={-1}>
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}
        </>
      }
    />
  );
}
