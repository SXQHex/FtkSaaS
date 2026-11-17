import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "../../components/ui/sheet";
import { Item, ItemGroup, ItemContent, ItemTitle, ItemDescription } from "../../components/ui/item";
import { Button } from "../../components/ui/button";
import { Empty, EmptyDescription } from "../../components/ui/empty";
export function SegmentDiscoveryView({
  loading = true,
  name,
  mode,
  rows,
  summary,
  notice,
  pagination,
  onClose,
}: {
  loading?: boolean;
  name: string;
  mode: "matches" | "automations";
  rows: { id: string; name: string; status?: string }[] | null;
  summary?: { audience_count: number; matched_count: number; using_automations: number };
  notice?: ReactNode;
  pagination?: ReactNode;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Sheet
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetHeader>
        <SheetTitle>{t(($) => $.automation.discovery[mode])}</SheetTitle>
        <SheetDescription>
          {name} · {t(($) => $.automation.savedDefinition)}
        </SheetDescription>
      </SheetHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pb-4">
        {summary && (
          <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 text-sm">
            {(["audience_count", "matched_count", "using_automations"] as const).map((key) => (
              <div className="contents" key={key}>
                <dt>{t(($) => $.automation.segmentCounts[key])}</dt>
                <dd className="tabular-nums">
                  {new Intl.NumberFormat("tr-TR").format(summary[key])}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {notice}
        {rows === null ? (
          loading ? (
            <p role="status">{t(($) => $.automation.loading)}</p>
          ) : null
        ) : rows.length === 0 ? (
          <Empty>
            <EmptyDescription>{t(($) => $.automation.empty)}</EmptyDescription>
          </Empty>
        ) : (
          <ItemGroup>
            {rows.map((row) => (
              <Item key={row.id} role="listitem" variant="outline">
                <ItemContent>
                  <ItemTitle className="break-words">{row.name}</ItemTitle>
                  {row.status && <ItemDescription>{row.status}</ItemDescription>}
                </ItemContent>
              </Item>
            ))}
          </ItemGroup>
        )}
      </div>
      <SheetFooter className="flex-wrap">
        {pagination}
        <Button variant="outline" onPress={onClose}>
          {t(($) => $.automation.cancel)}
        </Button>
      </SheetFooter>
    </Sheet>
  );
}
