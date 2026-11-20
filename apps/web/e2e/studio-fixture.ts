import { expect, type Page, type Route } from "@playwright/test";
import type {
  AgreementVersionView,
  AvailabilityRule,
  CenterSetupStatus,
  DisciplineView,
  ManagementStateView,
  PersonView,
  PersonPatch,
  InstructorRevocationPreview,
  ContactView,
} from "@ftksaas/api-contracts";
import { clickWorkspaceLink, mockNative, origin } from "./auth-fixture.js";

export const studioIds = {
  account: "019a7b00-0000-7000-8000-000000000002",
  org: "019a7b00-0000-7000-8000-000000000003",
  center: "019a7b00-0000-7000-8000-000000000004",
  self: "019a7b00-0000-7000-8000-000000000005",
  instructor: "019a7b00-0000-7000-8000-000000000006",
  room: "019a7b00-0000-7000-8000-000000000007",
  lesson: "019a7b00-0000-7000-8000-000000000008",
  discipline: "019a7b00-0000-7000-8000-000000000009",
  role: "019a7b00-0000-7000-8000-000000000010",
  availability: "019a7b00-0000-7000-8000-000000000011",
  agreement: "019a7b00-0000-7000-8000-000000000012",
};
const now = "2026-11-14T12:00:00Z";
const I = studioIds;
const uid = (index: number) => `019a7b00-0000-7000-8000-${String(index).padStart(12, "0")}`;
const originalPerson: PersonView = {
  id: I.instructor,
  display_name: "Örnek Eğitmen",
  version: 3,
  contacts: [],
  field_policy: {
    display_name: { source: "person", person_update_writable: true },
    given_name: { source: "person", person_update_writable: false },
    family_name: { source: "person", person_update_writable: false },
  },
  relationships: [{ center_id: I.center, kind: "instructor", state: "active" }],
  discipline_relationships: [
    {
      center_id: I.center,
      discipline_id: I.discipline,
      kind: "instructor",
      state: "active",
      version: 2,
    },
  ],
};
const discipline: DisciplineView = {
  id: I.discipline,
  name: "Tango",
  state: "active",
  version: 2,
  presentation: {
    organization: {
      description: null,
      color: null,
      icon: null,
      display_order: 0,
      public_visible: false,
      allow_center_description: true,
    },
    center: {
      id: uid(13),
      state: "active",
      version: 4,
      presentation: { description: null, public_visible: false },
    },
  },
};
export const initialAgreement: AgreementVersionView = {
  id: I.agreement,
  person_id: I.instructor,
  center_id: I.center,
  discipline_id: I.discipline,
  version: 1,
  format: "group",
  valid: { starts_at: "2026-11-01T00:00:00Z", ends_at: "2035-01-01T00:00:00Z" },
  supersedes_id: null,
  published_at: now,
  terms: {
    model: "session_fixed",
    currency: "TRY",
    components: [{ kind: "session_fixed", amount_minor: "12550" }],
    room_fee: { kind: "free", order: "after_instructor_share" },
  },
};
type Write = { operation: string; key: string; payload: Record<string, unknown> };
export async function mockStudio(page: Page, origins?: Parameters<typeof mockNative>[2]) {
  const native = await mockNative(page, false, origins);
  const state = {
    native,
    setupStatus: undefined as CenterSetupStatus | undefined,
    accountLinked: false,
    rooms: [
      { id: I.room, name: "Ana salon", capacity: 20 as number | null, active: true, version: 2 },
    ],
    lessons: [
      {
        id: I.lesson,
        name: "Başlangıç grubu",
        disciplineId: I.discipline,
        externalOpen: false,
        waitlist: false,
        active: true,
        version: 4,
      },
    ],
    people: [structuredClone(originalPerson)],
    roles: [
      {
        id: I.role,
        personId: I.instructor,
        active: true,
        version: 2,
        accountAccessGranted: null as boolean | null,
      },
    ],
    rules: [
      {
        id: I.availability,
        personId: I.instructor,
        version: 3,
        active: true,
        rule: {
          weekdays: [1, 3] as [number, ...number[]],
          local_start: "18:00:00",
          local_end: "21:00:00",
          valid_from: "2026-11-01",
          valid_until: null,
        } satisfies AvailabilityRule,
      },
    ] as {
      id: string;
      personId: string;
      version: number;
      active: boolean;
      rule: AvailabilityRule;
    }[],
    closures: [] as {
      id: string;
      state: "active" | "cancelled";
      resource: { kind: "person" | "room"; id: string };
      interval: { starts_at: string; ends_at: string };
    }[],
    agreements: [structuredClone(initialAgreement)],
    assignments: [] as {
      id: string;
      classId: string;
      personId: string;
      active: boolean;
      version: number;
    }[],
    unknownOperation: null as string | null,
    centerVersion: 7,
    writes: [] as Write[],
    effects: [] as string[],
    nextWrite: "normal" as "normal" | "unknown" | "conflict",
    failedReads: new Set<string>(),
    reads: [] as string[],
  };
  let serial = 100;
  const receipts = new Map<
    string,
    { operation_id: string; primary_id: string; version: number; replayed: boolean; related: [] }
  >();
  const send = (route: Route, data: unknown) =>
    route.fulfill({ json: { ok: true, data, trace_id: uid(99) } });
  const fail = (route: Route, code: string, retryable = false) =>
    route.fulfill({ json: { ok: false, error: { code, retryable, trace_id: uid(99) } } });
  const list = <T>(items: T[]) => ({ items, next_cursor: null, as_of: now });
  const centers = (includeSetupStatus = false) =>
    list([
      {
        id: I.center,
        name: "Fixture Center",
        timezone: "Europe/Istanbul",
        state: "active",
        accessible: true,
        version: state.centerVersion,
        ...(includeSetupStatus ? { setup_status: state.setupStatus } : {}),
      },
    ]);
  if (origins && origins.app !== origins.auth) {
    await page.route(`${origins.auth}/rest/v1/rpc/centers_list_v1`, (route) => {
      const request = route.request();
      expect(request.method()).toBe("POST");
      expect(request.headers()["content-profile"]).toBe("api_read");
      expect(request.postDataJSON()).toMatchObject({ p_request: { org_id: I.org } });
      return send(route, centers());
    });
  }
  const item = (
    entityType: NonNullable<ManagementStateView["entity"]>["type"],
    id: string,
    version: number,
    active: boolean,
    current: ManagementStateView["current"],
  ): ManagementStateView => ({
    operation: current!.operation,
    entity: { type: entityType, id },
    exists: true,
    state: active ? "active" : "inactive",
    versions: [{ entity: { type: entityType, id }, version }],
    current,
    as_of: now,
  });
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const op = new URL(route.request().url()).pathname.split("/").at(-1)!;
    if (op === "calendar_links_get_v1") {
      if (!route.request().postDataJSON().studio_program_scope) return route.fallback();
      return send(route, {
        ...list([]),
        service_ready: true,
        supported_kinds: ["lessons", "duties"],
      });
    }
    if (
      ![
        "organizations_list_v1",
        "centers_list_v1",
        "roles_list_v1",
        "settings_get_v1",
        "settings_catalog_get_v1",
        "subscription_get_v1",
        "disciplines_list_v1",
        "products_list_v1",
        "person_get_v1",
        "people_list_v1",
        "instructor_agreements_list_v1",
        "management_state_get_v1",
        "room_save_v1",
        "class_save_v1",
        "person_update_v1",
        "person_create_v1",
        "account_access_send_v1",
        "role_assign_v1",
        "class_assignment_set_v1",
        "role_revoke_preview_v1",
        "role_revoke_v1",
        "availability_save_v1",
        "availability_exception_save_v1",
        "instructor_agreement_publish_v1",
      ].includes(op)
    )
      return route.fallback();
    const r = route.request().postDataJSON() as Record<string, unknown>;
    if (["settings_get_v1", "settings_catalog_get_v1"].includes(op) && r.scope !== "center")
      return route.fallback();
    if (op === "management_state_get_v1" && r.operation === "account_profile_update_v1")
      return route.fallback();
    if (op !== "organizations_list_v1") expect(r.org_id, `${op} organization`).toBe(I.org);
    if (r.center_id !== undefined) expect(r.center_id, `${op} center`).toBe(I.center);
    if (op === "organizations_list_v1")
      return send(
        route,
        list([
          {
            id: I.org,
            name: "Fixture Studio",
            state: "active",
            access_mode: "normal",
            version: 1,
            self_context: { person_id: I.self, subscriber_number: null, centers: [] },
          },
        ]),
      );
    if (op === "centers_list_v1") return send(route, centers(Boolean(r.include_setup_status)));
    if (op === "role_revoke_preview_v1") {
      const role = state.roles.find((role) => role.id === r.assignment_id && role.active);
      if (!role || role.version !== r.expected_version) return fail(route, "VERSION_CONFLICT");
      return send(route, {
        id: uid(40),
        token: "fixture-impact-token",
        expires_at: "2035-01-01T00:00:00Z",
        assignment_id: role.id,
        assignment_version: role.version,
        sessions: [],
      } satisfies InstructorRevocationPreview);
    }
    if (op === "people_list_v1") return send(route, list(state.people));
    if (op === "roles_list_v1")
      return send(
        route,
        list([
          {
            id: uid(14),
            person_id: I.self,
            role: "owner",
            scope_center_id: null,
            state: "active",
            version: 1,
          },
        ]),
      );
    if (op === "settings_catalog_get_v1")
      return send(route, {
        scope: "center",
        catalog_version: 24,
        fields: [{ key: "address", group: "center", consumer: "public_profile", writable: true }],
        defaults: { address: "" },
        brand_packages: [],
        limitations: [],
      });
    if (op === "settings_get_v1")
      return send(route, {
        scope: "center",
        version: 1,
        values: { address: "Örnek test adresi" },
        overridden_fields: ["address"],
        as_of: now,
      });
    if (op === "subscription_get_v1")
      return send(route, {
        state: "active",
        plan: "pro",
        period_start: now,
        period_end: "2035-01-01T00:00:00Z",
        grace_until: null,
        cancel_at_period_end: false,
        pending_change: null,
        limits: { entries: [{ key: "rooms", unlimited: true }] },
        usage: { entries: [{ key: "rooms", value: state.rooms.length }] },
      });
    if (op === "disciplines_list_v1") return send(route, list([discipline]));
    if (op === "products_list_v1") return send(route, list([]));
    state.reads.push(op);
    if (state.failedReads.has(op)) return fail(route, "TEMPORARY_FAILURE", true);
    if (op === "person_get_v1") {
      const person = state.people.find((person) => person.id === r.person_id);
      return person ? send(route, person) : fail(route, "NOT_FOUND");
    }
    if (op === "instructor_agreements_list_v1")
      return send(
        route,
        list(state.agreements.filter((agreement) => agreement.person_id === r.person_id)),
      );
    if (op === "management_state_get_v1") {
      const selector = r.selector as { key: Record<string, unknown> };
      const k = selector.key;
      if (r.operation === "room_save_v1")
        return send(
          route,
          list(
            state.rooms
              .filter((room) => !k.room_id || k.room_id === room.id)
              .map((room) =>
                item("rooms", room.id, room.version, room.active, {
                  operation: "room_save_v1",
                  values: {
                    room_id: room.id,
                    name: room.name,
                    capacity: room.capacity,
                    state: room.active ? "active" : "inactive",
                  },
                }),
              ),
          ),
        );
      if (r.operation === "class_save_v1")
        return send(
          route,
          list(
            state.lessons
              .filter((lesson) => !k.class_id || k.class_id === lesson.id)
              .map((lesson) =>
                item("classes", lesson.id, lesson.version, lesson.active, {
                  operation: "class_save_v1",
                  values: {
                    class_id: lesson.id,
                    name: lesson.name,
                    discipline_id: lesson.disciplineId,
                    external_open: lesson.externalOpen,
                    waitlist_enabled: lesson.waitlist,
                  },
                }),
              ),
          ),
        );
      if (r.operation === "role_assign_v1")
        return send(
          route,
          list(
            state.roles
              .filter((role) => !k.person_id || k.person_id === role.personId)
              .map((role) => ({
                ...item("role_assignments", role.id, role.version, role.active, {
                  operation: "role_assign_v1",
                  values: {
                    person_id: role.personId,
                    role: "instructor",
                    scope: { center_id: I.center },
                  },
                }),
                ...(role.accountAccessGranted === null
                  ? {}
                  : { account_access_granted: role.accountAccessGranted }),
              })),
          ),
        );
      if (r.operation === "account_access_revoke_v1") return send(route, list([]));
      if (r.operation === "account_link_remove_v1")
        return send(
          route,
          list(
            state.accountLinked
              ? [
                  item("account_links", uid(19), 1, true, {
                    operation: "account_link_remove_v1",
                    values: { person_id: String(k.person_id), link_id: uid(19) },
                  }),
                ]
              : [],
          ),
        );
      if (r.operation === "program_preview_v1") return send(route, list([]));
      if (r.operation === "availability_save_v1") {
        const resource = k.resource as { id: string; kind: "person" | "room" };
        return send(
          route,
          list(
            state.rules
              .filter(
                (rule) => rule.personId === resource.id && (!k.rule_id || k.rule_id === rule.id),
              )
              .map((rule) =>
                item("availability_rules", rule.id, rule.version, rule.active, {
                  operation: "availability_save_v1",
                  values: { rule_id: rule.id, resource, rule: rule.rule },
                }),
              ),
          ),
        );
      }
      if (r.operation === "availability_exception_save_v1") {
        const resource = k.resource as { id: string; kind: "person" | "room" };
        return send(
          route,
          list(
            state.closures
              .filter(
                (closure) =>
                  closure.resource.id === resource.id && closure.resource.kind === resource.kind,
              )
              .map((closure) => ({
                ...item("availability_exceptions", closure.id, 1, true, {
                  operation: "availability_exception_save_v1",
                  values: { resource, interval: closure.interval, exception_id: closure.id },
                }),
                state: closure.state,
                versions: [
                  { entity: { type: "centers", id: I.center }, version: state.centerVersion },
                ],
              })),
          ),
        );
      }
      if (r.operation === "class_assignment_set_v1") {
        const assignment = state.assignments.find(
          (item) => item.classId === k.class_id && item.personId === k.person_id,
        );
        if (assignment)
          return send(
            route,
            list([
              item("class_assignments", assignment.id, assignment.version, assignment.active, {
                operation: "class_assignment_set_v1",
                values: {
                  class_id: assignment.classId,
                  person_id: assignment.personId,
                  duty: "instructor",
                  state: assignment.active ? "active" : "inactive",
                },
              }),
            ]),
          );
        return send(
          route,
          list([
            {
              operation: "class_assignment_set_v1",
              entity: null,
              exists: false,
              state: null,
              versions: [],
              as_of: now,
              current: {
                operation: "class_assignment_set_v1",
                values: {
                  class_id: String(k.class_id),
                  person_id: String(k.person_id),
                  duty: "instructor",
                },
              },
            } satisfies ManagementStateView,
          ]),
        );
      }
      if (r.operation === "person_merge_preview_v1" && k.directory === "center") {
        expect(k.status).toBe("suggested");
        expect(r.page).toEqual({ limit: 1 });
        return send(route, {
          ...list([]),
          merge_review_summary: { total: 0, filtered: 0, by_state: [] },
        });
      }
      throw new Error(`Unexpected Studio selector: ${String(r.operation)}`);
    }
    const key = String(r.operation_key);
    state.writes.push({ operation: op, key, payload: r });
    const old = receipts.get(key);
    if (old) return send(route, { ...old, replayed: true });
    if (state.nextWrite === "conflict") {
      state.nextWrite = "normal";
      return fail(route, "VERSION_CONFLICT");
    }
    if (op === "account_access_send_v1") {
      state.effects.push(op);
      return send(route, { job_id: uid(++serial), state: "pending" });
    }
    let primary = uid(++serial),
      version = 1;
    if (op === "room_save_v1") {
      const room = state.rooms.find((room) => room.id === r.room_id);
      if (room) {
        if (room.version !== r.expected_version) return fail(route, "VERSION_CONFLICT");
        room.name = String(r.name);
        room.capacity = r.capacity as number | null;
        room.active = r.state === "active";
        room.version++;
        primary = room.id;
        version = room.version;
      } else {
        expect(r.expected_version).toBeUndefined();
        state.rooms.push({
          id: primary,
          name: String(r.name),
          capacity: r.capacity as number | null,
          active: r.state === "active",
          version,
        });
      }
    } else if (op === "person_create_v1") {
      state.people.push({
        id: primary,
        version,
        display_name: String(r.display_name),
        field_policy: structuredClone(originalPerson.field_policy),
        contacts: (r.contacts as ContactView[]).map((contact) => ({
          ...contact,
          field_policy: { source: "person", person_update_writable: true },
        })),
        relationships: [],
        discipline_relationships: [],
      });
    } else if (op === "role_assign_v1") {
      const role = state.roles.find((role) => role.personId === r.person_id && role.active);
      if (!role || role.accountAccessGranted === true || !state.accountLinked)
        return fail(route, "VERSION_CONFLICT");
      role.accountAccessGranted = true;
      primary = role.id;
      version = ++role.version;
    } else if (op === "person_update_v1") {
      const person = state.people.find((person) => person.id === r.person_id)!;
      if (person.version !== r.expected_version) return fail(route, "VERSION_CONFLICT");
      const patch = r.patch as PersonPatch;
      if (
        patch.display_name !== undefined &&
        person.field_policy?.display_name.person_update_writable !== true
      )
        return fail(route, "FORBIDDEN");
      if (
        patch.contacts &&
        person.contacts?.some(
          (old) =>
            old.field_policy?.person_update_writable !== true &&
            !patch.contacts!.some((next) => next.kind === old.kind && next.value === old.value),
        )
      )
        return fail(route, "FORBIDDEN");
      if (patch.display_name !== undefined) person.display_name = patch.display_name;
      if (patch.contacts)
        person.contacts = patch.contacts.map((contact) => ({
          ...contact,
          ...person.contacts?.find(
            (old) => old.kind === contact.kind && old.value === contact.value,
          ),
          field_policy: person.contacts?.find(
            (old) => old.kind === contact.kind && old.value === contact.value,
          )?.field_policy ?? { source: "person", person_update_writable: true },
        }));
      primary = person.id;
      version = ++person.version;
    } else if (op === "class_assignment_set_v1") {
      const existing = state.assignments.find(
        (item) => item.classId === r.class_id && item.personId === r.person_id,
      );
      if (existing) {
        if (existing.version !== r.expected_version) return fail(route, "VERSION_CONFLICT");
        existing.active = r.state === "active";
        primary = existing.id;
        version = ++existing.version;
      } else {
        expect(r.expected_version).toBeUndefined();
        state.assignments.push({
          id: primary,
          classId: String(r.class_id),
          personId: String(r.person_id),
          active: r.state === "active",
          version,
        });
      }
    } else if (op === "role_revoke_v1") {
      const role = state.roles.find((role) => role.id === r.assignment_id)!;
      if (role.version !== r.expected_version) return fail(route, "VERSION_CONFLICT");
      expect(r.impact_approval).toEqual({ id: uid(40), token: "fixture-impact-token" });
      role.active = false;
      primary = role.id;
      version = ++role.version;
    } else if (op === "class_save_v1") {
      const lesson = state.lessons.find((lesson) => lesson.id === r.class_id);
      if (!lesson) throw new Error("Fixture expects an existing class");
      if (lesson.version !== r.expected_version) return fail(route, "VERSION_CONFLICT");
      lesson.name = String(r.name);
      lesson.disciplineId = String(r.discipline_id);
      lesson.externalOpen = Boolean(r.external_open);
      if (r.waitlist_enabled !== undefined) lesson.waitlist = Boolean(r.waitlist_enabled);
      primary = lesson.id;
      version = ++lesson.version;
    } else if (op === "availability_save_v1") {
      const rule = state.rules.find((rule) => rule.id === r.rule_id);
      if (rule) {
        if (rule.version !== r.expected_version) return fail(route, "VERSION_CONFLICT");
        if (!rule.active) return fail(route, "VERSION_CONFLICT");
        if (r.action === "retire") {
          expect(r.resource).toEqual({ kind: "person", id: rule.personId });
          expect(typeof r.reason === "string" && Boolean(r.reason.trim())).toBe(true);
          expect(r.rule).toBeUndefined();
          rule.active = false;
        } else rule.rule = r.rule as AvailabilityRule;
        rule.version++;
        primary = rule.id;
        version = rule.version;
      } else {
        expect(r.expected_version).toBeUndefined();
        state.rules.push({
          id: primary,
          personId: (r.resource as { id: string }).id,
          active: true,
          version,
          rule: r.rule as AvailabilityRule,
        });
      }
    } else if (op === "availability_exception_save_v1") {
      if (r.expected_version !== state.centerVersion) return fail(route, "VERSION_CONFLICT");
      if (r.action === "cancel") {
        const closure = state.closures.find((item) => item.id === r.exception_id);
        if (!closure || closure.state !== "active") return fail(route, "VERSION_CONFLICT");
        expect(r.resource).toEqual(closure.resource);
        expect(typeof r.reason === "string" && Boolean(r.reason.trim())).toBe(true);
        expect(r.interval).toBeUndefined();
        closure.state = "cancelled";
        primary = closure.id;
      } else
        state.closures.push({
          id: primary,
          state: "active",
          resource: r.resource as { kind: "person" | "room"; id: string },
          interval: r.interval as { starts_at: string; ends_at: string },
        });
      state.centerVersion++;
      version = state.centerVersion;
    } else if (op === "instructor_agreement_publish_v1") {
      const predecessor = r.supersedes_id
        ? state.agreements.find((agreement) => agreement.id === r.supersedes_id)
        : undefined;
      if (
        predecessor &&
        (predecessor.version !== r.expected_version ||
          state.agreements.some((agreement) => agreement.supersedes_id === predecessor.id))
      )
        return fail(route, "VERSION_CONFLICT");
      version = predecessor ? predecessor.version + 1 : 1;
      state.agreements.push({
        id: primary,
        person_id: String(r.person_id),
        center_id: I.center,
        discipline_id: String(r.discipline_id),
        format: r.format as AgreementVersionView["format"],
        valid: r.valid as AgreementVersionView["valid"],
        terms: r.terms as AgreementVersionView["terms"],
        supersedes_id: predecessor?.id ?? null,
        version,
        published_at: now,
      });
    } else throw new Error(`Unexpected Studio writer: ${op}`);
    const receipt = {
      operation_id: uid(++serial),
      primary_id: primary,
      version,
      replayed: false,
      related: [] as [],
    };
    receipts.set(key, receipt);
    state.effects.push(op);
    if (state.nextWrite === "unknown" || state.unknownOperation === op) {
      state.unknownOperation = null;
      state.nextWrite = "normal";
      return route.abort("failed");
    }
    return send(route, receipt);
  });
  return state;
}
export async function openStudio(page: Page) {
  await page.goto(`${origin}/login`);
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("Fixture123");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/account`);
  await expect(page.getByRole("heading", { name: "Hesabım", exact: true })).toBeVisible();
  await clickWorkspaceLink(page, "Stüdyo");
  await expect(page).toHaveURL(`${origin}/o/${I.org}/c/${I.center}/studio`);
  await expect(page.getByRole("heading", { name: "Stüdyo", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Örnek Eğitmen/ })).toBeVisible();
}

// Warm and revisit the real assignment picker in the same document/query lifetime.
export async function studioScheduleChoice(page: Page, instructorId: string, eligible: boolean) {
  await clickWorkspaceLink(page, "Ders programı");
  await page.getByRole("button", { name: "Seans ekle", exact: true }).click();
  const panel = page.getByRole("dialog");
  await expect(
    panel.locator(`#schedule-create-instructor option[value="${instructorId}"]`),
  ).toHaveCount(eligible ? 1 : 0);
  await panel.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await clickWorkspaceLink(page, "Stüdyo");
  await expect(page.getByRole("heading", { name: "Stüdyo", exact: true })).toBeVisible();
}
export async function mockStudioCalendar(page: Page) {
  await page.route("**/functions/v1/backend-v1/calendar_get_v1", (route) =>
    route.fulfill({
      json: {
        ok: true,
        data: { items: [], next_cursor: null, as_of: "2026-11-18T08:00:00Z" },
        trace_id: studioIds.role,
      },
    }),
  );
}
