import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { ClientScope } from "../../lib/scoped-backend";
import { readWorkspace } from "../workspace/workspace";
import { AuditView, type AuditFilter } from "./audit-view";
import { AuditDetailSheet } from "./audit-detail-sheet";
import { auditModules, readAudit, readTracking } from "./audit-read";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Field, FieldLabel } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { NativeSelect, NativeSelectOption } from "../../components/ui/native-select";
export function AuditContent({
  scope,
}: {
  scope: ClientScope;
  onLockChange: (value: boolean) => void;
  preservePending?: boolean;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"records" | "operations">("records");
  const [filter, setFilter] = useState<AuditFilter>({
    query: "",
    module: "",
    result: "",
    period: "30",
  });
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | "operation" | "preview" | "job">("all");
  const [state, setState] = useState("");
  const [anchor, setAnchor] = useState(() => new Date().toISOString());
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [index, setIndex] = useState(0);
  const [detailId, setDetail] = useState<string>();
  const workspace = useQuery({
    queryKey: ["workspace", scope.accountId, scope.orgId],
    queryFn: () => readWorkspace(scope.accountId, scope.orgId),
    enabled: false,
    retry: false,
  });
  const center =
    !workspace.isError && workspace.data?.selected?.id === scope.orgId
      ? workspace.data.centers.find((row) => row.id === scope.centerId && row.accessible)
      : undefined;
  const timezone = center?.timezone;
  const reset = () => {
    setCursors([undefined]);
    setIndex(0);
    setDetail(undefined);
  };
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(filter.query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [filter.query]);
  const input = {
    query,
    module: filter.module,
    result: filter.result,
    period: filter.period,
    anchor,
    timezone: timezone ?? "UTC",
    cursor: cursors[index],
  };
  const records = useQuery({
    queryKey: ["audit-directory", scope, input],
    queryFn: () => readAudit(scope, input),
    enabled: !!timezone && tab === "records",
    retry: false,
    refetchOnWindowFocus: false,
  });
  const tracking = useQuery({
    queryKey: ["tracking-directory", scope, input, kind, state],
    queryFn: () => readTracking(scope, { ...input, kind, state }),
    enabled: !!timezone && tab === "operations",
    retry: false,
    refetchOnWindowFocus: false,
  });
  const source = tab === "records" ? records : tracking;
  const rows = timezone && !records.isError ? records.data?.items : undefined;
  const operations = timezone && !tracking.isError ? tracking.data : undefined;
  const detail = tab === "records" ? rows?.find((row) => row.id === detailId) : undefined;
  const date = (value: string) =>
    new Intl.DateTimeFormat("tr-TR", {
      timeZone: timezone!,
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value)) + ` ${timezone}`;
  const formatCount = (value: number) => value.toLocaleString("tr-TR");
  const next = !source.isError && timezone ? source.data?.next_cursor : undefined;
  const refresh = () => {
    reset();
    setAnchor(new Date().toISOString());
  };
  return (
    <>
      <AuditView
        tab={tab}
        onTab={(value) => {
          setTab(value);
          reset();
        }}
        filter={filter}
        onFilter={(value) => {
          setFilter(value);
          reset();
        }}
        modules={auditModules.map((id) => ({ id, label: id }))}
        results={[{ id: "recorded", label: t(($) => $.audit.recorded) }]}
        filtersAvailable={!!timezone}
        rows={
          rows?.map((row) => ({
            id: row.id,
            date: date(row.created_at),
            actor: row.actor_display,
            action: row.action,
            subject: row.subject_title ?? row.subject.type,
            result: t(($) => $.audit.recorded),
          })) ?? null
        }
        operations={
          operations?.items.map((row) => ({
            id: `${row.kind}:${row.id}`,
            title: row.operation,
            context: `${t(($) => $.audit.kinds[row.kind])} · ${date(row.created_at)}`,
            state: row.state,
            note: [
              row.safe_error_code,
              row.expires_at ? t(($) => $.audit.expiry, { time: date(row.expires_at) }) : undefined,
              row.next_attempt_at
                ? t(($) => $.audit.nextAttempt, { time: date(row.next_attempt_at) })
                : undefined,
            ]
              .filter(Boolean)
              .join(" · "),
            ...(row.progress_count !== null
              ? {
                  progress: {
                    count: row.progress_count,
                    total: row.total_count,
                    label: t(($) => $.audit.progress),
                  },
                }
              : {}),
            action: { label: t(($) => $.audit.refresh), onAction: () => void tracking.refetch() },
          })) ?? null
        }
        summary={{
          attention: operations ? formatCount(operations.summary.attention) : null,
          running: operations ? formatCount(operations.summary.running) : null,
          retry: operations ? formatCount(operations.summary.retry) : null,
          completed: operations ? formatCount(operations.summary.completed) : null,
        }}
        attentionCount={operations ? formatCount(operations.summary.attention) : undefined}
        count={rows ? t(($) => $.audit.pageCount, { count: rows.length }) : undefined}
        onOpen={setDetail}
        pagination={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              isDisabled={index === 0 || source.isFetching}
              onPress={() => {
                setIndex((value) => value - 1);
                setDetail(undefined);
              }}
            >
              {t(($) => $.earnings.previousPage)}
            </Button>
            <Button
              variant="outline"
              size="sm"
              isDisabled={!next || source.isFetching}
              onPress={() => {
                if (next) {
                  setCursors((values) => [...values.slice(0, index + 1), next]);
                  setIndex((value) => value + 1);
                  setDetail(undefined);
                }
              }}
            >
              {t(($) => $.earnings.nextPage)}
            </Button>
          </div>
        }
        notice={
          <div className="space-y-3">
            <Alert>
              <AlertDescription>
                {tab === "records"
                  ? t(($) => $.audit.nativeRecords)
                  : t(($) => $.audit.nativeTracking)}
              </AlertDescription>
            </Alert>
            {tab === "operations" && (
              <div className="flex flex-wrap items-end gap-3">
                <Field>
                  <FieldLabel htmlFor="tracking-kind">{t(($) => $.audit.kind)}</FieldLabel>
                  <NativeSelect
                    id="tracking-kind"
                    value={kind}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (
                        value === "all" ||
                        value === "operation" ||
                        value === "preview" ||
                        value === "job"
                      ) {
                        setKind(value);
                        reset();
                      }
                    }}
                  >
                    {(["all", "operation", "preview", "job"] as const).map((value) => (
                      <NativeSelectOption key={value} value={value}>
                        {t(($) => $.audit.kinds[value])}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor="tracking-state">{t(($) => $.audit.state)}</FieldLabel>
                  <Input
                    id="tracking-state"
                    value={state}
                    maxLength={200}
                    onChange={(event) => {
                      setState(event.target.value);
                      reset();
                    }}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="tracking-search">{t(($) => $.audit.searchLabel)}</FieldLabel>
                  <Input
                    id="tracking-search"
                    type="search"
                    maxLength={200}
                    value={filter.query}
                    onChange={(event) => {
                      setFilter({ ...filter, query: event.target.value });
                      reset();
                    }}
                  />
                </Field>
              </div>
            )}
            {(source.isError || !timezone) && (
              <Alert variant="destructive">
                <AlertDescription role="alert">{t(($) => $.audit.unread)}</AlertDescription>
              </Alert>
            )}
            <Button variant="outline" isDisabled={source.isFetching || !timezone} onPress={refresh}>
              {t(($) => $.audit.refresh)}
            </Button>
          </div>
        }
      />
      {detail && timezone && (
        <AuditDetailSheet
          detail={{
            id: detail.id,
            title: detail.action,
            subject: detail.subject_title ?? detail.subject.type,
            date: date(detail.created_at),
            actor: detail.actor_display,
            module: detail.module ?? undefined,
            result: t(($) => $.audit.recorded),
            reason: detail.reason ?? undefined,
            changes:
              detail.diff?.changes.map((row) => ({
                field: row.field,
                before:
                  row.old_value === null ? t(($) => $.audit.notProvided) : String(row.old_value),
                after:
                  row.new_value === null ? t(($) => $.audit.notProvided) : String(row.new_value),
              })) ?? [],
          }}
          onClose={() => setDetail(undefined)}
        />
      )}
    </>
  );
}
