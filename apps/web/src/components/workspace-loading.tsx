"use client";

import { useTranslations } from "next-intl";

export function WorkspaceLoading() {
  const t = useTranslations("common");
  return (
    <output aria-live="polite" aria-busy="true" className="block space-y-4 py-4">
      <span className="sr-only">{t("loading")}</span>
      <span aria-hidden="true" className="block space-y-3 rounded-xl border bg-card p-6">
        <span className="block h-4 w-40 max-w-full animate-pulse rounded bg-muted" />
        <span className="block h-4 w-full max-w-md animate-pulse rounded bg-muted" />
        <span className="block h-4 w-2/3 max-w-sm animate-pulse rounded bg-muted" />
      </span>
    </output>
  );
}
