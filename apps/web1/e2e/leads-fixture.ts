import { expect, type Page } from "@playwright/test";
import type {
  LeadView,
  PersonView,
  CrmPipelineConfiguration,
} from "../src/lib/api-contracts/generated.js";
import { mockStudio, studioIds as I } from "./studio-fixture.js";
import { origin } from "./auth-fixture.js";
const id = (n: number) => `019a7b00-0000-7000-8000-${String(n).padStart(12, "0")}`;
export const leadIds = { first: id(900), person: id(901), activity: id(902), application: id(903) };
export async function mockLeads(
  page: Page,
  options: {
    unknown?: string;
    ackUnread?: boolean;
    denied?: boolean;
    staff?: boolean;
    personDenied?: boolean;
    unboundManager?: boolean;
    starter?: boolean;
  } = {},
) {
  const studio = await mockStudio(page);
  const catalog: CrmPipelineConfiguration = {
    stages: [
      { key: "new", name: "Yeni", kind: "open" },
      { key: "talk", name: "Görüşülüyor", kind: "open" },
      { key: "won", name: "Kazanıldı", kind: "won" },
      { key: "lost", name: "Kaybedildi", kind: "lost" },
    ],
    tags: [{ key: "evening", name: "Akşam" }],
    allow_center_tags: false,
    followup_days: null,
  };
  const person = (personId: string, name: string): PersonView => ({
    ...structuredClone(studio.people[0]),
    id: personId,
    display_name: name,
    contacts: [],
    relationships: [{ center_id: I.center, kind: "candidate", state: "active" }],
    discipline_relationships: [],
  });
  const people = new Map([
    [leadIds.person, person(leadIds.person, "Aday A")],
    [I.self, person(I.self, "Örnek sorumlu")],
  ]);
  const leads: LeadView[] = [
    {
      id: leadIds.first,
      person_id: leadIds.person,
      source: "phone",
      interest: "Tango",
      assigned_to: I.self,
      state: "open",
      last_contact: null,
      due_followup: "2026-11-20T13:00:00Z",
      version: 2,
      pipeline: { stage: catalog.stages[0], tags: [], loss_reason: null },
    },
  ];
  const activities = [
    {
      id: leadIds.activity,
      lead_id: leadIds.first,
      kind: "followup",
      due_at: "2026-11-20T13:00:00Z" as string | null,
      note: "İlk görüşmeyi yap" as string | null,
      outcome: null as string | null,
      version: 2,
      state: "open",
    },
  ];
  const app = {
    id: leadIds.application,
    version: 2,
    state: "pending",
    person_id: null as string | null,
    intake: {
      display_name: "Başvuran Örnek",
      phone: "+905550000000",
      email: "application@example.invalid",
      interest: "Tango",
      message: "Akşam grubu",
      consents: [],
    },
    phone_matches: [{ person_id: leadIds.person, display_name: "Aday A" }],
  };
  people.get(leadIds.person)!.contacts = [{ kind: "phone", value: app.intake.phone }];
  const writes: { operation: string; request: Record<string, unknown> }[] = [],
    reads: { operation: string; request: Record<string, unknown> }[] = [],
    effects: string[] = [],
    receipts = new Map<string, { operation: string; id: string; type: string }>();
  let denied = Boolean(options.denied),
    unread = false,
    serial = 910;
  await page.route("**/functions/v1/backend-v1/*", async (route) => {
    const operation = new URL(route.request().url()).pathname.split("/").at(-1)!,
      req = route.request().postDataJSON();
    reads.push({ operation, request: req });
    const send = (data: unknown) => route.fulfill({ json: { ok: true, data, trace_id: I.role } }),
      reject = (code = "FORBIDDEN") =>
        route.fulfill({
          status: 403,
          json: { ok: false, error: { code, retryable: false, trace_id: I.role } },
        });
    const list = (items: unknown[]) => ({
      items,
      next_cursor: null,
      as_of: "2026-11-16T12:00:00Z",
    });
    if (operation === "roles_list_v1" && (options.staff || options.unboundManager))
      return send(
        list([
          {
            id: I.role,
            person_id: I.self,
            role: options.staff ? "staff" : "owner",
            account_access_granted: !options.unboundManager,
            scope_center_id: options.staff ? I.center : null,
            state: "active",
            version: 1,
          },
        ]),
      );
    if (operation === "person_get_v1" && people.has(req.person_id)) {
      if (options.personDenied) return reject();
      return send(people.get(req.person_id));
    }
    if (operation === "people_list_v1")
      return send(
        list(
          [...people.values()].filter(
            (person) => !req.query || person.display_name.includes(req.query),
          ),
        ),
      );
    if (operation === "leads_list_v1") {
      expect(req.org_id).toBe(I.org);
      expect(req.center_id).toBe(I.center);
      if (options.starter && req.include_pipeline) return reject("PLAN_FEATURE_UNAVAILABLE");
      if (!options.starter) {
        expect(req.include_pipeline).toBe(true);
        expect(req.include_pipeline_summary).toBe(true);
      }
      if (denied) return reject();
      expect(req.include_details).toBe(true);
      expect(req.include_summary).toBe(true);
      const visible = leads.filter(
        (lead) =>
          (!req.query ||
            people.get(lead.person_id)?.display_name.includes(req.query) ||
            lead.interest.includes(req.query)) &&
          (!req.stage_key || lead.pipeline?.stage.key === req.stage_key) &&
          (!Object.hasOwn(req, "assigned_to") || lead.assigned_to === req.assigned_to),
      );
      return send({
        ...list(
          visible.map((lead) => ({
            ...lead,
            ...(options.starter ? { pipeline: undefined } : {}),
            created_at: "2026-11-16T10:00:00Z",
            display_name: people.get(lead.person_id)!.display_name,
            assigned_name: lead.assigned_to
              ? (people.get(lead.assigned_to)?.display_name ?? null)
              : null,
          })),
        ),
        ...(options.starter ? {} : { pipeline_catalog: catalog }),
        ...(req.include_pipeline_summary
          ? {
              pipeline_summary: {
                stages: catalog.stages.map((stage) => ({
                  stage_key: stage.key,
                  count: stage.key === "new" ? 24 : 0,
                })),
                trials: { offered: 8, registered: 5, attended: 3 },
              },
            }
          : {}),
        summary: {
          total: visible.length,
          open_leads: visible.filter((row) => row.state === "open").length,
          followups_today: 0,
          overdue_followups: 0,
          converted_last_30_days: visible.filter((row) => row.state === "converted").length,
        },
      });
    }
    if (operation === "management_work_list_v1") {
      expect(req).toMatchObject({ org_id: I.org, center_id: I.center, page: { limit: 1 } });
      const open = activities.filter((row) => row.kind === "followup" && row.state === "open");
      const pending =
        app.state === "pending" && !options.staff && !options.unboundManager && !options.starter;
      const items = [
        ...open.map((row) => ({
          id: row.id,
          version: row.version,
          kind: "crm_followup",
          created_at: "2026-11-16T12:00:00Z",
          title: row.note ?? "Takip",
          person_id: leadIds.person,
          due_at: row.due_at,
          target: {
            operation: "management_state_get_v1",
            selector: {
              operation: "crm_activity_save_v1",
              key: { lead_id: row.lead_id, activity_id: row.id },
            },
          },
        })),
        ...(pending
          ? [
              {
                id: app.id,
                version: app.version,
                kind: "application_review",
                created_at: "2026-11-16T12:00:00Z",
                title: "Başvuru",
                person_id: app.person_id,
                due_at: null,
                target: {
                  operation: "management_state_get_v1",
                  selector: {
                    operation: "public_application_review_v1",
                    key: { application_id: app.id },
                  },
                },
              },
            ]
          : []),
      ];
      return send({
        ...list(items.slice(0, 1)),
        next_cursor: items.length > 1 ? "work-next" : null,
        summary: {
          total: items.length,
          crm_followup: open.length,
          application_review: Number(pending),
          lesson_request: 0,
          lesson_attendance: 0,
          event_attendance: 0,
        },
      });
    }

    const entity = (
      type: string,
      value: string,
      version: number,
      state: string,
      values: unknown,
    ) => ({
      operation: req.operation,
      exists: true,
      entity: { type, id: value },
      state,
      versions: [{ entity: { type, id: value }, version }],
      current: { operation: req.operation, values },
      as_of: "2026-11-16T12:00:00Z",
    });
    if (operation === "management_state_get_v1") {
      const key = req.selector.key;
      if (req.operation === "lead_save_v1") {
        if (key.directory === "assignees")
          return send(
            list([
              {
                ...entity("people", I.self, 1, "active", {}),
                current: null,
                crm_discovery: {
                  kind: "assignee",
                  person_id: I.self,
                  display_name: "Örnek sorumlu",
                },
              },
            ]),
          );
        if (unread) {
          unread = false;
          return route.abort("failed");
        }
        return send(
          list(
            leads
              .filter(
                (lead) =>
                  lead.person_id === key.person_id && (!key.lead_id || lead.id === key.lead_id),
              )
              .map((lead) =>
                entity("leads", lead.id, lead.version, lead.state, {
                  lead_id: lead.id,
                  person_id: lead.person_id,
                  source: lead.source,
                  interest: lead.interest,
                  assigned_to: lead.assigned_to,
                  pipeline: lead.pipeline
                    ? {
                        stage_key: lead.pipeline.stage.key,
                        tag_keys: lead.pipeline.tags.map((tag) => tag.key),
                        loss_reason: lead.pipeline.loss_reason,
                      }
                    : null,
                }),
              ),
          ),
        );
      }
      if (req.operation === "crm_activity_save_v1" && key.directory === "followups")
        return send(
          list(
            activities
              .filter(
                (row) =>
                  row.due_at &&
                  (!Object.hasOwn(key, "assigned_to") ||
                    leads.find((lead) => lead.id === row.lead_id)?.assigned_to === key.assigned_to),
              )
              .map((row) => {
                const lead = leads.find((lead) => lead.id === row.lead_id)!;
                return {
                  ...entity("crm_activities", row.id, row.version, row.state, {}),
                  current: null,
                  crm_discovery: {
                    kind: "followup",
                    activity_id: row.id,
                    lead_id: row.lead_id,
                    person_id: lead.person_id,
                    display_name: people.get(lead.person_id)!.display_name,
                    assigned_to: lead.assigned_to,
                    assigned_name: lead.assigned_to
                      ? (people.get(lead.assigned_to)?.display_name ?? null)
                      : null,
                    due_at: row.due_at,
                    completed_at: row.state === "completed" ? "2026-11-16T12:00:00Z" : null,
                    note: row.note,
                  },
                };
              }),
          ),
        );
      if (req.operation === "crm_activity_save_v1")
        return send(
          list(
            activities
              .filter(
                (row) =>
                  row.lead_id === key.lead_id && (!key.activity_id || row.id === key.activity_id),
              )
              .map((row) =>
                entity("crm_activities", row.id, row.version, row.state, {
                  activity_id: row.id,
                  lead_id: row.lead_id,
                  kind: row.kind,
                  due_at: row.due_at,
                  note: row.note,
                  outcome: row.outcome,
                }),
              ),
          ),
        );
      if (req.operation === "public_application_review_v1") {
        const states = req.selector?.key?.states;
        if (states && !states.includes(app.state)) return send(list([]));
        return send(
          list([
            entity("public_applications", app.id, app.version, app.state, {
              application_id: app.id,
              received_at: "2026-11-16T11:00:00Z",
              person_id: app.person_id,
              center_id: I.center,
              intake: app.intake,
              phone_matches: app.phone_matches,
              phone_matches_truncated: false,
            }),
          ]),
        );
      }
    }
    if (operation === "operation_status_get_v1") {
      const receipt = receipts.get(req.key);
      expect(receipt?.operation).toBe(req.operation);
      return send({
        operation: req.operation,
        key: req.key,
        status: "succeeded",
        result_available: true,
        result_reference: { type: receipt?.type, id: receipt?.id },
      });
    }
    if (
      [
        "person_create_v1",
        "lead_save_v1",
        "crm_activity_save_v1",
        "lead_convert_v1",
        "public_application_review_v1",
      ].includes(operation)
    ) {
      writes.push({ operation, request: req });
      expect(req.org_id).toBe(I.org);
      expect(req.center_id).toBe(I.center);
      const replay = receipts.get(req.operation_key);
      if (replay) return send({ primary_id: replay.id, versions: [], job_ids: [] });
      if (
        options.staff &&
        (operation === "lead_convert_v1" || operation === "public_application_review_v1")
      )
        return reject();
      let primary: string, type: string;
      if (
        operation === "lead_save_v1" &&
        !req.lead_id &&
        leads.some((lead) => lead.person_id === req.person_id && lead.state === "open")
      )
        return reject("INVALID_STATE_TRANSITION");
      if (operation === "person_create_v1") {
        primary = id(++serial);
        type = "people";
        const created = person(primary, req.display_name);
        created.relationships = [];
        created.contacts = req.contacts.map(
          (contact: { kind: "phone" | "email"; value: string }) => ({
            ...contact,
          }),
        );
        people.set(primary, created);
      } else if (operation === "lead_save_v1") {
        type = "leads";
        primary = req.lead_id ?? id(++serial);
        let lead = leads.find((lead) => lead.id === primary);
        if (lead) {
          expect(req.expected_version).toBe(lead.version);
          lead.version++;
        } else {
          lead = {
            id: primary,
            person_id: req.person_id,
            source: req.source,
            interest: req.interest,
            assigned_to: null,
            state: "open",
            version: 1,
            last_contact: null,
            due_followup: null,
          };
          leads.push(lead);
          people
            .get(req.person_id)!
            .relationships.push({ center_id: I.center, kind: "candidate", state: "active" });
        }
        lead.source = req.source;
        lead.interest = req.interest;
        if (req.assigned_to !== undefined) lead.assigned_to = req.assigned_to;
        if (req.pipeline)
          lead.pipeline = {
            stage: catalog.stages.find((stage) => stage.key === req.pipeline.stage_key)!,
            tags: catalog.tags.filter((tag) => req.pipeline.tag_keys.includes(tag.key)),
            loss_reason: req.pipeline.loss_reason,
          };
        if (options.ackUnread) unread = true;
      } else if (operation === "crm_activity_save_v1") {
        type = "crm_activities";
        primary = req.activity_id ?? id(++serial);
        let row = activities.find((row) => row.id === primary);
        if (row) {
          expect(req.expected_version).toBe(row.version);
          row.version++;
        } else {
          row = {
            id: primary,
            lead_id: req.lead_id,
            kind: req.kind,
            due_at: null,
            note: null,
            outcome: null,
            version: 1,
            state: "open",
          };
          activities.push(row);
        }
        Object.assign(row, {
          kind: req.kind,
          due_at: req.due_at,
          note: req.note,
          outcome: req.outcome,
          state: req.kind === "followup" ? "open" : "completed",
        });
        const lead = leads.find((lead) => lead.id === req.lead_id)!;
        lead.due_followup =
          activities
            .filter((row) => row.lead_id === lead.id && row.state === "open" && row.due_at)
            .map((row) => row.due_at!)
            .sort()[0] ?? null;
        if (req.kind !== "followup") lead.version++;
      } else if (operation === "lead_convert_v1") {
        type = "leads";
        primary = req.lead_id;
        const lead = leads.find((lead) => lead.id === primary)!;
        lead.state = "converted";
        lead.version++;
        people
          .get(lead.person_id)!
          .relationships.push({ center_id: I.center, kind: "student", state: "active" });
      } else {
        type = "public_applications";
        primary = app.id;
        expect(req.expected_version).toBe(app.version);
        if (req.action === "create_candidate") {
          if (
            [...people.values()].some((person) =>
              person.contacts?.some(
                (contact) =>
                  contact.value === app.intake.phone || contact.value === app.intake.email,
              ),
            )
          )
            return reject("ACCOUNT_LINK_CONFLICT");
          const personId = id(++serial),
            created = person(personId, app.intake.display_name);
          created.contacts = [{ kind: "phone", value: app.intake.phone }];
          people.set(personId, created);
          app.person_id = personId;
          leads.push({
            id: id(++serial),
            person_id: personId,
            source: "public_application",
            interest: app.intake.interest,
            assigned_to: null,
            state: "open",
            version: 1,
            last_contact: null,
            due_followup: null,
          });
        }
        app.version++;
        app.state = req.action === "close" ? "closed" : "reviewed";
        if (req.action === "match_existing") app.person_id = req.person_id;
      }
      receipts.set(req.operation_key, { operation, id: primary, type });
      effects.push(operation);
      if (options.unknown === operation) {
        options.unknown = undefined;
        return route.abort("failed");
      }
      return send({ primary_id: primary, versions: [], job_ids: [] });
    }
    return route.fallback();
  });
  await page.goto(`${origin}/login`);
  await page.getByLabel("E-posta", { exact: true }).fill("fixture@example.invalid");
  await page.getByLabel("Parola", { exact: true }).fill("Fixture123");
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/account`);
  await page.clock.setFixedTime(new Date("2026-11-16T12:00:00Z"));
  await page.goto(`${origin}/o/${I.org}/c/${I.center}/leads`);
  await expect(page.getByRole("heading", { name: "Adaylar", exact: true })).toBeVisible();
  return {
    leads,
    people,
    activities,
    app,
    writes,
    effects,
    reads,
    catalog,
    setDenied: (value: boolean) => {
      denied = value;
    },
  };
}
export async function openLead(page: Page) {
  await page.getByRole("button", { name: "Aday A", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("İlgilendiği ders", { exact: true }).waitFor();
  return dialog;
}
export async function closeLead(page: Page) {
  await page
    .locator('[data-slot="sheet-footer"]')
    .getByRole("button", { name: "Kapat", exact: true })
    .click();
}
