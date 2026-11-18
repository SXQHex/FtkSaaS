import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../../components/ui/card";
import { ItemGroup, Item, ItemContent, ItemTitle, ItemDescription } from "../../components/ui/item";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "../../components/ui/table";
import { NativeSelect, NativeSelectOption } from "../../components/ui/native-select";
import { Progress, ProgressLabel } from "../../components/ui/progress";
import { Empty, EmptyDescription } from "../../components/ui/empty";
import { Badge } from "../../components/ui/badge";
export interface MemberPackageSummary {
  id: string;
  name: string;
  validity: string;
  state: string;
  counts?: { available: string; reserved: string; consumed: string };
  usage?: { consumed: number; total: number };
  note?: string;
}
export interface MemberRightMovement {
  id: string;
  date: string;
  title: string;
  quantity: string;
}
export interface MemberPaymentMovement {
  id: string;
  date: string;
  title: string;
  amount: string;
}
export function MemberEntitlementsView({
  packages,
  selected,
  onSelect,
  movements,
  movementPagination,
  payments,
  paymentPagination,
  paymentControl,
  balance,
  previous,
  notice,
}: {
  packages: MemberPackageSummary[] | null;
  selected: string;
  onSelect: (id: string) => void;
  movements: MemberRightMovement[] | null;
  movementPagination?: ReactNode;
  payments: MemberPaymentMovement[] | null;
  paymentPagination?: ReactNode;
  paymentControl?: ReactNode;
  balance: ReactNode;
  previous: { id: string; name: string; validity: string; state: string }[] | null;
  notice?: ReactNode;
}) {
  const { t } = useTranslation();
  const source = packages?.find((row) => row.id === selected);
  return (
    <div className="@container mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-4 p-4">
      <header>
        <h1 className="text-2xl leading-[1.25] font-semibold tracking-[-0.02em]">
          {t(($) => $.memberEntitlements.title)}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(($) => $.memberEntitlements.description)}
        </p>
      </header>
      {notice}
      {packages && packages.length > 1 && (
        <NativeSelect
          className="w-full @md:w-80"
          aria-label={t(($) => $.memberEntitlements.choosePackage)}
          value={selected}
          onChange={(event) => onSelect(event.target.value)}
        >
          <NativeSelectOption value="">
            {t(($) => $.memberEntitlements.choosePackage)}
          </NativeSelectOption>
          {packages.map((row) => (
            <NativeSelectOption key={row.id} value={row.id}>
              {row.name} · {row.validity}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      )}
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>
            {source?.name ??
              t(($) =>
                packages?.length === 0
                  ? $.memberEntitlements.emptyPackages
                  : packages && packages.length > 1
                    ? $.memberEntitlements.choosePackage
                    : $.memberEntitlements.packageUnread,
              )}
          </CardTitle>
          {source && (
            <CardDescription>
              {source.validity} · <Badge variant="outline">{source.state}</Badge>
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {source?.counts && (
            <div className="grid grid-cols-1 gap-3 @lg:grid-cols-3">
              {(["available", "reserved", "consumed"] as const).map((key) => (
                <Card key={key} className="gap-0.5 py-3">
                  <CardHeader className="px-4 [&_[data-slot=card-description]]:text-xs">
                    <CardDescription>{t(($) => $.memberEntitlements.metrics[key])}</CardDescription>
                    <CardTitle className="text-[1.375rem] leading-[1.3] tabular-nums">
                      {source.counts![key]}
                    </CardTitle>
                    <CardDescription>
                      {t(($) => $.memberEntitlements.metricHints[key])}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
          {source?.usage && (
            <Progress
              className="mt-4"
              value={Math.min(source.usage.consumed, source.usage.total)}
              maxValue={source.usage.total}
            >
              <ProgressLabel>
                {t(($) => $.memberEntitlements.usageValue, source.usage)}
              </ProgressLabel>
            </Progress>
          )}
          {source?.note && <p className="mt-3 text-sm text-muted-foreground">{source.note}</p>}
        </CardContent>
      </Card>
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>{t(($) => $.memberEntitlements.movements)}</CardTitle>
          <CardDescription>{t(($) => $.memberEntitlements.balanceChange)}</CardDescription>
        </CardHeader>
        <CardContent>
          {movements === null ? (
            <p className="text-sm text-muted-foreground">
              {t(($) => $.memberEntitlements.movementsUnread)}
            </p>
          ) : movements.length === 0 ? (
            <Empty>
              <EmptyDescription>{t(($) => $.memberEntitlements.emptyMovements)}</EmptyDescription>
            </Empty>
          ) : (
            <ItemGroup className="gap-0 divide-y">
              {movements.map((row) => (
                <Item
                  role="listitem"
                  key={row.id}
                  className="flex-nowrap rounded-none border-0 px-0"
                >
                  <ItemContent className="min-w-0">
                    <ItemTitle>{row.title}</ItemTitle>
                    <ItemDescription>{row.date}</ItemDescription>
                  </ItemContent>
                  <span className="tabular-nums">{row.quantity}</span>
                </Item>
              ))}
            </ItemGroup>
          )}
        </CardContent>
        {movementPagination && <CardFooter>{movementPagination}</CardFooter>}
      </Card>
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>{t(($) => $.memberEntitlements.payments)}</CardTitle>
          <CardDescription>{t(($) => $.memberEntitlements.paymentsHint)}</CardDescription>
        </CardHeader>
        <CardContent className="min-w-0 [&_[data-slot=table-container]]:max-h-[min(65dvh,36rem)]">
          {paymentControl}
          <div className="mb-4 flex flex-wrap justify-between gap-2 text-sm">
            <span>{t(($) => $.memberEntitlements.balance)}</span>
            <div className="font-medium tabular-nums">{balance}</div>
          </div>
          {payments === null ? (
            <p className="text-sm text-muted-foreground">
              {t(($) => $.memberEntitlements.paymentsUnread)}
            </p>
          ) : (
            <Table aria-label={t(($) => $.memberEntitlements.payments)} className="min-w-[28rem]">
              <TableHeader className="sticky top-0 z-20 bg-card">
                <TableHead isRowHeader className="sticky start-0 z-30 bg-card">
                  {t(($) => $.memberEntitlements.date)}
                </TableHead>
                <TableHead>{t(($) => $.memberEntitlements.operation)}</TableHead>
                <TableHead className="text-end">{t(($) => $.memberEntitlements.amount)}</TableHead>
              </TableHeader>
              <TableBody
                renderEmptyState={() => (
                  <Empty>
                    <EmptyDescription>
                      {t(($) => $.memberEntitlements.emptyPayments)}
                    </EmptyDescription>
                  </Empty>
                )}
              >
                {payments.map((row) => (
                  <TableRow key={row.id} id={row.id}>
                    <TableCell className="sticky start-0 z-10 bg-card tabular-nums">
                      {row.date}
                    </TableCell>
                    <TableCell>{row.title}</TableCell>
                    <TableCell className="text-end tabular-nums">{row.amount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {paymentPagination && <CardFooter>{paymentPagination}</CardFooter>}
      </Card>
      {previous !== null && previous.length > 0 && (
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>{t(($) => $.memberEntitlements.previousPackages)}</CardTitle>
          </CardHeader>
          <CardContent>
            <ItemGroup className="gap-0 divide-y">
              {previous.map((row) => (
                <Item role="listitem" key={row.id} className="rounded-none border-0 px-0">
                  <ItemContent>
                    <ItemTitle>{row.name}</ItemTitle>
                    <ItemDescription>{row.validity}</ItemDescription>
                  </ItemContent>
                  <Badge variant="outline">{row.state}</Badge>
                </Item>
              ))}
            </ItemGroup>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
