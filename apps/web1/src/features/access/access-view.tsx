import { useTranslation } from "react-i18next";
import {
  ArrowLeftIcon,
  UserPlusIcon,
  SearchIcon,
  CopyIcon,
  LockKeyholeIcon,
  CheckIcon,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardHeader, CardContent, CardFooter } from "../../components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "../../components/ui/table";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { Badge } from "../../components/ui/badge";
import { InputGroup, InputGroupInput, InputGroupAddon } from "../../components/ui/input-group";
import { Empty, EmptyDescription } from "../../components/ui/empty";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Pagination, PaginationContent, PaginationItem } from "../../components/ui/pagination";

export type InvitationFilter = "open" | "closed" | "all";
export type AccountFilter = "all" | "linked" | "unlinked";
export interface AccessInvitationRow {
  id: string;
  personId: string;
  personName: string | null;
  email: string | null;
  state: "pending" | "expired" | "accepted" | "revoked" | "unknown";
  sentLabel: string | null;
  expiresLabel: string | null;
  remainingLabel?: string;
  resendCount?: number;
  canResend: boolean;
  canRevoke: boolean;
}
export interface AccessAccountRow {
  id: string;
  personId: string;
  linkId?: string;
  name: string;
  email: string | null;
  inactive: boolean;
  binding: "linked" | "pending" | "unlinked" | "unknown";
  linkedLabel: string | null;
  lastSigninLabel: string | null;
  canRemove: boolean;
  canInvite: boolean;
}
export interface AccessSummary {
  linked: string | null;
  totalMembers?: string | null;
  pending: string | null;
  expired: string | null;
  unlinked: string | null;
  invitationBadge: number | null;
  accountBadge: number | null;
}
export type AccessAction =
  | { kind: "cancel"; invitation: AccessInvitationRow }
  | { kind: "resend"; invitation: AccessInvitationRow }
  | { kind: "unlink"; account: AccessAccountRow }
  | { kind: "invite"; account: AccessAccountRow };

