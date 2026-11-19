import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { CardContent } from "../../components/ui/card";
import { saveDownload } from "../../lib/save-download";
import type { ClientScope } from "../../lib/scoped-backend";
import type { PlatformInvoice } from "../../lib/api-contracts/generated";
import { downloadInvoice, readInvoicePage } from "./settings-invoices";

export function SettingsInvoiceHistory({
  scope,
  locked,
  onAccessLost,
}: {
  scope: ClientScope;
  locked: boolean;
  onAccessLost: (error: unknown) => boolean;
}) {
  const { t } = useTranslation();
  const history = useInfiniteQuery({
    queryKey: ["billing-invoices", scope.accountId, scope.orgId],
    queryFn: ({ pageParam }) => readInvoicePage(scope, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.next_cursor,
    retry: false,
    gcTime: 0,
  });
  const mounted = useRef(false);
  const inFlight = useRef(false);
  const [downloading, setDownloading] = useState<string>();
  const [downloadError, setDownloadError] = useState(false);
  const [denied, setDenied] = useState(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function save(row: PlatformInvoice) {
    if (inFlight.current || locked) return;
    inFlight.current = true;
    setDownloading(row.id);
    setDownloadError(false);
    try {
      const file = await downloadInvoice(scope, row);
      if (mounted.current) saveDownload(file.blob, file.name);
    } catch (error) {
      if (mounted.current) {
        if (onAccessLost(error)) setDenied(true);
        else setDownloadError(true);
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setDownloading(undefined);
    }
  }
  const rows = history.data?.pages.flatMap((page) => page.items) ?? [];
  const cursor = history.data?.pages.at(-1)?.next_cursor;
  const invalid =
    new Set(rows.map((row) => row.id)).size !== rows.length ||
    (!!cursor && history.data?.pageParams.includes(cursor));
  const date = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeZone: "UTC" });
  return (
    <CardContent className="space-y-3 border-t pt-4">
      <h3 className="text-sm font-semibold">{t(($) => $.settings.invoices.history)}</h3>
      {history.isPending ? (
        <p role="status">{t(($) => $.settings.invoices.loading)}</p>
      ) : history.isError || invalid || denied ? (
        <Alert variant="destructive">
          <AlertDescription className="space-y-2">
            <p>{t(($) => $.settings.invoices.historyError)}</p>
            {!denied && (
              <Button
                variant="outline"
                isDisabled={history.isFetching || locked}
                onPress={() => void history.refetch()}
              >
                {t(($) => $.auth.retry)}
              </Button>
            )}
          </AlertDescription>
        </Alert>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t(($) => $.settings.invoices.empty)}</p>
      ) : (
        <ul className="divide-y">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex min-w-0 flex-wrap items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0">
                <p className="font-medium wrap-anywhere">{row.invoice_number}</p>
                <time dateTime={row.issued_on} className="text-sm text-muted-foreground">
                  {date.format(new Date(row.issued_on))}
                </time>
              </div>
              <div className="flex max-w-full flex-wrap items-center gap-2">
                <Badge variant="outline">{row.mime === "application/pdf" ? "PDF" : "ZIP"}</Badge>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={t(($) => $.settings.invoices.downloadNamed, {
                    number: row.invoice_number,
                  })}
                  isDisabled={locked || !!downloading || history.isFetching}
                  onPress={() => void save(row)}
                >
                  {t(($) =>
                    downloading === row.id
                      ? $.settings.invoices.downloading
                      : $.settings.invoices.download,
                  )}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {downloadError && (
        <Alert variant="destructive">
          <AlertDescription>{t(($) => $.settings.invoices.downloadError)}</AlertDescription>
        </Alert>
      )}
      {history.hasNextPage && !history.isError && !invalid && !denied && (
        <Button
          variant="outline"
          isDisabled={history.isFetching || !!downloading || locked}
          onPress={() => void history.fetchNextPage()}
        >
          {t(($) => $.settings.invoices.more)}
        </Button>
      )}
    </CardContent>
  );
}
