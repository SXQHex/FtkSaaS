"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@ftksaas/ui/components/button";
import { ApiFailure } from "../../lib/api";
import type { SetupCommand } from "../../lib/studio-setup";
import { errorKey, type useSetupCommand } from "../setup/setup-command";
export function flowError(cause: unknown) {
  return cause instanceof ApiFailure
    ? cause.failure.error.code
    : cause instanceof Error
      ? cause.message
      : "network";
}
export function FlowError({ code }: { code: string }) {
  const t = useTranslations("flows"),
    setup = useTranslations("setup");
  return (
    <p role="alert">{t.has(`errors.${code}`) ? t(`errors.${code}`) : setup(errorKey(code))}</p>
  );
}
export function ConfirmWrite({
  command,
  controller,
  children,
  onBack,
}: {
  command: SetupCommand;
  controller: ReturnType<typeof useSetupCommand>;
  children: ReactNode;
  onBack: () => void;
}) {
  const t = useTranslations("flows"),
    [confirmed, setConfirmed] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const disabled = controller.busy || !!controller.pending;
  return (
    <section
      className="min-w-0 space-y-4 rounded-md border p-4 wrap-anywhere"
      aria-label={t("review")}
    >
      <h4 tabIndex={-1} ref={heading} className="font-semibold outline-none">
        {t("review")}
      </h4>
      {children}
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={confirmed}
          disabled={disabled}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        {t("confirm")}
      </label>
      <div className="flex flex-wrap gap-3">
        <Button
          className="h-auto min-h-11 max-w-full whitespace-normal"
          type="button"
          disabled={disabled || !confirmed}
          onClick={() => void controller.run(command).then(onBack)}
        >
          {t("apply")}
        </Button>
        <Button
          className="h-auto min-h-11 max-w-full whitespace-normal"
          type="button"
          variant="outline"
          disabled={controller.busy}
          onClick={onBack}
        >
          {t("back")}
        </Button>
      </div>
    </section>
  );
}
