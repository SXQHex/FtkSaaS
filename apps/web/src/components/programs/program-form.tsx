"use client";
import dynamic from "next/dynamic";
import { Button } from "@ftksaas/ui/components/button";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { v7 } from "uuid";
import type { Preview, ScheduleConfigurationRequirement } from "@ftksaas/api-contracts";
import { buildProgram, type ProgramInput } from "../../lib/program";
import { setupCall, setupError, type SetupScope } from "../../lib/studio-setup";
import { SetupFeedback, useSetupCommand, errorKey } from "../setup/setup-command";
import { ProgramFields } from "./program-fields";
import { ProgramReview } from "./program-review";
import type { ClassValues, NamedOption } from "./class-form";
const InstructorAgreements = dynamic(() =>
  import("../agreements/instructor-agreements").then((m) => m.InstructorAgreements),
);
export type ProgramCatalog = {
  rooms: NamedOption[];
  instructors: NamedOption[];
  disciplines: NamedOption[];
  duties?: import("./class-duty").DutyOption[];
};
export function ProgramForm({
  scope,
  selected,
  catalog,
  timeZone,
  onSaved,
}: {
  scope: SetupScope;
  selected: ClassValues;
  catalog: ProgramCatalog;
  timeZone: string;
  onSaved: () => void;
}) {
  const t = useTranslations("program"),
    errors = useTranslations("setup");
  const [draft, setDraft] = useState<ProgramInput>({
    starts_on: "",
    ends_on: "",
    weekdays: [],
    local_start: "",
    duration_minutes: NaN,
    total: NaN,
    room_id: "",
    person_id: "",
  });
  const [configuration, setConfiguration] = useState<ScheduleConfigurationRequirement | null>(null);
  const [needsPreview, setNeedsPreview] = useState(false);
  const [offsets, setOffsets] = useState<Record<string, number>>({});
  const [preview, setPreview] = useState<Preview | null>(null),
    [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const mounted = useRef(true);
  const previewLock = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  // Pending apply uses the existing scoped operation journal and cannot be replaced by a fresh preview.
  const command = useSetupCommand(scope, `program:${selected.id}`, () => {
    setPreview(null);
    onSaved();
  });
  const disabled = loading || command.busy || !!command.pending;
  return (
    <div className="min-w-0 space-y-5">
      <p className="text-sm text-muted-foreground">{t("timezone", { timezone: timeZone })}</p>
      {error && <p role="alert">{t.has(error) ? t(error) : errors(error)}</p>}
      {needsPreview && <output aria-live="polite">{t("refreshAfterAgreement")}</output>}
      {configuration && (
        <section className="space-y-4">
          <InstructorAgreements
            scope={scope}
            personId={configuration.person_id}
            requirement={configuration}
            timeZone={timeZone}
            onPublished={() => {
              setConfiguration(null);
              setNeedsPreview(true);
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setConfiguration(null);
              setNeedsPreview(true);
            }}
          >
            {t("back")}
          </Button>
        </section>
      )}
      {!preview && !configuration && (
        <form
          className="space-y-5"
          onSubmit={async (event) => {
            event.preventDefault();
            if (disabled || previewLock.current) return;
            try {
              const schedule = buildProgram(draft, timeZone, offsets);
              previewLock.current = true;
              setLoading(true);
              setError("");
              setNeedsPreview(false);
              const result = await setupCall("program_preview_v1", {
                org_id: scope.orgId,
                center_id: scope.centerId,
                class_id: selected.id,
                schedule,
              });
              if (mounted.current) setPreview(result);
            } catch (cause) {
              if (mounted.current)
                setError(
                  cause instanceof Error &&
                    ["invalidForm", "chooseOffsets", "nonexistentTime"].includes(cause.message)
                    ? cause.message
                    : errorKey(setupError(cause)),
                );
            } finally {
              previewLock.current = false;
              if (mounted.current) setLoading(false);
            }
          }}
        >
          <ProgramFields
            draft={draft}
            setDraft={setDraft}
            offsets={offsets}
            setOffsets={setOffsets}
            catalog={catalog}
            timeZone={timeZone}
            disabled={disabled}
            loading={loading}
          />
        </form>
      )}
      {preview && (
        <ProgramReview
          key={preview.id}
          preview={preview}
          catalog={catalog}
          timeZone={timeZone}
          disabled={disabled}
          onConfigure={() => {
            const requirement = preview.configuration_requirement;
            if (
              disabled ||
              requirement?.kind !== "instructor_agreement" ||
              preview.blockers[requirement.blocker_index]?.code !== "POLICY_NOT_CONFIGURED"
            )
              return;
            setConfiguration(requirement);
            setPreview(null);
          }}
          onBack={() => {
            setPreview(null);
            setError("");
          }}
          onApply={() =>
            void command.run({
              operation: "program_apply_v1",
              input: {
                org_id: scope.orgId,
                center_id: scope.centerId,
                operation_key: v7(),
                preview: { id: preview.id, token: preview.token },
              },
            })
          }
        />
      )}
      <SetupFeedback command={command} />
    </div>
  );
}
