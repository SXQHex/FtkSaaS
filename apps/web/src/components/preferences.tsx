"use client";
import { useEffect, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ftksaas/ui/components/select";
import { setLocale } from "../i18n/actions";

// Existing shadcn Select primitives; no additional menu or control abstraction.
export function Preferences() {
  const t = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <div className="flex min-w-0 max-w-full flex-wrap gap-3">
      <Select
        value={locale}
        disabled={pending}
        onValueChange={(value) => {
          setFailed(false);
          startTransition(async () => {
            try {
              await setLocale(value);
              router.refresh();
            } catch {
              setFailed(true);
            }
          });
        }}
      >
        <SelectTrigger
          className="h-auto min-h-11 w-40 max-w-full whitespace-normal py-2"
          aria-label={t("language")}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="tr">Türkçe</SelectItem>
          <SelectItem value="en">English</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={mounted ? (theme ?? "system") : "system"}
        disabled={!mounted}
        onValueChange={setTheme}
      >
        <SelectTrigger
          className="h-auto min-h-11 w-32 max-w-full whitespace-normal py-2"
          aria-label={t("theme")}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="system">{t("system")}</SelectItem>
          <SelectItem value="light">{t("light")}</SelectItem>
          <SelectItem value="dark">{t("dark")}</SelectItem>
        </SelectContent>
      </Select>
      {failed ? <p role="alert">{t("retry")}</p> : null}
    </div>
  );
}
