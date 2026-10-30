"use client";
import { useState, type ComponentProps } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";

type Props = ComponentProps<typeof Input> & { id: string; label: string; error?: string };
export function AccountField({ id, label, error, onChange, onInvalid, ...props }: Props) {
  const t = useTranslations("account");
  const [validation, setValidation] = useState("");
  const message = error || validation;
  const checkbox = props.type === "checkbox";
  const fieldLabel = (
    <Label htmlFor={id} className={checkbox ? "text-sm leading-6" : undefined}>
      {label}
      {props.required && (
        <span aria-hidden="true" className="text-destructive">
          *
        </span>
      )}
    </Label>
  );
  return (
    <div className="space-y-2">
      <div className={checkbox ? "flex items-start gap-3" : "space-y-2"}>
        {!checkbox && fieldLabel}
        <Input
          {...props}
          id={id}
          aria-label={label}
          placeholder={props.placeholder ?? label}
          aria-invalid={!!message}
          aria-describedby={message ? `${id}-error` : undefined}
          className={`aria-invalid:hover:border-destructive aria-invalid:focus-visible:border-destructive ${props.className ?? ""}`}
          onInvalid={(event) => {
            event.preventDefault();
            const field = event.currentTarget;
            setValidation(
              field.validity.valueMissing
                ? t("fieldRequired")
                : field.validity.typeMismatch
                  ? t("fieldEmail")
                  : field.validity.tooShort
                    ? t("fieldMinLength", { count: field.minLength })
                    : t("fieldFormat"),
            );
            field.form?.querySelector<HTMLInputElement>("input:invalid")?.focus();
            onInvalid?.(event);
          }}
          onChange={(event) => {
            setValidation("");
            onChange?.(event);
          }}
        />
        {checkbox && fieldLabel}
      </div>
      {message && (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {message}
        </p>
      )}
    </div>
  );
}
