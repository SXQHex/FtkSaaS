import { useTranslation } from "react-i18next";
import { CheckIcon, LockIcon } from "lucide-react";
import { Button } from "@ftksaas/ui/components/button";
import { Switch } from "@ftksaas/ui/components/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ftksaas/ui/components/tabs";
import { InvitePersonIcon } from "../../components/studiom-icons";
import type { useSettingsTeam } from "./use-settings-team";
import { teamPermissions } from "./settings-team";
import { useTeamPermissionLabels } from "./team-permission-labels";

export type TeamSection = "people" | "permissions";

export function SettingsTeamView({
  team,
  section,
  onSection,
  locked,
}: {
  team: ReturnType<typeof useSettingsTeam>;
  section: TeamSection;
  onSection: (section: TeamSection) => void;
  locked: boolean;
}) {
  const { t } = useTranslation();
  const matrix = team.permissions;
  const permissionLabels = useTeamPermissionLabels();
  return (
    <Tabs
      data-spanel="ekip"
      className="team-stack"
      selectedKey={section}
      keyboardActivation="manual"
      onSelectionChange={(key) => {
        if (!locked && (key === "people" || key === "permissions")) onSection(key);
      }}
    >
      <TabsList className="team-tabs" aria-label={t(($) => $.settings.teamSections)}>
        <TabsTrigger id="people" isDisabled={locked}>
          {t(($) => $.settings.teamPeople)}
          {team.table && (
            <span className="team-count" aria-hidden="true">
              {team.table.length}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger id="permissions" isDisabled={locked}>
          {t(($) => $.settings.teamPermissions)}
        </TabsTrigger>
      </TabsList>
      {team.notice && (
        <p className="team-toast" role="status">
          {team.notice}
        </p>
      )}
      <TabsContent id="people">
        <div className="team-card" data-tmp="people">
          <div className="team-card-header team-people-header">
            <div>
              <h2>{t(($) => $.settings.cards["ekip-0"].title)}</h2>
              <p>{t(($) => $.settings.cards["ekip-0"].description)}</p>
            </div>
            <Button isDisabled={locked || !team.canCreate} onPress={team.create}>
              <InvitePersonIcon data-icon="inline-start" />
              {t(($) => $.settings.invite)}
            </Button>
          </div>
          <div
            className="team-card-content team-table-wrap"
            tabIndex={0}
            role="region"
            aria-label={t(($) => $.settings.cards["ekip-0"].title)}
          >
            <table className="team-table">
              <thead>
                <tr>
                  {(["person", "roles", "state", "action"] as const).map((key) => (
                    <th
                      key={key}
                      scope="col"
                      className={key === "action" ? "team-table-action" : undefined}
                    >
                      {t(($) => $.settings.columns[key])}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {team.table?.map((row) => (
                  <tr key={row.id}>
                    {row.cells.map((cell, index) => (
                      <td key={index} className={index === 3 ? "team-table-action" : undefined}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
                {!team.table?.length && (
                  <tr>
                    <td colSpan={4}>
                      {t(($) =>
                        team.pending
                          ? $.settings.unread
                          : team.failed
                            ? $.settings.unavailable
                            : $.settings.empty,
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <p className="team-note">
              <LockIcon aria-hidden="true" />
              <span>{t(($) => $.settings.teamNative.ownershipNote)}</span>
            </p>
          </div>
        </div>
      </TabsContent>
      <TabsContent id="permissions">
        <form
          className="team-card"
          data-tmp="perm"
          aria-labelledby="team-permissions-title"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            matrix.save();
          }}
        >
          <div className="team-card-header">
            <h2 id="team-permissions-title">{t(($) => $.settings.cards["ay-izin"].title)}</h2>
            <p>{t(($) => $.settings.cards["ay-izin"].description)}</p>
          </div>
          <div
            className="team-card-content team-table-wrap team-matrix-content"
            tabIndex={0}
            role="region"
            aria-labelledby="team-permissions-title"
            aria-busy={matrix.pending}
          >
            <table className="team-table team-permission-table">
              <thead>
                <tr>
                  <th scope="col">{t(($) => $.settings.columns.permission)}</th>
                  {matrix.people.map(({ id, name, manager, staff, owner }) => (
                    <th key={id} scope="col">
                      {name?.split(" ")[0] ?? t(($) => $.settings.unknown)}
                      <span className="team-column-role">
                        {manager
                          ? t(($) =>
                              owner
                                ? $.settings.teamEditor.ownerManagerShort
                                : $.settings.teamEditor.managerShort,
                            )
                          : staff
                            ? t(($) => $.settings.teamNative.roles.staff)
                            : t(($) => $.settings.teamEditor.ownerOnly)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teamPermissions.map((permission) => {
                  const label = permissionLabels[permission];
                  return (
                    <tr key={permission}>
                      <th scope="row">{label}</th>
                      {matrix.people.map(({ id, name, manager, canAdjust, cells }) => {
                        const cell = cells[permission];
                        // Discount is an explicit grant even for a center manager.
                        const inherited = manager && permission !== "sale.discount";
                        const granted = inherited || (cell?.enabled ?? cell?.effective ?? false);
                        return (
                          <td key={id}>
                            {canAdjust && cell?.writable ? (
                              <Switch
                                aria-label={`${name ?? t(($) => $.settings.unknown)}: ${label}`}
                                isSelected={matrix.selected(
                                  id,
                                  permission,
                                  cell.enabled ?? cell.effective,
                                )}
                                isDisabled={!matrix.editable}
                                onChange={(enabled) => matrix.change(id, permission, enabled)}
                              />
                            ) : (
                              <>
                                {granted ? (
                                  <CheckIcon aria-hidden="true" />
                                ) : (
                                  <span className="text-muted-foreground" aria-hidden="true">
                                    –
                                  </span>
                                )}
                                <span className="sr-only">
                                  {t(($) =>
                                    granted
                                      ? $.settings.on
                                      : cell
                                        ? $.settings.off
                                        : $.settings.teamNative.permissionUnavailable,
                                  )}
                                </span>
                              </>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="team-card-footer">
            <span role="status" className="team-status">
              {matrix.status}
            </span>
            <div>
              <Button
                type="button"
                variant="outline"
                isDisabled={!matrix.canDiscard}
                onPress={matrix.discard}
              >
                {t(($) => $.settings.discard)}
              </Button>
              <Button type="submit" isDisabled={!matrix.canSave}>
                {t(($) => $.settings.save)}
              </Button>
            </div>
          </div>
        </form>
      </TabsContent>
    </Tabs>
  );
}
