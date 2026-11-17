import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { PlusIcon, SearchIcon } from "lucide-react";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  CardDescription,
} from "../../components/ui/card";
import { InputGroup, InputGroupInput, InputGroupAddon } from "../../components/ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "../../components/ui/table";
import { Empty, EmptyDescription } from "../../components/ui/empty";
import { Badge } from "../../components/ui/badge";

export type ProductFilter = "all" | "on" | "off" | "archived";
export interface ProductRow {
  id: string;
  name: string;
  kind: string;
  scope: string;
  validity: string | null;
  price: string;
  activeRights: string | null;
  salesState: ProductFilter | null;
}
export interface ProductSummary {
  onSale: string | null;
  recentSales: string | null;
  recentRevenue: string | null;
  activeHolders: string | null;
}

// Presentation only: readers provide scoped facts, totals and permitted actions.
export function ProductsView({
  rows,
  summary,
  state,
  search,
  filter,
  filtersAvailable = false,
  count,
  notice,
  onSearch,
  onFilter,
  onSelect,
  onAdd,
  pagination,
}: {
  rows: ProductRow[];
  summary: ProductSummary;
  state: "ready" | "loading" | "error";
  search: string;
  filter: ProductFilter;
  filtersAvailable?: boolean;
  count: string;
  notice?: ReactNode;
  onSearch?: (value: string) => void;
  onFilter?: (value: ProductFilter) => void;
  onSelect: (id: string) => void;
  onAdd?: () => void;
  pagination?: ReactNode;
}) {
  const { t } = useTranslation();
  const unknown = t(($) => $.products.unknown);
  const stats = [
    { label: t(($) => $.products.onSale), value: summary.onSale },
    { label: t(($) => $.products.recentSales), value: summary.recentSales },
    { label: t(($) => $.products.recentRevenue), value: summary.recentRevenue },
    { label: t(($) => $.products.activeHolders), value: summary.activeHolders },
  ];
  return (
    <div className="flex min-w-0 flex-col gap-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{t(($) => $.products.title)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t(($) => $.products.description)}</p>
        </div>
        <Button onPress={onAdd} isDisabled={!onAdd}>
          <PlusIcon data-icon="inline-start" />
          {t(($) => $.products.add)}
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
                <p className="text-2xl font-semibold break-words tabular-nums">
                  {stat.value ?? unknown}
                </p>
              </CardContent>
            </Card>
          </article>
        ))}
      </div>
      {notice}
      <Card className="min-w-0 gap-0 pt-3" aria-busy={state === "loading"}>
        <CardHeader className="flex flex-wrap items-center gap-3 pb-3">
          <InputGroup className="w-full max-w-56">
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput
              name="productSearch"
              aria-label={t(($) => $.products.search)}
              placeholder={t(($) => $.products.search)}
              value={search}
              disabled={!onSearch}
              onChange={(event) => onSearch?.(event.target.value)}
              autoComplete="off"
            />
          </InputGroup>
          <ToggleGroup
            variant="segmented"
            size="segmented"
            selectionMode="single"
            disallowEmptySelection
            className="max-w-full flex-wrap"
            aria-label={t(($) => $.products.status)}
            selectedKeys={new Set([filter])}
            onSelectionChange={(keys) => onFilter?.(String([...keys][0]) as ProductFilter)}
          >
            <ToggleGroupItem id="all">{t(($) => $.products.all)}</ToggleGroupItem>
            <ToggleGroupItem id="on" isDisabled={!filtersAvailable}>
              {t(($) => $.products.onSale)}
            </ToggleGroupItem>
            <ToggleGroupItem id="off" isDisabled={!filtersAvailable}>
              {t(($) => $.products.offSale)}
            </ToggleGroupItem>
            <ToggleGroupItem id="archived" isDisabled={!filtersAvailable}>
              {t(($) => $.products.archived)}
            </ToggleGroupItem>
          </ToggleGroup>
        </CardHeader>
        <CardContent className="min-w-0 pb-1">
          <Table
            aria-label={t(($) => $.products.title)}
            aria-busy={state === "loading"}
            className="min-w-[40rem]"
            onRowAction={(key) => onSelect(String(key))}
          >
            <TableHeader>
              <TableHead isRowHeader>{t(($) => $.products.package)}</TableHead>
              <TableHead>{t(($) => $.products.scope)}</TableHead>
              <TableHead>{t(($) => $.products.validity)}</TableHead>
              <TableHead className="text-right">{t(($) => $.products.price)}</TableHead>
              <TableHead className="text-right">{t(($) => $.products.activeRights)}</TableHead>
              <TableHead>{t(($) => $.products.onSale)}</TableHead>
            </TableHeader>
            <TableBody
              items={state === "ready" ? rows : []}
              renderEmptyState={() => (
                <Empty>
                  <EmptyDescription>
                    {t(($) =>
                      state === "loading"
                        ? $.products.loading
                        : state === "error"
                          ? $.products.readError
                          : $.products.empty,
                    )}
                  </EmptyDescription>
                </Empty>
              )}
            >
              {(row) => (
                <TableRow id={row.id} textValue={row.name}>
                  <TableCell>
                    <span className="font-medium">{row.name}</span>
                    <p className="mt-1 text-xs text-muted-foreground">{row.kind}</p>
                  </TableCell>
                  <TableCell>{row.scope}</TableCell>
                  <TableCell>{row.validity ?? unknown}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.price}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.activeRights ?? unknown}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {row.salesState === "on"
                        ? t(($) => $.products.onSale)
                        : row.salesState === "off"
                          ? t(($) => $.products.offSale)
                          : row.salesState === "archived"
                            ? t(($) => $.products.archived)
                            : unknown}
                    </Badge>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter className="flex-wrap justify-between gap-2 text-xs text-muted-foreground">
          <span>{count}</span>
          <span>{t(($) => $.products.saleNote)}</span>
          {pagination}
        </CardFooter>
      </Card>
    </div>
  );
}
