import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { UploadIcon, SearchIcon } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../../components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "../../components/ui/table";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../../components/ui/input-group";
import { NativeSelect, NativeSelectOption } from "../../components/ui/native-select";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Progress } from "../../components/ui/progress";
import {
  ItemGroup,
  Item,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
  ItemSeparator,
} from "../../components/ui/item";
import { Empty, EmptyDescription } from "../../components/ui/empty";
export interface AuditFilter {
  query: string;
  module: string;
  result: string;
  period: "1" | "7" | "30" | "all";
}
export interface AuditRow {
  id: string;
  date: string;
  actor: string;
  action: string;
  subject: string;
  result: string;
  resultTone?: "default" | "destructive" | "secondary" | "outline";
}
export interface AuditOperationRow {
  id: string;
  title: string;
  context: string;
  state: string;
  note?: string;
  progress?: { count: number; total: number | null; label: string };
  action?: { label: string; onAction: () => void };
}
export function AuditView({
  tab,
  onTab,
  filter,
  onFilter,
  modules,
  results,
  rows,
  operations,
  summary,
  attentionCount,
  count,
  notice,
  pagination,
  onOpen,
  onExport,
  locked = false,
  filtersAvailable = false,
}: {
  tab: "records" | "operations";
  onTab: (value: "records" | "operations") => void;
  filter: AuditFilter;
  onFilter: (value: AuditFilter) => void;
  modules: { id: string; label: string }[];
  results: { id: string; label: string }[];
  rows: AuditRow[] | null;
  operations: AuditOperationRow[] | null;
  summary: Record<"attention" | "running" | "retry" | "completed", string | null>;
  attentionCount?: string;
  count?: string;
  notice?: ReactNode;
  pagination?: ReactNode;
  onOpen: (id: string) => void;
  onExport?: () => void;
  locked?: boolean;
  filtersAvailable?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="@container flex min-w-0 flex-col gap-5 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{t(($) => $.audit.title)}</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {t(($) => $.audit.description)}
          </p>
        </div>
        {tab === "records" && (
          <Button variant="outline" isDisabled={locked || !onExport} onPress={onExport}>
            <UploadIcon data-icon="inline-start" />
            {t(($) => $.audit.export)}
          </Button>
        )}
      </header>
      {notice}
      <Tabs
        selectedKey={tab}
        onSelectionChange={(key) => {
          if (!locked && (key === "records" || key === "operations")) onTab(key);
        }}
      >
        <TabsList variant="line" aria-label={t(($) => $.audit.tabsLabel)}>
          <TabsTrigger id="records" isDisabled={locked}>
            {t(($) => $.audit.records)}
          </TabsTrigger>
          <TabsTrigger id="operations" isDisabled={locked}>
            {t(($) => $.audit.operations)}
            {attentionCount !== undefined && <Badge variant="secondary">{attentionCount}</Badge>}
          </TabsTrigger>
        </TabsList>
        <TabsContent id="records">
          <Card className="min-w-0">
            <CardHeader className="flex flex-wrap items-center gap-2">
              <InputGroup className="w-full @md:max-w-sm">
                <InputGroupAddon>
                  <SearchIcon />
                </InputGroupAddon>
                <InputGroupInput
                  aria-label={t(($) => $.audit.searchLabel)}
                  placeholder={t(($) => $.audit.searchPlaceholder)}
                  value={filter.query}
                  disabled={locked || !filtersAvailable}
                  onChange={(event) => onFilter({ ...filter, query: event.target.value })}
                />
              </InputGroup>
              <NativeSelect
                aria-label={t(($) => $.audit.module)}
                value={filter.module}
                disabled={locked || !filtersAvailable}
                onChange={(event) => onFilter({ ...filter, module: event.target.value })}
                className="w-full @sm:w-40"
              >
                <NativeSelectOption value="">{t(($) => $.audit.allModules)}</NativeSelectOption>
                {modules.map((row) => (
                  <NativeSelectOption key={row.id} value={row.id}>
                    {row.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <NativeSelect
                aria-label={t(($) => $.audit.result)}
                value={filter.result}
                disabled={locked || !filtersAvailable}
                onChange={(event) => onFilter({ ...filter, result: event.target.value })}
                className="w-full @sm:w-36"
              >
                <NativeSelectOption value="">{t(($) => $.audit.allResults)}</NativeSelectOption>
                {results.map((row) => (
                  <NativeSelectOption key={row.id} value={row.id}>
                    {row.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <ToggleGroup
                aria-label={t(($) => $.audit.period)}
                selectionMode="single"
                disallowEmptySelection
                selectedKeys={[filter.period]}
                isDisabled={locked || !filtersAvailable}
                onSelectionChange={(keys) => {
                  const value = [...keys][0];
                  if (value === "1" || value === "7" || value === "30" || value === "all")
                    onFilter({ ...filter, period: value });
                }}
              >
                {(["1", "7", "30", "all"] as const).map((key) => (
                  <ToggleGroupItem key={key} id={key}>
                    {t(($) => $.audit.periods[key])}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </CardHeader>
            <CardContent className="min-w-0">
              <div
                role="region"
                tabIndex={0}
                aria-label={t(($) => $.audit.records)}
                className="min-w-0 overflow-x-auto rounded-md focus-visible:outline-2 focus-visible:outline-ring [&>[data-slot=table-container]]:overflow-visible"
              >
                <Table
                  aria-label={t(($) => $.audit.records)}
                  className="min-w-[42rem] [&_[data-slot=table-head]]:sticky [&_[data-slot=table-head]]:top-0 [&_[data-slot=table-head]]:z-10 [&_[data-slot=table-head]]:bg-card"
                >
                  <TableHeader>
                    <TableHead isRowHeader>{t(($) => $.audit.time)}</TableHead>
                    <TableHead>{t(($) => $.audit.actor)}</TableHead>
                    <TableHead>{t(($) => $.audit.action)}</TableHead>
                    <TableHead>{t(($) => $.audit.subject)}</TableHead>
                    <TableHead>{t(($) => $.audit.result)}</TableHead>
                  </TableHeader>
                  <TableBody
                    renderEmptyState={() => (
                      <Empty>
                        <EmptyDescription>
                          {rows === null ? t(($) => $.audit.unread) : t(($) => $.audit.empty)}
                        </EmptyDescription>
                      </Empty>
                    )}
                  >
                    {(rows ?? []).map((row) => (
                      <TableRow
                        key={row.id}
                        id={row.id}
                        textValue={`${row.date} ${row.actor} ${row.action}`}
                      >
                        <TableCell className="tabular-nums text-muted-foreground">
                          {row.date}
                        </TableCell>
                        <TableCell>{row.actor}</TableCell>
                        <TableCell>
                          <Button
                            variant="link"
                            className="h-auto whitespace-normal text-left"
                            onPress={() => onOpen(row.id)}
                            isDisabled={locked}
                          >
                            {row.action}
                          </Button>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{row.subject}</TableCell>
                        <TableCell>
                          <Badge variant={row.resultTone ?? "secondary"}>{row.result}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
            <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t">
              <p role="status" className="text-xs text-muted-foreground">
                {count ?? (rows === null ? t(($) => $.audit.unread) : undefined)}
              </p>
              {pagination}
            </CardFooter>
          </Card>
        </TabsContent>
        <TabsContent id="operations">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="grid min-w-0 grid-cols-2 gap-4 @4xl:grid-cols-4">
              {(["attention", "running", "retry", "completed"] as const).map((key) => (
                <Card key={key} className="min-w-0">
                  <CardHeader>
                    <CardDescription>{t(($) => $.audit.metrics[key])}</CardDescription>
                    <CardTitle className="text-2xl tabular-nums wrap-anywhere">
                      {summary[key] ?? "—"}
                    </CardTitle>
                    <CardDescription>{t(($) => $.audit.metricHints[key])}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>
                  <h2>{t(($) => $.audit.operations)}</h2>
                </CardTitle>
                <CardDescription>{t(($) => $.audit.operationsDescription)}</CardDescription>
              </CardHeader>
              <CardContent>
                {operations === null || operations.length === 0 ? (
                  <Empty>
                    <EmptyDescription>
                      {operations === null
                        ? t(($) => $.audit.unread)
                        : t(($) => $.audit.emptyOperations)}
                    </EmptyDescription>
                  </Empty>
                ) : (
                  <ItemGroup>
                    {operations.map((row, index) => (
                      <div key={row.id}>
                        {index > 0 && <ItemSeparator />}
                        <Item className="flex-wrap px-0">
                          <ItemContent className="min-w-0">
                            <ItemTitle className="wrap-anywhere">{row.title}</ItemTitle>
                            <ItemDescription className="wrap-anywhere">
                              {row.context}
                              {row.note ? ` · ${row.note}` : ""}
                            </ItemDescription>
                            {row.progress && (
                              <Progress
                                aria-label={row.progress.label}
                                value={row.progress.total === null ? 0 : row.progress.count}
                                isIndeterminate={row.progress.total === null}
                                maxValue={Math.max(row.progress.total ?? 1, 1)}
                                valueLabel={
                                  row.progress.total === null
                                    ? undefined
                                    : `${row.progress.count} / ${row.progress.total}`
                                }
                              />
                            )}
                          </ItemContent>
                          <ItemActions className="flex-wrap">
                            <Badge variant="secondary">{row.state}</Badge>
                            {row.action && (
                              <Button
                                variant="outline"
                                size="sm"
                                onPress={row.action.onAction}
                                isDisabled={locked}
                              >
                                {row.action.label}
                              </Button>
                            )}
                          </ItemActions>
                        </Item>
                      </div>
                    ))}
                  </ItemGroup>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
