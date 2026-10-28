"use client";
import { useTranslations } from "next-intl";
import { Button } from "@ftksaas/ui/components/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const t = useTranslations("pages");
  const common = useTranslations("common");
  return (
    <main id="main-content" className="mx-auto max-w-lg space-y-5 px-6 py-24">
      <h1 className="text-2xl font-semibold">{t("errorTitle")}</h1>
      <p>{t("errorHelp")}</p>
      <Button onClick={reset}>{common("retry")}</Button>
    </main>
  );
}
