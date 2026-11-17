import { useRef, useState } from "react";
import { useQuery, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { readAccount } from "../../lib/account";
import { readFactors, readSecurityHistory } from "./security";
import { getSupabaseClient } from "../../lib/supabase";
import { GoogleIdentities } from "./google-identities";
import { PasswordChange } from "./password-change";
import { readSessions } from "./sessions";
import { TotpRemove } from "./totp-remove";
import { TotpSetup } from "./totp-setup";
import { DeletionPreviewPanel } from "./deletion-preview-panel";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../../components/ui/card";
import {
  Item,
  ItemGroup,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "../../components/ui/item";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Skeleton } from "../../components/ui/skeleton";

export function SecurityPanel({ accountId }: { accountId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const queries = useQueryClient();
  const needsSessionsRead = useRef(false);
  const needsNativeRefresh = useRef(false);
  const [changed, setChanged] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const [pending, setPending] = useState(false);
  const factors = useQuery({ queryKey: ["account-factors", accountId], queryFn: readFactors });
  const history = useInfiniteQuery({
    queryKey: ["account-security-history", accountId],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => readSecurityHistory(pageParam),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
  async function refresh() {
    setPending(true);
    setRefreshError(false);
    try {
      if (needsNativeRefresh.current) {
        const { error } = await getSupabaseClient().auth.refreshSession();
        if (error) throw error;
        needsNativeRefresh.current = false;
      }
      await Promise.all([
        readAccount(),
        ...(needsSessionsRead.current ? [readSessions()] : []),
        factors.refetch({ throwOnError: true }),
        history.refetch({ throwOnError: true }),
      ]);
      await router.invalidate();
      needsSessionsRead.current = false;
    } catch {
      setRefreshError(true);
    } finally {
      setPending(false);
    }
  }
  async function onChanged(nativeRefresh = false) {
    needsNativeRefresh.current ||= nativeRefresh;
    setChanged(true);
    await refresh();
  }
  const verified = factors.data?.totp ?? [];
  const incomplete =
    factors.data?.all.filter(
      (factor) => factor.factor_type === "totp" && factor.status === "unverified",
    ) ?? [];
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {changed && !pending && !refreshError && <p role="status">{t(($) => $.security.updated)}</p>}
      {refreshError && (
        <Alert variant="destructive">
          <AlertDescription>
            {t(($) => $.security.refreshError)}{" "}
            <Button
              variant="outline"
              size="sm"
              isDisabled={pending}
              onPress={() => {
                void refresh();
              }}
            >
              {t(($) => $.auth.retry)}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{t(($) => $.security.signinTitle)}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ItemGroup className="gap-0 [&>[data-slot=item]]:rounded-none">
            <Item
              role="listitem"
              className="rounded-none border-0 border-b border-border px-0 py-3"
            >
              <ItemContent className="min-w-0 basis-full sm:basis-auto">
                <ItemTitle>{t(($) => $.auth.password)}</ItemTitle>
                <ItemDescription>{t(($) => $.passwordChange.rowDescription)}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <PasswordChange
                  onChanged={async () => {
                    queries.removeQueries({ queryKey: ["account-sessions", accountId] });
                    needsSessionsRead.current = true;
                    await onChanged();
                  }}
                />
              </ItemActions>
            </Item>
            <Item
              role="listitem"
              className="rounded-none border-0 border-b border-border px-0 py-3"
            >
              <ItemContent className="basis-full sm:basis-auto">
                <ItemTitle>
                  {t(($) => $.auth.mfaTitle)}{" "}
                  {factors.data && (
                    <Badge variant={verified.length ? "success" : "secondary"}>
                      {verified.length
                        ? t(($) => $.security.enabled)
                        : t(($) => $.security.disabled)}
                    </Badge>
                  )}
                </ItemTitle>
                <ItemDescription>{t(($) => $.security.mfaDescription)}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <TotpSetup
                  canStart={Boolean(
                    factors.data && !factors.isError && !verified.length && !incomplete.length,
                  )}
                  onChanged={onChanged}
                />
              </ItemActions>
            </Item>
            {factors.isPending && <Skeleton role="listitem" className="h-16 w-full" />}
            {factors.isError && (
              <Item role="listitem" className="px-0 py-0">
                <Alert variant="destructive">
                  <AlertDescription>
                    {t(($) => $.security.loadError)}{" "}
                    <Button
                      variant="outline"
                      size="sm"
                      onPress={() => {
                        void factors.refetch();
                      }}
                    >
                      {t(($) => $.auth.retry)}
                    </Button>
                  </AlertDescription>
                </Alert>
              </Item>
            )}
            {verified.map((factor, index) => (
              <Item role="listitem" className="px-0 py-3" key={factor.id}>
                <ItemContent>
                  <ItemTitle>
                    {factor.friendly_name ||
                      t(($) => $.auth.mfaFactorNumber, { number: index + 1 })}
                  </ItemTitle>
                  <ItemDescription>{t(($) => $.security.verifiedFactor)}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <TotpRemove
                    factorId={factor.id}
                    name={
                      factor.friendly_name ||
                      t(($) => $.auth.mfaFactorNumber, { number: index + 1 })
                    }
                    onRemoved={() => onChanged(true)}
                  />
                </ItemActions>
              </Item>
            ))}
            {incomplete.map((factor) => (
              <Item role="listitem" className="px-0 py-3" key={factor.id}>
                <ItemContent>
                  <ItemTitle>{t(($) => $.security.incomplete)}</ItemTitle>
                  <ItemDescription>{t(($) => $.security.incompleteDescription)}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <TotpRemove
                    factorId={factor.id}
                    name={factor.friendly_name || t(($) => $.security.incomplete)}
                    onRemoved={() => onChanged(true)}
                  />
                </ItemActions>
              </Item>
            ))}
            <GoogleIdentities
              accountId={accountId}
              onChanged={async () => {
                await queries.invalidateQueries({ queryKey: ["account-profile", accountId] });
                await onChanged();
              }}
            />
          </ItemGroup>
        </CardContent>
      </Card>
      <DeletionPreviewPanel key={accountId} accountId={accountId} />
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{t(($) => $.security.historyTitle)}</h2>
          </CardTitle>
          <CardDescription>{t(($) => $.security.historyDescription)}</CardDescription>
        </CardHeader>
        <CardContent>
          {history.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : history.isError ? (
            <Alert variant="destructive">
              <AlertDescription>
                {t(($) => $.security.loadError)}{" "}
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => {
                    void history.refetch();
                  }}
                >
                  {t(($) => $.auth.retry)}
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <ItemGroup className="gap-0 [&>[data-slot=item]]:rounded-none [&>[data-slot=item]:not(:last-child)]:border-b-border">
              {history.data.pages
                .flatMap((page) => page.items)
                .map((event) => (
                  <Item role="listitem" className="px-0 py-3" key={event.id}>
                    <ItemContent>
                      <ItemTitle>{t(($) => $.security.events[event.action])}</ItemTitle>
                      <ItemDescription>
                        <time dateTime={event.at}>
                          {new Intl.DateTimeFormat("tr-TR", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }).format(new Date(event.at))}
                        </time>
                      </ItemDescription>
                    </ItemContent>
                  </Item>
                ))}
              {history.data.pages[0].items.length === 0 && (
                <p role="listitem">{t(($) => $.security.noHistory)}</p>
              )}
            </ItemGroup>
          )}
        </CardContent>
        {history.hasNextPage && (
          <CardFooter>
            <Button
              variant="outline"
              isDisabled={history.isFetchingNextPage}
              onPress={() => {
                void history.fetchNextPage();
              }}
            >
              {t(($) => $.security.more)}
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
