import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { LockKeyholeIcon } from "lucide-react";
import { Button } from "@ftksaas/ui/components/button";
import { Switch } from "@ftksaas/ui/components/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ftksaas/ui/components/tabs";
import { InvitePersonIcon } from "../../components/studiom-icons";
import type { useSettingsTeam } from "./use-settings-team";

export type TeamSection = "people" | "permissions";

export function SettingsTeamView({
  team,
  section,
  onSection,
  locked,
  children,
}: {
  team: ReturnType<typeof useSettingsTeam>;
  section: TeamSection;
  onSection: (section: TeamSection) => void;
  locked: boolean;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const { table, matrix } = team;
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
          {table && (
            <span className="team-count" aria-hidden="true">
              {table.rows.length}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger id="permissions" isDisabled={locked}>
          {t(($) => $.settings.teamPermissions)}
        </TabsTrigger>
      </TabsList>
      {team.notice}
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
          <div className="team-card-content">
            <div
              className="team-table-wrap"
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
                  {table?.rows.map((row) => (
                    <tr key={row.id}>
                      {row.cells.map((cell, index) => (
                        <td key={index} className={index === 3 ? "team-table-action" : undefined}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {!table?.rows.length && (
                    <tr>
                      <td colSpan={4}>
                        {table ? t(($) => $.settings.empty) : t(($) => $.settings.unavailable)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {table?.after}
            <p className="team-note">
              <LockKeyholeIcon aria-hidden="true" />
              <span>{t(($) => $.settings.teamNative.ownershipNote)}</span>
            </p>
            {children}
          </div>
        </div>
      </TabsContent>
      <TabsContent id="permissions">
        <form
          className="team-card"
          data-tmp="perm"
          aria-labelledby="team-permissions-title"
          onSubmit={(event) => {
            event.preventDefault();
            if (!locked) team.reviewPermission();
          }}
        >
          <div className="team-card-header">
            <h2 id="team-permissions-title">{t(($) => $.settings.cards["ay-izin"].title)}</h2>
            <p>{t(($) => $.settings.cards["ay-izin"].description)}</p>
          </div>
          <div className="team-card-content">
            <div
              className="team-table-wrap"
              tabIndex={0}
              role="region"
              aria-labelledby="team-permissions-title"
            >
              <table className="team-table team-permission-table">
                <thead>
                  <tr>
                    <th scope="col">{t(($) => $.settings.columns.permission)}</th>
                    {matrix.people.map((person) => (
                      <th key={person.id} scope="col">
                        {person.name.split(" ")[0]}
                        <span className="team-column-role">
                          {t(($) => $.settings.teamNative.roles[person.role])}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.rows.map((row) => (
                    <tr key={row.id}>
                      <th scope="row">{row.label}</th>
                      {matrix.people.map((person) => {
                        const cell = row.values[person.id];
                        return (
                          <td key={person.id}>
                            {cell ? (
                              <Switch
                                aria-label={`${person.name}: ${row.label}`}
                                isSelected={cell.value}
                                isDisabled={locked || !cell.writable}
                                onChange={cell.change}
                              />
                            ) : (
                              <span aria-label={t(($) => $.settings.unknown)}>–</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="team-card-footer">
            <span role="status" className="team-status">
              {team.permissionLoading
                ? t(($) => $.settings.unread)
                : team.permissionUnavailable
                  ? t(($) => $.settings.permissionUnavailable)
                  : team.permissionDraft
                    ? t(($) => $.settings.teamNative.permissionDraft)
                    : team.permissionIncomplete
                      ? t(($) => $.settings.teamNative.permissionsIncomplete)
                      : t(($) => $.settings.teamNative.permissionsSaved)}
            </span>
            <div>
              <Button
                type="button"
                variant="outline"
                isDisabled={locked || !team.permissionDraft}
                onPress={team.discardPermission}
              >
                {t(($) => $.settings.discard)}
              </Button>
              <Button
                type="submit"
                isDisabled={
                  locked ||
                  !team.permissionDraft ||
                  team.permissionUnavailable ||
                  team.permissionLoading
                }
              >
                {t(($) => $.settings.save)}
              </Button>
            </div>
          </div>
        </form>
      </TabsContent>
    </Tabs>
  );
}
