import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
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
import { Badge } from "@ftksaas/ui/components/badge";
import { Empty, EmptyDescription } from "@ftksaas/ui/components/empty";
import { Skeleton } from "@ftksaas/ui/components/skeleton";
import { MemberReadSkeleton } from "../member/member-read-skeleton";
export interface InstructorEarningRow {
  id: string;
  date: string;
  session: string;
  context: string[];
  basis: string;
  amount: string;
  state: string;
}
export interface InstructorPaymentRow {
  id: string;
  date: string;
  operation: string;
  method: string;
  amount: string;
}
export function InstructorEarningsView({
  period,
  periods,
  onPeriod,
  totals,
  agreement,
  lines,
  payments,
  loadingTotals,
  loadingAgreement,
  loadingRows,
  tab,
  onTab,
  notice,
  pagination,
}: {
  period: string;
  periods: { id: string; label: string; disabled?: boolean }[];
  onPeriod: (value: string) => void;
  totals: { earned: string | null; paid: string | null; remaining: string | null };
  agreement: ReactNode;
  lines: InstructorEarningRow[] | null;
  payments: InstructorPaymentRow[] | null;
  loadingTotals: boolean;
  loadingAgreement: boolean;
  loadingRows: boolean;
  tab: "lines" | "payments";
  onTab: (value: "lines" | "payments") => void;
  notice?: ReactNode;
  pagination?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="@container flex min-w-0 flex-col gap-5 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t(($) => $.instructorEarnings.title)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(($) => $.instructorEarnings.description)}
          </p>
        </div>
        <NativeSelect
          className="w-full @sm:w-44"
          aria-label={t(($) => $.instructorEarnings.period)}
          value={period}
          onChange={(event) => onPeriod(event.target.value)}
        >
          {periods.map((row) => (
            <NativeSelectOption key={row.id} value={row.id} disabled={row.disabled}>
              {row.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </header>
      <div aria-busy={loadingTotals} className="grid min-w-0 grid-cols-1 gap-4 @lg:grid-cols-3">
        {(["earned", "paid", "remaining"] as const).map((key) => (
          <Card key={key}>
            <CardHeader>
              <CardDescription>{t(($) => $.instructorEarnings.metrics[key])}</CardDescription>
              <CardTitle className="break-words text-2xl tabular-nums">
                {loadingTotals ? (
                  <Skeleton aria-hidden="true" className="h-8 w-24" />
                ) : (
                  (totals[key] ?? "—")
                )}
              </CardTitle>
              <CardDescription>{t(($) => $.instructorEarnings.metricHints[key])}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
      {notice}
      <Card className="min-w-0">
        <CardContent className="pt-5">
          <h2 className="text-sm font-semibold">{t(($) => $.instructorEarnings.agreement)}</h2>
          <div aria-busy={loadingAgreement} className="mt-2 text-sm text-muted-foreground">
            {loadingAgreement ? <Skeleton aria-hidden="true" className="h-10 w-full" /> : agreement}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {t(($) => $.instructorEarnings.agreementHint)}
          </p>
        </CardContent>
      </Card>
      <Card className="min-w-0">
        <Tabs
          selectedKey={tab}
          onSelectionChange={(key) => {
            if (key === "lines" || key === "payments") onTab(key);
          }}
        >
          <CardHeader className="border-b">
            <TabsList aria-label={t(($) => $.instructorEarnings.tabsLabel)}>
              <TabsTrigger id="lines">{t(($) => $.instructorEarnings.tabs.lines)}</TabsTrigger>
              <TabsTrigger id="payments">
                {t(($) => $.instructorEarnings.tabs.payments)}
              </TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent className="min-w-0 pt-4 [&_[data-slot=table-container]]:max-h-[min(65dvh,36rem)]">
            <TabsContent id="lines">
              {loadingRows ? (
                <MemberReadSkeleton label={t(($) => $.instructorEarnings.loading)} />
              ) : lines === null ? (
                <p className="py-8 text-sm text-muted-foreground">
                  {t(($) => $.instructorEarnings.unread)}
                </p>
              ) : (
                <Table
                  aria-label={t(($) => $.instructorEarnings.tabs.lines)}
                  scrollRegionLabel={t(($) => $.instructorEarnings.tabs.lines)}
                  className="min-w-[42rem]"
                >
                  <TableHeader className="sticky top-0 z-20 bg-card">
                    <TableHead isRowHeader className="sticky start-0 z-30 bg-card">
                      {t(($) => $.instructorEarnings.date)}
                    </TableHead>
                    <TableHead>{t(($) => $.instructorEarnings.session)}</TableHead>
                    <TableHead>{t(($) => $.instructorEarnings.basis)}</TableHead>
                    <TableHead className="text-end">
                      {t(($) => $.instructorEarnings.amount)}
                    </TableHead>
                    <TableHead>{t(($) => $.instructorEarnings.state)}</TableHead>
                  </TableHeader>
                  <TableBody
                    renderEmptyState={() => (
                      <Empty>
                        <EmptyDescription>
                          {t(($) => $.instructorEarnings.emptyLines)}
                        </EmptyDescription>
                      </Empty>
                    )}
                  >
                    {lines.map((row) => (
                      <TableRow key={row.id} id={row.id}>
                        <TableCell className="sticky start-0 z-10 bg-card tabular-nums">
                          {row.date}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium wrap-anywhere">{row.session}</p>
                          {row.context.map((detail) => (
                            <p key={detail} className="text-xs text-muted-foreground">
                              {detail}
                            </p>
                          ))}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{row.basis}</TableCell>
                        <TableCell className="text-end tabular-nums">{row.amount}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{row.state}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
            <TabsContent id="payments">
              {loadingRows ? (
                <MemberReadSkeleton label={t(($) => $.instructorEarnings.loading)} />
              ) : payments === null ? (
                <p className="py-8 text-sm text-muted-foreground">
                  {t(($) => $.instructorEarnings.unreadPayments)}
                </p>
              ) : (
                <Table
                  aria-label={t(($) => $.instructorEarnings.tabs.payments)}
                  scrollRegionLabel={t(($) => $.instructorEarnings.tabs.payments)}
                  className="min-w-[34rem]"
                >
                  <TableHeader className="sticky top-0 z-20 bg-card">
                    <TableHead isRowHeader className="sticky start-0 z-30 bg-card">
                      {t(($) => $.instructorEarnings.date)}
                    </TableHead>
                    <TableHead>{t(($) => $.instructorEarnings.operation)}</TableHead>
                    <TableHead>{t(($) => $.instructorEarnings.method)}</TableHead>
                    <TableHead className="text-end">
                      {t(($) => $.instructorEarnings.amount)}
                    </TableHead>
                  </TableHeader>
                  <TableBody
                    renderEmptyState={() => (
                      <Empty>
                        <EmptyDescription>
                          {t(($) => $.instructorEarnings.emptyPayments)}
                        </EmptyDescription>
                      </Empty>
                    )}
                  >
                    {payments.map((row) => (
                      <TableRow key={row.id} id={row.id}>
                        <TableCell className="sticky start-0 z-10 bg-card tabular-nums">
                          {row.date}
                        </TableCell>
                        <TableCell>{row.operation}</TableCell>
                        <TableCell className="text-muted-foreground">{row.method}</TableCell>
                        <TableCell className="text-end tabular-nums">{row.amount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </CardContent>
        </Tabs>
        <CardFooter>{pagination}</CardFooter>
      </Card>
    </div>
  );
}
