import { useEffect, useRef, useState } from "react";
import { XIcon } from "lucide-react";
import { useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { DeletionConfirmation } from "./deletion-confirmation";
import { readDeletionPreview } from "./deletion-preview";
import { BackendError } from "../../lib/backend";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../../components/ui/card";
import {
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "../../components/ui/sheet";
import { Button } from "../../components/ui/button";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Skeleton } from "../../components/ui/skeleton";
import { Item, ItemGroup, ItemContent, ItemTitle, ItemActions } from "../../components/ui/item";
import { Badge } from "../../components/ui/badge";

const impactKeys = [
  "active_account_links",
  "open_sessions",
  "open_requests",
  "active_reservations",
  "active_event_registrations",
  "open_debts",
  "student_credit_accounts",
] as const;
export function DeletionPreviewPanel({ accountId }: { accountId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const confirm = useRef<(() => Promise<void>) | undefined>(undefined);
  const [applying, setApplying] = useState(false);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<Awaited<ReturnType<typeof readDeletionPreview>>>();
  const revision = useRef(0);
  const busy = useRef(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  const retryButton = useRef<HTMLButtonElement>(null);
  const impact = view?.impact;
  useEffect(() => {
    if (open && !pending) (failed ? retryButton : closeButton).current?.focus();
  }, [open, pending, failed]);
  function close() {
    if (applying) return;
    confirm.current = undefined;
    revision.current++;
    busy.current = false;
    setOpen(false);
    setPending(false);
    setView(undefined);
    setFailed(false);
  }
  async function load() {
    if (busy.current) return;
    const current = ++revision.current;
    busy.current = true;
    setPending(true);
    setFailed(false);
    setView(undefined);
    confirm.current = undefined;
    try {
      const result = await readDeletionPreview(accountId, (action) => {
        if (current === revision.current) confirm.current = action;
      });
      if (current === revision.current) setView(result);
    } catch (error) {
      if (current !== revision.current) return;
      if (
        (error instanceof BackendError &&
          ["AUTH_REQUIRED", "SESSION_REVOKED"].includes(error.code)) ||
        (error instanceof Error && ["AUTH_REQUIRED", "ACCOUNT_CHANGED"].includes(error.message))
      ) {
        close();
        await router.invalidate();
      } else setFailed(true);
    } finally {
      if (current === revision.current) {
        busy.current = false;
        setPending(false);
      }
    }
  }
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{t(($) => $.accountDeletion.title)}</h2>
          </CardTitle>
          <CardDescription>{t(($) => $.accountDeletion.description)}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            size="sm"
            onPress={() => {
              setOpen(true);
              void load();
            }}
          >
            {t(($) => $.accountDeletion.openPreview)}
          </Button>
        </CardContent>
      </Card>
      <Sheet
        isOpen={open}
        isDismissable={!applying}
        isKeyboardDismissDisabled={applying}
        onOpenChange={(value) => {
          if (!value) close();
        }}
        showCloseButton={false}
      >
        <SheetHeader className="flex-row items-start justify-between gap-3">
          <div>
            <SheetTitle>{t(($) => $.accountDeletion.previewTitle)}</SheetTitle>
            <SheetDescription>{t(($) => $.accountDeletion.previewDescription)}</SheetDescription>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            isDisabled={applying}
            aria-label={t(($) => $.accountDeletion.closePreview)}
            onPress={close}
          >
            <XIcon />
          </Button>
        </SheetHeader>
        <div
          role="region"
          aria-label={t(($) => $.accountDeletion.effectsRegion)}
          tabIndex={0}
          className="min-h-0 flex-1 overflow-y-auto px-5 py-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground focus-visible:-outline-offset-2"
        >
          {pending && (
            <div role="status">
              <p>{t(($) => $.accountDeletion.loading)}</p>
              <Skeleton className="mt-2 h-24 w-full" />
            </div>
          )}
          {failed && (
            <Alert variant="destructive">
              <AlertDescription>{t(($) => $.accountDeletion.failed)}</AlertDescription>
            </Alert>
          )}
          {view && (
            <div className="flex flex-col gap-4">
              {view.blockers.length > 0 ? (
                <Alert variant="destructive">
                  <AlertDescription>
                    <ul>
                      {view.blockers.map((code, index) => (
                        <li key={index}>
                          {code === "OWNER_TRANSFER_REQUIRED"
                            ? t(($) => $.accountDeletion.ownerBlock)
                            : t(($) => $.accountDeletion.blocked)}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              ) : (
                <p role="status">{t(($) => $.accountDeletion.noBlockers)}</p>
              )}
              {view.effects.length > 0 && (
                <ItemGroup>
                  {view.effects.map((effect, index) => (
                    <Item key={index} role="listitem" size="xs">
                      <ItemContent>
                        <ItemTitle>
                          {effect.entityType === "accounts"
                            ? t(($) => $.accountDeletion.accountEffect)
                            : t(($) => $.accountDeletion.otherEffect)}{" "}
                          · {t(($) => $.accountDeletion.actions[effect.action])}
                        </ItemTitle>
                      </ItemContent>
                      {typeof effect.quantity === "number" && (
                        <ItemActions>
                          <Badge variant="secondary">{effect.quantity}</Badge>
                        </ItemActions>
                      )}
                    </Item>
                  ))}
                </ItemGroup>
              )}
              {impact && (
                <ItemGroup>
                  {impactKeys.map((key) => (
                    <Item key={key} role="listitem" size="xs">
                      <ItemContent>
                        <ItemTitle>{t(($) => $.accountDeletion.impact[key])}</ItemTitle>
                      </ItemContent>
                      <ItemActions>
                        <Badge variant="secondary">{impact[key]}</Badge>
                      </ItemActions>
                    </Item>
                  ))}
                </ItemGroup>
              )}
              {view.blockers.length === 0 && (
                <DeletionConfirmation
                  confirm={() => {
                    if (!confirm.current) return Promise.reject(new Error("PREVIEW_REQUIRED"));
                    return confirm.current();
                  }}
                  onPending={setApplying}
                />
              )}
              <p className="text-muted-foreground">{t(($) => $.accountDeletion.physicalErasure)}</p>
              <p className="text-muted-foreground">
                {t(($) => $.accountDeletion.expires, {
                  value: new Intl.DateTimeFormat("tr-TR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(new Date(view.expiresAt)),
                })}
              </p>
            </div>
          )}
          <p>{t(($) => $.accountDeletion.readOnly)}</p>
        </div>
        <SheetFooter>
          {failed && (
            <Button ref={retryButton} variant="outline" onPress={() => void load()}>
              {t(($) => $.auth.retry)}
            </Button>
          )}
          <Button isDisabled={applying} ref={closeButton} variant="outline" onPress={close}>
            {t(($) => $.accountDeletion.close)}
          </Button>
        </SheetFooter>
      </Sheet>
    </>
  );
}
