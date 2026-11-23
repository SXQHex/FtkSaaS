import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { ClientScope } from "../../lib/scoped-backend";
import { formatMinorAmount } from "../../lib/money";
import { Button } from "@ftksaas/ui/components/button";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import {
  Item,
  ItemGroup,
  ItemContent,
  ItemTitle,
  ItemDescription,
} from "@ftksaas/ui/components/item";
import { productsKeys } from "./products-query";
import { readProductHistory } from "./products";

export function ProductHistory(props: {
  scope: ClientScope;
  productId: string;
  onAccessLost: (error: unknown) => boolean;
}) {
  return (
    <>
      <HistoryPage {...props} view="versions" />
      <HistoryPage {...props} view="sales" />
    </>
  );
}
function HistoryPage({
  scope,
  productId,
  view,
  onAccessLost,
}: {
  scope: ClientScope;
  productId: string;
  view: "versions" | "sales";
  onAccessLost: (error: unknown) => boolean;
}) {
  const { t } = useTranslation();
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [index, setIndex] = useState(0);
  const query = useQuery({
    queryKey: [...productsKeys.history(scope, productId), view, cursors[index]],
    queryFn: (context) => readProductHistory(scope, productId, view, cursors[index], context),
    retry: false,
  });
  useEffect(() => {
    if (query.error) onAccessLost(query.error);
  }, [query.error, onAccessLost]);
  const title =
    view === "versions" ? t(($) => $.products.versions) : t(($) => $.products.recentPurchases);
  const rows = query.isError ? [] : (query.data?.items ?? []);
  return (
    <section className="flex min-w-0 flex-col gap-2" aria-label={title}>
      <h3 className="text-sm font-semibold">{title}</h3>
      {query.isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            {t(($) => $.products.historyError)}
            <Button
              variant="outline"
              isDisabled={query.isFetching}
              onPress={() => {
                void query.refetch();
              }}
            >
              {t(($) => $.products.retry)}
            </Button>
          </AlertDescription>
        </Alert>
      ) : query.isPending ? (
        <p>{t(($) => $.products.historyLoading)}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t(($) => $.products.historyEmpty)}</p>
      ) : (
        <ItemGroup>
          {rows.map((row) => (
            <Item key={row.id} role="listitem" variant="outline" size="sm">
              <ItemContent>
                <ItemTitle>{"terms" in row ? row.terms.name : row.product_name}</ItemTitle>
                <ItemDescription>
                  {new Intl.DateTimeFormat("tr-TR", {
                    dateStyle: "short",
                    timeStyle: "short",
                    timeZone: "UTC",
                  }).format(new Date(row.created_at))}{" "}
                  UTC
                  {"terms" in row
                    ? ` · ${formatMinorAmount(row.terms.price_minor, row.terms.currency)}`
                    : ` · ${formatMinorAmount(row.net_minor, row.currency)} · ${t(($) => $.products.saleStates[row.state])}`}
                </ItemDescription>
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>
      )}
      <div role="group" className="flex flex-wrap gap-2" aria-label={title}>
        <Button
          size="sm"
          variant="outline"
          isDisabled={index === 0 || query.isFetching}
          onPress={() => setIndex((value) => value - 1)}
        >
          {t(($) => $.products.previous)}
        </Button>
        <Button
          size="sm"
          variant="outline"
          isDisabled={query.isError || query.isFetching || !query.data?.next_cursor}
          onPress={() => {
            const next = query.data?.next_cursor;
            if (next) {
              setCursors((values) => [...values.slice(0, index + 1), next]);
              setIndex((value) => value + 1);
            }
          }}
        >
          {t(($) => $.products.next)}
        </Button>
      </div>
    </section>
  );
}
