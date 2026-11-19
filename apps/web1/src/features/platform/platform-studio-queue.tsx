import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button, LinkButton } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { readPlatformStudioQueue } from "../workspace/studio-setup-request";
import { PlatformReadError } from "./platform-read-error";

const requestDate = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Istanbul",
});

export function PlatformStudioQueue({ accountId }: { accountId: string }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const key = ["platform-studio-requests", accountId];
  const query = useInfiniteQuery({
    queryKey: key,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => readPlatformStudioQueue(accountId, pageParam),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    retry: false,
    refetchOnMount: "always",
    gcTime: 0,
  });
  const rows = query.data?.pages.flatMap((page) => page.items) ?? [];
  const cursor = query.data?.pages.at(-1)?.next_cursor;
  const invalid =
    new Set(rows.map((row) => row.id)).size !== rows.length ||
    (!!cursor && query.data?.pageParams.includes(cursor));
  const refresh = () => void client.resetQueries({ queryKey: key, exact: true });
  const title = t(($) => $.platform.studioRequests.title);
  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
        {!query.isError && !invalid && (
          <Button variant="outline" isDisabled={query.isFetching} onPress={refresh}>
            {t(($) => $.platform.studioRequests.refresh)}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {query.isPending ? (
          <p role="status">{t(($) => $.platform.loading)}</p>
        ) : query.isError || invalid ? (
          <PlatformReadError error={query.error} onRetry={refresh} />
        ) : rows.length === 0 ? (
          <p>{t(($) => $.platform.studioRequests.empty)}</p>
        ) : (
          <>
            <Table aria-label={title} scrollRegionLabel={title} className="min-w-[31rem]">
              <TableHeader>
                <TableHead isRowHeader>{t(($) => $.platform.studioRequests.name)}</TableHead>
                <TableHead>{t(($) => $.platform.studioRequests.requestedAt)}</TableHead>
                <TableHead>{t(($) => $.platform.studioRequests.request)}</TableHead>
              </TableHeader>
              <TableBody items={rows}>
                {(row) => (
                  <TableRow id={row.id}>
                    <TableCell>
                      <LinkButton
                        className="max-w-xs whitespace-normal wrap-anywhere"
                        variant="ghost"
                        href={"/platform?section=create&studio_request_id=" + row.id}
                      >
                        {row.name}
                      </LinkButton>
                    </TableCell>
                    <TableCell>
                      <time dateTime={row.created_at}>
                        {requestDate.format(new Date(row.created_at))}
                      </time>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.id}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {query.hasNextPage && (
              <Button
                variant="outline"
                isDisabled={query.isFetching}
                onPress={() => void query.fetchNextPage()}
              >
                {t(($) => $.platform.studioRequests.more)}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
