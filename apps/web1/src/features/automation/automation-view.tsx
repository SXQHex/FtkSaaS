import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "../../components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "../../components/ui/table";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Switch } from "../../components/ui/switch";
import { Empty, EmptyDescription } from "../../components/ui/empty";
export type AutomationTab = "automations" | "segments" | "jobs";
export interface AutomationRow {
  id: string;
  name: string;
  trigger: string;
  action: string;
  lastJob: string;
  enabled: boolean;
  canRun: boolean;
}
export interface SegmentRow {
  id: string;
  name: string;
  conditions: string;
  members: string;
  usedBy: string;
}
export interface AutomationJobRow {
  id: string;
  automationId: string;
  automation: string;
  when: string;
  initiator: string;
  state: string;
  targets: string;
  emailAccepted: string;
  delivery: string;
  canRetry: boolean;
}
export function AutomationView({
  tab,
  onTab,
  automations,
  segments,
  jobs,
  onAdd,
  onEdit,
  onSegment,
  onToggle,
  onRun,
  onRetry,
  locked = false,
  notice,
  pagination,
  jobsPlaceholder,
  onDiscover,
  jobSummary,
}: {
  tab: AutomationTab;
  onTab: (value: AutomationTab) => void;
  automations: AutomationRow[] | null;
  segments: SegmentRow[] | null;
  jobs: AutomationJobRow[] | null;
  onAdd?: () => void;
  onEdit: (id: string) => void;
  onSegment: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onRun: (id: string) => void;
  onRetry: (automationId: string, id: string) => void;
  locked?: boolean;
  notice?: ReactNode;
  pagination?: ReactNode;
  jobsPlaceholder?: ReactNode;
  onDiscover?: (id: string, mode: "matches" | "automations") => void;
  jobSummary?: ReactNode;
}) {
  const { t } = useTranslation();
  const unknown = t(($) => $.automation.unknown),
    empty = (
      <Empty>
        <EmptyDescription>{t(($) => $.automation.empty)}</EmptyDescription>
      </Empty>
    );
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t(($) => $.automation.title)}</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {t(($) => $.automation.description)}
          </p>
        </div>
        {tab !== "jobs" && (
          <Button isDisabled={locked || !onAdd} onPress={onAdd}>
            {tab === "segments" ? t(($) => $.automation.addSegment) : t(($) => $.automation.add)}
          </Button>
        )}
      </header>
      {notice}
      <Tabs
        selectedKey={tab}
        onSelectionChange={(key) => {
          if (!locked && ["automations", "segments", "jobs"].includes(String(key)))
            onTab(key as AutomationTab);
        }}
      >
        <TabsList aria-label={t(($) => $.automation.tabsLabel)} className="max-w-full flex-wrap">
          {(["automations", "segments", "jobs"] as const).map((key) => (
            <TabsTrigger key={key} id={key} isDisabled={locked}>
              {t(($) => $.automation.tabs[key])}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent id="automations">
          <Card>
            <CardHeader className="sr-only">
              <CardTitle>
                <h2>{t(($) => $.automation.tabs.automations)}</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {automations === null ? (
                <p>{t(($) => $.automation.loading)}</p>
              ) : (
                <div
                  role="region"
                  aria-label={t(($) => $.automation.tabs.automations)}
                  tabIndex={0}
                  className="overflow-x-auto rounded-md focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <Table
                    aria-label={t(($) => $.automation.tabs.automations)}
                    className="min-w-[44rem]"
                  >
                    <TableHeader>
                      <TableHead isRowHeader>{t(($) => $.automation.columns.automation)}</TableHead>
                      <TableHead>{t(($) => $.automation.columns.when)}</TableHead>
                      <TableHead>{t(($) => $.automation.columns.action)}</TableHead>
                      <TableHead>{t(($) => $.automation.columns.lastJob)}</TableHead>
                      <TableHead>{t(($) => $.automation.columns.operation)}</TableHead>
                      <TableHead>{t(($) => $.automation.columns.enabled)}</TableHead>
                    </TableHeader>
                    <TableBody renderEmptyState={() => empty}>
                      {automations.map((row) => (
                        <TableRow key={row.id} id={row.id}>
                          <TableCell>
                            <Button
                              variant="ghost"
                              className="h-auto justify-start px-0 text-start whitespace-normal"
                              isDisabled={locked}
                              onPress={() => onEdit(row.id)}
                            >
                              {row.name}
                            </Button>
                          </TableCell>
                          <TableCell>{row.trigger}</TableCell>
                          <TableCell>{row.action}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{row.lastJob}</Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              isDisabled={locked || !row.canRun}
                              onPress={() => onRun(row.id)}
                            >
                              {t(($) => $.automation.run)}
                            </Button>
                          </TableCell>
                          <TableCell>
                            <Switch
                              aria-label={t(($) => $.automation.toggleFor, { name: row.name })}
                              isSelected={row.enabled}
                              isDisabled={locked}
                              onChange={(value) => onToggle(row.id, value)}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex-wrap justify-between gap-3">
              <span className="text-sm text-muted-foreground">
                {automations
                  ? t(($) => $.automation.pageCount, { count: automations.length })
                  : unknown}
              </span>
              {pagination}
            </CardFooter>
          </Card>
        </TabsContent>
        <TabsContent id="segments">
          <Card>
            <CardHeader className="sr-only">
              <CardTitle>
                <h2>{t(($) => $.automation.tabs.segments)}</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {segments === null ? (
                <p>{t(($) => $.automation.loading)}</p>
              ) : (
                <div
                  role="region"
                  aria-label={t(($) => $.automation.tabs.segments)}
                  tabIndex={0}
                  className="overflow-x-auto rounded-md focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <Table
                    aria-label={t(($) => $.automation.tabs.segments)}
                    className="min-w-[38rem]"
                  >
                    <TableHeader>
                      <TableHead isRowHeader>{t(($) => $.automation.columns.segment)}</TableHead>
                      <TableHead>{t(($) => $.automation.columns.conditions)}</TableHead>
                      <TableHead>{t(($) => $.automation.columns.members)}</TableHead>
                      <TableHead>{t(($) => $.automation.columns.usedBy)}</TableHead>
                      <TableHead>{t(($) => $.automation.columns.operation)}</TableHead>
                    </TableHeader>
                    <TableBody renderEmptyState={() => empty}>
                      {segments.map((row) => (
                        <TableRow key={row.id} id={row.id}>
                          <TableCell>{row.name}</TableCell>
                          <TableCell>{row.conditions}</TableCell>
                          <TableCell>
                            {onDiscover ? (
                              <Button
                                variant="ghost"
                                isDisabled={locked}
                                onPress={() => onDiscover(row.id, "matches")}
                              >
                                {t(($) => $.automation.discovery.matches)}
                              </Button>
                            ) : (
                              row.members
                            )}
                          </TableCell>
                          <TableCell>
                            {onDiscover ? (
                              <Button
                                variant="ghost"
                                isDisabled={locked}
                                onPress={() => onDiscover(row.id, "automations")}
                              >
                                {t(($) => $.automation.discovery.automations)}
                              </Button>
                            ) : (
                              row.usedBy
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              isDisabled={locked}
                              onPress={() => onSegment(row.id)}
                            >
                              {t(($) => $.automation.edit)}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <p className="text-sm text-muted-foreground">{t(($) => $.automation.segmentHint)}</p>
              {pagination}
            </CardFooter>
          </Card>
        </TabsContent>
        <TabsContent id="jobs">
          {jobSummary}
          <Card>
            <CardHeader className="sr-only">
              <CardTitle>
                <h2>{t(($) => $.automation.tabs.jobs)}</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {jobs === null ? (
                (jobsPlaceholder ?? <p>{t(($) => $.automation.loading)}</p>)
              ) : (
                <div
                  role="region"
                  aria-label={t(($) => $.automation.tabs.jobs)}
                  tabIndex={0}
                  className="overflow-x-auto rounded-md focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <Table aria-label={t(($) => $.automation.tabs.jobs)} className="min-w-[50rem]">
                    <TableHeader>
                      <TableHead isRowHeader>{t(($) => $.automation.columns.time)}</TableHead>
                      <TableHead>{t(($) => $.automation.columns.automation)}</TableHead>
                      <TableHead>{t(($) => $.automation.columns.initiator)}</TableHead>
                      <TableHead>{t(($) => $.automation.columns.jobState)}</TableHead>
                      <TableHead>{t(($) => $.automation.columns.targets)}</TableHead>
                      <TableHead>{t(($) => $.automation.columns.emailAccepted)}</TableHead>
                      <TableHead>{t(($) => $.automation.columns.delivery)}</TableHead>
                      <TableHead>{t(($) => $.automation.columns.operation)}</TableHead>
                    </TableHeader>
                    <TableBody renderEmptyState={() => empty}>
                      {jobs.map((row) => (
                        <TableRow key={row.id} id={row.id}>
                          <TableCell>{row.when}</TableCell>
                          <TableCell>{row.automation}</TableCell>
                          <TableCell>{row.initiator}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{row.state}</Badge>
                          </TableCell>
                          <TableCell>{row.targets}</TableCell>
                          <TableCell>{row.emailAccepted}</TableCell>
                          <TableCell>{row.delivery}</TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              isDisabled={locked || !row.canRetry}
                              onPress={() => onRetry(row.automationId, row.id)}
                            >
                              {t(($) => $.automation.retry)}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <p className="text-sm text-muted-foreground">{t(($) => $.automation.jobHint)}</p>
              {pagination}
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
