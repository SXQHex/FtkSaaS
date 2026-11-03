"use client";
import { useTranslations } from "next-intl";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@ftksaas/ui/components/sheet";
import type { SetupScope } from "../../lib/studio-setup";
import { ClassForm, type ClassValues } from "./class-form";
import { ClassDuty } from "./class-duty";
import { ProgramForm, type ProgramCatalog } from "./program-form";
import { SingleSessionForm } from "./single-session-form";
export type ProgramEditorMode = "createClass" | "editClass" | "session" | "program" | "duties";
export function ProgramEditorPanel({
  mode,
  scope,
  selected,
  classes,
  catalog,
  timeZone,
  onSaved,
  onClose,
  onRestoreFocus,
}: {
  mode: ProgramEditorMode;
  scope: SetupScope;
  selected?: ClassValues;
  classes: ClassValues[];
  catalog: ProgramCatalog;
  timeZone: string;
  onSaved: () => void;
  onClose: () => void;
  onRestoreFocus: () => void;
}) {
  const t = useTranslations("program");
  const titles = {
    createClass: "createClass",
    editClass: "editClass",
    session: "createSession",
    program: "newProgram",
    duties: "defaultDuties",
  } as const;
  if (["editClass", "program", "duties"].includes(mode) && !selected) return null;
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        className="w-full overflow-y-auto sm:max-w-2xl"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onRestoreFocus();
        }}
      >
        <SheetHeader className="pr-12">
          <SheetTitle>{t(titles[mode])}</SheetTitle>
          <SheetDescription>
            {selected && mode !== "createClass" && mode !== "session" ? `${selected.name} · ` : ""}
            {t("editorContext", { timezone: timeZone })}
          </SheetDescription>
        </SheetHeader>
        <div className="min-w-0 px-5 pb-8">
          {(mode === "createClass" || mode === "editClass") && (
            <ClassForm
              scope={scope}
              current={mode === "editClass" ? selected : undefined}
              disciplines={catalog.disciplines}
              onSaved={onSaved}
            />
          )}
          {mode === "session" && (
            <SingleSessionForm
              scope={scope}
              catalog={catalog}
              classes={classes}
              timeZone={timeZone}
              onSaved={onSaved}
            />
          )}
          {mode === "program" && selected && (
            <ProgramForm
              scope={scope}
              selected={selected}
              catalog={catalog}
              timeZone={timeZone}
              onSaved={onSaved}
            />
          )}
          {mode === "duties" && selected && (
            <ClassDuty
              scope={scope}
              classId={selected.id}
              people={
                catalog.duties ??
                catalog.instructors.map((p) => ({ ...p, duty: "instructor" as const }))
              }
              onSaved={onSaved}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
