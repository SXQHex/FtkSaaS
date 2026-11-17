import { useId, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { UploadIcon } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../../components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "../../components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "../../components/ui/chart";
import { Field, FieldGroup, FieldLabel } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Progress } from "../../components/ui/progress";
export type ReportTab = "summary" | "collections" | "instructors" | "files";
export type ReportRange = "30" | "90" | "custom";
export type ReportBreakdown = "member" | "instructor" | "package";
export interface ReportMetric {
  value: string;
  hint?: string;
}
export interface ReportChartPoint {
  id: string;
  label: string;
  value: number;
  display: string;
}
export interface ReportRow {
  id: string;
  cells: ReactNode[];
}
export interface ReportFileRow {
  id: string;
  name: string;
  detail: string;
  state: string;
  progress?: number;
  canDownload?: boolean;
  canRetry?: boolean;
  canReadRows?: boolean;
}
export interface ReportPresentation {
  summary: ReportMetric[];
  collections: ReportMetric[];
  instructors: ReportMetric[];
  weeks: ReportChartPoint[];
  packages: ReportChartPoint[];
  funnel: ReportChartPoint[];
  packageSummary: string;
  funnelSummary: string;
  lessons: ReportRow[];
  breakdowns: Record<ReportBreakdown, { description: string; rows: ReportRow[] }>;
  earnings: ReportRow[];
  exports: ReportFileRow[];
  imports: ReportFileRow[];
}
export function ReportTable({
  title,
  description,
  columns,
  rows,
  action,
}: {
  title: string;
  description?: string;
  columns: string[];
  rows: ReportRow[] | undefined;
  action?: ReactNode;
}) {
  const { t } = useTranslation(),
    id = useId();
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>
            <h2 id={id}>{title}</h2>
          </CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {action}
      </CardHeader>
      <CardContent>
        <div
          role="region"
          aria-labelledby={id}
          tabIndex={0}
          className="overflow-x-auto rounded-md focus-visible:outline-2 focus-visible:outline-ring"
        >
          <Table aria-labelledby={id} className="min-w-[36rem]">
            <TableHeader>
              {columns.map((column, index) => (
                <TableHead key={column} isRowHeader={index === 0}>
                  {column}
                </TableHead>
              ))}
            </TableHeader>
            <TableBody renderEmptyState={() => <p>{t(($) => $.reports.empty)}</p>}>
              {(rows ?? []).map((row) => (
                <TableRow key={row.id} id={row.id}>
                  {row.cells.map((cell, index) => (
                    <TableCell key={index}>{cell}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {!rows && <p>{t(($) => $.reports.unknown)}</p>}
      </CardContent>
    </Card>
  );
}
function ReportChart({
  title,
  description,
  points,
}: {
  title: string;
  description?: string;
  points: ReportChartPoint[] | undefined;
}) {
  const { t } = useTranslation(),
    id = useId();
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 id={id}>{title}</h2>
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <figure aria-labelledby={id}>
          <ChartContainer
            className="h-60 min-h-48 w-full [&_.recharts-surface:focus-visible]:outline-2 [&_.recharts-surface:focus-visible]:outline-ring"
            config={{ value: { label: title, color: "var(--chart-1)" } }}
          >
            <BarChart accessibilityLayer data={points ?? []}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" fill="var(--color-value)" radius={3} isAnimationActive={false} />
            </BarChart>
          </ChartContainer>
          <figcaption className="text-sm text-muted-foreground">{description ?? title}</figcaption>
        </figure>
        {points ? (
          <details>
            <summary className="cursor-pointer rounded-sm py-2 focus-visible:outline-2 focus-visible:outline-ring">
              {t(($) => $.reports.chartData)}
            </summary>
            <div role="region" aria-label={title} tabIndex={0} className="overflow-x-auto">
              <Table aria-label={title}>
                <TableHeader>
                  <TableHead isRowHeader>{t(($) => $.reports.columns.week)}</TableHead>
                  <TableHead>{title}</TableHead>
                </TableHeader>
                <TableBody>
                  {points.map((point) => (
                    <TableRow key={point.id} id={point.id}>
                      <TableCell>{point.label}</TableCell>
                      <TableCell>{point.display}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </details>
        ) : (
          <p>{t(($) => $.reports.unknown)}</p>
        )}
      </CardContent>
    </Card>
  );
}
function Metrics({ labels, values }: { labels: string[]; values: ReportMetric[] | undefined }) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 gap-3 min-[901px]:grid-cols-4">
      {labels.map((label, index) => (
        <Card key={label}>
          <CardHeader>
            <CardDescription>{label}</CardDescription>
            <CardTitle className="break-words text-2xl tabular-nums">
              {values?.[index]?.value ?? t(($) => $.reports.unknown)}
            </CardTitle>
            {values?.[index]?.hint && <CardDescription>{values[index]!.hint}</CardDescription>}
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
function Bars({ points }: { points: ReportChartPoint[] | undefined }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4">
      {points ? (
        points.map((point) => (
          <div key={point.id} className="flex flex-col gap-2">
            <div className="flex flex-wrap justify-between gap-2">
              <span>{point.label}</span>
              <span className="tabular-nums">{point.display}</span>
            </div>
            <Progress aria-label={point.label} value={point.value} />
          </div>
        ))
      ) : (
        <p>{t(($) => $.reports.unknown)}</p>
      )}
    </div>
  );
}
export function ReportsView({
  tab,
  onTab,
  range,
  onRange,
  from,
  to,
  onDates,
  breakdown,
  onBreakdown,
  data,
  onExport,
  onPeople,
  onFile,
  locked = false,
  notice,
}: {
  tab: ReportTab;
  onTab: (tab: ReportTab) => void;
  range: ReportRange;
  onRange: (range: ReportRange) => void;
  from: string;
  to: string;
  onDates: (from: string, to: string) => void;
  breakdown: ReportBreakdown;
  onBreakdown: (by: ReportBreakdown) => void;
  data?: ReportPresentation;
  onExport: () => void;
  onPeople: () => void;
  onFile: (kind: "export" | "import", id: string, action: "download" | "retry" | "rows") => void;
  locked?: boolean;
  notice?: ReactNode;
}) {
  const { t } = useTranslation();
  const column = (
    key: keyof (typeof import("../../locales/tr/common.json"))["reports"]["columns"],
  ) => t(($) => $.reports.columns[key]);
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t(($) => $.reports.title)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t(($) => $.reports.description)}</p>
        </div>
        <div className="flex max-w-full flex-wrap items-center gap-2">
          {tab !== "files" && (
            <ToggleGroup
              aria-label={t(($) => $.reports.period)}
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={[range]}
              onSelectionChange={(keys) => {
                const key = [...keys][0];
                if (!locked && ["30", "90", "custom"].includes(String(key)))
                  onRange(key as ReportRange);
              }}
              isDisabled={locked}
              variant="outline"
              size="sm"
              className="max-w-full flex-wrap"
            >
              {(["30", "90", "custom"] as const).map((key) => (
                <ToggleGroupItem key={key} id={key}>
                  {t(($) => $.reports.ranges[key])}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
          <Button variant="outline" isDisabled={locked} onPress={onExport}>
            <UploadIcon data-icon="inline-start" />
            {t(($) => $.reports.export)}
          </Button>
        </div>
      </header>
      {notice}
      {range === "custom" && tab !== "files" && (
        <Card>
          <CardContent>
            <FieldGroup className="flex flex-row flex-wrap gap-4">
              <Field className="w-auto">
                <FieldLabel htmlFor="report-from">{t(($) => $.reports.from)}</FieldLabel>
                <Input
                  id="report-from"
                  type="date"
                  value={from}
                  disabled={locked}
                  onChange={(e) => onDates(e.target.value, to)}
                />
              </Field>
              <Field className="w-auto">
                <FieldLabel htmlFor="report-to">{t(($) => $.reports.to)}</FieldLabel>
                <Input
                  id="report-to"
                  type="date"
                  value={to}
                  disabled={locked}
                  onChange={(e) => onDates(from, e.target.value)}
                />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>
      )}
      <Tabs
        selectedKey={tab}
        onSelectionChange={(key) => {
          if (!locked && ["summary", "collections", "instructors", "files"].includes(String(key)))
            onTab(key as ReportTab);
        }}
      >
        <TabsList
          aria-label={t(($) => $.reports.tabsLabel)}
          className="h-auto max-w-full flex-wrap"
        >
          {(["summary", "collections", "instructors", "files"] as const).map((key) => (
            <TabsTrigger key={key} id={key} isDisabled={locked}>
              {t(($) => $.reports.tabs[key])}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent id="summary" className="flex flex-col gap-5">
          <Metrics
            labels={[
              t(($) => $.reports.revenue),
              t(($) => $.reports.sold),
              t(($) => $.reports.occupancy),
              t(($) => $.reports.attendance),
            ]}
            values={data?.summary}
          />
          <div className="grid min-w-0 gap-4 min-[1181px]:grid-cols-[minmax(0,1fr)_22rem]">
            <ReportChart
              title={t(($) => $.reports.weekly)}
              description={t(($) => $.reports.weeklyHint)}
              points={data?.weeks}
            />
            <Card>
              <CardHeader>
                <CardTitle>
                  <h2>{t(($) => $.reports.packageSales)}</h2>
                </CardTitle>
                <CardDescription>
                  {data?.packageSummary ?? t(($) => $.reports.unknown)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Bars points={data?.packages} />
              </CardContent>
            </Card>
          </div>
          <ReportTable
            title={t(($) => $.reports.lessonOccupancy)}
            description={t(($) => $.reports.lessonHint)}
            columns={["lesson", "sessions", "occupancy", "attendance"].map((key) =>
              column(key as "lesson" | "sessions" | "occupancy" | "attendance"),
            )}
            rows={data?.lessons}
          />
        </TabsContent>
        <TabsContent id="collections" className="flex flex-col gap-5">
          <Metrics
            labels={[
              t(($) => $.reports.collected),
              t(($) => $.reports.debt),
              t(($) => $.reports.credit),
              t(($) => $.reports.collectionRate),
            ]}
            values={data?.collections}
          />
          <ReportTable
            title={t(($) => $.reports.breakdown)}
            description={data?.breakdowns[breakdown].description}
            action={
              <ToggleGroup
                aria-label={t(($) => $.reports.breakdown)}
                selectionMode="single"
                disallowEmptySelection
                selectedKeys={[breakdown]}
                onSelectionChange={(keys) => {
                  const key = [...keys][0];
                  if (!locked && ["member", "instructor", "package"].includes(String(key)))
                    onBreakdown(key as ReportBreakdown);
                }}
                isDisabled={locked}
                variant="outline"
                size="sm"
              >
                {(["member", "instructor", "package"] as const).map((key) => (
                  <ToggleGroupItem key={key} id={key}>
                    {t(($) => $.reports.by[key])}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            }
            columns={
              breakdown === "member"
                ? [column("member"), column("rights"), column("lastPayment"), column("debt")]
                : breakdown === "instructor"
                  ? [
                      column("instructor"),
                      column("sessions"),
                      column("participation"),
                      column("revenueShare"),
                    ]
                  : [column("package"), column("count"), column("gross")]
            }
            rows={data?.breakdowns[breakdown].rows}
          />
        </TabsContent>
        <TabsContent id="instructors" className="flex flex-col gap-5">
          <Metrics
            labels={[
              t(($) => $.reports.earnings),
              t(($) => $.reports.paid),
              t(($) => $.reports.remaining),
              t(($) => $.reports.averageEarning),
            ]}
            values={data?.instructors}
          />
          <ReportTable
            title={t(($) => $.reports.instructorEarnings)}
            description={t(($) => $.reports.instructorHint)}
            columns={[
              column("instructor"),
              column("closedSessions"),
              column("earning"),
              column("paid"),
              column("remaining"),
            ]}
            rows={data?.earnings}
          />
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>{t(($) => $.reports.funnel)}</h2>
              </CardTitle>
              <CardDescription>{t(($) => $.reports.funnelHint)}</CardDescription>
            </CardHeader>
            <CardContent>
              <Bars points={data?.funnel} />
              <p className="mt-3 text-sm text-muted-foreground">
                {data?.funnelSummary ?? t(($) => $.reports.unknown)}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent id="files" className="flex flex-col gap-5">
          {(["export", "import"] as const).map((kind) => (
            <Card key={kind}>
              <CardHeader className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>
                    <h2>
                      {kind === "export"
                        ? t(($) => $.reports.exports)
                        : t(($) => $.reports.imports)}
                    </h2>
                  </CardTitle>
                  <CardDescription>
                    {kind === "export"
                      ? t(($) => $.reports.exportsHint)
                      : t(($) => $.reports.importsHint)}
                  </CardDescription>
                </div>
                {kind === "import" && (
                  <Button variant="outline" size="sm" isDisabled={locked} onPress={onPeople}>
                    {t(($) => $.reports.goPeople)}
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {(kind === "export" ? data?.exports : data?.imports)?.length ? (
                  <ul className="flex flex-col gap-4">
                    {(kind === "export" ? data!.exports : data!.imports).map((row) => (
                      <li
                        key={row.id}
                        className="flex flex-wrap items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="break-words font-medium">{row.name}</p>
                          <p className="text-sm text-muted-foreground">{row.detail}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{row.state}</Badge>
                          {row.progress !== undefined && (
                            <Progress
                              className="w-24"
                              aria-label={
                                kind === "export"
                                  ? t(($) => $.reports.exportProgress)
                                  : t(($) => $.reports.importProgress)
                              }
                              value={row.progress}
                            />
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            isDisabled={
                              locked || !(row.canDownload || row.canReadRows || row.canRetry)
                            }
                            onPress={() =>
                              onFile(
                                kind,
                                row.id,
                                row.canDownload ? "download" : row.canReadRows ? "rows" : "retry",
                              )
                            }
                          >
                            {row.canReadRows
                              ? t(($) => $.reports.rows)
                              : row.canRetry
                                ? t(($) => $.reports.retry)
                                : t(($) => $.reports.download)}
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>{data ? t(($) => $.reports.empty) : t(($) => $.reports.unknown)}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
