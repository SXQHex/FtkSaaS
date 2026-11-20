import { useId, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { PlusIcon, SearchIcon } from "lucide-react";
import type { CrmPipelineStage, CrmPipelineSummary } from "@ftksaas/api-contracts";
import { LeadsBoard, type LeadRow } from "./leads-board";
import {
  Card,
  CardHeader,
  CardContent,
  CardDescription,
  CardFooter,
} from "@ftksaas/ui/components/card";
import { Button } from "@ftksaas/ui/components/button";
import { Badge } from "@ftksaas/ui/components/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@ftksaas/ui/components/tabs";
import { ToggleGroup, ToggleGroupItem } from "@ftksaas/ui/components/toggle-group";
import { InputGroup, InputGroupInput, InputGroupAddon } from "@ftksaas/ui/components/input-group";
import { NativeSelect, NativeSelectOption } from "@ftksaas/ui/components/native-select";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@ftksaas/ui/components/table";
import { Empty, EmptyDescription } from "@ftksaas/ui/components/empty";
export type LeadTab = "board" | "tasks" | "apps" | "list";
export interface LeadsSummary {
  open: string | null;
  today: string | null;
  late: string | null;
  converted: string | null;
}
export function LeadsView({
  rows,
  stages,
  pipelineSummary,
  summary,
  pendingCounts,
  tab,
  onTab,
  onSelect,
  onStage,
  onAdd,
  search,
  onSearch,
  owner,
  onOwner,
  owners,
  ownerActions,
  stageFilter,
  onStageFilter,
  filtersAvailable = false,
  advanced = true,
  disabled = false,
  notice,
  pagination,
  tasks,
  applications,
}: {
  rows: LeadRow[];
  stages: CrmPipelineStage[];
  pipelineSummary?: CrmPipelineSummary;
  summary: LeadsSummary;
  pendingCounts: Partial<Record<LeadTab, number>>;
  tab: LeadTab;
  onTab: (tab: LeadTab) => void;
  onSelect: (id: string) => void;
  onStage?: (id: string, stage: string) => void;
  onAdd?: () => void;
  search: string;
  onSearch?: (value: string) => void;
  owner: string;
  onOwner?: (value: string) => void;
  owners: { id: string; name: string }[];
  ownerActions?: ReactNode;
  stageFilter: string;
  onStageFilter?: (value: string) => void;
  filtersAvailable?: boolean;
  advanced?: boolean;
  disabled?: boolean;
  notice?: ReactNode;
  pagination?: ReactNode;
  tasks: ReactNode;
  applications: ReactNode;
}) {
  const { t } = useTranslation();
  const countId = useId();
  const stats = [
    { label: t(($) => $.leads.stats.open), value: summary.open },
    { label: t(($) => $.leads.stats.today), value: summary.today },
    { label: t(($) => $.leads.stats.late), value: summary.late },
    { label: t(($) => $.leads.stats.converted), value: summary.converted },
  ];
  return (
    <div className="flex min-w-0 flex-col gap-4 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t(($) => $.leads.title)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t(($) => $.leads.description)}</p>
        </div>
        <Button onPress={onAdd} isDisabled={disabled || !onAdd}>
          <PlusIcon data-icon="inline-start" />
          {t(($) => $.leads.add)}
        </Button>
      </header>
      <div className="grid min-w-0 grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader>
              <CardDescription>{stat.label}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">{stat.value ?? "—"}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent>
          <ToggleGroup
            aria-label={t(($) => $.leads.stage)}
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={new Set([stageFilter])}
            isDisabled={disabled || !filtersAvailable || !onStageFilter}
            onSelectionChange={(keys) => {
              const key = [...keys][0];
              if (typeof key === "string") onStageFilter?.(key);
            }}
            className="flex-wrap"
            variant="outline"
          >
            <ToggleGroupItem id="all">{t(($) => $.leads.all)}</ToggleGroupItem>
            {stages.map((stage) => (
              <ToggleGroupItem key={stage.key} id={stage.key}>
                {stage.name}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </CardContent>
      </Card>
      {notice}
      <Card className="min-w-0 gap-0 pt-3">
        <Tabs
          selectedKey={tab}
          onSelectionChange={(key) => onTab(key as LeadTab)}
          isDisabled={disabled}
        >
          <CardHeader className="gap-3 pb-3">
            <TabsList
              aria-label={t(($) => $.leads.sections)}
              variant="line"
              className="grid w-full grid-cols-2 gap-1 group-data-horizontal/tabs:h-auto sm:flex sm:w-fit"
            >
              {(["board", "tasks", "apps", "list"] as const).map((key) => {
                const count = pendingCounts[key];
                const descriptionId = `${countId}-${key}`;
                return (
                  <TabsTrigger
                    key={key}
                    id={key}
                    className="h-9 flex-none gap-1.5"
                    aria-describedby={count == null ? undefined : descriptionId}
                    isDisabled={!advanced && key === "board"}
                  >
                    {t(($) => $.leads.tabs[key])}
                    {count != null && (
                      <>
                        <Badge variant="secondary" className="tabular-nums" aria-hidden="true">
                          {count.toLocaleString("tr-TR")}
                        </Badge>
                        <span id={descriptionId} hidden>
                          {t(($) => $.leads.pendingTabCount, {
                            value: count.toLocaleString("tr-TR"),
                          })}
                        </span>
                      </>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>
            <search
              className="flex flex-wrap items-center gap-3"
              aria-label={t(($) => $.leads.search)}
            >
              <InputGroup className="w-full max-w-64">
                <InputGroupAddon>
                  <SearchIcon />
                </InputGroupAddon>
                <InputGroupInput
                  aria-label={t(($) => $.leads.search)}
                  placeholder={t(($) => $.leads.search)}
                  name="lead-search"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={search}
                  disabled={disabled || !onSearch}
                  onChange={(event) => onSearch?.(event.target.value)}
                />
              </InputGroup>
              <NativeSelect
                aria-label={t(($) => $.leads.owner)}
                name="lead-owner-filter"
                value={owner}
                disabled={disabled || !filtersAvailable || !onOwner}
                onChange={(event) => onOwner?.(event.target.value)}
                className="w-full sm:ml-auto sm:w-44"
              >
                <NativeSelectOption value="">{t(($) => $.leads.allOwners)}</NativeSelectOption>
                <NativeSelectOption value="unassigned">
                  {t(($) => $.leads.unassigned)}
                </NativeSelectOption>
                {owners.map((row) => (
                  <NativeSelectOption key={row.id} value={row.id}>
                    {row.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {ownerActions}
            </search>
          </CardHeader>
          <TabsContent id="board" className="mt-0">
            <p className="px-5 text-xs text-muted-foreground">{t(($) => $.leads.boardHint)}</p>
            {pipelineSummary && (
              <dl
                aria-label={t(($) => $.leads.trialTotals)}
                className="flex flex-wrap gap-4 px-5 py-3 text-sm"
              >
                {(["offered", "registered", "attended"] as const).map((key) => (
                  <div key={key}>
                    <dt className="text-muted-foreground">
                      {t(($) => $.leads.trialTotalsLabels[key])}
                    </dt>
                    <dd className="font-semibold tabular-nums">
                      {pipelineSummary.trials[key].toLocaleString("tr-TR")}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {stages.length ? (
              <LeadsBoard
                rows={rows}
                stages={stages}
                stageCounts={pipelineSummary?.stages}
                disabled={disabled}
                onSelect={onSelect}
                onStage={onStage}
              />
            ) : (
              <Empty>
                <EmptyDescription>{t(($) => $.leads.noCatalog)}</EmptyDescription>
              </Empty>
            )}
          </TabsContent>
          <TabsContent id="tasks" className="mt-0 px-5 pb-4">
            {tasks}
          </TabsContent>
          <TabsContent id="apps" className="mt-0 px-5 pb-4">
            {applications}
          </TabsContent>
          <TabsContent id="list" className="mt-0">
            <Table aria-label={t(($) => $.leads.sections)}>
              <TableHeader>
                {[
                  t(($) => $.leads.candidate),
                  t(($) => $.leads.stage),
                  t(($) => $.leads.interest),
                  t(($) => $.leads.source),
                  t(($) => $.leads.owner),
                  t(($) => $.leads.next),
                ].map((label, index) => (
                  <TableHead id={label} isRowHeader={index === 0} key={label}>
                    {label}
                  </TableHead>
                ))}
              </TableHeader>
              <TableBody
                renderEmptyState={() => (
                  <Empty>
                    <EmptyDescription>{t(($) => $.leads.empty)}</EmptyDescription>
                  </Empty>
                )}
              >
                {rows.map((row) => (
                  <TableRow id={row.id} key={row.id} textValue={row.name}>
                    <TableCell>
                      <Button
                        variant="link"
                        className="h-auto p-0 text-left whitespace-normal"
                        isDisabled={disabled}
                        onPress={() => onSelect(row.id)}
                      >
                        {row.name}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {row.stageName ?? t(($) => $.leads.noStage)}
                      </Badge>
                    </TableCell>
                    <TableCell>{row.interest}</TableCell>
                    <TableCell>{row.source}</TableCell>
                    <TableCell>{row.assignedName ?? t(($) => $.leads.unassigned)}</TableCell>
                    <TableCell>
                      {row.nextAction ?? "—"}
                      {row.due && <p className="text-xs text-muted-foreground">{row.due}</p>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
        <CardFooter className="flex-wrap justify-between gap-3 pt-3">
          <p className="text-xs text-muted-foreground">
            {t(($) => $.leads.pageHint, { loaded: rows.length })}
          </p>
          {pagination}
        </CardFooter>
      </Card>
    </div>
  );
}