// Only composition and display: no demo expiry/resend rules or account-access
// decisions are inferred here. Counts and actions come from scoped readers.
export function AccessView({
  invitations,
  accounts,
  summary,
  state,
  invitationState = state,
  accountState = state,
  invitationFilter,
  accountFilter,
  search,
  onInvitationFilter,
  onAccountFilter,
  onSearch,
  onAction,
  onInvite,
  onBack,
  onRetry,
  invitationPaging,
  accountPaging,
  locked = false,
}: {
  invitations: AccessInvitationRow[];
  accounts: AccessAccountRow[];
  summary: AccessSummary;
  state: "ready" | "loading" | "error";
  invitationState?: "ready" | "loading" | "error";
  accountState?: "ready" | "loading" | "error";
  invitationFilter: InvitationFilter;
  accountFilter: AccountFilter;
  search: string;
  onInvitationFilter?: (filter: InvitationFilter) => void;
  onAccountFilter?: (filter: AccountFilter) => void;
  onSearch?: (search: string) => void;
  onAction?: (action: AccessAction) => void;
  onInvite?: () => void;
  onBack?: () => void;
  onRetry?: () => void;
  locked?: boolean;
  invitationPaging?: AccessPaging;
  accountPaging?: AccessPaging;
}) {
  const { t } = useTranslation();
  const unknown = t(($) => $.access.unknown);
  const empty = (message: string) => (
    <Empty className="p-8">
      <EmptyDescription>{message}</EmptyDescription>
    </Empty>
  );
  const summaries = [
    {
      key: "linked" as const,
      label: t(($) => $.access.linkedMembers),
      description: t(($) => $.access.linkedDescription),
    },
    {
      key: "pending" as const,
      label: t(($) => $.access.pendingInvitations),
      description: t(($) => $.access.pendingDescription),
    },
    {
      key: "expired" as const,
      label: t(($) => $.access.expiredInvitations),
      description: t(($) => $.access.expiredDescription),
    },
    {
      key: "unlinked" as const,
      label: t(($) => $.access.unlinkedMembers),
      description: t(($) => $.access.unlinkedDescription),
    },
  ];
  return (
    <div className="flex min-w-0 flex-col gap-4 p-4 sm:p-6" inert={locked}>
      <Button
        variant="link"
        className="-mb-2 min-h-0 w-fit p-0 text-muted-foreground"
        isDisabled={!onBack}
        onPress={onBack}
      >
        <ArrowLeftIcon />
        {t(($) => $.people.title)}
      </Button>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t(($) => $.access.title)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t(($) => $.access.description)}</p>
        </div>
        <Button isDisabled={!onInvite} onPress={onInvite}>
          <UserPlusIcon />
          {t(($) => $.people.invite)}
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 min-[901px]:grid-cols-4">
        {summaries.map((item) => (
          <Card key={item.key} className="min-h-24 gap-0 py-3 [--card-spacing:--spacing(4)]">
            <CardHeader>
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </CardHeader>
            <CardContent>
              <data
                value={summary[item.key] ?? ""}
                className="block text-[1.375rem] leading-[1.3] font-semibold tabular-nums"
              >
                {summary[item.key] ?? unknown}
                {item.key === "linked" && summary.totalMembers && (
                  <span className="text-sm font-normal text-muted-foreground">
                    {" "}
                    / {summary.totalMembers}
                  </span>
                )}
              </data>
              <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      {state === "error" && (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            {t(($) => $.access.readError)}
            <Button variant="outline" size="sm" isDisabled={!onRetry} onPress={onRetry}>
              {t(($) => $.people.retry)}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <Card className="min-w-0 gap-0 pb-0">
        <Tabs defaultSelectedKey="invitations" className="min-w-0 gap-0">
          <CardHeader className="border-b pb-3">
            <TabsList
              aria-label={t(($) => $.access.sections)}
              className="max-w-full overflow-x-auto"
            >
              <TabsTrigger id="invitations">
                {t(($) => $.access.invitations)}
                <Badge variant="secondary">{summary.invitationBadge ?? "?"}</Badge>
              </TabsTrigger>
              <TabsTrigger id="accounts">
                {t(($) => $.access.accounts)}
                <Badge variant="secondary">{summary.accountBadge ?? "?"}</Badge>
              </TabsTrigger>
            </TabsList>
          </CardHeader>
          <TabsContent id="invitations" className="min-w-0">
            <CardContent className="flex flex-col gap-3 pt-4 pb-1">
              <ToggleGroup
                variant="segmented"
                size="segmented"
                aria-label={t(($) => $.access.invitationStatus)}
                selectionMode="single"
                disallowEmptySelection
                selectedKeys={new Set([invitationFilter])}
                onSelectionChange={(keys) =>
                  onInvitationFilter?.(String([...keys][0]) as InvitationFilter)
                }
              >
                <ToggleGroupItem id="open" isDisabled={!onInvitationFilter}>
                  {t(($) => $.access.open)}
                </ToggleGroupItem>
                <ToggleGroupItem id="closed" isDisabled={!onInvitationFilter}>
                  {t(($) => $.access.closed)}
                </ToggleGroupItem>
                <ToggleGroupItem id="all" isDisabled={!onInvitationFilter}>
                  {t(($) => $.people.all)}
                </ToggleGroupItem>
              </ToggleGroup>
              <Table
                aria-label={t(($) => $.access.invitations)}
                aria-busy={invitationState === "loading"}
                className="min-w-[44rem] [&_[data-slot=table-cell]]:py-3"
              >
                <TableHeader>
                  <TableHead isRowHeader>{t(($) => $.access.invitedPerson)}</TableHead>
                  <TableHead>{t(($) => $.access.sent)}</TableHead>
                  <TableHead>{t(($) => $.access.validity)}</TableHead>
                  <TableHead>{t(($) => $.people.status)}</TableHead>
                  <TableHead>
                    <span className="sr-only">{t(($) => $.access.actions)}</span>
                  </TableHead>
                </TableHeader>
                <TableBody
                  items={invitationState === "ready" ? invitations : []}
                  renderEmptyState={() =>
                    empty(
                      t(($) =>
                        invitationState === "loading"
                          ? $.access.loading
                          : invitationState === "error"
                            ? $.access.readError
                            : $.access.noInvitations,
                      ),
                    )
                  }
                >
                  {(item) => (
                    <TableRow id={item.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>
                            {item.email ?? item.personName ?? t(($) => $.access.contactUnavailable)}
                          </span>
                          {item.email && item.personName && (
                            <span className="text-xs text-muted-foreground">{item.personName}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5 tabular-nums">
                          <span>{item.sentLabel ?? unknown}</span>
                          {item.resendCount !== undefined && item.resendCount > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {t(($) => $.access.resentCount, { count: item.resendCount })}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5 tabular-nums">
                          <span>{item.expiresLabel ?? unknown}</span>
                          {item.remainingLabel && (
                            <span className="text-xs text-muted-foreground">
                              {item.remainingLabel}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.state === "accepted"
                              ? "success"
                              : item.state === "pending"
                                ? "outline"
                                : "secondary"
                          }
                        >
                          {item.state === "accepted" && <CheckIcon />}
                          {t(($) => $.access.invitationStates[item.state])}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {(item.state === "pending" || item.state === "expired") && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                isDisabled={!onAction || !item.canResend}
                                aria-label={`${t(($) => $.access.resend)} — ${item.personName ?? unknown}`}
                                onPress={() => onAction?.({ kind: "resend", invitation: item })}
                              >
                                {t(($) => $.access.resend)}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                isDisabled
                                aria-label={t(($) => $.access.copyLink)}
                                aria-describedby="access-copy-unavailable"
                              >
                                <CopyIcon />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                isDisabled={!onAction || !item.canRevoke}
                                aria-label={`${t(($) => $.access.cancelInvitation)} — ${item.personName ?? unknown}`}
                                onPress={() => onAction?.({ kind: "cancel", invitation: item })}
                              >
                                {t(($) => $.access.cancelInvitation)}
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter className="flex flex-wrap justify-between gap-3 py-2.5 pt-2.5!">
              <p className="text-xs text-muted-foreground">
                {t(($) => $.access.invitationFooter)}{" "}
                <span id="access-copy-unavailable">{t(($) => $.access.copyUnavailable)}</span>
              </p>
              {invitationPaging && <AccessPagination {...invitationPaging} />}
            </CardFooter>
          </TabsContent>
          <TabsContent id="accounts" className="min-w-0">
            <CardContent className="flex min-w-0 flex-col gap-3 pt-4 pb-1">
              <div className="flex flex-wrap items-center gap-3">
                <InputGroup className="max-w-56 rounded-md border-input bg-transparent">
                  <InputGroupAddon>
                    <SearchIcon />
                  </InputGroupAddon>
                  <InputGroupInput
                    aria-label={t(($) => $.people.search)}
                    placeholder={t(($) => $.people.search)}
                    value={search}
                    onChange={(event) => onSearch?.(event.target.value)}
                    readOnly={!onSearch}
                  />
                </InputGroup>
                <ToggleGroup
                  variant="segmented"
                  size="segmented"
                  aria-label={t(($) => $.access.accountStatus)}
                  selectionMode="single"
                  disallowEmptySelection
                  selectedKeys={new Set([accountFilter])}
                  onSelectionChange={(keys) =>
                    onAccountFilter?.(String([...keys][0]) as AccountFilter)
                  }
                >
                  <ToggleGroupItem id="all" isDisabled={!onAccountFilter}>
                    {t(($) => $.people.all)}
                  </ToggleGroupItem>
                  <ToggleGroupItem id="linked" isDisabled={!onAccountFilter}>
                    {t(($) => $.access.accountStates.linked)}
                  </ToggleGroupItem>
                  <ToggleGroupItem id="unlinked" isDisabled={!onAccountFilter}>
                    {t(($) => $.access.notLinked)}
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
              <Table
                aria-label={t(($) => $.access.accounts)}
                aria-busy={accountState === "loading"}
                className="min-w-[44rem] [&_[data-slot=table-cell]]:py-[11px]"
              >
                <TableHeader>
                  <TableHead isRowHeader>{t(($) => $.people.member)}</TableHead>
                  <TableHead>{t(($) => $.access.account)}</TableHead>
                  <TableHead>{t(($) => $.access.linkedAt)}</TableHead>
                  <TableHead>{t(($) => $.access.lastSignin)}</TableHead>
                  <TableHead>
                    <span className="sr-only">{t(($) => $.access.actions)}</span>
                  </TableHead>
                </TableHeader>
                <TableBody
                  items={accountState === "ready" ? accounts : []}
                  renderEmptyState={() =>
                    empty(
                      t(($) =>
                        accountState === "loading"
                          ? $.access.loading
                          : accountState === "error"
                            ? $.access.readError
                            : $.people.empty,
                      ),
                    )
                  }
                >
                  {(item) => (
                    <TableRow id={item.id}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar className="size-6">
                            <AvatarFallback>
                              {item.name
                                .split(/\s+/u)
                                .slice(0, 2)
                                .map((part) => part[0])
                                .join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span>
                              {item.name}
                              {item.inactive && (
                                <Badge variant="secondary" className="ml-1">
                                  {t(($) => $.people.states.inactive)}
                                </Badge>
                              )}
                            </span>
                            {item.email && (
                              <span className="text-xs text-muted-foreground">{item.email}</span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.binding === "linked"
                              ? "success"
                              : item.binding === "pending"
                                ? "outline"
                                : "secondary"
                          }
                        >
                          {item.binding === "linked" && <CheckIcon />}
                          {t(($) => $.access.accountStates[item.binding])}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {item.linkedLabel ?? t(($) => $.access.notShared)}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {item.lastSigninLabel ?? t(($) => $.access.notShared)}
                      </TableCell>
                      <TableCell>
                        {item.binding === "linked" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            isDisabled={!onAction || !item.canRemove}
                            aria-label={`${t(($) => $.access.unlink)} — ${item.name}`}
                            onPress={() => onAction?.({ kind: "unlink", account: item })}
                          >
                            {t(($) => $.access.unlink)}
                          </Button>
                        ) : (
                          <Button
                            variant={item.binding === "pending" ? "ghost" : "outline"}
                            size="sm"
                            isDisabled={!onAction || !item.canInvite}
                            aria-label={`${t(($) => (item.binding === "pending" ? $.access.resendInvitation : $.access.sendLinkInvitation))} — ${item.name}`}
                            onPress={() => onAction?.({ kind: "invite", account: item })}
                          >
                            {t(($) =>
                              item.binding === "pending"
                                ? $.access.resendInvitation
                                : $.access.sendLinkInvitation,
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter className="flex flex-wrap justify-between gap-3 py-2.5 pt-2.5!">
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <LockKeyholeIcon className="mt-0.5 size-3.5 shrink-0" />
                {t(($) => $.access.accountFooter)}
              </p>
              {accountPaging && <AccessPagination {...accountPaging} />}
            </CardFooter>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
export interface AccessPaging {
  hasPrevious: boolean;
  hasNext: boolean;
  busy?: boolean;
  onPrevious: () => void;
  onNext: () => void;
}
function AccessPagination({ hasPrevious, hasNext, busy, onPrevious, onNext }: AccessPaging) {
  const { t } = useTranslation();
  return (
    <Pagination aria-label={t(($) => $.access.pagination)} className="m-0 w-auto">
      <PaginationContent>
        <PaginationItem>
          <Button
            size="sm"
            variant="outline"
            isDisabled={busy || !hasPrevious}
            onPress={onPrevious}
          >
            {t(($) => $.people.previous)}
          </Button>
        </PaginationItem>
        <PaginationItem>
          <Button size="sm" variant="outline" isDisabled={busy || !hasNext} onPress={onNext}>
            {t(($) => $.people.next)}
          </Button>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
