import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@ftksaas/ui/lib/utils";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@ftksaas/ui/components/card";
import {
  Item,
  ItemGroup,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "@ftksaas/ui/components/item";
import { Button } from "@ftksaas/ui/components/button";
import { Badge } from "@ftksaas/ui/components/badge";
import { Input } from "@ftksaas/ui/components/input";
import { Checkbox } from "@ftksaas/ui/components/checkbox";
import { Field, FieldLabel } from "@ftksaas/ui/components/field";
import { ToggleGroup, ToggleGroupItem } from "@ftksaas/ui/components/toggle-group";
import { Empty, EmptyDescription } from "@ftksaas/ui/components/empty";
import { MemberReadSkeleton } from "../member/member-read-skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@ftksaas/ui/components/alert-dialog";
import type { InboxFilter, InboxVisibility } from "./inbox";
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
export function InboxView({
  member = false,
  loading,
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
  canMarkSelection = false,
  onMarkInboxRead,
  onMarkSelected,
  onMoveSelected,
  undoVisibility = false,
  onSelectVisible,
  onUndo,
  locked = false,
  notice,
  detailNotice,
  pagination,
  sourceAction,
  onUnread,
  canUnread = false,
  checked = [],
  onCheck,
  summary,
  onSearch,
}: {
  member?: boolean;
  loading: boolean;
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
  canMarkSelection?: boolean;
  onMarkInboxRead?: () => void;
  onMarkSelected: (read: boolean) => void;
  onMoveSelected: (visibility: InboxVisibility) => void;
  undoVisibility?: boolean;
  onSelectVisible: (value: boolean) => void;
  onUndo?: () => void;
  locked?: boolean;
  notice?: ReactNode;
  detailNotice?: ReactNode;
  pagination?: ReactNode;
  sourceAction?: ReactNode;
  onUnread?: () => void;
  canUnread?: boolean;
  checked?: string[];
  onCheck?: (id: string, checked: boolean) => void;
  summary?: { total: number; unread: number; pending: number };
  onSearch?: () => void;
}) {
  const { t } = useTranslation(),
    heading = useRef<HTMLHeadingElement>(null),
    buttons = useRef(new Map<string, HTMLButtonElement>()),
    previous = useRef<string | null>(null);
  const selectedId = selected?.id;
  const [deleteOpen, setDeleteOpen] = useState(false);
  const outsideInbox = filter === "archived" || filter === "deleted";
  const filters: InboxFilter[] = ["all", "unread", "todo"];
  if (!member) filters.push("archived", "deleted");
  const visibleChecked = rows?.filter((row) => checked.includes(row.id)).length ?? 0;
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
          <h1 className="text-2xl font-semibold">
            {t(($) => (member ? $.workspace.notifications : $.inbox.title))}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(($) => (member ? $.inbox.memberDescription : $.inbox.description))}
          </p>
        </div>
        {member && (
          <Button
            variant="outline"
            isDisabled={locked || !onMarkInboxRead}
            onPress={onMarkInboxRead}
          >
            {t(($) => $.inbox.markInboxRead)}
          </Button>
        )}
        <div
          role="group"
          aria-label={t(($) => $.inbox.selectionActions)}
          className="flex flex-wrap items-center gap-2"
        >
          <Checkbox
            className="bg-input/70"
            isSelected={visibleChecked > 0 && visibleChecked === rows?.length}
            isIndeterminate={visibleChecked > 0 && visibleChecked < (rows?.length ?? 0)}
            isDisabled={locked || !rows?.length}
            onChange={onSelectVisible}
          >
            {t(($) => $.inbox.selectVisible)}
          </Checkbox>
          <Button
            variant="outline"
            isDisabled={locked || !canMarkSelection}
            onPress={() => onMarkSelected(true)}
          >
            {t(($) => $.inbox.markSelected)}
            {checked.length > 0 && <Badge variant="secondary">{checked.length}</Badge>}
          </Button>
          <Button
            variant="outline"
            isDisabled={locked || !canMarkSelection}
            onPress={() => onMarkSelected(false)}
          >
            {t(($) => $.inbox.markSelectedUnread)}
          </Button>
          {!member && (
            <>
              <Button
                variant="outline"
                isDisabled={locked || !canMarkSelection}
                onPress={() => onMoveSelected(outsideInbox ? "inbox" : "archived")}
              >
                {t(($) => (outsideInbox ? $.inbox.restoreSelected : $.inbox.archiveSelected))}
              </Button>
              {filter !== "deleted" && (
                <Button
                  variant="outline"
                  isDisabled={locked || !canMarkSelection}
                  onPress={() => setDeleteOpen(true)}
                >
                  {t(($) => $.inbox.deleteSelected)}
                </Button>
              )}
            </>
          )}
        </div>
      </header>
      {notice}
      {onUndo && (
        <Button variant="outline" className="self-start" isDisabled={locked} onPress={onUndo}>
          {t(($) => (undoVisibility ? $.inbox.undoVisibilityChange : $.inbox.undoReadChange))}
        </Button>
      )}
      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <Card className={cn("min-w-0", selected && "hidden xl:flex")}>
          <CardHeader>
            <CardTitle className="sr-only">
              <h2>{t(($) => $.inbox.messages)}</h2>
            </CardTitle>
            <div className="flex min-w-0 flex-col gap-3">
              <form
                className="flex min-w-0 items-end gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  onSearch?.();
                }}
              >
                <Field className="min-w-0 flex-1">
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
                <Button type="submit" variant="outline" isDisabled={locked || !advancedAvailable}>
                  {t(($) => $.inbox.searchSubmit)}
                </Button>
              </form>
              <ToggleGroup
                aria-label={t(($) => $.inbox.filter)}
                selectionMode="single"
                disallowEmptySelection
                selectedKeys={[filter]}
                onSelectionChange={(keys) => {
                  const value = [...keys][0];
                  const next = filters.find((filter) => filter === value);
                  if (next) onFilter(next);
                }}
                variant="segmented"
                className="max-w-full flex-wrap"
              >
                {filters.map((value) => (
                  <ToggleGroupItem
                    aria-label={t(($) => $.inbox.filters[value])}
                    id={value}
                    key={value}
                    isDisabled={locked || (value === "todo" && !advancedAvailable)}
                  >
                    {t(($) => $.inbox.filters[value])}
                    {summary && !outsideInbox && value !== "archived" && value !== "deleted" && (
                      <Badge variant="secondary">
                        {
                          summary[
                            value === "all" ? "total" : value === "unread" ? "unread" : "pending"
                          ]
                        }
                      </Badge>
                    )}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </CardHeader>
          <CardContent>
            {loading && <MemberReadSkeleton label={t(($) => $.inbox.loading)} />}
            {rows &&
              (rows.length === 0 ? (
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
                      {onCheck && (
                        <Checkbox
                          aria-label={t(($) => $.inbox.selectMessage, { title: row.title })}
                          isSelected={checked.includes(row.id)}
                          isDisabled={locked}
                          onChange={(value) => onCheck(row.id, value)}
                        />
                      )}
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
                      <ItemActions className="max-w-full self-start text-xs text-muted-foreground tabular-nums">
                        {row.created}
                      </ItemActions>
                    </Item>
                  ))}
                </ItemGroup>
              ))}
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
                    {t(($) => (member ? $.workspace.notifications : $.inbox.title))}
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
                </CardContent>
                <CardFooter className="flex flex-wrap items-center gap-2">
                  {sourceAction}
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
      <AlertDialog isOpen={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogHeader>
          <AlertDialogTitle>{t(($) => $.inbox.deleteSelected)}</AlertDialogTitle>
          <AlertDialogDescription>
            {t(($) => $.inbox.deleteSelectedDescription, { count: checked.length })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel autoFocus>{t(($) => $.inbox.deleteCancel)}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            isDisabled={locked || !canMarkSelection}
            onPress={() => onMoveSelected("deleted")}
          >
            {t(($) => $.inbox.deleteConfirm)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialog>
    </div>
  );
}
