import { useId } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { BellIcon } from "lucide-react";
import { Badge } from "@ftksaas/ui/components/badge";
import { LinkButton } from "@ftksaas/ui/components/button";
import type { ClientScope } from "../../lib/scoped-backend";
import { inboxListQuery } from "./inbox";

export function MemberInboxLink({
  scope,
  current,
  disabled,
}: {
  scope: ClientScope;
  current: boolean;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const descriptionId = useId();
  const inbox = useQuery(inboxListQuery(scope));
  const count = inbox.isError ? undefined : inbox.data?.summary?.unread;
  const search = new URLSearchParams({ org: scope.orgId, center: scope.centerId, view: "member" });
  return (
    <div className="relative">
      <LinkButton
        href={`/inbox?${search}`}
        aria-label={t(($) => $.workspace.notifications)}
        aria-describedby={count !== undefined ? descriptionId : undefined}
        aria-current={current ? "page" : undefined}
        isDisabled={disabled}
        size="icon"
        variant={current ? "secondary" : "ghost"}
        className={current ? "border border-current" : undefined}
      >
        <BellIcon aria-hidden="true" />
      </LinkButton>
      {count !== undefined && count > 0 && (
        <Badge
          aria-hidden="true"
          className="pointer-events-none absolute end-0 top-0 h-4 min-w-4 px-1 text-[0.625rem] tabular-nums"
        >
          {count > 99 ? "99+" : count}
        </Badge>
      )}
      {count !== undefined && (
        <span id={descriptionId} className="sr-only">
          {t(($) => $.inbox.unreadCount, { count })}
        </span>
      )}
    </div>
  );
}
