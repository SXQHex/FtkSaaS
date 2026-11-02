"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@ftksaas/ui/components/button";
import {
  getRooms,
  getAvailability,
  getSetupDisciplines,
  getCenterDiscipline,
  readableCenterDiscipline,
  setupCall,
  setupError,
  type SetupScope,
} from "../../lib/studio-setup";
import { setupPolicyKeys } from "../../lib/setup-policy";
import { errorKey } from "./setup-command";

type Checks = {
  rooms: boolean;
  discipline: boolean;
  instructor: boolean;
  roomHours: boolean;
  instructorHours: boolean;
  policies: boolean;
};
export function SetupChecklist({ scope, timezone }: { scope: SetupScope; timezone: string }) {
  const t = useTranslations("setup");
  const [checks, setChecks] = useState<Checks | null>(null),
    [error, setError] = useState(""),
    [request, setRequest] = useState(0);
  useEffect(() => {
    if (!request) return;
    let active = true;
    async function load() {
      const [rooms, policies, disciplines] = await Promise.all([
        getRooms(scope.orgId, scope.centerId!),
        setupCall("policies_get_v1", { org_id: scope.orgId, keys: [...setupPolicyKeys] }),
        getSetupDisciplines(scope.orgId),
      ]);
      const roles = [];
      let cursor: string | null | undefined;
      do {
        const result = await setupCall("roles_list_v1", {
          org_id: scope.orgId,
          center_id: scope.centerId,
          page: { limit: 50, sort: "created_at_asc", ...(cursor ? { cursor } : {}) },
        });
        roles.push(...result.items);
        cursor = result.next_cursor;
      } while (cursor);
      const activeDisciplines = disciplines.filter((row) => row.state === "active");
      const relation =
        activeDisciplines.length === 1
          ? await getCenterDiscipline(scope.orgId, scope.centerId!, activeDisciplines[0].id)
          : null;
      const activeRooms = rooms.filter((room) => room.state === "active" && room.entity);
      const instructors = roles.filter(
        (role) =>
          role.state === "active" &&
          role.role === "instructor" &&
          role.scope_center_id === scope.centerId,
      );
      const [roomRules, instructorRules] = await Promise.all([
        activeRooms.length === 1
          ? getAvailability(scope.orgId, scope.centerId!, {
              kind: "room",
              id: activeRooms[0].entity!.id,
            })
          : Promise.resolve([]),
        instructors.length === 1
          ? getAvailability(scope.orgId, scope.centerId!, {
              kind: "person",
              id: instructors[0].person_id,
            })
          : Promise.resolve([]),
      ]);
      // Future/expired rules are not evidence of currently configured hours.
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      const currentHours = (rows: typeof roomRules) =>
        rows.some((row) => {
          const rule =
            row.current?.operation === "availability_save_v1" ? row.current.values.rule : undefined;
          return (
            rule &&
            rule.weekdays.length > 0 &&
            rule.valid_from <= today &&
            (!rule.valid_until || rule.valid_until > today)
          );
        });
      if (active)
        setChecks({
          rooms:
            activeRooms.length === 1 &&
            activeRooms[0].current?.operation === "room_save_v1" &&
            typeof activeRooms[0].current.values.capacity === "number" &&
            activeRooms[0].current.values.capacity > 0,
          discipline:
            activeDisciplines.length === 1 &&
            readableCenterDiscipline(relation, activeDisciplines[0].id) &&
            relation?.exists === true &&
            relation.state === "active",
          instructor: instructors.length === 1,
          roomHours: currentHours(roomRules),
          instructorHours: currentHours(instructorRules),
          policies: setupPolicyKeys.every((key) => policies.some((policy) => policy.key === key)),
        });
    }
    void load().catch((cause) => {
      if (active) {
        setChecks(null);
        setError(errorKey(setupError(cause)));
      }
    });
    return () => {
      active = false;
    };
  }, [request, scope.orgId, scope.centerId, timezone]);
  return (
    <section className="space-y-4 rounded-lg border p-4" aria-label={t("checklistTitle")}>
      <h3 className="text-lg font-semibold">{t("checklistTitle")}</h3>
      <p className="text-sm text-muted-foreground">{t("checklistHint")}</p>
      <Button
        variant="outline"
        onClick={() => {
          setChecks(null);
          setError("");
          setRequest((n) => n + 1);
        }}
      >
        {t("checkSetup")}
      </Button>
      {request > 0 && !checks && !error && <output aria-live="polite">{t("loading")}</output>}
      {error && <p role="alert">{t(error)}</p>}
      {checks && (
        <ul className="divide-y text-sm">
          {Object.entries(checks).map(([key, value]) => (
            <li key={key} className="flex flex-wrap justify-between gap-3 py-3">
              <span>{t(`checklist.${key}`)}</span>
              <span>{t(value ? "verified" : "needsSetup")}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm">
        {t(checks && Object.values(checks).every(Boolean) ? "setupVerified" : "setupIncomplete")}
      </p>
    </section>
  );
}
