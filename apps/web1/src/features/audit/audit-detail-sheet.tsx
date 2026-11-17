import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { LockIcon } from "lucide-react";
import {
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "../../components/ui/sheet";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { ItemGroup, Item, ItemContent, ItemTitle, ItemDescription } from "../../components/ui/item";
import { Empty, EmptyDescription } from "../../components/ui/empty";
export interface AuditDetail {
  id: string;
  title: string;
  subject: string;
  date: string;
  actor: string;
  module?: string;
  result?: string;
  device?: string;
  reason?: string;
  changes: { field: string; before: string; after: string }[];
}
export function AuditDetailSheet({
  detail,
  notice,
  action,
  onClose,
  locked = false,
}: {
  detail: AuditDetail;
  notice?: ReactNode;
  action?: { label: string; onAction: () => void };
  onClose: () => void;
  locked?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Sheet
      isOpen
      onOpenChange={(open) => {
        if (!open && !locked) onClose();
      }}
      isDismissable={!locked}
      isKeyboardDismissDisabled={locked}
      showCloseButton={false}
    >
      <SheetHeader>
        <SheetTitle>{detail.title}</SheetTitle>
        <SheetDescription>{detail.subject}</SheetDescription>
      </SheetHeader>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {notice}
        <dl className="grid grid-cols-[minmax(0,6rem)_minmax(0,1fr)] gap-x-3 gap-y-3 text-sm">
          {(
            [
              ["id", detail.id],
              ["time", detail.date],
              ["actor", detail.actor],
              ["module", detail.module],
              ["result", detail.result],
              ["device", detail.device],
            ] as const
          ).map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="text-muted-foreground">{t(($) => $.audit.detailLabels[key])}</dt>
              <dd className="min-w-0 wrap-anywhere">
                {key === "result" && value ? (
                  <Badge variant="secondary">{value}</Badge>
                ) : (
                  (value ?? t(($) => $.audit.notProvided))
                )}
              </dd>
            </div>
          ))}
        </dl>
        <h2 className="mt-6 mb-3 text-sm font-semibold">{t(($) => $.audit.details)}</h2>
        {detail.reason && (
          <p className="mb-3 whitespace-pre-line text-sm wrap-anywhere">{detail.reason}</p>
        )}
        {detail.changes.length > 0 ? (
          <ItemGroup>
            {detail.changes.map((change, index) => (
              <Item key={`${change.field}:${index}`}>
                <ItemContent>
                  <ItemTitle>{change.field}</ItemTitle>
                  <ItemDescription className="whitespace-pre-line wrap-anywhere">
                    {change.before} → {change.after}
                  </ItemDescription>
                </ItemContent>
              </Item>
            ))}
          </ItemGroup>
        ) : (
          <Empty>
            <EmptyDescription>{t(($) => $.audit.noDetails)}</EmptyDescription>
          </Empty>
        )}
        <p className="mt-5 flex items-start gap-2 text-xs text-muted-foreground">
          <LockIcon className="size-4 shrink-0" />
          {t(($) => $.audit.immutable)}
        </p>
      </div>
      <SheetFooter>
        {action && (
          <Button variant="outline" isDisabled={locked} onPress={action.onAction}>
            {action.label}
          </Button>
        )}
        <Button variant="outline" isDisabled={locked} onPress={onClose}>
          {t(($) => $.audit.close)}
        </Button>
      </SheetFooter>
    </Sheet>
  );
}
