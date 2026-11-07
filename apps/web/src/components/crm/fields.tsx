"use client";
import { useId } from "react";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
export const control = "min-h-11 w-full rounded-md border bg-background px-3";
export const button = "h-auto min-h-11 max-w-full whitespace-normal";
export function Field({
  name,
  label,
  type = "text",
  value,
  required = false,
}: {
  name: string;
  label: string;
  type?: string;
  value?: string;
  required?: boolean;
}) {
  const id = useId();
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type={type}
        defaultValue={value}
        required={required}
        maxLength={10000}
      />
    </div>
  );
}
