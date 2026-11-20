import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@ftksaas/ui/components/card";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@ftksaas/ui/components/dialog";
import { Button } from "@ftksaas/ui/components/button";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { StateView, type StateKind } from "./state-view";
export function StateGalleryView({
  actions,
  feedback,
  conflict,
  onCloseConflict,
  onReload,
  motionPaused,
  onMotionPaused,
}: {
  actions: Partial<Record<StateKind, ReactNode>>;
  feedback: Partial<Record<StateKind, string>>;
  conflict: boolean;
  onCloseConflict: () => void;
  onReload: () => void;
  motionPaused: boolean;
  onMotionPaused: (value: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="@container flex min-w-0 flex-col gap-5 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t(($) => $.states.galleryTitle)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(($) => $.states.galleryDescription)}
        </p>
      </header>
      <Alert role="note">
        <AlertDescription>{t(($) => $.states.exampleOnly)}</AlertDescription>
      </Alert>
      <div className="grid min-w-0 grid-cols-1 gap-4 @3xl:grid-cols-2 @6xl:grid-cols-3">
        {stateKinds.map((kind) => (
          <Card key={kind} className="min-w-0" data-state-example={kind}>
            <CardHeader>
              <CardTitle>
                <h2>{t(($) => $.states.catalog[kind].title)}</h2>
              </CardTitle>
              <CardDescription>{t(($) => $.states.catalog[kind].description)}</CardDescription>
            </CardHeader>
            <CardContent className="min-w-0">
              <StateView
                motionPaused={motionPaused}
                kind={kind}
                headingLevel={3}
                actions={actions[kind]}
                traceId={kind === "error" ? "00000000-0000-7000-8000-000000000001" : undefined}
              />
            </CardContent>
            {kind === "loading" && (
              <CardFooter>
                <Button variant="outline" size="sm" onPress={() => onMotionPaused(!motionPaused)}>
                  {motionPaused ? t(($) => $.states.resumeMotion) : t(($) => $.states.pauseMotion)}
                </Button>
              </CardFooter>
            )}
            {feedback[kind] && (
              <CardFooter>
                <p role="status" className="text-sm wrap-anywhere">
                  {feedback[kind]}
                </p>
              </CardFooter>
            )}
          </Card>
        ))}
      </div>
      <Dialog
        showCloseButton={false}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
        isOpen={conflict}
        onOpenChange={(open) => {
          if (!open) onCloseConflict();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t(($) => $.states.content.conflict.title)}</DialogTitle>
          <DialogDescription>{t(($) => $.states.conflictHelp)}</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">{t(($) => $.states.previous)}</dt>
            <dd>{t(($) => $.states.previousExample)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t(($) => $.states.current)}</dt>
            <dd>{t(($) => $.states.currentExample)}</dd>
          </div>
        </dl>
        <DialogFooter>
          <Button variant="outline" onPress={onCloseConflict}>
            {t(($) => $.states.cancel)}
          </Button>
          <Button onPress={onReload}>{t(($) => $.states.reload)}</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

import { stateKinds } from "./state-kinds";
