"use client";
import { useDisplayFormatter as useFormatter } from "../display-format";
import { useCallback, useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { v7 } from "uuid";
import type {
  SettingsFieldKey,
  SettingsResetPreview,
  SettingsHistory,
} from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import {
  setupCall,
  type SetupScope,
  type SetupCommand,
  type SetupInput,
} from "../../lib/studio-setup";
import { readSettingsEditor, editorQuery } from "../../lib/settings-editor";
import type { DeliveryTarget } from "../../lib/delivery-settings";
import { initialShape, shapeValid } from "../../lib/settings-shape";
import { useRemote } from "../../lib/use-remote";
import { editorChoices } from "../../lib/settings-choices";
import { operatingValue } from "../../lib/operating-settings";
import { HistoryRestore } from "./history-restore";
import { OrganizationLogo } from "./organization-logo";
import { SettingControl, type SettingChoices } from "./setting-control";
import { ConfirmWrite, FlowError, flowError } from "../bookings/flow-controls";
import { useSetupCommand, SetupFeedback } from "../setup/setup-command";
export function SettingsEditor(props: {
  scope: SetupScope;
  target: DeliveryTarget;
  onSaved?: () => void;
}) {
  const scope =
    props.target === "organization" || props.target === "member"
      ? { actorId: props.scope.actorId, orgId: props.scope.orgId }
      : props.scope;
  return <EditorConnection key={JSON.stringify([scope, props.target])} {...props} scope={scope} />;
}
function EditorConnection({
  scope,
  target,
  onSaved,
}: {
  scope: SetupScope;
  target: DeliveryTarget;
  onSaved?: () => void;
}) {
  const t = useTranslations("settingsEditor"),
    [revision, setRevision] = useState(0),
    [selected, setSelected] = useState<SettingsFieldKey | "">("");
  const load = useCallback(() => readSettingsEditor(scope, target), [scope, target]),
    source = useRemote(load, JSON.stringify([scope, target, revision]));
  const refresh = () => {
    setSelected("");
    setRevision((n) => n + 1);
  };
  const recovery = useSetupCommand(scope, `settings-editor:${target}`, refresh);
  return (
    <section
      className="min-w-0 space-y-4 rounded-lg border p-4 wrap-anywhere"
      aria-label={t(`targets.${target}`)}
    >
      <h3 className="font-semibold">{t(`targets.${target}`)}</h3>
      <p>{t("hint")}</p>
      <SetupFeedback command={recovery} />
      <Button variant="outline" onClick={refresh}>
        {t("refresh")}
      </Button>
      {!source ? (
        <output>{t("loading")}</output>
      ) : source.error ? (
        <FlowError code={source.error} />
      ) : (
        source.data && (
          <>
            <label className="block space-y-2">
              {t("field")}
              <select
                className="min-h-11 w-full rounded-md border bg-background px-3"
                value={selected}
                onChange={(e) => setSelected(e.target.value as SettingsFieldKey)}
              >
                <option value="">{t("choose")}</option>
                {source.data.catalog.fields
                  .filter(
                    (f) =>
                      source.data!.shape.properties?.[f.key] &&
                      source.data!.shape.properties[f.key]?.type !== "null",
                  )
                  .map((f) => (
                    <option key={f.key} value={f.key}>
                      {t.has(`labels.${f.key}`) ? t(`labels.${f.key}`) : t("value")}
                      {!f.writable ? ` · ${t("readonly")}` : ""}
                    </option>
                  ))}
              </select>
            </label>
            {selected && (
              <SettingsField
                key={`${revision}:${selected}`}
                scope={scope}
                target={target}
                name={selected}
                source={source.data}
                onSaved={() => {
                  refresh();
                  onSaved?.();
                  window.dispatchEvent(new Event("ftk-settings-changed"));
                }}
              />
            )}
            {target === "organization" && (
              <OrganizationLogo
                key={revision}
                scope={scope}
                version={source.data.view.version}
                asset={source.data.view.logo}
                onSaved={() => {
                  refresh();
                  onSaved?.();
                }}
              />
            )}
            <EditorHistory
              key={revision}
              scope={scope}
              target={target}
              shape={source.data.shape}
              version={source.data.view.version}
              writable={source.data.catalog.fields.filter((f) => f.writable).map((f) => f.key)}
              onSaved={refresh}
            />
          </>
        )
      )}
    </section>
  );
}
function SettingsField({
  scope,
  target,
  name,
  source,
  onSaved,
}: {
  scope: SetupScope;
  target: DeliveryTarget;
  name: SettingsFieldKey;
  source: Awaited<ReturnType<typeof readSettingsEditor>>;
  onSaved: () => void;
}) {
  const t = useTranslations("settingsEditor"),
    shape = source.shape.properties![name]!,
    current = operatingValue(source.view.values, name),
    [value, setValue] = useState(() => (current === undefined ? initialShape(shape) : current)),
    [reason, setReason] = useState(""),
    [review, setReview] = useState<SetupCommand | null>(null),
    [reset, setReset] = useState<SettingsResetPreview | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [choices, setChoices] = useState<SettingChoices>({});
  const { setTheme } = useTheme();
  const command = useSetupCommand(scope, `settings-editor:${target}`, () => {
      if (target === "user" && name === "theme") {
        const theme = reset ? operatingValue(reset.after, name) : value;
        if (["light", "dark", "system"].includes(String(theme))) setTheme(String(theme));
      }
      onSaved();
    }),
    writable = source.catalog.fields.some((f) => f.key === name && f.writable),
    disabled = busy || command.busy || !!command.pending;
  useEffect(() => {
    let alive = true;
    void editorChoices(scope, target, name)
      .then((choices) => {
        if (alive) setChoices(choices);
      })
      .catch((e) => {
        if (alive) setError(flowError(e));
      });
    return () => {
      alive = false;
    };
  }, [scope, target, name]);
  useEffect(() => {
    if (!reset) return;
    const timer = setTimeout(
      () => {
        setReview(null);
        setReset(null);
        setError("PREVIEW_STALE");
      },
      Math.max(0, Math.min(2147483647, Date.parse(reset.expires_at) - Date.now())),
    );
    return () => clearTimeout(timer);
  }, [reset]);
  function invalidate() {
    setReview(null);
    setReset(null);
    setError("");
  }
  return (
    <section className="space-y-4">
      <p>
        {t(source.view.overridden_fields.some((k) => k === name) ? "local" : "default")} ·{" "}
        {t("version", { version: source.view.version })}
      </p>
      {(() => {
        const inherited =
          source.view.inherited_fields && Reflect.get(source.view.inherited_fields, name);
        const prepared =
          source.view.preparation_sources &&
          typeof source.view.preparation_sources === "object" &&
          Reflect.get(source.view.preparation_sources, name);
        const origin = inherited || prepared;
        return origin && typeof origin === "object" ? (
          <p>
            {t.has(String(origin.kind)) ? t(String(origin.kind)) : t("default")}
            {typeof origin.organization_version === "number"
              ? ` · ${t("version", { version: origin.organization_version })}`
              : ""}
          </p>
        ) : null;
      })()}
      <SetupFeedback command={command} />
      {error && <FlowError code={error} />}
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (disabled) return;
          try {
            if (!writable || !reason.trim() || !shapeValid(shape, value))
              throw Error("invalidSettings");
            setReview({
              operation: "settings_update_v1",
              input: {
                ...editorQuery(scope, target),
                operation_key: v7(),
                expected_version: source.view.version,
                patch: { [name]: value },
                reason: reason.trim(),
              } as SetupInput<"settings_update_v1">,
            });
            setReset(null);
            setError("");
          } catch (e) {
            setError(flowError(e));
          }
        }}
      >
        <fieldset className="min-w-0 space-y-3" disabled={!writable || disabled}>
          <SettingControl
            shape={shape}
            value={value}
            name={name}
            choices={choices}
            onChange={(v) => {
              invalidate();
              setValue(v);
            }}
          />
          <label className="block">
            {t("reason")}
            <Input
              required
              maxLength={1000}
              value={reason}
              onChange={(e) => {
                invalidate();
                setReason(e.target.value);
              }}
            />
          </label>
          <Button className="h-auto min-h-11 max-w-full whitespace-normal">{t("review")}</Button>
          {target === "center" &&
            [
              "report_templates",
              "import_templates",
              "agreement_templates",
              "permission_templates",
            ].includes(name) && (
              <Button
                className="h-auto min-h-11 max-w-full whitespace-normal"
                type="button"
                variant="outline"
                onClick={() => {
                  if (!reason.trim()) {
                    setError("invalidSettings");
                    return;
                  }
                  setReset(null);
                  setReview({
                    operation: "settings_update_v1",
                    input: {
                      ...editorQuery(scope, target),
                      operation_key: v7(),
                      expected_version: source.view.version,
                      patch: {},
                      inherit_fields: [name],
                      reason: reason.trim(),
                    } as SetupInput<"settings_update_v1">,
                  });
                }}
              >
                {t("inherit")}
              </Button>
            )}
          <Button
            className="h-auto min-h-11 max-w-full whitespace-normal"
            type="button"
            variant="outline"
            onClick={async () => {
              if (disabled) return;
              setBusy(true);
              invalidate();
              try {
                if (!reason.trim()) throw Error("invalidSettings");
                const p = await setupCall("settings_reset_preview_v1", {
                  ...editorQuery(scope, target),
                  fields: [name],
                } as SetupInput<"settings_reset_preview_v1">);
                if (
                  p.scope !== target ||
                  p.fields.length !== 1 ||
                  p.fields[0] !== name ||
                  p.version !== source.view.version ||
                  Date.parse(p.expires_at) <= Date.now()
                )
                  throw Error("PREVIEW_STALE");
                setReset(p);
                setReview({
                  operation: "settings_reset_apply_v1",
                  input: {
                    ...editorQuery(scope, target),
                    operation_key: v7(),
                    expected_version: p.version,
                    preview: { id: p.id, token: p.token },
                    reason: reason.trim(),
                  },
                });
              } catch (e) {
                setError(flowError(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {t("reset")}
          </Button>
        </fieldset>
      </form>
      {!writable && <p>{t("readonly")}</p>}
      {review && !command.pending && (
        <ConfirmWrite command={review} controller={command} onBack={() => setReview(null)}>
          <p>{t.has(`labels.${name}`) ? t(`labels.${name}`) : t("value")}</p>
          {review.operation === "settings_update_v1" && review.input.inherit_fields ? (
            <p>{t("inheritHint")}</p>
          ) : (
            <fieldset disabled className="min-w-0">
              <SettingControl
                shape={shape}
                value={reset ? operatingValue(reset.after, name) : value}
                name={name}
                choices={choices}
                onChange={() => {}}
              />
            </fieldset>
          )}
          <p>{reason}</p>
        </ConfirmWrite>
      )}
    </section>
  );
}
function EditorHistory({
  scope,
  target,
  shape,
  version,
  writable,
  onSaved,
}: {
  scope: SetupScope;
  target: DeliveryTarget;
  shape: import("../../lib/settings-shape").SettingShape;
  version: number;
  writable: SettingsFieldKey[];
  onSaved: () => void;
}) {
  const t = useTranslations("settingsEditor"),
    f = useFormatter(),
    [open, setOpen] = useState(false),
    [cursor, setCursor] = useState<string>(),
    [revision, setRevision] = useState(0);
  const load = useCallback(async () => {
    if (!open) return null;
    const p = await setupCall("settings_history_get_v1", {
      ...editorQuery(scope, target),
      ...(cursor ? { cursor } : {}),
    });
    if (cursor && p.next_cursor === cursor) throw Error("invalidSettings");
    return p;
  }, [scope, target, open, cursor]);
  const result = useRemote(load, JSON.stringify([scope, target, open, cursor, revision]));
  return (
    <section className="space-y-3">
      <Button
        className="h-auto min-h-11 max-w-full whitespace-normal"
        variant="outline"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          setCursor(undefined);
          setRevision((n) => n + 1);
        }}
      >
        {t("history")}
      </Button>
      {open &&
        (!result ? (
          <output>{t("loading")}</output>
        ) : result.error ? (
          <FlowError code={result.error} />
        ) : (
          result.data && (
            <HistoryRows
              page={result.data}
              shape={shape}
              scope={scope}
              target={target}
              version={version}
              writable={writable}
              onSaved={onSaved}
              date={(v) => f.dateTime(new Date(v), { dateStyle: "medium", timeStyle: "short" })}
              next={setCursor}
            />
          )
        ))}
    </section>
  );
}
function HistoryRows({
  page,
  shape,
  scope,
  target,
  version,
  writable,
  onSaved,
  date,
  next,
}: {
  page: SettingsHistory;
  scope: SetupScope;
  target: DeliveryTarget;
  version: number;
  writable: SettingsFieldKey[];
  onSaved: () => void;
  shape: import("../../lib/settings-shape").SettingShape;
  date: (v: string) => string;
  next: (v: string) => void;
}) {
  const t = useTranslations("settingsEditor");
  return (
    <>
      <ul className="space-y-3">
        {page.items.map((row) => (
          <li key={row.id}>
            <p>
              {date(row.at)} · {row.reason}
              {` · ${t(row.actor_account_id === scope.actorId ? "actorSelf" : "actorOther")}`}
            </p>
            {row.media_change && <p>{t("mediaChanged")}</p>}
            <ul>
              {Object.keys(row.after)
                .filter(
                  (k) =>
                    JSON.stringify(Reflect.get(row.before, k)) !==
                    JSON.stringify(Reflect.get(row.after, k)),
                )
                .map((k) => (
                  <li key={k}>
                    {t.has(`labels.${k}`) ? t(`labels.${k}`) : t("value")}
                    {shape.properties?.[k] && (
                      <fieldset disabled className="min-w-0">
                        <p>{t("before")}</p>
                        <SettingControl
                          shape={shape.properties[k]}
                          value={Reflect.get(row.before, k)}
                          name={k}
                          choices={{}}
                          onChange={() => {}}
                        />
                        <p>{t("after")}</p>
                        <SettingControl
                          shape={shape.properties[k]}
                          value={Reflect.get(row.after, k)}
                          name={k}
                          choices={{}}
                          onChange={() => {}}
                        />
                      </fieldset>
                    )}
                    {writable.some((field) => field === k) && (
                      <HistoryRestore
                        scope={scope}
                        target={target}
                        version={version}
                        historyId={row.id}
                        field={k as SettingsFieldKey}
                        onSaved={onSaved}
                      />
                    )}
                  </li>
                ))}
            </ul>
          </li>
        ))}
      </ul>
      {!page.items.length && <p>{t("empty")}</p>}
      {page.next_cursor && (
        <Button variant="outline" onClick={() => next(page.next_cursor!)}>
          {t("next")}
        </Button>
      )}
    </>
  );
}
