import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SearchIcon } from "lucide-react";
import type { NavigationGroup } from "./navigation";
import { Button } from "../../components/ui/button";
import { DialogFooter } from "../../components/ui/dialog";
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "../../components/ui/command";
export function NavigationSearch({ groups }: { groups: NavigationGroup[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  useEffect(() => {
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
  }, []);
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="@min-[1000px]/workspace:min-w-56"
        aria-label={t(($) => $.workspace.searchButtonLabel)}
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
        open={open}
        onOpenChange={setOpen}
        title={t(($) => $.workspace.searchTitle)}
        description={t(($) => $.workspace.searchDescription)}
      >
        <search aria-label={t(($) => $.workspace.searchTitle)}>
          <Command>
            <CommandInput
              type="search"
              placeholder={t(($) => $.workspace.searchPlaceholder)}
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
            />
            <CommandList
              aria-label={t(($) => $.workspace.searchResults)}
              renderEmptyState={() => (
                <CommandEmpty>{t(($) => $.workspace.noResults)}</CommandEmpty>
              )}
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
                      onAction={() => setOpen(false)}
                    >
                      {item.icon}
                      <span>{t(($) => $.workspace.links[item.key])}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </search>
        <DialogFooter className="p-2">
          <Button variant="outline" onPress={() => setOpen(false)}>
            {t(($) => $.security.close)}
          </Button>
        </DialogFooter>
      </CommandDialog>
    </>
  );
}
