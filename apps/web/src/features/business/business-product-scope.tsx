import { useInfiniteQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button, LinkButton } from "@ftksaas/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@ftksaas/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ftksaas/ui/components/table";
import type { CenterView } from "@ftksaas/api-contracts";
import type { ClientScope } from "../../lib/scoped-backend";
import { formatMinorAmount } from "../../lib/money";
import { readProductsManagementPage } from "../products/products";

export function BusinessProductScope({
  scope,
  centers,
}: {
  scope: ClientScope;
  centers: CenterView[];
}) {
  const { t } = useTranslation();
  const catalog = useInfiniteQuery({
    queryKey: ["business-product-scope", scope.accountId, scope.orgId, scope.centerId],
    initialPageParam: undefined as string | undefined,
    queryFn: (context) => readProductsManagementPage(scope, "all", "", context.pageParam, context),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    gcTime: 0,
    retry: false,
  });
  const title = t(($) => $.businessCenters.usageScope);
  const rows = catalog.isError ? [] : (catalog.data?.pages.flatMap((page) => page.items) ?? []);
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {catalog.isPending ? (
          <p role="status">{t(($) => $.platform.loading)}</p>
        ) : catalog.isError ? (
          <p role="alert">{t(($) => $.businessCenters.directoryError)}</p>
        ) : !rows.length ? (
          <p>{t(($) => $.businessCenters.empty)}</p>
        ) : (
          <Table aria-label={title} scrollRegionLabel={title} className="min-w-[37rem]">
            <TableHeader>
              <TableHead isRowHeader>{t(($) => $.workspace.links.products)}</TableHead>
              <TableHead>{t(($) => $.platform.billing.amount)}</TableHead>
              <TableHead>{t(($) => $.businessCenters.usageCenters)}</TableHead>
            </TableHeader>
            <TableBody items={rows}>
              {(row) => (
                <TableRow id={row.id}>
                  <TableCell className="max-w-40 whitespace-normal wrap-anywhere">
                    {row.terms.name}
                  </TableCell>
                  <TableCell>
                    {formatMinorAmount(row.terms.price_minor, row.terms.currency)}
                  </TableCell>
                  <TableCell className="max-w-48 whitespace-normal wrap-anywhere">
                    {[
                      ...new Set(
                        row.terms.scopes.map((item) =>
                          item.center_id
                            ? (centers.find((center) => center.id === item.center_id)?.name ??
                              t(($) => $.businessCenters.unknownCenter))
                            : t(($) => $.products.organizationScope),
                        ),
                      ),
                    ].join(", ")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
        {catalog.hasNextPage && !catalog.isError && (
          <Button
            variant="outline"
            isDisabled={catalog.isFetching}
            onPress={() => void catalog.fetchNextPage()}
          >
            {t(($) => $.businessCenters.more)}
          </Button>
        )}
        <LinkButton href={`/o/${scope.orgId}/c/${scope.centerId}/products`} variant="outline">
          {t(($) => $.workspace.links.products)}
        </LinkButton>
      </CardContent>
    </Card>
  );
}
