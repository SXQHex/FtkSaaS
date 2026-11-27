import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useFilter } from "react-aria-components";
import { SearchIcon } from "lucide-react";
import type { NavigationGroup } from "./navigation";
import { Button } from "@ftksaas/ui/components/button";
import { DialogFooter } from "@ftksaas/ui/components/dialog";
import { settingsLayout } from "../settings/settings-layout";
import { readPeoplePage } from "../people/people";
import type { ClientScope } from "../../lib/scoped-backend";
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@ftksaas/ui/components/command";
export function NavigationSearch({
  disabled = false,
  groups,
  settingsUrl,
  memberScope,
  showActions,
  managementActions,
  onThemeChange,
  onSignOut,
}: {
  disabled?: boolean;
  groups: NavigationGroup[];
  settingsUrl?: string;
  memberScope?: ClientScope;
  showActions: boolean;
  managementActions: boolean;
  onThemeChange?: () => void;
  onSignOut: () => void;
}) {
  const { t } = useTranslation();
  const { contains } = useFilter({ sensitivity: "base" });
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [settled, setSettled] = useState("");
  const query = input.trim();
  const links = groups.flatMap(({ items }) => items);
  const accountUrl = links.find(({ key }) => key === "account")?.url ?? "/account";
  const peopleUrl = managementActions ? links.find(({ key }) => key === "people")?.url : undefined;
  const reportsUrl = managementActions
    ? links.find(({ key }) => key === "reports")?.url
    : undefined;
  const canSearchMembers = !disabled && open && !!memberScope && query.length >= 2;
  useEffect(() => {
    if (!canSearchMembers) return;
    const timer = setTimeout(() => setSettled(query), 250);
    return () => clearTimeout(timer);
  }, [canSearchMembers, query]);
  const searching = canSearchMembers && query === settled;
  const memberSearch = useQuery({
    queryKey: ["palette-members", memberScope, settled],
    queryFn: async (context) => {
      const page = await readPeoplePage(
        memberScope!,
        settled,
        undefined,
        "active",
        false,
        undefined,
        context,
        6,
      );
      return page.items.slice(0, 6).map(({ id, display_name: name }) => ({ id, name }));
    },
    enabled: searching,
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
  const members = searching && !memberSearch.isError ? (memberSearch.data ?? []) : [];
  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) {
      setInput("");
      setSettled("");
    }
  }
  const actions = [
    ...(peopleUrl
      ? [{ key: "invite", label: t(($) => $.people.invite), href: `${peopleUrl}?action=invite` }]
      : []),
    ...(reportsUrl
      ? [
          {
            key: "import",
            label: t(($) => $.workspace.importMembers),
            href: `${reportsUrl}?action=import`,
          },
          {
            key: "export",
            label: t(($) => $.workspace.exportReport),
            href: `${reportsUrl}?action=export`,
          },
        ]
      : []),
    {
      key: "theme",
      label: t(($) => $.workspace.changeTheme),
      href: onThemeChange ? undefined : `${accountUrl}#account-appearance`,
      run: onThemeChange,
    },
    { key: "sign-out", label: t(($) => $.auth.signout), run: onSignOut },
  ];
  useEffect(() => {
    if (disabled) return;
    function shortcut(event: KeyboardEvent) {
      if (
        !event.isComposing &&
        !event.repeat &&
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, [disabled]);
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="pointer-coarse:min-h-11 pointer-coarse:min-w-11 @min-[1000px]/workspace:min-w-56"
        aria-label={t(($) => $.workspace.searchButtonLabel)}
        isDisabled={disabled}
        onPress={() => setOpen(true)}
      >
        <SearchIcon />
        <span className="hidden @min-[901px]/workspace:inline">
          {t(($) => $.workspace.searchShort)}
        </span>
        <span className="hidden rounded border px-1 text-xs text-muted-foreground min-[901px]:inline">
          Ctrl K
        </span>
      </Button>
      <CommandDialog
        open={open && !disabled}
        onOpenChange={changeOpen}
        title={t(($) => $.workspace.searchTitle)}
        description={t(($) => $.workspace.searchDescription)}
      >
        <search aria-label={t(($) => $.workspace.searchTitle)}>
          <Command
            inputValue={input}
            onInputChange={setInput}
            filter={(label, value, node) =>
              String(node.key).startsWith("member:") || contains(label, value)
            }
          >
            <CommandInput
              autoFocus
              type="search"
              placeholder={t(($) => $.workspace.searchPlaceholder)}
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
            />
            <CommandList
              aria-label={t(($) => $.workspace.searchResults)}
              renderEmptyState={() =>
                !canSearchMembers ||
                (searching && !memberSearch.isFetching && !memberSearch.isError) ? (
                  <CommandEmpty>{t(($) => $.workspace.noResults)}</CommandEmpty>
                ) : null
              }
            >
              {groups.map((group) => (
                <CommandGroup key={group.key} heading={t(($) => $.workspace.groups[group.key])}>
                  {group.items.map((item) => (
                    <CommandItem
                      key={item.key}
                      id={item.key}
                      href={item.url}
                      isDisabled={!item.url}
                      textValue={t(($) => $.workspace.links[item.key])}
                      onAction={() => changeOpen(false)}
                    >
                      {item.icon}
                      <span>{t(($) => $.workspace.links[item.key])}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
              {settingsUrl && (
                <CommandGroup heading={t(($) => $.settings.title)}>
                  {settingsLayout.map(({ key }) => {
                    const label = t(($) => $.settings.tabs[key]);
                    return (
                      <CommandItem
                        key={key}
                        id={`settings-${key}`}
                        href={`${settingsUrl}?${new URLSearchParams({ section: key })}`}
                        textValue={label}
                        onAction={() => changeOpen(false)}
                      >
                        {label}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
              {memberScope && members.length > 0 && (
                <CommandGroup heading={t(($) => $.people.title)}>
                  {members.map((member) => (
                    <CommandItem
                      key={member.id}
                      id={`member:${member.id}`}
                      href={`/o/${encodeURIComponent(memberScope.orgId)}/c/${encodeURIComponent(memberScope.centerId)}/people/${encodeURIComponent(member.id)}`}
                      textValue={member.name}
                      onAction={() => changeOpen(false)}
                    >
                      {member.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {showActions && query && (
                <CommandGroup heading={t(($) => $.workspace.quickActions)}>
                  {actions.map(({ key, label, href, run }) => (
                    <CommandItem
                      key={key}
                      id={`action-${key}`}
                      href={href}
                      textValue={label}
                      onAction={() => {
                        changeOpen(false);
                        run?.();
                      }}
                    >
                      {label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
          <p role="status" className="px-3 text-sm empty:hidden">
            {searching && memberSearch.isError ? t(($) => $.workspace.searchMembersError) : ""}
          </p>
        </search>
        <DialogFooter className="p-2">
          <Button variant="outline" onPress={() => changeOpen(false)}>
            {t(($) => $.security.close)}
          </Button>
        </DialogFooter>
      </CommandDialog>
    </>
  );
}
