import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { v7 as uuidv7 } from "uuid";
import { BackendError } from "../../lib/backend";
import { saveTheme, type ThemeSnapshot, type ThemeIntent, type ThemeChoice } from "./appearance";
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

type Notice = "ready" | "saved" | "unknown" | "conflict" | "saved-unread";
export function AppearancePanel({
  snapshot,
  readError,
  onRefresh,
}: {
  snapshot?: ThemeSnapshot;
  readError: boolean;
  onRefresh: () => Promise<ThemeSnapshot>;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [notice, setNotice] = useState<Notice>("ready");
  const [intent, setIntent] = useState<ThemeIntent>();
  const [readFailed, setReadFailed] = useState(false);
  async function reload(clearIntent: boolean) {
    if (locked.current) return;
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
  async function write(next?: ThemeChoice) {
    if (locked.current || !snapshot?.writable) return;
    if (next) {
      if (notice !== "ready" && notice !== "saved") return;
      if (next === snapshot.theme) return;
    }
    const current = next ? { theme: next, version: snapshot.version, key: uuidv7() } : intent;
    if (!current) return;
    setIntent(current);
    locked.current = true;
    setBusy(true);
    setReadFailed(false);
    let accepted = false;
    try {
      await saveTheme(current);
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
    busy || readError || readFailed || !snapshot?.writable || !["ready", "saved"].includes(notice);
  return (
    <Card>
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
            <Item className="p-0">
              <ItemContent className="min-w-[min(100%,18rem)]">
                <ItemTitle>{t(($) => $.appearance.theme)}</ItemTitle>
                <ItemDescription>{t(($) => $.appearance.themeHint)}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <ToggleGroup
                  variant="segmented"
                  size="segmented"
                  spacing={0.5}
                  selectionMode="single"
                  disallowEmptySelection
                  aria-label={t(($) => $.appearance.theme)}
                  selectedKeys={new Set([intent?.theme ?? snapshot.theme])}
                  isDisabled={disabled}
                  onSelectionChange={(keys) => {
                    const key = [...keys][0];
                    if (key === "system" || key === "light" || key === "dark") void write(key);
                  }}
                >
                  <ToggleGroupItem id="system">{t(($) => $.appearance.system)}</ToggleGroupItem>
                  <ToggleGroupItem id="light">{t(($) => $.appearance.light)}</ToggleGroupItem>
                  <ToggleGroupItem id="dark">{t(($) => $.appearance.dark)}</ToggleGroupItem>
                </ToggleGroup>
              </ItemActions>
            </Item>
          )
        )}
        {snapshot && !snapshot.writable && <p>{t(($) => $.appearance.readonly)}</p>}
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
                isDisabled={busy || !snapshot?.writable}
                onPress={() => {
                  void write();
                }}
              >
                {t(($) => $.appearance.retryWrite)}
              </Button>{" "}
              <Button
                variant="outline"
                size="sm"
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
