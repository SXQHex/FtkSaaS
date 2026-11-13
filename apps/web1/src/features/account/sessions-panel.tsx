import { useRef, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { v7 as uuidv7 } from "uuid";
import { PencilIcon } from "lucide-react";
import type { AccountSessionView } from "../../lib/api-contracts/generated";
import { getSupabaseClient } from "../../lib/supabase";
import { readAccount } from "../../lib/account";
import { readSessions, revokeSession } from "./sessions";
import { RevokeOthers } from "./revoke-others";
import { SessionLabel } from "./session-label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
} from "../../components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../../components/ui/table";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Skeleton } from "../../components/ui/skeleton";

export function SessionsPanel({ accountId }: { accountId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const queries = useQueryClient();
  const [labelConflict, setLabelConflict] = useState(false);
  const [editing, setEditing] = useState<AccountSessionView>();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const [changed, setChanged] = useState(false);
  const intents = useRef(new Map<string, string>());
  const sessions = useInfiniteQuery({
    queryKey: ["account-sessions", accountId],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => readSessions(pageParam),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
  async function refresh() {
    setRefreshError(false);
    try {
      await Promise.all([
        readAccount(),
        sessions.refetch({ throwOnError: true }),
        queries.invalidateQueries({ queryKey: ["account-security-history", accountId] }),
      ]);
      await router.invalidate();
      setChanged(true);
    } catch {
      setRefreshError(true);
    }
  }
  async function revoke(sessionId: string) {
    setPending(true);
    setFailed(false);
    setChanged(false);
    let key = intents.current.get(sessionId);
    if (!key) {
      key = uuidv7();
      intents.current.set(sessionId, key);
    }
    let currentRevoked = false;
    try {
      const result = await revokeSession(sessionId, key);
      currentRevoked = result.current_revoked;
      if (currentRevoked) {
        try {
          const { error } = await getSupabaseClient().auth.signOut({ scope: "local" });
          if (error) throw error;
        } finally {
          queries.clear();
          await router.navigate({ to: "/login", replace: true });
        }
        return;
      }
      intents.current.delete(sessionId);
    } catch {
      setFailed(true);
    } finally {
      if (!currentRevoked) await refresh();
      setPending(false);
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t(($) => $.sessions.title)}</h2>
        </CardTitle>
        <CardDescription>{t(($) => $.sessions.description)}</CardDescription>
        <CardAction>
          <RevokeOthers onRefresh={refresh} />
        </CardAction>
      </CardHeader>
      <CardContent className="min-w-0">
        {changed && !pending && !failed && !refreshError && !labelConflict && (
          <p role="status">{t(($) => $.sessions.updated)}</p>
        )}
        {labelConflict && (
          <Alert>
            <AlertDescription>{t(($) => $.sessions.labelConflict)}</AlertDescription>
          </Alert>
        )}
        {failed && (
          <Alert variant="destructive">
            <AlertDescription>{t(($) => $.sessions.revokeError)}</AlertDescription>
          </Alert>
        )}
        {refreshError && (
          <Alert variant="destructive">
            <AlertDescription>
              {t(($) => $.sessions.refreshError)}{" "}
              <Button
                variant="outline"
                size="sm"
                onPress={() => {
                  void refresh();
                }}
              >
                {t(($) => $.auth.retry)}
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {sessions.isPending ? (
          <Skeleton className="h-32 w-full" />
        ) : sessions.isError ? (
          <Alert variant="destructive">
            <AlertDescription>
              {t(($) => $.sessions.readError)}{" "}
              <Button
                variant="outline"
                size="sm"
                onPress={() => {
                  void sessions.refetch();
                }}
              >
                {t(($) => $.auth.retry)}
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <Table className="min-w-[34rem]" aria-label={t(($) => $.sessions.title)}>
            <TableHeader>
              <TableHead id="device" isRowHeader>
                {t(($) => $.sessions.device)}
              </TableHead>
              <TableHead id="refreshed">{t(($) => $.sessions.refreshed)}</TableHead>
              <TableHead id="actions">
                <span className="sr-only">{t(($) => $.sessions.actions)}</span>
              </TableHead>
            </TableHeader>
            <TableBody renderEmptyState={() => t(($) => $.sessions.empty)}>
              {sessions.data.pages
                .flatMap((page) => page.items)
                .map((session) => (
                  <TableRow id={session.session_id} key={session.session_id}>
                    <TableCell>
                      <div className="flex max-w-sm flex-wrap items-center gap-2">
                        <span className="break-all font-medium">
                          {session.label ||
                            session.user_agent ||
                            t(($) => $.sessions.unknownDevice)}
                        </span>
                        {session.current && <Badge>{t(($) => $.sessions.current)}</Badge>}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          isDisabled={pending}
                          aria-label={t(($) => $.sessions.editLabel, {
                            name:
                              session.label ||
                              session.user_agent ||
                              t(($) => $.sessions.unknownDevice),
                          })}
                          onPress={() => {
                            setLabelConflict(false);
                            setEditing(session);
                          }}
                        >
                          <PencilIcon />
                        </Button>
                      </div>
                      {session.label && session.user_agent && (
                        <p className="max-w-sm break-all text-muted-foreground">
                          {session.user_agent}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <time dateTime={session.last_refreshed_at}>
                        {new Intl.DateTimeFormat("tr-TR", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(session.last_refreshed_at))}
                      </time>
                    </TableCell>
                    <TableCell>
                      {!session.current && (
                        <Button
                          variant="ghost"
                          size="sm"
                          isDisabled={pending}
                          onPress={() => {
                            void revoke(session.session_id);
                          }}
                        >
                          {t(($) => $.sessions.close)}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        )}
        {editing && (
          <SessionLabel
            session={editing}
            onClose={(conflict = false) => {
              setEditing(undefined);
              setLabelConflict(conflict);
            }}
            onRefresh={refresh}
          />
        )}
      </CardContent>
      {sessions.hasNextPage && (
        <CardFooter>
          <Button
            variant="outline"
            isDisabled={sessions.isFetchingNextPage}
            onPress={() => {
              void sessions.fetchNextPage();
            }}
          >
            {t(($) => $.security.more)}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
