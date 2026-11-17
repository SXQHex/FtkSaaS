import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from "react";
import { useTranslation } from "react-i18next";
import { v7 as uuidv7 } from "uuid";
import { BackendError } from "../../lib/backend";
import {
  saveAppearance,
  type AppearanceSnapshot,
  type AppearanceIntent,
  type AppearanceChange,
} from "./appearance";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../../components/ui/card";
import {
  Item,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "../../components/ui/item";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Skeleton } from "../../components/ui/skeleton";
import { NativeSelect, NativeSelectOption } from "../../components/ui/native-select";
import { Separator } from "../../components/ui/separator";

type Notice = "ready" | "saved" | "unknown" | "conflict" | "saved-unread";
export interface AppearanceActions {
  toggleTheme: () => void;
}
export function AppearancePanel({
  snapshot,
  readError,
  onRefresh,
  ref,
  onDisabledChange,
}: {
  snapshot?: AppearanceSnapshot;
  readError: boolean;
  onRefresh: () => Promise<AppearanceSnapshot>;
  ref?: Ref<AppearanceActions>;
  onDisabledChange?: (disabled: boolean) => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [notice, setNotice] = useState<Notice>("ready");
  const [intent, setIntent] = useState<AppearanceIntent>();
  const [readFailed, setReadFailed] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const lastField = useRef<AppearanceChange["field"]>("theme");
  useLayoutEffect(() => {
    if (busy || !previousFocus.current) return;
    const previous = previousFocus.current;
    previousFocus.current = null;
    if (document.activeElement !== document.body) return;
    const recovery = card.current?.querySelector<HTMLElement>("[data-recovery]:not(:disabled)");
    const control = card.current?.querySelector<HTMLElement>(
      lastField.current !== "theme"
        ? `#appearance-${lastField.current === "font_scale" ? "scale" : lastField.current}:not(:disabled)`
        : '[role="radio"][aria-checked="true"]:not(:disabled)',
    );
    const target =
      previous.isConnected && !previous.matches(":disabled") ? previous : (recovery ?? control);
    target?.focus();
  }, [busy]);
  async function reload(clearIntent: boolean) {
    if (locked.current) return;
    previousFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    locked.current = true;
    setBusy(true);
    try {
      await onRefresh();
      setReadFailed(false);
      if (clearIntent) {
        setIntent(undefined);
        setNotice("ready");
      } else if (notice === "saved-unread") setNotice("saved");
    } catch {
      setReadFailed(true);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function write(next?: AppearanceChange) {
    if (locked.current || !snapshot) return;
    if (next) {
      if (notice !== "ready" && notice !== "saved") return;
      if (
        !snapshot.writable[next.field] ||
        (next.value === snapshot.values[next.field] &&
          (next.field !== "timezone_name" ||
            snapshot.values.timezone_mode === (next.value === null ? "auto" : "manual")))
      )
        return;
    }
    const current = next ? { change: next, version: snapshot.version, key: uuidv7() } : intent;
    if (!current || !snapshot.writable[current.change.field]) return;
    lastField.current = current.change.field;
    setIntent(current);
    previousFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    locked.current = true;
    setBusy(true);
    setReadFailed(false);
    let accepted = false;
    try {
      await saveAppearance(current);
      accepted = true;
      setIntent(undefined);
      setNotice("saved-unread");
    } catch (error) {
      if (error instanceof BackendError && error.code === "VERSION_CONFLICT") {
        setIntent(undefined);
        setNotice("conflict");
      } else setNotice("unknown");
    }
    try {
      await onRefresh();
      if (accepted) setNotice("saved");
    } catch {
      setReadFailed(true);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  const disabled =
    busy || readError || readFailed || !snapshot || !["ready", "saved"].includes(notice);
  useEffect(() => {
    onDisabledChange?.(disabled || !snapshot?.writable.theme);
  }, [disabled, snapshot?.writable.theme, onDisabledChange]);
  useImperativeHandle(ref, () => ({
    toggleTheme() {
      if (disabled || !snapshot?.writable.theme) return;
      const dark =
        snapshot.values.theme === "dark" ||
        (snapshot.values.theme === "system" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);
      void write({ field: "theme", value: dark ? "light" : "dark" });
    },
  }));
  const scale =
    intent?.change.field === "font_scale" ? intent.change.value : snapshot?.values.font_scale;
  const scales = [
    ...new Set([0.75, 1, 1.1, 1.25, 1.5, 2, ...(typeof scale === "number" ? [scale] : [])]),
  ].sort((a, b) => a - b);
  return (
    <Card ref={card}>
      <CardHeader>
        <CardTitle>
          <h2>{t(($) => $.appearance.title)}</h2>
        </CardTitle>
        <CardDescription>{t(($) => $.appearance.description)}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!snapshot && !readError ? (
          <Skeleton className="h-14 w-full" />
        ) : (
          snapshot && (
            <>
              <Item className="p-0">
                <ItemContent className="min-w-[min(100%,18rem)]">
                  <ItemTitle>{t(($) => $.appearance.theme)}</ItemTitle>
                  <ItemDescription>{t(($) => $.appearance.themeHint)}</ItemDescription>
                </ItemContent>
                <ItemActions className="max-w-full">
                  <ToggleGroup
                    variant="segmented"
                    className="max-w-full flex-wrap"
                    size="segmented"
                    spacing={0.5}
                    selectionMode="single"
                    disallowEmptySelection
                    aria-label={t(($) => $.appearance.theme)}
                    selectedKeys={
                      new Set([
                        intent?.change.field === "theme"
                          ? intent.change.value
                          : snapshot.values.theme,
                      ])
                    }
                    isDisabled={disabled || !snapshot.writable.theme}
                    onSelectionChange={(keys) => {
                      const key = [...keys][0];
                      if (key === "system" || key === "light" || key === "dark")
                        void write({ field: "theme", value: key });
                    }}
                  >
                    <ToggleGroupItem id="system">{t(($) => $.appearance.system)}</ToggleGroupItem>
                    <ToggleGroupItem id="light">{t(($) => $.appearance.light)}</ToggleGroupItem>
                    <ToggleGroupItem id="dark">{t(($) => $.appearance.dark)}</ToggleGroupItem>
                  </ToggleGroup>
                </ItemActions>
              </Item>
              {(
                [
                  { field: "language", label: "language" },
                  { field: "timezone_name", label: "timezone" },
                  { field: "week_start", label: "weekStart" },
                ] as const
              ).map(({ field, label }) => (
                <div key={field} className="flex flex-col gap-3">
                  <Separator />
                  <Item className="p-0">
                    <ItemContent className="min-w-[min(100%,18rem)]">
                      <ItemTitle>
                        <label htmlFor={`appearance-${field}`}>
                          {t(($) => $.appearance[label])}
                        </label>
                      </ItemTitle>
                      <ItemDescription id={`appearance-${field}-hint`}>
                        {t(($) => $.appearance[`${label}Hint`])}
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions className="max-w-full">
                      <NativeSelect
                        id={`appearance-${field}`}
                        className="w-44 max-w-full"
                        aria-describedby={`appearance-${field}-hint`}
                        disabled={disabled || !snapshot.writable[field]}
                        value={
                          field === "timezone_name"
                            ? snapshot.values.timezone_mode === "auto"
                              ? "auto"
                              : (snapshot.values.timezone_name ?? "auto")
                            : snapshot.values[field]
                        }
                        onChange={(event) => {
                          const value = event.target.value;
                          if (field === "language") void write({ field, value });
                          else if (field === "timezone_name")
                            void write({ field, value: value === "auto" ? null : value });
                          else if (value === "monday" || value === "sunday")
                            void write({ field, value });
                        }}
                      >
                        {field === "language" ? (
                          <>
                            <NativeSelectOption value="auto">
                              {t(($) => $.appearance.automatic)}
                            </NativeSelectOption>
                            {!["auto", "tr", "en"].includes(snapshot.values.language) && (
                              <NativeSelectOption value={snapshot.values.language}>
                                {snapshot.values.language}
                              </NativeSelectOption>
                            )}
                            <NativeSelectOption value="tr">
                              {t(($) => $.appearance.turkish)}
                            </NativeSelectOption>
                            <NativeSelectOption value="en">
                              {t(($) => $.appearance.english)}
                            </NativeSelectOption>
                          </>
                        ) : field === "timezone_name" ? (
                          <>
                            <NativeSelectOption value="auto">
                              {t(($) => $.appearance.automatic)}
                            </NativeSelectOption>
                            {[
                              ...new Set([
                                ...(snapshot.values.timezone_name
                                  ? [snapshot.values.timezone_name]
                                  : []),
                                "UTC",
                                ...Intl.supportedValuesOf("timeZone"),
                              ]),
                            ]
                              .sort()
                              .map((zone) => (
                                <NativeSelectOption key={zone} value={zone}>
                                  {zone}
                                </NativeSelectOption>
                              ))}
                          </>
                        ) : (
                          <>
                            <NativeSelectOption value="monday">
                              {t(($) => $.appearance.monday)}
                            </NativeSelectOption>
                            <NativeSelectOption value="sunday">
                              {t(($) => $.appearance.sunday)}
                            </NativeSelectOption>
                          </>
                        )}
                      </NativeSelect>
                    </ItemActions>
                  </Item>
                </div>
              ))}
              <Separator />
              <Item className="p-0">
                <ItemContent className="min-w-[min(100%,18rem)]">
                  <ItemTitle>
                    <label htmlFor="appearance-scale">{t(($) => $.appearance.scale)}</label>
                  </ItemTitle>
                  <ItemDescription id="appearance-scale-hint">
                    {t(($) => $.appearance.scaleHint)}
                  </ItemDescription>
                </ItemContent>
                <ItemActions className="max-w-full">
                  <NativeSelect
                    id="appearance-scale"
                    className="w-44 max-w-full"
                    aria-describedby="appearance-scale-hint"
                    disabled={disabled || !snapshot.writable.font_scale}
                    value={scale === null ? "system" : String(scale)}
                    onChange={(event) => {
                      const value =
                        event.target.value === "system" ? null : Number(event.target.value);
                      if (value === null || (Number.isFinite(value) && value >= 0.75 && value <= 2))
                        void write({ field: "font_scale", value });
                    }}
                  >
                    <NativeSelectOption value="system">
                      {t(($) => $.appearance.deviceScale)}
                    </NativeSelectOption>
                    {scales.map((value) => (
                      <NativeSelectOption key={value} value={value}>
                        {new Intl.NumberFormat("tr", {
                          style: "percent",
                          maximumFractionDigits: 2,
                        }).format(value)}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </ItemActions>
              </Item>
              <Separator />
              <Item className="p-0">
                <ItemContent className="min-w-[min(100%,18rem)]">
                  <ItemTitle>
                    <label htmlFor="appearance-contrast">{t(($) => $.appearance.contrast)}</label>
                  </ItemTitle>
                  <ItemDescription id="appearance-contrast-hint">
                    {t(($) => $.appearance.contrastHint)}
                  </ItemDescription>
                </ItemContent>
                <ItemActions className="max-w-full">
                  <NativeSelect
                    id="appearance-contrast"
                    className="w-44 max-w-full"
                    aria-describedby="appearance-contrast-hint"
                    disabled={disabled || !snapshot.writable.contrast}
                    value={snapshot.values.contrast}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (value === "system" || value === "high")
                        void write({ field: "contrast", value });
                    }}
                  >
                    <NativeSelectOption value="system">
                      {t(($) => $.appearance.standardContrast)}
                    </NativeSelectOption>
                    <NativeSelectOption value="high">
                      {t(($) => $.appearance.highContrast)}
                    </NativeSelectOption>
                  </NativeSelect>
                </ItemActions>
              </Item>
            </>
          )
        )}
        {snapshot && (!snapshot.writable.theme || !snapshot.writable.font_scale) && (
          <p>{t(($) => $.appearance.readonly)}</p>
        )}
        {notice === "saved" && (
          <Alert role="status">
            <AlertDescription>{t(($) => $.appearance.saved)}</AlertDescription>
          </Alert>
        )}
        {notice === "unknown" && (
          <Alert variant="destructive">
            <AlertDescription>
              {t(($) => $.appearance.unknown)}{" "}
              <Button
                variant="outline"
                size="sm"
                data-recovery
                isDisabled={busy || !snapshot || !intent || !snapshot.writable[intent.change.field]}
                onPress={() => {
                  void write();
                }}
              >
                {t(($) => $.appearance.retryWrite)}
              </Button>{" "}
              <Button
                variant="outline"
                size="sm"
                data-recovery
                isDisabled={busy}
                onPress={() => {
                  void reload(true);
                }}
              >
                {t(($) => $.appearance.reload)}
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {notice === "conflict" && (
          <Alert variant="destructive">
            <AlertDescription>
              {t(($) => $.appearance.conflict)}{" "}
              <Button
                variant="outline"
                size="sm"
                data-recovery
                isDisabled={busy}
                onPress={() => {
                  void reload(true);
                }}
              >
                {t(($) => $.appearance.reload)}
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {(readError || readFailed) && (
          <Alert variant="destructive">
            <AlertDescription>
              {notice === "saved-unread"
                ? t(($) => $.appearance.savedReadError)
                : t(($) => $.appearance.readError)}{" "}
              <Button
                variant="outline"
                size="sm"
                data-recovery
                isDisabled={busy}
                onPress={() => {
                  void reload(false);
                }}
              >
                {t(($) => $.auth.retry)}
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
