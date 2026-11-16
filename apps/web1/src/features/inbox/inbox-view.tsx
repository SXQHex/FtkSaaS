import { useEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
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
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Field, FieldLabel } from "../../components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { Empty, EmptyDescription } from "../../components/ui/empty";
export interface InboxRow {
  id: string;
  title: string;
  body: string;
  kind: string;
  created: string;
  read: boolean;
  language?: string;
  actionState?: string;
  context: { label: string; value: string }[];
}
export type InboxFilter = "all" | "unread" | "todo";
export function InboxView({
  rows,
  selected,
  filter,
  onFilter,
  query,
  onQuery,
  onOpen,
  onBack,
  onMarkRead,
  canMarkRead,
  advancedAvailable = false,
  canMarkAll = false,
  onMarkAll,
  locked = false,
  notice,
  detailNotice,
  pagination,
  sourceAction,
  replyEnabled = false,
  reply = "",
  onReply,
  onSend,
  onComplete,
  canComplete = false,
  onUnread,
  canUnread = false,
}: {
  rows: InboxRow[] | null;
  selected: InboxRow | null;
  filter: InboxFilter;
  onFilter: (value: InboxFilter) => void;
  query: string;
  onQuery: (value: string) => void;
  onOpen: (id: string) => void;
  onBack: () => void;
  onMarkRead: () => void;
  canMarkRead: boolean;
  advancedAvailable?: boolean;
  canMarkAll?: boolean;
  onMarkAll: () => void;
  locked?: boolean;
  notice?: ReactNode;
  detailNotice?: ReactNode;
  pagination?: ReactNode;
  sourceAction?: ReactNode;
  replyEnabled?: boolean;
  reply?: string;
  onReply?: (value: string) => void;
  onSend?: () => void;
  onComplete?: () => void;
  canComplete?: boolean;
  onUnread?: () => void;
  canUnread?: boolean;
}) {
  const { t } = useTranslation(),
    heading = useRef<HTMLHeadingElement>(null),
    buttons = useRef(new Map<string, HTMLButtonElement>()),
    previous = useRef<string | null>(null);
  const selectedId = selected?.id;
  useEffect(() => {
    if (selectedId) {
      previous.current = selectedId;
      heading.current?.focus();
    } else if (previous.current) buttons.current.get(previous.current)?.focus();
  }, [selectedId]);
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t(($) => $.inbox.title)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t(($) => $.inbox.description)}</p>
        </div>
        <Button variant="outline" isDisabled={locked || !canMarkAll} onPress={onMarkAll}>
          {t(($) => $.inbox.markAll)}
        </Button>
      </header>
      {notice}
      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <Card className={cn("min-w-0", selected && "hidden xl:flex")}>
          <CardHeader>
            <CardTitle className="sr-only">
              <h2>{t(($) => $.inbox.messages)}</h2>
            </CardTitle>
            <div className="flex min-w-0 flex-col gap-3">
              <Field>
                <FieldLabel htmlFor="inbox-search" className="sr-only">
                  {t(($) => $.inbox.search)}
                </FieldLabel>
                <Input
                  id="inbox-search"
                  type="search"
                  value={query}
                  placeholder={t(($) => $.inbox.search)}
                  disabled={locked || !advancedAvailable}
                  onChange={(event) => onQuery(event.target.value)}
                />
              </Field>
              <ToggleGroup
                aria-label={t(($) => $.inbox.filter)}
                selectionMode="single"
                disallowEmptySelection
                selectedKeys={[filter]}
                onSelectionChange={(keys) => {
                  const value = [...keys][0];
                  if (value === "all" || value === "unread" || value === "todo") onFilter(value);
                }}
                variant="segmented"
                className="max-w-full flex-wrap"
              >
                {(["all", "unread", "todo"] as const).map((value) => (
                  <ToggleGroupItem
                    id={value}
                    key={value}
                    isDisabled={locked || (value === "todo" && !advancedAvailable)}
                  >
                    {t(($) => $.inbox.filters[value])}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </CardHeader>
          <CardContent>
            {rows === null ? (
              <p>{t(($) => $.inbox.loading)}</p>
            ) : rows.length === 0 ? (
              <Empty>
                <EmptyDescription>{t(($) => $.inbox.empty)}</EmptyDescription>
              </Empty>
            ) : (
              <ItemGroup>
                {rows.map((row) => (
                  <Item
                    role="listitem"
                    key={row.id}
                    variant={selected?.id === row.id ? "muted" : "outline"}
                    size="sm"
                  >
                    <ItemContent className="min-w-0">
                      <ItemTitle className="w-full">
                        <Button
                          ref={(node) => {
                            if (node) buttons.current.set(row.id, node);
                            else buttons.current.delete(row.id);
                          }}
                          variant="ghost"
                          className="h-auto w-full min-w-0 justify-start px-0 text-start whitespace-normal"
                          isDisabled={locked}
                          aria-controls="inbox-detail"
                          aria-current={selected?.id === row.id ? true : undefined}
                          onPress={() => onOpen(row.id)}
                        >
                          {row.title}
                        </Button>
                      </ItemTitle>
                      <ItemDescription className="line-clamp-2 break-words" lang={row.language}>
                        {row.body}
                      </ItemDescription>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="outline">{row.kind}</Badge>
                        <Badge variant={row.read ? "secondary" : "default"}>
                          {row.read ? t(($) => $.inbox.read) : t(($) => $.inbox.unread)}
                        </Badge>
                        {row.actionState && <Badge variant="outline">{row.actionState}</Badge>}
                      </div>
                    </ItemContent>
                    <ItemActions className="self-start text-xs text-muted-foreground tabular-nums">
                      {row.created}
                    </ItemActions>
                  </Item>
                ))}
              </ItemGroup>
            )}
          </CardContent>
          <CardFooter className="flex-wrap justify-between gap-3">
            <span className="text-sm text-muted-foreground tabular-nums">
              {rows
                ? t(($) => $.inbox.pageCount, { count: rows.length })
                : t(($) => $.inbox.unknown)}
            </span>
            {pagination}
          </CardFooter>
        </Card>
        <aside
          id="inbox-detail"
          aria-label={t(($) => $.inbox.detail)}
          className={cn("min-w-0 xl:sticky xl:top-20", !selected && "hidden xl:block")}
        >
          <Card className="min-w-0">
            {selected ? (
              <>
                <CardHeader>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="self-start xl:hidden"
                    isDisabled={locked}
                    onPress={onBack}
                  >
                    {t(($) => $.inbox.title)}
                  </Button>
                  <CardTitle>
                    <h2
                      ref={heading}
                      tabIndex={-1}
                      className="break-words"
                      lang={selected.language}
                    >
                      {selected.title}
                    </h2>
                  </CardTitle>
                  <CardDescription className="tabular-nums">{selected.created}</CardDescription>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{selected.kind}</Badge>
                    <Badge variant={selected.read ? "secondary" : "default"}>
                      {selected.read ? t(($) => $.inbox.read) : t(($) => $.inbox.unread)}
                    </Badge>
                    {selected.actionState && <Badge>{selected.actionState}</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  <p className="whitespace-pre-wrap break-words" lang={selected.language}>
                    {selected.body}
                  </p>
                  <dl className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-x-4 gap-y-3 text-sm">
                    {selected.context.map((item) => (
                      <div key={item.label} className="contents">
                        <dt className="text-muted-foreground">{item.label}</dt>
                        <dd className="min-w-0 break-words">{item.value}</dd>
                      </div>
                    ))}
                  </dl>
                  {detailNotice}
                  <Field>
                    <FieldLabel htmlFor="inbox-reply">{t(($) => $.inbox.reply)}</FieldLabel>
                    <Textarea
                      id="inbox-reply"
                      value={reply}
                      disabled={locked || !replyEnabled}
                      onChange={(event) => onReply?.(event.target.value)}
                      placeholder={t(($) => $.inbox.replyPlaceholder)}
                      rows={3}
                    />
                  </Field>
                </CardContent>
                <CardFooter className="flex flex-wrap items-center gap-2">
                  {sourceAction}
                  <Button
                    variant="outline"
                    size="sm"
                    isDisabled={locked || !canComplete}
                    onPress={onComplete}
                  >
                    {t(($) => $.inbox.complete)}
                  </Button>
                  <Button
                    size="sm"
                    isDisabled={locked || !replyEnabled || !reply.trim()}
                    onPress={onSend}
                  >
                    {t(($) => $.inbox.send)}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    isDisabled={locked || (selected.read ? !canUnread : !canMarkRead)}
                    onPress={selected.read ? onUnread : onMarkRead}
                  >
                    {selected.read ? t(($) => $.inbox.markUnread) : t(($) => $.inbox.markRead)}
                  </Button>
                </CardFooter>
              </>
            ) : (
              <CardContent>
                <Empty>
                  <EmptyDescription>{t(($) => $.inbox.choose)}</EmptyDescription>
                </Empty>
              </CardContent>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
