import type { ReactNode } from "react";
import { cn } from "@ftksaas/ui/lib/utils";
import { useTranslation } from "react-i18next";
import {
  UsersIcon,
  SearchIcon,
  CircleAlertIcon,
  WifiOffIcon,
  GitMergeIcon,
  PackageIcon,
  LockIcon,
  BanIcon,
  ClockIcon,
  CircleCheckIcon,
} from "lucide-react";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@ftksaas/ui/components/empty";
import { Alert, AlertTitle, AlertDescription } from "@ftksaas/ui/components/alert";
import { Skeleton } from "@ftksaas/ui/components/skeleton";
import { Spinner } from "@ftksaas/ui/components/spinner";
import type { StateKind } from "./state-kinds";
export type { StateKind } from "./state-kinds";
const icons = {
  empty: UsersIcon,
  noResults: SearchIcon,
  error: CircleAlertIcon,
  offline: WifiOffIcon,
  conflict: GitMergeIcon,
  limit: PackageIcon,
  forbidden: LockIcon,
  readOnly: BanIcon,
  notFound: SearchIcon,
  expired: ClockIcon,
  received: CircleCheckIcon,
};
export function StateView({
  kind,
  headingLevel = 2,
  actions,
  traceId,
  motionPaused = false,
}: {
  kind: StateKind;
  headingLevel?: 1 | 2 | 3;
  actions?: ReactNode;
  traceId?: string;
  motionPaused?: boolean;
}) {
  const { t } = useTranslation();
  const Heading = headingLevel === 1 ? "h1" : headingLevel === 2 ? "h2" : "h3";
  if (kind === "loading")
    return (
      <div
        aria-busy="true"
        className={cn(
          "flex min-w-0 flex-col gap-4 p-6",
          motionPaused && "[&_*]:[animation-play-state:paused]",
        )}
      >
        <div
          role="progressbar"
          aria-label={t(($) => $.states.content.loading.title)}
          className="flex items-center gap-2"
        >
          <Spinner
            aria-hidden="true"
            role="presentation"
            aria-label={undefined}
            className="motion-reduce:[animation-duration:6s]"
          />
          <Heading className="text-sm font-medium">
            {t(($) => $.states.content.loading.title)}
          </Heading>
        </div>
        <div aria-hidden="true" className="flex flex-col gap-3">
          <Skeleton className="h-4 w-2/5 motion-reduce:animate-none" />
          <Skeleton className="h-4 w-full motion-reduce:animate-none" />
          <Skeleton className="h-4 w-4/5 motion-reduce:animate-none" />
          <Skeleton className="h-4 w-3/5 motion-reduce:animate-none" />
        </div>
        {actions}
      </div>
    );
  const Icon = icons[kind];
  return (
    <Empty role={kind === "error" ? "alert" : undefined} className="min-w-0">
      <EmptyHeader>
        <EmptyMedia variant="icon" aria-hidden="true">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>
          <Heading tabIndex={headingLevel === 1 ? -1 : undefined}>
            {t(($) => $.states.content[kind].title)}
          </Heading>
        </EmptyTitle>
        <EmptyDescription>{t(($) => $.states.content[kind].description)}</EmptyDescription>
      </EmptyHeader>
      {traceId && (
        <p className="max-w-full text-xs text-muted-foreground wrap-anywhere">
          {t(($) => $.states.trace)} <code>{traceId}</code>
        </p>
      )}
      {actions && (
        <EmptyContent>
          <div className="flex flex-wrap justify-center gap-2">{actions}</div>
        </EmptyContent>
      )}
    </Empty>
  );
}
export function StateBanner({ kind }: { kind: "offline" | "readOnly" }) {
  const { t } = useTranslation();
  const Icon = icons[kind];
  return (
    <Alert role={kind === "offline" ? "alert" : "status"} className="rounded-none">
      <Icon aria-hidden="true" />
      <AlertTitle>{t(($) => $.states.content[kind].title)}</AlertTitle>
      <AlertDescription>{t(($) => $.states.content[kind].description)}</AlertDescription>
    </Alert>
  );
}
