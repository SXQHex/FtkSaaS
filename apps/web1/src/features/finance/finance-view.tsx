import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CreditCardIcon, SearchIcon } from "lucide-react";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  CardDescription,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "../../components/ui/table";
import { InputGroup, InputGroupInput, InputGroupAddon } from "../../components/ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { NativeSelect, NativeSelectOption } from "../../components/ui/native-select";
import { Badge } from "../../components/ui/badge";
import { Empty, EmptyDescription } from "../../components/ui/empty";

export type FinanceTab = "movements" | "debts" | "credits";
export type FinanceFilter = "all" | "sale" | "collection" | "other";
export type FinanceAction =
  | "collect"
  | "correct"
  | "cancel"
  | "sale-refund"
  | "credit-refund"
  | "offset"
  | "adjust";
export interface FinanceRowAction {
  kind: FinanceAction;
  onPress: () => void;
}
export interface FinanceMovementRow {
  id: string;
  date: string;
  person: string;
  kind: string;
  detail: string;
  amount: string;
  state?: string;
  actions: FinanceRowAction[];
}
export interface FinanceDebtRow {
  id: string;
  person: string;
  lastSale: string | null;
  amount: string;
  actions: FinanceRowAction[];
}
export interface FinanceCreditRow {
  id: string;
  person: string;
  amount: string;
  debt: string | null;
  actions: FinanceRowAction[];
}
export interface FinanceSummary {
  periodLabel: string;
  sales: string | null;
  collections: string | null;
  debt: string | null;
  credit: string | null;
  debtCount: string | null;
  creditCount: string | null;
}
export function FinanceView({
  tab,
  onTab,
  summary,
  movements,
  debts,
  credits,
  state,
  search,
  filter,
  method,
  onSearch,
  onFilter,
  onMethod,
  onCollect,
  counts,
  notice,
  pagination,
}: {
  tab: FinanceTab;
  onTab: (value: FinanceTab) => void;
  summary: FinanceSummary;
  movements: FinanceMovementRow[];
  debts: FinanceDebtRow[];
  credits: FinanceCreditRow[];
  state: "ready" | "loading" | "error";
  search: string;
  filter: FinanceFilter;
  method: string;
  onSearch?: (value: string) => void;
  onFilter?: (value: FinanceFilter) => void;
  onMethod?: (value: string) => void;
  onCollect?: () => void;
  counts: Record<FinanceTab, string>;
  notice?: ReactNode;
  pagination?: ReactNode;
}) {
  const { t } = useTranslation(),
    unknown = t(($) => $.finance.unknown);
  const actions = (items: FinanceRowAction[]) => (
    <div className="flex flex-wrap justify-end gap-2">
      {items.map((action) => (
        <Button
          key={action.kind}
          variant={action.kind === "collect" ? "outline" : "ghost"}
          size="sm"
          onPress={action.onPress}
        >
          {t(($) => $.finance.actions[action.kind])}
        </Button>
      ))}
    </div>
  );
  const empty = () => (
    <Empty>
      <EmptyDescription>
        {t(($) =>
          state === "loading"
            ? $.finance.loading
            : state === "error"
              ? $.finance.readError
              : $.finance.empty,
        )}
      </EmptyDescription>
    </Empty>
  );
  const stats = [
    {
      label: t(($) => $.finance.periodSales, { period: summary.periodLabel }),
      value: summary.sales,
      hint: t(($) => $.finance.salesHint),
    },
    {
      label: t(($) => $.finance.periodCollections, { period: summary.periodLabel }),
      value: summary.collections,
      hint: t(($) => $.finance.collectionsHint),
    },
    {
      label: t(($) => $.finance.openDebt),
      value: summary.debt,
      hint: t(($) => $.finance.debtHint),
    },
    {
      label: t(($) => $.finance.memberCredit),
      value: summary.credit,
      hint: t(($) => $.finance.creditHint),
    },
  ];
  return (
    <div className="flex min-w-0 flex-col gap-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{t(($) => $.finance.title)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t(($) => $.finance.description)}</p>
        </div>
        <Button onPress={onCollect} isDisabled={!onCollect}>
          <CreditCardIcon data-icon="inline-start" />
          {t(($) => $.finance.actions.collect)}
        </Button>
      </header>
      <div className="grid min-w-0 grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <article key={stat.label} className="min-w-0">
            <Card className="h-full">
              <CardHeader>
                <CardDescription>{stat.label}</CardDescription>
              </CardHeader>
              <CardContent>
                <dl>
                  <dt className="sr-only">{stat.label}</dt>
                  <dd className="text-2xl font-semibold break-words tabular-nums">
                    {stat.value ?? unknown}
                  </dd>
                </dl>
                <p className="mt-1 text-xs text-muted-foreground">{stat.hint}</p>
              </CardContent>
            </Card>
          </article>
        ))}
      </div>
      {notice}
      <Card className="min-w-0 gap-0" aria-busy={state === "loading"}>
        <Tabs
          selectedKey={tab}
          onSelectionChange={(key) => onTab(key as FinanceTab)}
          className="min-w-0 gap-0"
        >
          <CardHeader className="pb-4">
            <TabsList
              variant="line"
              aria-label={t(($) => $.finance.sections)}
              className="max-w-full flex-wrap justify-start"
            >
              <TabsTrigger id="movements">{t(($) => $.finance.movements)}</TabsTrigger>
              <TabsTrigger id="debts">
                {t(($) => $.finance.openDebts)}
                <Badge variant="secondary">{summary.debtCount ?? "?"}</Badge>
              </TabsTrigger>
              <TabsTrigger id="credits">
                {t(($) => $.finance.credits)}
                <Badge variant="secondary">{summary.creditCount ?? "?"}</Badge>
              </TabsTrigger>
            </TabsList>
          </CardHeader>
          <TabsContent id="movements" className="min-w-0">
            <search
              className="flex min-w-0 flex-wrap items-center gap-3 px-5 pb-4"
              aria-label={t(($) => $.finance.filters)}
            >
              <InputGroup className="w-full max-w-52">
                <InputGroupAddon>
                  <SearchIcon />
                </InputGroupAddon>
                <InputGroupInput
                  name="financeSearch"
                  value={search}
                  aria-label={t(($) => $.finance.search)}
                  placeholder={t(($) => $.finance.search)}
                  disabled={!onSearch}
                  onChange={(event) => onSearch?.(event.target.value)}
                />
              </InputGroup>
              <ToggleGroup
                variant="segmented"
                size="segmented"
                selectionMode="single"
                disallowEmptySelection
                selectedKeys={new Set([filter])}
                className="max-w-full flex-wrap"
                aria-label={t(($) => $.finance.operationKind)}
                onSelectionChange={(keys) => onFilter?.(String([...keys][0]) as FinanceFilter)}
              >
                <ToggleGroupItem id="all">{t(($) => $.finance.all)}</ToggleGroupItem>
                <ToggleGroupItem id="sale" isDisabled={!onFilter}>
                  {t(($) => $.finance.sale)}
                </ToggleGroupItem>
                <ToggleGroupItem id="collection" isDisabled={!onFilter}>
                  {t(($) => $.finance.collection)}
                </ToggleGroupItem>
                <ToggleGroupItem id="other" isDisabled={!onFilter}>
                  {t(($) => $.finance.other)}
                </ToggleGroupItem>
              </ToggleGroup>
              <NativeSelect
                name="methodFilter"
                value={method}
                aria-label={t(($) => $.finance.method)}
                disabled={!onMethod}
                onChange={(event) => onMethod?.(event.target.value)}
              >
                <NativeSelectOption value="">{t(($) => $.finance.allMethods)}</NativeSelectOption>
                <NativeSelectOption value="cash">{t(($) => $.finance.cash)}</NativeSelectOption>
                <NativeSelectOption value="card_pos">{t(($) => $.finance.card)}</NativeSelectOption>
                <NativeSelectOption value="bank_transfer">
                  {t(($) => $.finance.bank)}
                </NativeSelectOption>
              </NativeSelect>
            </search>
            <CardContent className="min-w-0 pb-1">
              <Table aria-label={t(($) => $.finance.movements)} className="min-w-[45rem]">
                <TableHeader>
                  <TableHead>{t(($) => $.finance.date)}</TableHead>
                  <TableHead isRowHeader>{t(($) => $.finance.member)}</TableHead>
                  <TableHead>{t(($) => $.finance.operation)}</TableHead>
                  <TableHead>{t(($) => $.finance.methodDetail)}</TableHead>
                  <TableHead className="text-right">{t(($) => $.finance.amount)}</TableHead>
                  <TableHead>
                    <span className="sr-only">{t(($) => $.finance.rowActions)}</span>
                  </TableHead>
                </TableHeader>
                <TableBody items={state === "ready" ? movements : []} renderEmptyState={empty}>
                  {(row) => (
                    <TableRow id={row.id}>
                      <TableCell>{row.date}</TableCell>
                      <TableCell>{row.person}</TableCell>
                      <TableCell>
                        {row.kind}
                        {row.state && (
                          <Badge variant="outline" className="ms-2">
                            {row.state}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{row.detail}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.amount}</TableCell>
                      <TableCell>{actions(row.actions)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter className="flex-wrap justify-between gap-2 text-xs text-muted-foreground">
              <span>{counts.movements}</span>
              <span>{t(($) => $.finance.historyNote)}</span>
              {pagination}
            </CardFooter>
          </TabsContent>
          <TabsContent id="debts" className="min-w-0">
            <CardContent className="min-w-0 pb-1">
              <Table aria-label={t(($) => $.finance.openDebts)} className="min-w-[34rem]">
                <TableHeader>
                  <TableHead isRowHeader>{t(($) => $.finance.member)}</TableHead>
                  <TableHead>{t(($) => $.finance.lastSale)}</TableHead>
                  <TableHead className="text-right">{t(($) => $.finance.openDebt)}</TableHead>
                  <TableHead>
                    <span className="sr-only">{t(($) => $.finance.rowActions)}</span>
                  </TableHead>
                </TableHeader>
                <TableBody items={state === "ready" ? debts : []} renderEmptyState={empty}>
                  {(row) => (
                    <TableRow id={row.id}>
                      <TableCell>{row.person}</TableCell>
                      <TableCell>{row.lastSale ?? unknown}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.amount}</TableCell>
                      <TableCell>{actions(row.actions)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter className="text-xs text-muted-foreground">{counts.debts}</CardFooter>
          </TabsContent>
          <TabsContent id="credits" className="min-w-0">
            <CardContent className="min-w-0 pb-1">
              <Table aria-label={t(($) => $.finance.credits)} className="min-w-[34rem]">
                <TableHeader>
                  <TableHead isRowHeader>{t(($) => $.finance.member)}</TableHead>
                  <TableHead className="text-right">{t(($) => $.finance.credit)}</TableHead>
                  <TableHead>{t(($) => $.finance.openDebt)}</TableHead>
                  <TableHead>
                    <span className="sr-only">{t(($) => $.finance.rowActions)}</span>
                  </TableHead>
                </TableHeader>
                <TableBody items={state === "ready" ? credits : []} renderEmptyState={empty}>
                  {(row) => (
                    <TableRow id={row.id}>
                      <TableCell>{row.person}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.amount}</TableCell>
                      <TableCell>{row.debt ?? unknown}</TableCell>
                      <TableCell>{actions(row.actions)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter className="flex-wrap justify-between gap-2 text-xs text-muted-foreground">
              <span>{counts.credits}</span>
              <span>{t(($) => $.finance.creditNote)}</span>
            </CardFooter>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
