import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { WalletIcon } from "lucide-react";
import {
  Card,
  CardHeader,
  CardDescription,
  CardTitle,
  CardContent,
  CardFooter,
} from "@ftksaas/ui/components/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@ftksaas/ui/components/tabs";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@ftksaas/ui/components/table";
import { NativeSelect, NativeSelectOption } from "@ftksaas/ui/components/native-select";
import { ToggleGroup, ToggleGroupItem } from "@ftksaas/ui/components/toggle-group";
import { Button } from "@ftksaas/ui/components/button";
import { Avatar, AvatarFallback } from "@ftksaas/ui/components/avatar";
import { Badge } from "@ftksaas/ui/components/badge";
import { Empty, EmptyDescription } from "@ftksaas/ui/components/empty";
export type EarningsTab = "instructors" | "lines" | "payments";
export interface EarningsInstructorRow {
  id: string;
  name: string;
  initials: string;
  agreement: string;
  agreementIds: string[];
  agreementDetail: string;
  sessions: string;
  earned: string;
  paid: string;
  remaining: string;
}
export interface EarningsLineRow {
  id: string;
  date: string;
  session: string;
  instructor: string;
  basis: string;
  amount: string;
  paid: string;
  remaining: string;
  state: string;
}
export interface EarningsPaymentRow {
  id: string;
  date: string;
  instructor: string;
  operation: string;
  amount: string;
  note: string;
  method: string;
  canCorrect: boolean;
}
export function EarningsView({
  tab,
  onTab,
  instructor,
  onInstructor,
  instructors,
  period,
  periods,
  onPeriod,
  summary,
  people,
  lines,
  payments,
  onPay,
  onAgreement,
  agreementStatus,
  onCorrect,
  notice,
  pagination,
  count,
  locked = false,
}: {
  tab: EarningsTab;
  onTab: (value: EarningsTab) => void;
  instructor: string;
  onInstructor: (value: string) => void;
  instructors: { id: string; name: string }[];
  period: string;
  periods: { id: string; label: string }[];
  onPeriod: (value: string) => void;
  summary: Record<"earned" | "paid" | "remaining" | "overpaid", string | null>;
  people: EarningsInstructorRow[] | null;
  lines: EarningsLineRow[] | null;
  payments: EarningsPaymentRow[] | null;
  onPay: (personId?: string) => void;
  onAgreement: (personId: string) => void;
  agreementStatus: (row: EarningsInstructorRow) => ReactNode;
  onCorrect: (id: string) => void;
  notice?: ReactNode;
  pagination?: ReactNode;
  count?: string;
  locked?: boolean;
}) {
  const { t } = useTranslation();
  const empty = (rows: unknown[] | null) => (
    <Empty>
      <EmptyDescription>
        {rows === null ? t(($) => $.earnings.unread) : t(($) => $.earnings.empty)}
      </EmptyDescription>
    </Empty>
  );
  const tableClass =
    "min-w-[48rem] [&_[data-slot=table-head]]:sticky [&_[data-slot=table-head]]:top-0 [&_[data-slot=table-head]]:bg-card [&_[data-slot=table-head]]:z-10";
  return (
    <div className="@container flex min-w-0 flex-col gap-5 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{t(($) => $.earnings.title)}</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {t(($) => $.earnings.description)}
          </p>
        </div>
        <Button onPress={() => onPay()} isDisabled={locked}>
          <WalletIcon data-icon="inline-start" />
          {t(($) => $.earnings.pay)}
        </Button>
      </header>
      <div className="grid min-w-0 grid-cols-2 gap-4 @4xl:grid-cols-4">
        {(["earned", "paid", "remaining", "overpaid"] as const).map((key) => (
          <Card key={key} className="min-w-0">
            <CardHeader>
              <CardDescription>{t(($) => $.earnings.metrics[key])}</CardDescription>
              <CardTitle className="text-2xl tabular-nums wrap-anywhere">
                {summary[key] ?? "—"}
              </CardTitle>
              <CardDescription>{t(($) => $.earnings.metricHints[key])}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
      {notice}
      <Card className="min-w-0">
        <Tabs
          selectedKey={tab}
          onSelectionChange={(key) => {
            if (!locked && (key === "instructors" || key === "lines" || key === "payments"))
              onTab(key);
          }}
        >
          <CardHeader className="flex flex-wrap items-center justify-between gap-3">
            <TabsList variant="line" aria-label={t(($) => $.earnings.tabsLabel)}>
              {(["instructors", "lines", "payments"] as const).map((key) => (
                <TabsTrigger
                  key={key}
                  id={key}
                  isDisabled={locked}
                  className="text-muted-foreground transition-shadow"
                >
                  {t(($) => $.earnings.tabs[key])}
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <NativeSelect
                aria-label={t(($) => $.earnings.instructor)}
                value={instructor}
                onChange={(event) => onInstructor(event.target.value)}
                disabled={locked}
                className="w-full @sm:w-44"
              >
                <NativeSelectOption value="">
                  {t(($) => $.earnings.allInstructors)}
                </NativeSelectOption>
                {instructors.map((row) => (
                  <NativeSelectOption key={row.id} value={row.id}>
                    {row.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <ToggleGroup
                aria-label={t(($) => $.earnings.period)}
                selectionMode="single"
                disallowEmptySelection
                selectedKeys={[period]}
                onSelectionChange={(keys) => {
                  const key = [...keys][0];
                  if (typeof key === "string") onPeriod(key);
                }}
                isDisabled={locked}
              >
                {periods.map((row) => (
                  <ToggleGroupItem key={row.id} id={row.id}>
                    {row.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </CardHeader>
          <CardContent className="min-w-0">
            <TabsContent id="instructors">
              <div
                role="region"
                tabIndex={0}
                aria-label={t(($) => $.earnings.tabs.instructors)}
                className="min-w-0 scroll-pl-32 overflow-x-auto rounded-md focus-visible:outline-2 focus-visible:outline-ring [&>[data-slot=table-container]]:overflow-visible"
              >
                <Table aria-label={t(($) => $.earnings.tabs.instructors)} className={tableClass}>
                  <TableHeader>
                    <TableHead isRowHeader className="w-32">
                      {t(($) => $.earnings.instructor)}
                    </TableHead>
                    <TableHead>{t(($) => $.earnings.agreement)}</TableHead>
                    <TableHead>{t(($) => $.earnings.sessions)}</TableHead>
                    <TableHead>{t(($) => $.earnings.title)}</TableHead>
                    <TableHead>{t(($) => $.earnings.metrics.paid)}</TableHead>
                    <TableHead>{t(($) => $.earnings.metrics.remaining)}</TableHead>
                    <TableHead>{t(($) => $.earnings.actions)}</TableHead>
                  </TableHeader>
                  <TableBody renderEmptyState={() => empty(people)}>
                    {(people ?? []).map((row) => (
                      <TableRow key={row.id} id={row.id} textValue={row.name}>
                        <TableCell className="sticky left-0 z-10 w-32 min-w-32 max-w-32 bg-card whitespace-normal">
                          <div className="flex items-center gap-2">
                            <Avatar size="sm">
                              <AvatarFallback>{row.initials}</AvatarFallback>
                            </Avatar>
                            <span className="min-w-0 wrap-anywhere">{row.name}</span>
                          </div>
                        </TableCell>
                        <TableCell focusMode="child" className="py-6">
                          <Button
                            variant="link"
                            onPress={() => onAgreement(row.id)}
                            isDisabled={locked}
                          >
                            {row.agreement}
                          </Button>
                          <p className="text-xs text-muted-foreground">{row.agreementDetail}</p>
                          {agreementStatus(row)}
                        </TableCell>
                        <TableCell className="tabular-nums">{row.sessions}</TableCell>
                        <TableCell className="tabular-nums">{row.earned}</TableCell>
                        <TableCell className="tabular-nums">{row.paid}</TableCell>
                        <TableCell className="tabular-nums">{row.remaining}</TableCell>
                        <TableCell focusMode="child" className="py-6">
                          <Button
                            size="sm"
                            variant="outline"
                            isDisabled={locked}
                            onPress={() => onPay(row.id)}
                          >
                            {t(($) => $.earnings.pay)}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
            <TabsContent id="lines">
              <div
                role="region"
                tabIndex={0}
                aria-label={t(($) => $.earnings.tabs.lines)}
                className="min-w-0 overflow-x-auto rounded-md focus-visible:outline-2 focus-visible:outline-ring [&>[data-slot=table-container]]:overflow-visible"
              >
                <Table aria-label={t(($) => $.earnings.tabs.lines)} className={tableClass}>
                  <TableHeader>
                    <TableHead isRowHeader>{t(($) => $.earnings.date)}</TableHead>
                    <TableHead>{t(($) => $.earnings.session)}</TableHead>
                    <TableHead>{t(($) => $.earnings.instructor)}</TableHead>
                    <TableHead>{t(($) => $.earnings.basis)}</TableHead>
                    <TableHead>{t(($) => $.earnings.amount)}</TableHead>
                    <TableHead>{t(($) => $.earnings.metrics.paid)}</TableHead>
                    <TableHead>{t(($) => $.earnings.metrics.remaining)}</TableHead>
                    <TableHead>{t(($) => $.earnings.state)}</TableHead>
                  </TableHeader>
                  <TableBody renderEmptyState={() => empty(lines)}>
                    {(lines ?? []).map((row) => (
                      <TableRow key={row.id} id={row.id} textValue={`${row.date} ${row.session}`}>
                        <TableCell className="sticky left-0 z-10 bg-card">{row.date}</TableCell>
                        <TableCell>{row.session}</TableCell>
                        <TableCell>{row.instructor}</TableCell>
                        <TableCell>{row.basis}</TableCell>
                        <TableCell className="tabular-nums">{row.amount}</TableCell>
                        <TableCell className="tabular-nums">{row.paid}</TableCell>
                        <TableCell className="tabular-nums">{row.remaining}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{row.state}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
            <TabsContent id="payments">
              <div
                role="region"
                tabIndex={0}
                aria-label={t(($) => $.earnings.tabs.payments)}
                className="min-w-0 overflow-x-auto rounded-md focus-visible:outline-2 focus-visible:outline-ring [&>[data-slot=table-container]]:overflow-visible"
              >
                <Table aria-label={t(($) => $.earnings.tabs.payments)} className={tableClass}>
                  <TableHeader>
                    <TableHead isRowHeader>{t(($) => $.earnings.date)}</TableHead>
                    <TableHead>{t(($) => $.earnings.instructor)}</TableHead>
                    <TableHead>{t(($) => $.earnings.operation)}</TableHead>
                    <TableHead>{t(($) => $.earnings.amount)}</TableHead>
                    <TableHead>{t(($) => $.earnings.note)}</TableHead>
                    <TableHead>{t(($) => $.earnings.actions)}</TableHead>
                  </TableHeader>
                  <TableBody renderEmptyState={() => empty(payments)}>
                    {(payments ?? []).map((row) => (
                      <TableRow
                        key={row.id}
                        id={row.id}
                        textValue={`${row.date} ${row.instructor}`}
                      >
                        <TableCell className="sticky left-0 z-10 bg-card">{row.date}</TableCell>
                        <TableCell>{row.instructor}</TableCell>
                        <TableCell>
                          <span>{row.operation}</span>
                          <p className="text-xs text-muted-foreground">{row.method}</p>
                        </TableCell>
                        <TableCell className="tabular-nums">{row.amount}</TableCell>
                        <TableCell>{row.note}</TableCell>
                        <TableCell focusMode="child" className="py-6">
                          {row.canCorrect && (
                            <Button
                              size="sm"
                              variant="outline"
                              onPress={() => onCorrect(row.id)}
                              isDisabled={locked}
                            >
                              {t(($) => $.earnings.correct)}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
            {pagination}
          </CardContent>
        </Tabs>
        <CardFooter className="flex flex-wrap items-start justify-between gap-3 border-t text-xs text-muted-foreground">
          {count && <span className="tabular-nums">{count}</span>}
          <p className="max-w-2xl">{t(($) => $.earnings.footer)}</p>
        </CardFooter>
      </Card>
    </div>
  );
}
