"use client";
import { useId } from "react";
import { useTranslations } from "next-intl";
import type {
  CenterView,
  DisciplineView,
  OrganizationView,
  ManagementStateView,
} from "@ftksaas/api-contracts";
import { v7 } from "uuid";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import { SetupFeedback, useSetupCommand } from "./setup-command";
import type { SetupScope } from "../../lib/studio-setup";

type SourceTarget =
  | { kind: "organization"; organization: OrganizationView }
  | { kind: "center"; center?: CenterView };
export function SourceForm({
  scope,
  target,
  onSaved,
}: {
  scope: SetupScope;
  target: SourceTarget;
  onSaved: () => void;
}) {
  const t = useTranslations("setup");
  const formId = useId();
  const command = useSetupCommand(
    scope,
    target.kind === "organization"
      ? "organization"
      : target.center
        ? `center:${target.center.id}`
        : "new-center",
    onSaved,
  );
  const current = target.kind === "organization" ? target.organization : target.center;
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const base = {
          org_id: scope.orgId,
          operation_key: v7(),
          name: String(data.get("name")).trim(),
        };
        if (target.kind === "organization")
          void command.run({
            operation: "organization_update_v1",
            input: { ...base, expected_version: target.organization.version },
          });
        else if (target.center)
          void command.run({
            operation: "center_update_v1",
            input: {
              ...base,
              center_id: target.center.id,
              expected_version: target.center.version,
              timezone: String(data.get("timezone")).trim(),
            },
          });
        else
          void command.run({
            operation: "center_create_v1",
            input: { ...base, timezone: String(data.get("timezone")).trim() },
          });
      }}
    >
      <fieldset disabled={command.busy || !!command.pending} className="space-y-4">
        <Label htmlFor={`source-${formId}`}>
          {t(target.kind === "organization" ? "organizationName" : "centerName")}
        </Label>
        <Input id={`source-${formId}`} name="name" defaultValue={current?.name ?? ""} required />
        {target.kind === "center" && (
          <div className="space-y-2">
            <Label htmlFor={`timezone-${formId}`}>{t("timezone")}</Label>
            <Input
              id={`timezone-${formId}`}
              name="timezone"
              defaultValue={target.center?.timezone ?? ""}
              placeholder="Europe/Istanbul"
              required
            />
            <p className="text-xs text-muted-foreground">{t("timezoneHint")}</p>
          </div>
        )}
        <Button type="submit">{t(current ? "save" : "createCenter")}</Button>
      </fieldset>
      <SetupFeedback command={command} />
    </form>
  );
}
export function DisciplineForm({
  scope,
  discipline,
  onSaved,
}: {
  scope: SetupScope;
  discipline?: DisciplineView;
  onSaved: () => void;
}) {
  const t = useTranslations("setup");
  const command = useSetupCommand(scope, `discipline:${discipline?.id ?? "new"}`, onSaved);
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        void command.run({
          operation: "discipline_save_v1",
          input: {
            org_id: scope.orgId,
            operation_key: v7(),
            name: String(data.get("name")).trim(),
            state: data.get("active") ? "active" : "inactive",
            ...(discipline
              ? { discipline_id: discipline.id, expected_version: discipline.version }
              : {}),
          },
        });
      }}
    >
      <fieldset disabled={command.busy || !!command.pending} className="space-y-4">
        <Label htmlFor={`discipline-name-${discipline?.id ?? "new"}`}>{t("disciplineName")}</Label>
        <Input
          id={`discipline-name-${discipline?.id ?? "new"}`}
          name="name"
          defaultValue={discipline?.name ?? ""}
          required
        />
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            name="active"
            defaultChecked={discipline ? discipline.state === "active" : true}
          />
          {t("activeDiscipline")}
        </label>
        <Button>{t(discipline ? "save" : "createDiscipline")}</Button>
      </fieldset>
      <SetupFeedback command={command} />
    </form>
  );
}
export function RoomCreate({
  scope,
  onSaved,
  room,
}: {
  scope: SetupScope;
  onSaved: () => void;
  room?: ManagementStateView;
}) {
  const t = useTranslations("setup");
  const formId = useId();
  const id = room?.entity?.id;
  const values = room?.current?.operation === "room_save_v1" ? room.current.values : null;
  const version = room?.versions.find(
    (entry) => entry.entity.type === "rooms" && entry.entity.id === id,
  )?.version;
  const command = useSetupCommand(scope, `room:${id ?? "new"}`, onSaved);
  if (
    room &&
    (!id || !version || !values || values.name === undefined || values.capacity === undefined)
  )
    return <p role="alert">{t("unreadableRoom")}</p>;
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        void command.run({
          operation: "room_save_v1",
          input: {
            org_id: scope.orgId,
            center_id: scope.centerId,
            operation_key: v7(),
            name: String(data.get("name")).trim(),
            capacity: Number(data.get("capacity")),
            ...(room ? { room_id: id, expected_version: version } : {}),
          },
        });
      }}
    >
      <fieldset disabled={command.busy || !!command.pending} className="space-y-4">
        <Label htmlFor={`room-name-${formId}`}>{t("roomName")}</Label>
        <Input id={`room-name-${formId}`} name="name" defaultValue={values?.name} required />
        <Label htmlFor={`room-capacity-${formId}`}>{t("roomCapacity")}</Label>
        <Input
          id={`room-capacity-${formId}`}
          name="capacity"
          defaultValue={values?.capacity ?? ""}
          type="number"
          min={0}
          step={1}
          required
        />
        <p className="text-sm text-muted-foreground">{t("roomCapacityHint")}</p>
        <Button>{t(room ? "save" : "createRoom")}</Button>
      </fieldset>
      <SetupFeedback command={command} />
    </form>
  );
}
export function SelfCenterAccess({ scope, onSaved }: { scope: SetupScope; onSaved: () => void }) {
  const t = useTranslations("setup");
  const command = useSetupCommand(scope, "self-center", onSaved);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("ownerVsManager")}</p>
      <Button
        type="button"
        variant="outline"
        disabled={command.busy || !!command.pending}
        onClick={() =>
          void command.run({
            operation: "manager_self_assign_center_v1",
            input: { org_id: scope.orgId, operation_key: v7(), target_center_id: scope.centerId! },
          })
        }
      >
        {t("selfAssign")}
      </Button>
      <SetupFeedback command={command} />
    </div>
  );
}
