import { WorkCalendarEditor } from "./work-calendar-editor";
import { PreparationManagement } from "./preparation-management";
import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { readWorkspace, workspaceRoles } from "../workspace/workspace";
import { BackendError } from "../../lib/backend";
import type { ClientScope } from "../../lib/scoped-backend";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { SettingsView, type SettingsViewData } from "./settings-view";
import { readDisciplineCatalog, type DisciplineLevel } from "./discipline-reader";
import { DisciplineEditor } from "./discipline-editor";
import { OrganizationLifecyclePanel } from "./organization-lifecycle-panel";
import { SettingsIdentityEditor } from "./settings-identity-editor";
import { SettingsPublicEditor } from "./settings-public-editor";
import {
  publicSettingsKeys,
  readSettingsDocument,
  type SettingsDocumentSource,
} from "./settings-document";
import { publicCalendarInterval, readPublicCalendar } from "../public-program/public-calendar-read";
import { SettingsPolicyEditor } from "./settings-policy-editor";
import type { PolicyView } from "../../lib/api-contracts/generated";
import { SettingsDowngradeEditor } from "./settings-downgrade-editor";
import { SettingsUpgradeEditor } from "./settings-upgrade-editor";
import type { SettingsUpgradeQuote } from "./settings-upgrade";
import { SettingsChangeCancelEditor } from "./settings-change-cancel-editor";
import { SettingsPeriodEditor } from "./settings-period-editor";
import { SettingsPaymentEditor } from "./settings-payment-editor";
import { SubscriptionRenewalEditor } from "./subscription-renewal-editor";
import type { SettingsSubscriptionSource } from "./settings-subscription";
import { useSettingsSubscription } from "./use-settings-subscription";
import { useSettingsHistory } from "./use-settings-history";
import { useSettingsRooms } from "./use-settings-rooms";
import { useSettingsPolicies } from "./use-settings-policies";
import { useSettingsDocument } from "./use-settings-document";
import { useSettingsTeam } from "./use-settings-team";
import { useSettingsNotifications } from "./use-settings-notifications";
import { readOrganizationSettingsCatalog } from "./settings-reader";
import { SettingsTaxProfile } from "./settings-tax-profile";
import { SettingsInvoiceHistory } from "./settings-invoice-history";

export function SettingsContent({
  scope,
  onLockChange,
  preservePending = false,
}: {
  scope: ClientScope;
  onLockChange: (locked: boolean) => void;
  preservePending?: boolean;
}) {
  const router = useRouter();
  const workspace = useQuery({
    queryKey: ["workspace", scope.accountId, scope.orgId],
    queryFn: () => readWorkspace(scope.accountId, scope.orgId),
    enabled: false,
    retry: false,
  });
  const current =
    (!workspace.isError || preservePending) && workspace.data?.selected?.id === scope.orgId
      ? workspace.data
      : undefined;
  const organization = current?.selected,
    center = current?.centers.find((item) => item.id === scope.centerId && item.accessible);
  const catalog = useQuery({
    queryKey: ["settings-organization-catalog", scope.accountId, scope.orgId],
    queryFn: () => readOrganizationSettingsCatalog(scope),
    enabled: Boolean(organization && center && !workspace.isError),
    retry: false,
  });
  useEffect(() => {
    const error = catalog.error;
    if (
      (error instanceof BackendError &&
        ["AUTH_REQUIRED", "SESSION_REVOKED"].includes(error.code)) ||
      (error instanceof Error && ["AUTH_REQUIRED", "ACCOUNT_CHANGED"].includes(error.message))
    )
      void router.invalidate();
  }, [catalog.error, router]);
  if (!organization || !center)
    return (
      <div className="p-6">
        <SettingsView data={{}} />
      </div>
    );
  const roles = current.roles.filter(
    (role) => role.state === "active" && role.person_id === organization.self_context?.person_id,
  );
  // Owner is stored on the organization, not necessarily as a role-assignment row.
  // Native organization field access represents Owner/OM settings scope; each domain writer still rechecks its own gates.
  const organizationCatalog =
    !catalog.isError && catalog.data?.state === "known" ? catalog.data.catalog : undefined;
  const canOrganization = Boolean(organizationCatalog);
  const canWriteOrganization =
    organizationCatalog?.fields.some((field) => field.key === "address" && field.writable) === true;
  const canCenter = roles.some(
    (role) => role.role === "center_manager" && role.scope_center_id === scope.centerId,
  );
  return (
    <SettingsManagement
      key={`${scope.accountId}:${scope.orgId}:${scope.centerId}`}
      scope={scope}
      organizationLabel={organization.name}
      centerLabel={center.name}
      timezone={center.timezone}
      canSubscription={
        organizationCatalog?.fields.some(
          (field) => field.key === "billing_name" && field.writable,
        ) === true
      }
      canOrganization={canOrganization}
      owner={workspaceRoles(current, scope.centerId).includes("owner")}
      canWriteOrganization={canWriteOrganization}
      readOnly={workspace.isError}
      organizationLoading={catalog.isPending || catalog.isFetching}
      canCenter={canCenter}
      onLockChange={onLockChange}
    />
  );
}

