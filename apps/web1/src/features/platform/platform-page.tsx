import { useEffect, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
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
import type { AccountView } from "../../lib/api-contracts/generated";
import {
  platformAccessDenied,
  platformOrganizationsKey,
  readPlatformOrganizations,
} from "./platform-directory";
import { PlatformOrganizationDetail } from "./platform-organization-detail";
import { PlatformGrace } from "./platform-grace";
import { paymentHref } from "./platform-payment";
import { PlatformPaymentDetail, PlatformPayments } from "./platform-payments";
import { PlatformStudioQueue } from "./platform-studio-queue";
import { PlatformCreate } from "./platform-create";
import { PlatformOperators } from "./platform-operators";

const route = getRouteApi("/platform");
export function PlatformRoutePage() {
  const account = route.useLoaderData();
  const { organization_id, section, payment_id, studio_request_id } = route.useSearch();
  return (
    <PlatformPage
      key={account.id}
      account={account}
      organizationId={organization_id}
      section={section}
      paymentId={payment_id}
      studioRequestId={studio_request_id}
    />
  );
}

function PlatformPage({
  account,
  organizationId,
  section,
  paymentId,
  studioRequestId,
}: {
  account: AccountView;
  organizationId?: string;
  section?: "payments" | "studio-requests" | "create" | "operators";
  paymentId?: string;
  studioRequestId?: string;
}) {
  const { t } = useTranslation();
  const [denied, setDenied] = useState(false);
  const allowed = !denied && account.platform_scope?.organizations === true;
  const canVerify = allowed && account.platform_scope?.payment_verify === true;
  const canGrace = allowed && account.platform_scope?.grace_extend === true;
  const canReadQueue = allowed && account.platform_scope?.organization_create === true;
  const canManageOperators = allowed && account.platform_scope?.operator_manage === true;
  const payments = section === "payments";
  const studioRequests = section === "studio-requests";
  const create = section === "create";
  const operators = section === "operators";
  const unavailable =
    !allowed ||
    (payments && !canVerify) ||
    ((studioRequests || create) && !canReadQueue) ||
    (operators && !canManageOperators);
  const deny = () => setDenied(true);
  const title = t(($) => $.platform.title);
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} · Fethiye Tango`;
    return () => {
      document.title = previous;
    };
  }, [title]);
  return (
    <main className="mx-auto flex min-w-0 w-full max-w-6xl flex-col gap-5 px-4 py-6 md:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <LinkButton href="/account" variant="outline">
          {t(($) => $.auth.account)}
        </LinkButton>
      </header>
      {allowed && (
        <nav aria-label={t(($) => $.platform.sections)} className="flex flex-wrap gap-2">
          <LinkButton
            href="/platform"
            aria-current={!section ? "page" : undefined}
            variant={!section ? "default" : "outline"}
          >
            {t(($) => $.platform.organizations)}
          </LinkButton>
          {canVerify && (
            <LinkButton
              href={paymentHref()}
              aria-current={payments ? "page" : undefined}
              variant={payments ? "default" : "outline"}
            >
              {t(($) => $.platform.billing.payments)}
            </LinkButton>
          )}
          {canManageOperators && (
            <LinkButton
              href="/platform?section=operators"
              aria-current={operators ? "page" : undefined}
              variant={operators ? "default" : "outline"}
            >
              {t(($) => $.platform.operators.title)}
            </LinkButton>
          )}
          {canReadQueue && (
            <LinkButton
              href="/platform?section=studio-requests"
              aria-current={studioRequests ? "page" : undefined}
              variant={studioRequests ? "default" : "outline"}
            >
              {t(($) => $.platform.studioRequests.title)}
            </LinkButton>
          )}
        </nav>
      )}
      {unavailable ? (
        <Alert variant="destructive">
          <AlertDescription>{t(($) => $.platform.denied)}</AlertDescription>
        </Alert>
      ) : studioRequests ? (
        <PlatformStudioQueue accountId={account.id} />
      ) : create ? (
        <PlatformCreate
          key={studioRequestId ?? "direct"}
          accountId={account.id}
          requestId={studioRequestId}
          onDenied={deny}
        />
      ) : operators ? (
        <PlatformOperators accountId={account.id} onDenied={deny} />
      ) : payments ? (
        paymentId ? (
          organizationId ? (
            <PlatformPaymentDetail
              key={organizationId + paymentId}
              accountId={account.id}
              orgId={organizationId}
              paymentId={paymentId}
              onDenied={deny}
            />
          ) : (
            <Alert variant="destructive">
              <AlertDescription>{t(($) => $.platform.billing.missing)}</AlertDescription>
            </Alert>
          )
        ) : (
          <PlatformPayments
            key={organizationId ?? "all"}
            accountId={account.id}
            orgId={organizationId}
          />
        )
      ) : organizationId ? (
        <>
          <PlatformOrganizationDetail
            key={organizationId}
            accountId={account.id}
            organizationId={organizationId}
            canSuspend={account.platform_scope?.organization_suspend === true}
            paymentsHref={canVerify ? paymentHref(organizationId) : undefined}
            onDenied={deny}
          />
          {canGrace && (
            <PlatformGrace
              key={"grace-" + organizationId}
              accountId={account.id}
              orgId={organizationId}
              onDenied={deny}
            />
          )}
        </>
      ) : (
        <>
          {canReadQueue && <PlatformStudioQueue accountId={account.id} />}
          <PlatformOrganizationList accountId={account.id} canCreate={canReadQueue} />
        </>
      )}
    </main>
  );
}

function PlatformOrganizationList({
  accountId,
  canCreate,
}: {
  accountId: string;
  canCreate: boolean;
}) {
  const { t } = useTranslation();
  const query = useInfiniteQuery({
    queryKey: platformOrganizationsKey(accountId),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => readPlatformOrganizations(accountId, pageParam),
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
  const title = t(($) => $.platform.organizations);
  if (platformAccessDenied(query.error))
    return (
      <Alert variant="destructive">
        <AlertDescription>{t(($) => $.platform.denied)}</AlertDescription>
      </Alert>
    );
  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
        {canCreate && (
          <LinkButton href="/platform?section=create">
            {t(($) => $.platform.create.title)}
          </LinkButton>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {query.isPending ? (
          <p role="status">{t(($) => $.platform.loading)}</p>
        ) : query.isError || invalid ? (
          <Alert variant="destructive">
            <AlertDescription className="space-y-2">
              <p>{t(($) => $.platform.readError)}</p>
              <Button variant="outline" onPress={() => void query.refetch()}>
                {t(($) => $.auth.retry)}
              </Button>
            </AlertDescription>
          </Alert>
        ) : rows.length === 0 ? (
          <p>{t(($) => $.platform.empty)}</p>
        ) : (
          <>
            <Table aria-label={title} scrollRegionLabel={title} className="min-w-[36rem]">
              <TableHeader>
                <TableHead isRowHeader>{t(($) => $.platform.organization)}</TableHead>
                <TableHead>{t(($) => $.platform.lifecycle)}</TableHead>
                <TableHead>{t(($) => $.platform.subscription)}</TableHead>
                <TableHead>{t(($) => $.platform.access)}</TableHead>
              </TableHeader>
              <TableBody items={rows}>
                {(row) => (
                  <TableRow id={row.id}>
                    <TableCell>
                      <LinkButton
                        variant="ghost"
                        size="sm"
                        className="max-w-64 whitespace-normal break-words"
                        href={`/platform?organization_id=${row.id}`}
                      >
                        {row.name}
                      </LinkButton>
                    </TableCell>
                    <TableCell>{t(($) => $.platform.states[row.state])}</TableCell>
                    <TableCell>
                      {row.subscription_state
                        ? t(($) => $.platform.subscriptions[row.subscription_state!])
                        : t(($) => $.platform.noSubscription)}
                    </TableCell>
                    <TableCell className="space-x-2">
                      <Badge variant="outline">
                        {t(($) => $.platform.accessModes[row.access_mode])}
                      </Badge>
                      {row.platform_suspended && (
                        <Badge variant="destructive">{t(($) => $.platform.suspended)}</Badge>
                      )}
                    </TableCell>
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
                {t(($) => $.platform.more)}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
