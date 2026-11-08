"use client";
import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import {
  initialShape,
  shapeBranches,
  shapeValid,
  type SettingShape,
} from "../../lib/settings-shape";
export type SettingChoices = Record<string, { id: string; name: string; orgId?: string }[]>;
const control = "min-h-11 w-full rounded-md border bg-background px-3";
export function SettingControl({
  shape,
  value,
  onChange,
  name,
  choices,
}: {
  shape: SettingShape;
  value: unknown;
  onChange: (v: unknown) => void;
  name: string;
  choices: SettingChoices;
}) {
  const t = useTranslations("settingsEditor"),
    id = useId(),
    label = t.has(`labels.${name}`) ? t(`labels.${name}`) : t("value");
  const branches = shapeBranches(shape);
  const [branchIndex, setBranchIndex] = useState(() =>
    Math.max(
      0,
      branches.findIndex((b) => shapeValid(b, value)),
    ),
  );
  if (branches.length) {
    const index = Math.min(branchIndex, branches.length - 1),
      branch = branches[index]!;
    return (
      <fieldset className="min-w-0 space-y-3">
        <legend>{label}</legend>
        <label className="block">
          {t("kind")}
          <select
            className={control}
            value={index}
            onChange={(e) => {
              setBranchIndex(Number(e.target.value));
              onChange(initialShape(branches[Number(e.target.value)]!));
            }}
          >
            {branches.map((b, i) => {
              const v =
                b.type === "null"
                  ? "unset"
                  : String(
                      b.properties?.kind?.const ?? b.properties?.type?.const ?? b.type ?? i + 1,
                    );
              return (
                <option key={i} value={i}>
                  {t.has(`options.${String(v).replaceAll(".", "_")}`)
                    ? t(`options.${String(v).replaceAll(".", "_")}`)
                    : t("variant", { number: i + 1 })}
                </option>
              );
            })}
          </select>
        </label>
        <SettingControl
          shape={branch}
          value={value}
          onChange={onChange}
          name={name}
          choices={choices}
        />
      </fieldset>
    );
  }
  if (shape.type === "null")
    return (
      <p>
        {label}: {t("unset")}
      </p>
    );
  if (Object.hasOwn(shape, "const"))
    return (
      <p>
        {label}: {String(shape.const)}
      </p>
    );
  if (shape.enum)
    return (
      <label className="block space-y-2">
        {label}
        <select
          className={control}
          value={shape.enum.findIndex((x) => x === value)}
          onChange={(e) => onChange(shape.enum![Number(e.target.value)])}
        >
          <option value={-1}>{t("choose")}</option>
          {shape.enum.map((v, i) => (
            <option key={i} value={i}>
              {t.has(`options.${String(v).replaceAll(".", "_")}`)
                ? t(`options.${String(v).replaceAll(".", "_")}`)
                : String(v)}
            </option>
          ))}
        </select>
      </label>
    );
  if (shape.type === "object") {
    const record =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    return (
      <fieldset className="min-w-0 space-y-3 rounded-md border p-3">
        <legend>{label}</legend>
        {Object.entries(shape.properties ?? {}).map(([k, s]) => {
          const optional = !shape.required?.includes(k),
            enabled = Object.hasOwn(record, k);
          return (
            <div className="space-y-2" key={k}>
              {optional && (
                <label className="flex min-h-11 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => {
                      const next = { ...record };
                      if (e.target.checked) next[k] = initialShape(s);
                      else delete next[k];
                      onChange(next);
                    }}
                  />
                  {t.has(`labels.${k}`) ? t(`labels.${k}`) : t("optional")}
                </label>
              )}
              {(!optional || enabled) && (
                <SettingControl
                  shape={s}
                  value={record[k]}
                  name={k}
                  choices={
                    name === "startup_context" && typeof record.org_id === "string"
                      ? Object.fromEntries(
                          Object.entries(choices).map(([family, rows]) => [
                            family,
                            family === "organizations"
                              ? rows
                              : rows.filter((r) => r.orgId === record.org_id),
                          ]),
                        )
                      : choices
                  }
                  onChange={(v) =>
                    onChange(
                      name === "startup_context" && k === "org_id"
                        ? { ...record, org_id: v, center_id: null, discipline_id: null }
                        : name === "startup_context" && k === "center_id"
                          ? { ...record, center_id: v, discipline_id: null }
                          : { ...record, [k]: v },
                    )
                  }
                />
              )}
            </div>
          );
        })}
      </fieldset>
    );
  }
  if (shape.type === "array") {
    const rows = Array.isArray(value) ? value : [],
      item = shape.items ?? {};
    if (item.enum)
      return (
        <fieldset className="min-w-0 space-y-2">
          <legend>{label}</legend>
          {item.enum.map((v, i) => (
            <label className="flex min-h-11 items-center gap-3" key={i}>
              <input
                type="checkbox"
                checked={rows.includes(v)}
                onChange={(e) =>
                  onChange(e.target.checked ? [...rows, v] : rows.filter((x) => x !== v))
                }
              />
              {t.has(`options.${String(v).replaceAll(".", "_")}`)
                ? t(`options.${String(v).replaceAll(".", "_")}`)
                : String(v)}
            </label>
          ))}
        </fieldset>
      );
    return (
      <fieldset className="min-w-0 space-y-3 rounded-md border p-3">
        <legend>{label}</legend>
        {rows.map((r, i) => (
          <div key={i} className="space-y-2 border-b pb-3">
            <SettingControl
              shape={item}
              value={r}
              name={name.endsWith("_ids") ? name.slice(0, -1) : name}
              choices={choices}
              onChange={(v) => onChange(rows.map((r, j) => (j === i ? v : r)))}
            />
            <Button
              className="h-auto min-h-11 max-w-full whitespace-normal"
              type="button"
              variant="outline"
              onClick={() => onChange(rows.filter((_, j) => j !== i))}
            >
              {t("remove")}
            </Button>
          </div>
        ))}
        <Button
          className="h-auto min-h-11 max-w-full whitespace-normal"
          type="button"
          variant="outline"
          disabled={rows.length >= (shape.maxItems ?? Number.MAX_SAFE_INTEGER)}
          onClick={() => onChange([...rows, initialShape(item)])}
        >
          {t("add")}
        </Button>
      </fieldset>
    );
  }
  if (shape.type === "boolean")
    return (
      <label className="flex min-h-11 items-center gap-3">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
        />
        {label}
      </label>
    );
  if (shape.reference === "FtkUuid") {
    const family =
      name === "org_id"
        ? "organizations"
        : name.includes("product")
          ? "products"
          : name.includes("center")
            ? "centers"
            : name.includes("discipline")
              ? "disciplines"
              : name.includes("instructor")
                ? "instructors"
                : name.includes("room")
                  ? "rooms"
                  : "people";
    return (
      <label className="block space-y-2">
        {label}
        <select
          className={control}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{t("choose")}</option>
          {choices[family]?.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
    );
  }
  const number = shape.type === "integer" || shape.type === "number",
    instant = shape.format === "date-time";
  const text = typeof value === "string" || typeof value === "number" ? String(value) : "";
  let local = text;
  if (instant && text && Number.isFinite(Date.parse(text))) {
    const d = new Date(text);
    local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  return (
    <label className="block space-y-2" htmlFor={id}>
      {label}
      <Input
        id={id}
        type={
          number
            ? "number"
            : shape.format === "date"
              ? "date"
              : instant
                ? "datetime-local"
                : name.endsWith("color")
                  ? "color"
                  : shape.format === "email"
                    ? "email"
                    : "text"
        }
        value={local}
        min={shape.minimum}
        max={shape.maximum}
        step={number ? (shape.type === "integer" ? 1 : "any") : undefined}
        minLength={shape.minLength}
        maxLength={shape.maxLength}
        pattern={shape.pattern}
        onChange={(e) => {
          const v = e.target.value;
          if (instant && v) {
            const d = new Date(v);
            onChange(Number.isFinite(d.getTime()) ? d.toISOString() : v);
          } else onChange(number && v !== "" ? Number(v) : v);
        }}
      />
    </label>
  );
}