function SettingsManagement({
  scope,
  organizationLabel,
  centerLabel,
  timezone,
  canOrganization,
  owner,
  canSubscription,
  canWriteOrganization,
  readOnly,
  organizationLoading,
  canCenter,
  onLockChange,
}: {
  scope: ClientScope;
  organizationLabel: string;
  centerLabel: string;
  timezone: string;
  canOrganization: boolean;
  owner: boolean;
  canSubscription: boolean;
  canWriteOrganization: boolean;
  readOnly: boolean;
  organizationLoading: boolean;
  canCenter: boolean;
  onLockChange: (locked: boolean) => void;
}) {
  const [workCalendarOpen, setWorkCalendarOpen] = useState(false);
  const { t } = useTranslation(),
    router = useRouter(),
    queries = useQueryClient();
  const [level, setLevel] = useState<DisciplineLevel>(canCenter ? "center" : "organization");
  const navigate = useNavigate({ from: "/o/$orgId/c/$centerId/settings" });
  const { section = "genel" } = useSearch({ from: "/o/$orgId/c/$centerId/settings" });
  const [selection, setSelection] = useState<{ id?: string }>(),
    [locked, setLocked] = useState(false),
    [identity, setIdentity] = useState<DisciplineLevel>(),
    [renewal, setRenewal] = useState<SettingsSubscriptionSource>(),
    [payment, setPayment] = useState<{
      before: SettingsSubscriptionSource;
      quote?: SettingsUpgradeQuote;
    }>(),
    [period, setPeriod] = useState<SettingsSubscriptionSource>(),
    [changeCancel, setChangeCancel] = useState<SettingsSubscriptionSource>(),
    [upgrade, setUpgrade] = useState<SettingsSubscriptionSource>(),
    [downgrade, setDowngrade] = useState<SettingsSubscriptionSource>(),
    [policy, setPolicy] = useState<PolicyView>(),
    [publicSettings, setPublicSettings] = useState<SettingsDocumentSource>(),
    [copyFeedback, setCopyFeedback] = useState<{ href: string; success: boolean }>();
  const publishLock = useCallback(
    (value: boolean) => {
      setLocked(value);
      onLockChange(value);
    },
    [onLockChange],
  );
  const accessLost = useCallback(
    (failure: unknown) => {
      const code =
        failure instanceof BackendError
          ? failure.code
          : failure instanceof Error
            ? failure.message
            : undefined;
      if (
        !code ||
        !["AUTH_REQUIRED", "SESSION_REVOKED", "ACCOUNT_CHANGED", "FORBIDDEN"].includes(code)
      )
        return false;
      setSelection(undefined);
      setIdentity(undefined);
      setRenewal(undefined);
      setPayment(undefined);
      setPeriod(undefined);
      setChangeCancel(undefined);
      setUpgrade(undefined);
      setDowngrade(undefined);
      setPolicy(undefined);
      setPublicSettings(undefined);
      if (code === "FORBIDDEN") {
        void queries.invalidateQueries({ queryKey: ["workspace", scope.accountId, scope.orgId] });
      } else {
        queries.clear();
        void router.invalidate();
      }
      return true;
    },
    [queries, router, scope.accountId, scope.orgId],
  );
  const allowed = level === "organization" ? canOrganization : canCenter;
  const writable = !readOnly && (level === "organization" ? canWriteOrganization : canCenter);
  const document = useSettingsDocument({
    scope,
    level,
    enabled: allowed,
    readOnly,
    onLockChange: publishLock,
    onAccessLost: accessLost,
  });
  const rooms = useSettingsRooms({
    scope,
    enabled: allowed && canCenter && level === "center",
    readOnly,
    locked,
    onLockChange: publishLock,
    onAccessLost: accessLost,
  });
  const subscription = useSettingsSubscription({
    scope,
    enabled: allowed && canSubscription && level === "organization",
    timezone,
    locked,
    onAccessLost: accessLost,
  });
  const history = useSettingsHistory({
    scope,
    level,
    timezone,
    enabled: allowed,
    locked,
    onAccessLost: accessLost,
  });
  const policies = useSettingsPolicies({
    scope,
    level,
    timezone,
    enabled: allowed,
    onAccessLost: accessLost,
    writable,
    locked,
    onEdit: (value) => setPolicy(structuredClone(value)),
  });
  const team = useSettingsTeam({
    scope,
    enabled: allowed && !readOnly,
    level,
    writable,
    canManageManagers: canWriteOrganization,
    visible: section === "ekip",
    locked,
    onLockChange: publishLock,
    onAccessLost: accessLost,
  });
  const notifications = useSettingsNotifications(
    document.source,
    section === "bildirim" || section === "sablon",
    locked,
  );
  const query = useQuery({
    queryKey: [
      "settings-disciplines",
      scope.accountId,
      scope.orgId,
      scope.centerId,
      level,
      canOrganization,
    ],
    queryFn: async () => {
      if (level === "organization")
        return { items: await readDisciplineCatalog(scope, "organization"), centerItems: null };
      const [local, global] = await Promise.all([
        readDisciplineCatalog(scope, "center"),
        canOrganization ? readDisciplineCatalog(scope, "organization") : Promise.resolve(null),
      ]);
      return { items: global ?? local, centerItems: local };
    },
    enabled: allowed,
    retry: false,
  });
  useEffect(() => {
    if (
      query.error instanceof BackendError &&
      ["AUTH_REQUIRED", "SESSION_REVOKED"].includes(query.error.code)
    )
      void router.invalidate();
    else if (
      query.error instanceof Error &&
      ["AUTH_REQUIRED", "ACCOUNT_CHANGED"].includes(query.error.message)
    )
      void router.invalidate();
  }, [query.error, router]);
  const source = query.isError || query.isFetching ? undefined : query.data;
  const publicValues = document.source?.document.values;
  const organizationSource = useQuery({
    queryKey: ["settings-document", scope.accountId, scope.orgId, scope.centerId, "organization"],
    queryFn: () => readSettingsDocument(scope, "organization"),
    enabled: section === "yayin" && level === "center" && canOrganization && !readOnly,
    retry: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });
  const legacyCenter = useQuery({
    queryKey: ["settings-public-legacy-center", scope.orgId, scope.centerId],
    queryFn: async ({ signal }) =>
      readPublicCalendar(
        {
          slug: scope.orgId,
          centerId: scope.centerId,
          interval: await publicCalendarInterval(),
        },
        signal,
      ),
    enabled:
      section === "yayin" &&
      level === "center" &&
      !canOrganization &&
      !organizationLoading &&
      !readOnly,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const organizationDocument =
    level === "organization"
      ? document.source?.document
      : canOrganization && !organizationSource.isError && !organizationSource.isFetching
        ? organizationSource.data?.document
        : undefined;
  const managedPage =
    organizationDocument?.scope === "organization"
      ? organizationDocument.values.public_page
      : undefined;
  const publicTarget =
    document.source &&
    !readOnly &&
    (organizationDocument ||
      (!canOrganization &&
        !legacyCenter.isError &&
        !legacyCenter.isFetching &&
        legacyCenter.data?.publication_state === "available"))
      ? {
          to: "/public/$slug/calendar" as const,
          params: { slug: managedPage?.slug ?? scope.orgId },
          search: level === "center" ? { center_id: scope.centerId } : {},
        }
      : undefined;
  const publicHref =
    publicTarget && new URL(router.buildLocation(publicTarget).href, window.location.origin).href;
  const copyable = !!publicHref && managedPage?.enabled !== false;
  async function copyPublicLink(href: string) {
    setCopyFeedback(undefined);
    try {
      await navigator.clipboard.writeText(href);
      setCopyFeedback({ href, success: true });
    } catch {
      setCopyFeedback({ href, success: false });
    }
  }
  const data: SettingsViewData = {
    ...document.data,
    ...subscription.data,
    ...(section === "plan" && level === "organization" && owner && !readOnly && canOrganization
      ? {
          billingTax: (
            <SettingsTaxProfile
              scope={scope}
              locked={locked}
              onLockChange={publishLock}
              onAccessLost={accessLost}
            />
          ),
          invoiceHistory: (
            <SettingsInvoiceHistory scope={scope} locked={locked} onAccessLost={accessLost} />
          ),
        }
      : {}),
    permissions: team.matrix,
    fields: {
      ...document.data.fields,
      ...notifications.fields,
      ...(managedPage ? { "ay-py-page": { value: managedPage.enabled, writable: false } } : {}),
      ...(publicValues?.public_profile_enabled !== undefined
        ? {
            "ay-py-on": { value: publicValues.public_profile_enabled, writable: false },
          }
        : {}),
      ...(publicHref ? { "ay-py-slug": { value: publicHref, writable: false } } : {}),
      ...(publicValues?.public_application_form !== undefined
        ? {
            "ay-py-form": { value: publicValues.public_application_form !== null, writable: false },
            "ay-py-cons": {
              value:
                publicValues.public_application_form?.consents
                  .map((row) => `${row.purpose} · ${row.version}`)
                  .join("; ") ?? "",
              writable: false,
            },
          }
        : {}),
      ...policies.fields,
      "hs-f": history.filter,
      "ay-ad": { value: organizationLabel, writable: false },
      "ay-sube": { value: centerLabel, writable: false },
      "ay-tz": { value: timezone, writable: false },
    },
    brand: document.data.brand ? { ...document.data.brand, name: organizationLabel } : undefined,
    preparationManagement:
      document.source && section === "sablon"
        ? (
            [
              "program_templates",
              "event_templates",
              "collection_templates",
              "crm_templates",
              "automation_templates",
            ] as const
          ).map((family) => (
            <PreparationManagement
              key={`${scope.orgId}:${scope.centerId}:${level}:${document.source!.document.version}:${family}`}
              source={document.source!}
              family={family}
              locked={locked}
              readOnly={readOnly}
              onReview={document.reviewPreparation}
            />
          ))
        : undefined,
    tables: {
      politika: policies.table,
      ekip: team.table,
      sablon: notifications.table,
      salonlar: rooms.table && {
        ...rooms.table,
        after:
          level === "center" &&
          document.source?.catalog.fields.some((field) => field.key === "work_calendar") ? (
            <Button
              type="button"
              variant="outline"
              isDisabled={locked}
              onPress={() => setWorkCalendarOpen(true)}
            >
              {t(($) => $.workCalendar.title)}
            </Button>
          ) : undefined,
      },
      gecmis: history.table,
      ...(source
        ? {
            disciplines: {
              columns:
                level === "organization"
                  ? ["name", "organizationState", "action"]
                  : ["name", "organizationState", "centerState", "action"],
              rows: source.items.map((item) => {
                const local = source.centerItems?.find((row) => row.id === item.id)?.presentation
                  .center;
                const state = (active: boolean) => (
                  <Badge variant={active ? "secondary" : "outline"}>
                    {active ? t(($) => $.settings.on) : t(($) => $.settings.off)}
                  </Badge>
                );
                const available = writable && (level === "organization" || item.state === "active");
                return {
                  id: item.id,
                  cells: [
                    item.name,
                    state(item.state === "active"),
                    ...(level === "center"
                      ? [
                          local
                            ? state(local.state === "active")
                            : t(($) => $.settings.disciplineStatus.notInCenterList),
                        ]
                      : []),
                    <div key="action" className="flex flex-col items-start gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        isDisabled={locked || !available}
                        onPress={() => setSelection({ id: item.id })}
                      >
                        {t(($) => $.settings.disciplineStatus.edit)}
                      </Button>
                      {!available && level === "center" && (
                        <p className="text-xs text-muted-foreground">
                          {t(($) => $.settings.disciplineStatus.masterInactive)}
                        </p>
                      )}
                    </div>,
                  ],
                };
              }),
            },
          }
        : {}),
    },
  };
  async function refreshSubscription(result: SettingsSubscriptionSource) {
    queries.setQueryData(["settings-subscription", scope.accountId, scope.orgId], result);
    await queries.invalidateQueries(
      { queryKey: ["workspace", scope.accountId, scope.orgId] },
      { throwOnError: true },
    );
  }
  async function refresh() {
    // A master change also invalidates center projections that were read before it.
    // Mark every cached projection stale, then read the active scope only once.
    await queries.invalidateQueries({
      queryKey: ["settings-disciplines", scope.accountId, scope.orgId],
      refetchType: "none",
    });
    await queries.invalidateQueries({
      queryKey: ["schedule-sources", scope.accountId, scope.orgId],
      refetchType: "none",
    });
    const result = await query.refetch();
    if (result.error) throw result.error;
    await queries.invalidateQueries({
      queryKey: ["studio", scope.accountId, scope.orgId],
    });
  }
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      {workCalendarOpen && (
        <WorkCalendarEditor
          key={`${scope.accountId}:${scope.orgId}:${scope.centerId}`}
          scope={scope}
          onClose={() => {
            if (!locked) setWorkCalendarOpen(false);
          }}
          onLockChange={publishLock}
          onAccessLost={accessLost}
        />
      )}
      {((!allowed && !(level === "organization" && organizationLoading)) || query.isError) && (
        <Alert role="alert" variant="destructive">
          <AlertDescription>
            {allowed
              ? t(($) => $.settings.disciplineStatus.readError)
              : t(($) => $.settings.disciplineStatus.unavailable)}
            {allowed && (
              <Button
                type="button"
                variant="outline"
                isDisabled={query.isFetching || locked}
                onPress={() => {
                  void query.refetch();
                }}
              >
                {t(($) => $.settings.disciplineStatus.reload)}
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}
      {document.notice}
      {team.notice}
      {notifications.notice}
      {section === "yayin" && (
        <p role="status" className="text-sm text-muted-foreground">
          {copyFeedback &&
            copyFeedback.href === publicHref &&
            (copyFeedback.success
              ? t(($) => $.settings.publicLinkCopied)
              : t(($) => $.settings.publicLinkCopyFailed))}
        </p>
      )}
      <SettingsView
        section={section}
        onSection={(next) => {
          if (!locked)
            void navigate({
              search: { section: next === "genel" ? undefined : next },
              replace: true,
            });
        }}
        onPermission={team.onPermission}
        teamActionLabel={t(($) => $.settings.teamNative.addRole)}
        onField={document.onField}
        onColor={document.onColor}
        onLogo={document.onLogo}
        logoAccept={document.logoAccept}
        resetCards={document.resetCards}
        onSave={document.onSave}
        onDiscard={document.onDiscard}
        data={data}
        locked={locked}
        scope={{
          selected: level,
          organizationLabel,
          centerLabel,
          organizationAvailable: canOrganization,
          centerAvailable: canCenter,
        }}
        onScope={(next) => {
          if (!locked) {
            setSelection(undefined);
            team.reset();
            setLevel(next);
          }
        }}
        availableActions={[
          ...(publicHref ? ["preview" as const] : []),
          ...(copyable ? ["copyLink" as const] : []),
          ...(team.canCreate ? ["invite" as const] : []),
          ...(document.source?.catalog.fields.some(
            (row) =>
              publicSettingsKeys.some(
                (key) => key === row.key && (key !== "public_page" || level === "organization"),
              ) && row.writable,
          ) && !readOnly
            ? ["publicSettings" as const]
            : []),
          ...(subscription.downgradeSource && !readOnly ? ["changePlan" as const] : []),
          ...(subscription.upgradeSource && !readOnly ? ["upgradePlan" as const] : []),
          ...(subscription.cancelSource && !readOnly ? ["cancelChange" as const] : []),
          ...(subscription.periodSource && !readOnly ? ["changePeriod" as const] : []),
          ...(subscription.paymentSource && !readOnly ? ["payment" as const] : []),
          ...(subscription.renewalSource && !readOnly ? ["cancelSubscription" as const] : []),
          ...(document.resetCards.length ? ["reset" as const] : []),
          ...(rooms.canCreate ? ["room" as const] : []),
          ...(document.canRemoveLogo ? ["removeLogo" as const] : []),
          ...(writable && source && level === "organization" ? ["discipline" as const] : []),
          ...(writable
            ? [
                level === "organization"
                  ? ("renameOrganization" as const)
                  : ("renameCenter" as const),
              ]
            : []),
        ]}
        onAction={(action) => {
          if (locked) return;
          if (action.kind === "preview" && publicTarget) void router.navigate(publicTarget);
          if (action.kind === "copyLink" && publicHref && copyable) void copyPublicLink(publicHref);
          if (action.kind === "invite") team.create();
          if (action.kind === "publicSettings" && document.source)
            setPublicSettings(structuredClone(document.source));
          if (action.kind === "changePlan" && subscription.downgradeSource)
            setDowngrade(structuredClone(subscription.downgradeSource));
          if (action.kind === "upgradePlan" && subscription.upgradeSource)
            setUpgrade(structuredClone(subscription.upgradeSource));
          if (action.kind === "cancelChange" && subscription.cancelSource)
            setChangeCancel(structuredClone(subscription.cancelSource));
          if (action.kind === "changePeriod" && subscription.periodSource)
            setPeriod(structuredClone(subscription.periodSource));
          if (action.kind === "payment" && subscription.paymentSource)
            setPayment({ before: structuredClone(subscription.paymentSource) });
          if (action.kind === "cancelSubscription" && subscription.renewalSource)
            setRenewal(structuredClone(subscription.renewalSource));
          if (action.kind === "reset") document.onReset(action.card);
          if (action.kind === "room") rooms.create();
          if (action.kind === "removeLogo") document.onRemoveLogo();
          if (action.kind === "discipline" && level === "organization") setSelection({});
          if (action.kind === "renameOrganization" && level === "organization")
            setIdentity("organization");
          if (action.kind === "renameCenter" && level === "center") setIdentity("center");
        }}
      />
      {section === "plan" && level === "organization" && canOrganization && (
        <OrganizationLifecyclePanel
          scope={scope}
          organizationLabel={organizationLabel}
          locked={locked}
          onLockChange={publishLock}
          onSaved={async () => {
            await Promise.all([
              queries.invalidateQueries({ queryKey: ["workspace", scope.accountId, scope.orgId] }),
              queries.invalidateQueries({
                queryKey: ["settings-subscription", scope.accountId, scope.orgId],
              }),
            ]);
          }}
          onAccessLost={accessLost}
        />
      )}
      {team.dialog}
      {notifications.dialog}
      {publicSettings && (
        <SettingsPublicEditor
          before={publicSettings}
          onSaved={async () => {
            await queries.invalidateQueries(
              {
                queryKey: [
                  "settings-document",
                  scope.accountId,
                  scope.orgId,
                  scope.centerId,
                  level,
                ],
              },
              { throwOnError: true },
            );
            await queries.invalidateQueries({
              queryKey: ["settings-history", scope.accountId, scope.orgId],
            });
            await queries.invalidateQueries({ queryKey: ["public-calendar"], refetchType: "none" });
            await queries.invalidateQueries({
              queryKey: ["public-application-discovery"],
              refetchType: "none",
            });
            await queries.invalidateQueries({
              queryKey: ["settings-public-legacy-center", scope.orgId],
            });
          }}
          onClose={() => {
            if (!locked) setPublicSettings(undefined);
          }}
          onLockChange={publishLock}
          onAccessLost={accessLost}
        />
      )}
      {policy && (
        <SettingsPolicyEditor
          scope={scope}
          level={level}
          before={policy}
          timezone={timezone}
          disciplines={
            source?.items
              .filter((row) => row.state === "active")
              .map((row) => ({ id: row.id, name: row.name })) ?? []
          }
          onSaved={async () => {
            await queries.invalidateQueries(
              {
                queryKey: [
                  "settings-policies",
                  scope.accountId,
                  scope.orgId,
                  scope.centerId,
                  level,
                ],
              },
              { throwOnError: true },
            );
            await queries.invalidateQueries({
              queryKey: ["settings-history", scope.accountId, scope.orgId],
            });
          }}
          onClose={() => {
            if (!locked) setPolicy(undefined);
          }}
          onLockChange={publishLock}
          onAccessLost={accessLost}
        />
      )}
      {identity && (
        <SettingsIdentityEditor
          scope={scope}
          level={identity}
          onClose={() => {
            if (!locked) setIdentity(undefined);
          }}
          onSaved={async () => {
            await queries.invalidateQueries(
              { queryKey: ["workspace", scope.accountId, scope.orgId] },
              { throwOnError: true },
            );
          }}
          onLockChange={publishLock}
          onAccessLost={accessLost}
        />
      )}
      {downgrade && (
        <SettingsDowngradeEditor
          before={downgrade}
          timezone={timezone}
          onSaved={refreshSubscription}
          onClose={() => {
            if (!locked) setDowngrade(undefined);
          }}
          onLockChange={publishLock}
          onAccessLost={accessLost}
        />
      )}
      {upgrade && (
        <SettingsUpgradeEditor
          before={upgrade}
          timezone={timezone}
          onClose={() => {
            if (!locked) setUpgrade(undefined);
          }}
          onLockChange={publishLock}
          onAccessLost={accessLost}
          onSaved={refreshSubscription}
          onPay={(current, quote) => {
            if (!locked) {
              setUpgrade(undefined);
              setPayment({ before: structuredClone(current), quote: structuredClone(quote) });
            }
          }}
        />
      )}
      {changeCancel && (
        <SettingsChangeCancelEditor
          before={changeCancel}
          onClose={() => {
            if (!locked) setChangeCancel(undefined);
          }}
          onLockChange={publishLock}
          onAccessLost={accessLost}
          onSaved={refreshSubscription}
        />
      )}
      {period && (
        <SettingsPeriodEditor
          before={period}
          timezone={timezone}
          onClose={() => {
            if (!locked) setPeriod(undefined);
          }}
          onLockChange={publishLock}
          onAccessLost={accessLost}
          onSaved={refreshSubscription}
        />
      )}
      {payment && (
        <SettingsPaymentEditor
          before={payment.before}
          quote={payment.quote}
          onClose={() => {
            if (!locked) setPayment(undefined);
          }}
          onLockChange={publishLock}
          onAccessLost={accessLost}
          onSaved={refreshSubscription}
        />
      )}
      {renewal && (
        <SubscriptionRenewalEditor
          before={renewal}
          onClose={() => {
            if (!locked) setRenewal(undefined);
          }}
          onLockChange={publishLock}
          onAccessLost={accessLost}
          onSaved={refreshSubscription}
        />
      )}
      {subscription.notice}
      {history.notice}
      {rooms.notice}
      {rooms.editor}
      {policies.notice}
      {document.dialog}
      {selection && (
        <DisciplineEditor
          key={`${scope.accountId}:${scope.orgId}:${scope.centerId}:${level}:${selection.id ?? "new"}`}
          scope={scope}
          level={level}
          id={selection.id}
          scopeLabel={level === "organization" ? organizationLabel : centerLabel}
          onClose={() => {
            if (!locked) setSelection(undefined);
          }}
          onRefresh={refresh}
          onLockChange={publishLock}
          onAccessLost={accessLost}
          canWrite={writable && !query.isError && !query.isFetching}
        />
      )}
    </div>
  );
}
