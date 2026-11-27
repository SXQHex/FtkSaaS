import type { Page } from "@playwright/test";
import type { StarterRetainedScope } from "@ftksaas/api-contracts";
import {
  mockCompletion,
  nativePage,
  nativeMutation,
  metadata,
  uid,
  at,
  completionUrl,
  type NativeRequest,
  type RecordedRequest,
} from "./pro-completion-fixture.js";
import { studioIds as I } from "./studio-fixture.js";
export async function mockSettingsCompletion(
  page: Page,
  options: {
    permissionUnknown?: boolean;
    permissionStaleReadback?: boolean;
    roleDetailReadbackFailure?: boolean;
    roleAssignmentTransportFailure?: boolean;
    invitationReadbackFailure?: boolean;
    teamRoleResponseFailure?: boolean;
    staffRemoval?: "handover-stale" | "handover-unavailable" | "empty" | "forbidden";
    onStaffRemovalDirectoryRead?: () => Promise<void>;
    billingOwner?: boolean;
    ownerWithoutCenterManagement?: boolean;
    businessDowngrade?: boolean;
    bootstrapBilling?: "owner" | "member";
    startUrl?: string | null;
  } = {},
) {
  const writes: RecordedRequest[] = [];
  const state = {
    version: { organization: 1, center: 1 },
    inherited: {} as Record<string, { kind: string; organization_version: number }>,
    values: {
      organization: {
        address: "Sentetik adres",
        billing_name: "Sentetik kuruluş",
        billing_address: "Sentetik fatura adresi",
        billing_email: "billing@example.invalid",
        program_duration_minutes: 45,
        program_templates: [],
        event_templates: [],
        automation_templates: [
          {
            key: "org-followup",
            name: "Organizasyon takibi",
            defaults: {
              trigger: { kind: "student_inactive", offset_days: 2 },
              action: {
                kind: "create_followup",
                channel: "in_app",
                template_key: "Organizasyon takip notu",
              },
            },
          },
        ],
        collection_templates: [],
        crm_templates: [],
        public_profile_enabled: false,
        public_fields: ["name"],
        public_application_form: null,
        public_page: null,
      },
      center: {
        address: "Sentetik adres",
        program_duration_minutes: 60,
        program_templates: [],
        event_templates: [],
        automation_templates: [],
        collection_templates: [
          {
            key: "cash",
            name: "Yerel nakit",
            defaults: { currency: "TRY", payment_method: "cash" },
          },
        ],
        crm_templates: [],
        public_profile_enabled: false,
        public_fields: ["name"],
        public_application_form: null,
      },
    } as Record<string, NativeRequest>,
    policy: undefined as NativeRequest | undefined,
    subVersion: 2,
    pending: false,
    transitioned: false,
    kept: undefined as StarterRetainedScope | undefined,
    keptCenterId: undefined as string | null | undefined,
    failed: false,
  };
  const staffPermissions = [
    "person.manage",
    "person.activate",
    "invite.student",
    "reservation.write",
    "attendance.draft",
    "sale.write",
    "finance.collect",
    "sale.discount",
    "reservation.capacity_override",
    "request.write",
    "request.resolve",
    "crm.daily",
  ];
  const permissionVersions = new Map<string, number>();
  const permissionSelections = new Map<string, boolean>([[`${I.self}:sale.discount`, true]]);
  const permissionResults = new Map<string, ReturnType<typeof nativeMutation>>();
  const personVersion = (id: string) => permissionVersions.get(id) ?? 3;
  const permissionCells = (id: string, permissions: string[]) =>
    permissions.map((permission) => {
      const enabled = permissionSelections.get(`${id}:${permission}`) ?? null;
      return {
        permission,
        override_exists: enabled !== null,
        enabled,
        override_version: enabled === null ? null : personVersion(id),
        effective_staff_grant: enabled ?? (id === I.instructor && permission === "person.manage"),
      };
    });
  let returnedStalePermissionVersion = false;
  let assignedRoleReads = 0;
  let roleAssignmentFailed = false;
  let invitationReads = 0;
  const target = {
    plan: "starter",
    target: { id: uid(101), period: "monthly", amount_minor: "50000", currency: "TRY" },
    effective_at: "2099-01-01T00:00:00Z",
    kept_center_required: true,
  };
  const targets = options.businessDowngrade
    ? [
        {
          ...target,
          plan: "pro",
          target: { ...target.target, id: uid(140), amount_minor: "90000" },
        },
        target,
      ]
    : [target];
  const staff = {
    id: uid(102),
    person_id: I.instructor,
    role: "staff",
    scope_center_id: I.center,
    state: "active",
    version: 2,
    account_access_granted: true,
  };
  const roles = [
    staff,
    { ...staff, id: uid(120), role: "instructor" },
    { ...staff, id: uid(121), person_id: uid(130), role: "center_manager" },
    { ...staff, id: uid(122), person_id: uid(130), role: "org_manager", scope_center_id: null },
  ];
  const invitedPeople = new Set<string>();
  const pendingTeamRoles = new Map<string, (typeof roles)[number]>();
  let teamRoleResponseFailed = false;
  let staffPreviewReads = 0;
  const policy = {
    key: "reservation_window",
    scope: { kind: "organization" },
    value: {
      kind: "window",
      opens_minutes_before: 10080,
      closes_minutes_before: 60,
      manager_exception: false,
    },
    effective_at: at,
    mandatory: false,
    version: 2,
  };
  const notificationDelivery = {
    channels: { in_app: true, email: false, push: false },
    mandatory_when_available: [
      "security",
      "reservation_result",
      "request_result",
      "cancellation",
      "change",
      "seat_offer",
      "collection",
      "refund",
      "access_change",
    ],
    transactional_in_app_required: true,
    in_app_delayed_by_quiet_hours: false,
    in_app_in_digest: false,
    new_member_marketing_default_enabled: false,
    platform_marketing_default_enabled: false,
    reminders: {
      feature_licensed: true,
      timing_controls_available: true,
      new_member_default_enabled: true,
      lesson_hours: [1, 3, 24],
      default_lesson_hours: 24,
      package_expiry_days: [3, 7, 14],
      default_package_expiry_days: 7,
      payment_due_days: [1, 3, 7],
      default_payment_due_days: 3,
    },
    digest: {
      controls_available: false,
      choices: ["instant", "daily", "weekly"],
      default_frequency: "instant",
      daily_local_time: "18:00:00",
      weekly_weekday: 7,
      weekly_local_time: "18:00:00",
      timezone_source: "user_display_timezone",
    },
    quiet_hours: {
      controls_available: true,
      new_user_default_enabled: false,
      exceptions: ["security", "center_cancellation", "near_24h_change", "expiring_seat_offer"],
    },
  };
  const directMemberEntry =
    options.bootstrapBilling === "member" ? (options.startUrl ?? undefined) : undefined;
  const handle: Parameters<typeof mockCompletion>[1] = async ({ op, r, send, fail, abort }) => {
    if (op === "account_access_send_v1") {
      writes.push({ op, r });
      invitedPeople.add(r.person_id);
      return send({ job_id: uid(770), state: "pending" });
    }
    if (
      (op === "role_assign_v1" || op === "center_manager_assign_v1") &&
      invitedPeople.has(r.person_id)
    ) {
      writes.push({ op, r } as RecordedRequest);
      const role = "role" in r ? r.role : "center_manager";
      let assignment = pendingTeamRoles.get(r.operation_key);
      if (!assignment) {
        if (
          [...pendingTeamRoles.values()].some(
            (row) => row.person_id === r.person_id && row.role === role,
          )
        )
          return fail("INVALID_STATE_TRANSITION");
        assignment = {
          ...staff,
          id: uid(771 + pendingTeamRoles.size),
          person_id: r.person_id,
          role,
          version: 1,
        };
        pendingTeamRoles.set(r.operation_key, assignment);
      }
      if (role === "staff" && options.teamRoleResponseFailure && !teamRoleResponseFailed) {
        teamRoleResponseFailed = true;
        return abort();
      }
      return send(nativeMutation(assignment.id));
    }
    if (op === "job_status_get_v1" && r.job_id === uid(770)) {
      invitationReads++;
      if (options.invitationReadbackFailure && invitationReads === 1) return abort();
      return send({
        id: uid(770),
        state: "pending",
        progress_count: 0,
        total_count: null,
        result_reference: null,
        safe_error_code: null,
      });
    }
    if (options.bootstrapBilling) {
      if (op === "organizations_list_v1") {
        return send(
          nativePage([
            {
              id: I.org,
              name: "Fixture Studio",
              state: "active",
              access_mode: "bootstrap",
              version: 1,
              self_context: { person_id: I.self, subscriber_number: null, centers: [] },
              self_management_scope: null,
            },
          ]),
        );
      }
      if (op === "roles_list_v1" || (op === "settings_catalog_get_v1" && r.org_id))
        return fail("SUBSCRIPTION_NOT_STARTED");
      if (op === "subscription_get_v1") {
        if (options.bootstrapBilling === "member") return fail("FORBIDDEN");
        return send({
          state: "pending_payment",
          plan: "business",
          period_start: null,
          period_end: null,
          grace_until: null,
          cancel_at_period_end: false,
          pending_change: null,
          subscription_version: 1,
          limits: { entries: [] },
          usage: { entries: [] },
          billing: {
            current: { id: uid(110), period: "monthly", amount_minor: "100000", currency: "TRY" },
            period_change_options: [],
            pending_period_change: null,
            downgrade_options: [],
            upgrade_options: [],
          },
        });
      }
    }
    if (op === "centers_list_v1" && options.businessDowngrade) {
      const center = {
        id: I.center,
        name: "Fixture Center",
        timezone: "Europe/Istanbul",
        state: "active",
        accessible: true,
        version: 1,
      };
      await send(nativePage([center, { ...center, id: uid(141), name: "İkinci merkez" }]));
    }
    if (op === "roles_list_v1") {
      if (staff.state === "inactive" && r.role === "staff" && r.state === "active")
        await options.onStaffRemovalDirectoryRead?.();
      if (
        options.roleDetailReadbackFailure &&
        r.page?.limit === 100 &&
        writes.some((entry) => entry.op === "role_assign_v1" && entry.r.person_id === r.person_id)
      ) {
        // The write is acknowledged. Fail its first authoritative readback.
        assignedRoleReads++;
        if (assignedRoleReads === 1) return abort();
      }
      const self = {
        id: uid(103),
        person_id: I.self,
        role: "center_manager",
        scope_center_id: I.center,
        state: "active",
        version: 1,
        account_access_granted: true,
      };
      await send(
        nativePage(
          [
            ...roles,
            ...(options.ownerWithoutCenterManagement ? [] : [self]),
            ...(options.billingOwner
              ? [{ ...self, id: uid(104), role: "owner", scope_center_id: null }]
              : []),
          ].filter(
            (row) =>
              (!r.person_id || row.person_id === r.person_id) &&
              (!r.center_id || row.scope_center_id === r.center_id) &&
              (!r.role || row.role === r.role) &&
              (!r.state || row.state === r.state),
          ),
        ),
      );
    }
    if (op === "settings_catalog_get_v1" && (r.scope === "organization" || r.scope === "center"))
      await send({
        scope: r.scope,
        catalog_version: 25,
        fields: [
          "address",
          "collection_templates",
          "program_templates",
          "event_templates",
          "automation_templates",
          "crm_templates",
          ...(r.scope === "organization"
            ? ["billing_name", "billing_address", "billing_email", "public_page"]
            : []),
          "public_profile_enabled",
          "public_fields",
          "public_application_form",
        ]
          .map((key) => ({
            key,
            group: r.scope === "organization" ? "O01" : "M01",
            consumer: "public_profile",
            writable: true,
          }))
          .concat({
            key: "program_duration_minutes",
            group: r.scope === "organization" ? "O18" : "M06",
            consumer: "schedule_build_program",
            writable: true,
          }),
        defaults: {},
        brand_packages: [],
        limitations: [],
        notification_delivery: notificationDelivery,
        ...(r.include_configured_forms
          ? {
              configured_forms: {
                items: [
                  {
                    form_id: uid(105),
                    center_id: r.scope === "center" ? I.center : null,
                    channel: "web_form",
                    form_key: "synthetic-approved-form",
                    enabled: true,
                  },
                ],
                next_cursor: null,
              },
            }
          : {}),
      });
    if (op === "settings_get_v1" && (r.scope === "organization" || r.scope === "center"))
      await send({
        scope: r.scope,
        version: state.version[r.scope as "organization" | "center"],
        values: state.values[r.scope],
        overridden_fields: [],
        as_of: at,
        ...(r.scope === "organization" ? { logo: null } : {}),
        ...(r.scope === "center" ? { inherited_fields: state.inherited } : {}),
      });
    if (op === "settings_update_v1") {
      writes.push({ op, r });
      state.version[r.scope as "organization" | "center"]++;
      Object.assign(state.values[r.scope]!, structuredClone(r.patch));
      if (r.scope === "center") {
        for (const key of Object.keys(r.patch)) delete state.inherited[key];
        for (const key of r.inherit_fields ?? []) {
          state.inherited[key] = {
            kind: "organization_inherited",
            organization_version: state.version.organization,
          };
          state.values.center![key] = structuredClone(state.values.organization![key]);
        }
      }
      await send(nativeMutation(I.account));
    }
    if (op === "settings_history_get_v1") await send(nativePage([]));
    if (op === "content_catalog_get_v1")
      await send({
        items: [
          {
            id: uid(106),
            org_id: I.org,
            center_id: r.center_id ?? null,
            scope_key: r.scope_key,
            code: r.code,
            channel: "document",
            language: "tr",
            version: 1,
            source_version: "approved-1",
            content: {
              name: "Sentetik onaylı metin",
              language: "tr",
              template_id: "synthetic",
              template_version: "1",
              text: "Yalnız CI için sentetik onay metni.",
            },
            state: "published",
            revision: 1,
            created_at: at,
            published_at: at,
            retired: false,
            invalidated: false,
          },
        ],
        as_of: at,
      });
    if (op === "policies_get_v1") await send([policy]);
    if (op === "reservation_impact_preview_v1")
      await send({
        preview: {
          id: uid(107),
          token: "synthetic",
          scope_hash: "synthetic",
          dependencies: { versions: [] },
          effects: [],
          blockers: [],
          expires_at: "2099-01-01T00:00:00Z",
        },
        change: r.change,
        affected: [],
        preserves_reservations: true,
        waives_independent_blocks: false,
      });
    if (op === "policy_publish_v1") {
      writes.push({ op, r });
      state.policy = structuredClone(r);
      await send(nativeMutation(uid(108)));
    }
    if (op === "subscription_get_v1")
      await send({
        state: "active",
        plan: state.transitioned ? "starter" : options.businessDowngrade ? "business" : "pro",
        period_start: state.transitioned ? target.effective_at : at,
        period_end: state.transitioned ? "2099-02-01T00:00:00Z" : target.effective_at,
        grace_until: null,
        cancel_at_period_end: false,
        pending_change:
          state.pending && !state.transitioned
            ? { type: "saas_change_requests", id: uid(109) }
            : null,
        subscription_version: state.subVersion,
        limits: { entries: [] },
        usage: { entries: [] },
        pending_starter_scope:
          state.pending && !state.transitioned && state.kept
            ? { center_id: state.keptCenterId, scope: state.kept }
            : null,
        billing: {
          current: state.transitioned
            ? target.target
            : { id: uid(110), period: "monthly", amount_minor: "100000", currency: "TRY" },
          period_change_options: [],
          pending_period_change: null,
          downgrade_options: state.transitioned ? [] : targets,
          upgrade_options: [],
        },
      });
    if (op === "subscription_downgrade_request_v1") {
      writes.push({ op, r });
      state.pending = true;
      state.kept = structuredClone(r.kept_scope);
      state.keptCenterId = r.kept_center_id;
      state.subVersion++;
      await send(nativeMutation(uid(109)));
    }
    if (
      op === "org_manager_assign_v1" ||
      op === "org_manager_revoke_v1" ||
      op === "center_manager_assign_v1" ||
      op === "center_manager_revoke_v1"
    ) {
      writes.push({ op, r } as RecordedRequest);
      const role = op.startsWith("org_") ? "org_manager" : "center_manager";
      const existing = roles.find((row) => row.person_id === r.person_id && row.role === role);
      if (op.includes("revoke")) {
        if (!("expected_version" in r) || !existing || existing.version !== r.expected_version)
          throw Error("FIXTURE_STALE_ROLE");
        existing.state = "inactive";
        existing.version++;
        await send(nativeMutation(existing.id));
      } else {
        const row = {
          ...staff,
          id: uid(123),
          person_id: r.person_id,
          role,
          scope_center_id: role === "org_manager" ? null : I.center,
          version: 1,
        };
        roles.push(row);
        await send(nativeMutation(row.id));
      }
    }
    if (op === "role_assign_v1") {
      writes.push({ op, r });
      if (options.roleAssignmentTransportFailure && !roleAssignmentFailed) {
        roleAssignmentFailed = true;
        return abort();
      }
      roles.push({
        id: uid(111),
        person_id: r.person_id,
        role: r.role,
        scope_center_id: I.center,
        state: "active",
        version: 1,
        account_access_granted: true,
      });
      await send(nativeMutation(uid(111)));
    }
    if (op === "role_revoke_preview_v1" && options.staffRemoval) {
      if (options.staffRemoval === "forbidden") return fail("FORBIDDEN");
      if (
        r.assignment_id !== staff.id ||
        r.expected_version !== staff.version ||
        staff.state !== "active"
      )
        return fail("VERSION_CONFLICT");
      staffPreviewReads++;
      const handover = options.staffRemoval !== "empty";
      return send({
        id: uid(790 + staffPreviewReads),
        token: `staff-removal-${staffPreviewReads}`,
        expires_at: "2099-01-01T00:00:00Z",
        assignment_id: staff.id,
        assignment_version: staff.version,
        sessions: [],
        staff_impact: {
          lost_permissions: handover ? ["crm.daily"] : [],
          open_leads: handover
            ? [
                {
                  lead_id: uid(796),
                  person_id: uid(797),
                  version: staffPreviewReads,
                  followups: [{ activity_id: uid(798), version: 1, due_at: null }],
                },
              ]
            : [],
          handover_required: handover,
          recipients:
            options.staffRemoval === "handover-stale"
              ? [
                  { person_id: I.self, display_name: "Sentetik hesap" },
                  { person_id: uid(130), display_name: "Sentetik yönetici" },
                ]
              : [],
        },
      });
    }
    if (op === "role_revoke_v1" && options.staffRemoval) {
      writes.push({ op, r });
      if (
        r.assignment_id !== staff.id ||
        staff.state !== "active" ||
        r.expected_version !== staff.version
      )
        return fail("VERSION_CONFLICT");
      if (
        (options.staffRemoval === "handover-stale" && staffPreviewReads === 1) ||
        r.impact_approval?.id !== uid(790 + staffPreviewReads) ||
        r.impact_approval?.token !== `staff-removal-${staffPreviewReads}`
      )
        return fail("PREVIEW_STALE");
      if (options.staffRemoval === "handover-stale" && r.handover_person_id !== uid(130))
        return fail("FORBIDDEN");
      staff.state = "inactive";
      staff.version++;
      return send({ ...nativeMutation(staff.id), version: staff.version });
    }
    if (op === "permission_set_v1") {
      writes.push({ op, r });
      const receipt = permissionResults.get(r.operation_key);
      if (receipt) return send({ ...receipt, replayed: true });
      const version = personVersion(r.person_id);
      if (r.expected_version !== version) return fail("VERSION_CONFLICT");
      permissionSelections.set(`${r.person_id}:${r.permission}`, r.enabled);
      permissionVersions.set(r.person_id, version + 1);
      const result = { ...nativeMutation(uid(112)), version: version + 1 };
      permissionResults.set(r.operation_key, result);
      if (options.permissionUnknown && !state.failed && permissionResults.size === 2) {
        state.failed = true;
        return abort();
      }
      return send(result);
    }
    if (op === "management_state_get_v1") {
      const operation = r.operation,
        key = r.selector.key as {
          target_plan_id?: string;
          kept_center_id?: string | null;
          person_id?: string;
          role?: string;
          permission?: string;
          permission_summary?: boolean;
          directory?: string;
        };
      const resources = "resources" in r.selector ? r.selector.resources : undefined;
      if (operation === "policy_publish_v1")
        await send(
          nativePage([
            metadata(
              operation,
              "policy_versions",
              uid(108),
              state.policy
                ? {
                    key: state.policy.key,
                    value: state.policy.value,
                    effective_at: state.policy.effective_at,
                    mandatory: state.policy.mandatory,
                  }
                : {
                    key: policy.key,
                    value: policy.value,
                    effective_at: policy.effective_at,
                    mandatory: policy.mandatory,
                  },
              state.policy ? 3 : 2,
              "active",
            ),
          ]),
        );
      if (operation === "subscription_downgrade_request_v1") {
        const base = metadata(
          operation,
          "saas_subscriptions",
          uid(113),
          {
            target_plan_id:
              targets.find((item) => item.target.id === key.target_plan_id)?.target.id ??
              target.target.id,
            kept_center_id: key.kept_center_id ?? null,
            expected_version: state.subVersion,
          },
          state.subVersion,
        );
        if (typeof resources === "string" && resources) {
          const kind = resources;
          const resource =
            kind === "rooms"
              ? { id: I.room, display_name: "Ana salon" }
              : kind === "disciplines"
                ? { id: I.discipline, display_name: "Tango" }
                : kind === "instructors"
                  ? { id: I.instructor, display_name: "Sentetik personel" }
                  : { id: uid(114), display_name: "Sentetik öğrenci" };
          await send(
            nativePage([
              { ...base, retained_resource: { kind, ...resource, subscriber_number: null } },
            ]),
          );
        } else await send(nativePage([base]));
      }
      if (
        [
          "org_manager_assign_v1",
          "org_manager_revoke_v1",
          "center_manager_assign_v1",
          "center_manager_revoke_v1",
        ].includes(operation)
      ) {
        const role = operation.startsWith("org_") ? "org_manager" : "center_manager";
        const row = roles.find((row) => row.person_id === key.person_id && row.role === role);
        await send(
          nativePage(
            row
              ? [
                  metadata(
                    operation,
                    "role_assignments",
                    row.id,
                    { person_id: row.person_id },
                    row.version,
                    row.state,
                  ),
                ]
              : [],
          ),
        );
      }
      if (operation === "role_assign_v1")
        await send(
          nativePage(
            roles
              .filter((role) => role.role === key.role)
              .map((role) => ({
                ...metadata(
                  operation,
                  "role_assignments",
                  role.id,
                  { person_id: role.person_id, role: role.role, scope: { center_id: I.center } },
                  role.version,
                ),
                account_access_granted: true,
              })),
          ),
        );
      if (operation === "permission_set_v1" && key.directory === "center") {
        const stale =
          options.permissionStaleReadback &&
          !r.page?.cursor &&
          permissionResults.size === 3 &&
          !returnedStalePermissionVersion;
        if (stale) returnedStalePermissionVersion = true;
        const member = (
          personId: string,
          displayName: string,
          teamRoles: string[],
          permissions: string[],
        ) =>
          metadata(
            operation,
            "people",
            personId,
            {
              person_id: personId,
              display_name: displayName,
              team_roles: teamRoles,
              permission_overrides: permissionCells(personId, permissions).map((cell) => ({
                ...cell,
                writable: true,
              })),
            },
            personVersion(personId) - (stale && personId === I.instructor ? 1 : 0),
          );
        return send(
          r.page?.cursor
            ? nativePage([
                member(uid(130), "Canlı yönetici", ["center_manager"], ["sale.discount"]),
                member(I.self, "Sentetik hesap", ["center_manager", "staff"], staffPermissions),
                member(uid(132), "İkinci personel", ["staff"], staffPermissions),
                member(uid(131), "Stüdyo eğitmeni", ["instructor"], ["attendance.draft"]),
              ])
            : nativePage(
                [
                  member(
                    I.instructor,
                    "Sentetik personel",
                    ["instructor", "staff"],
                    staffPermissions,
                  ),
                ],
                "team-matrix-page-2",
              ),
        );
      }
      if (operation === "permission_set_v1" && key.permission_summary) {
        const selected = key.person_id;
        if (selected !== I.instructor && selected !== uid(130)) {
          await send(nativePage([]));
          return;
        }
        const overrides = permissionCells(
          selected,
          selected === I.instructor ? staffPermissions : ["sale.discount"],
        );
        await send(
          nativePage([
            metadata(
              operation,
              "people",
              selected,
              { person_id: selected, permission_overrides: overrides },
              personVersion(selected),
            ),
          ]),
        );
      }
      if (operation === "permission_set_v1" && key.permission && key.person_id) {
        const selected = key.person_id;
        const enabled = permissionSelections.get(`${selected}:${key.permission}`);
        await send(
          nativePage([
            metadata(
              operation,
              "people",
              selected,
              {
                person_id: selected,
                permission: key.permission,
                ...(enabled === undefined ? {} : { enabled }),
                override_exists: enabled !== undefined,
              },
              personVersion(selected),
            ),
          ]),
        );
      }
    }
    if (op === "operation_status_get_v1")
      await send({
        operation: r.operation,
        key: r.key,
        status: "succeeded",
        result_available: true,
        result_reference: {
          type:
            r.operation === "permission_set_v1"
              ? "permission_overrides"
              : r.operation === "subscription_downgrade_request_v1"
                ? "saas_change_requests"
                : "accounts",
          id:
            r.operation === "permission_set_v1"
              ? uid(112)
              : r.operation === "subscription_downgrade_request_v1"
                ? uid(109)
                : I.account,
        },
      });
  };
  const f = await mockCompletion(page, handle, directMemberEntry);
  f.studio.people[0]!.display_name = "Sentetik personel";
  f.studio.people.push({ ...f.studio.people[0]!, id: I.self, display_name: "Sentetik hesap" });
  f.studio.people.push({ ...f.studio.people[0]!, id: uid(130), display_name: "Sentetik yönetici" });
  const startUrl = options.startUrl === undefined ? completionUrl("settings") : options.startUrl;
  if (startUrl !== null && !directMemberEntry) await page.goto(startUrl);
  return {
    ...f,
    writes,
    state,
    pendingTeamRoles,
    acceptTeamInvitation(personId: string) {
      if (!invitedPeople.delete(personId)) throw Error("FIXTURE_INVITATION_UNAVAILABLE");
      for (const row of pendingTeamRoles.values()) if (row.person_id === personId) roles.push(row);
    },
  };
}
