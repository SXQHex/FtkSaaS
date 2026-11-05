import { useState } from "react";
import { beforeEach, expect, test, vi } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type {
  EntitlementView,
  NegativeLimitsView,
  ReservationProtectionPreview,
  SessionView,
} from "@ftksaas/api-contracts";
import { render } from "./render";
import { server } from "./mocks/server";
import { PersonEntitlements } from "../src/components/products/person-entitlements";
import { rightsApi } from "../src/lib/rights";
import { recoverSetup, setupStorageKey } from "../src/lib/studio-setup";
vi.mock("../src/lib/supabase/client", () => ({
  browserClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: { access_token: "synthetic" } }, error: null }),
    },
  }),
}));
const id = "019a2b3c-4d5e-7000-8000-000000000080",
  org = "019a2b3c-4d5e-7000-8000-000000000081",
  center = "019a2b3c-4d5e-7000-8000-000000000082",
  person = "019a2b3c-4d5e-7000-8000-000000000083";
const scope = { actorId: id, orgId: org, centerId: center },
  base = "https://project.example.invalid/functions/v1/backend-v1/";
const row: EntitlementView = {
  sale_id: id,
  person_id: person,
  start_date: "2026-11-01",
  end_date: "2026-12-01",
  timezone: "Europe/Istanbul",
  state: "active",
  sale_state: "active",
  version: 7,
  kind: "credits",
  available: 5,
  reserved: 2,
  consumed: 1,
  deficit: 0,
  quotas: [],
  deficit_scopes: [],
};
const limits: NegativeLimitsView = {
  person_id: person,
  center_id: center,
  discipline_id: id,
  version: 12,
  override: null,
  default_limit: 2,
  upper_limit: 5,
  effective_limit: 2,
  reserved_deficit: 1,
  consumed_deficit: 1,
  policy_version_ids: [],
  override_version: null,
};
function preview(
  change: ReservationProtectionPreview["change"],
  affected = false,
): ReservationProtectionPreview {
  return {
    change,
    preserves_reservations: true,
    waives_independent_blocks: false,
    affected: affected
      ? [
          {
            reservation_id: org,
            session_id: center,
            person_id: person,
            quantity: 2,
            source_sale_id: id,
            existing_version: 4,
            allocation_ids: [],
            deficit_ids: [],
          },
        ]
      : [],
    preview: {
      id: org,
      token: "synthetic-proof",
      scope_hash: "synthetic",
      dependencies: { versions: [], policy_hashes: [], permission_hash: "synthetic" },
      effects: [],
      blockers: [],
      expires_at: "2099-01-01T00:00:00Z",
    },
  };
}
function success() {
  return HttpResponse.json({
    ok: true,
    data: { operation_id: org, primary_id: id, version: 8, replayed: false, related: [] },
    trace_id: id,
  });
}
beforeEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.example.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "synthetic");
  vi.spyOn(rightsApi, "disciplines").mockResolvedValue([
    { id, name: "Salsa", state: "active", version: 1 },
  ]);
  vi.spyOn(rightsApi, "limits").mockResolvedValue(limits);
  vi.spyOn(rightsApi, "session").mockResolvedValue({
    id: center,
    starts_at: "2026-11-10T15:00:00Z",
    ends_at: "2026-11-10T16:00:00Z",
  } as SessionView);
});
async function start(
  kind = "Kredi düzelt",
  read = vi.fn<() => Promise<EntitlementView[]>>().mockResolvedValue([row]),
  waitLimits = true,
  onSaved?: () => void,
) {
  const user = userEvent.setup();
  const view = render(
    <PersonEntitlements scope={scope} personId={person} read={read} management onSaved={onSaved} />,
  );
  await user.click(screen.getByRole("button", { name: "Hakları göster" }));
  await user.click(await screen.findByRole("button", { name: kind }));
  if (kind === "Negatif limiti düzenle") {
    await user.selectOptions(await screen.findByRole("combobox", { name: "Disiplin" }), id);
    if (waitLimits) await screen.findByRole("spinbutton", { name: "Yeni kişisel negatif limit" });
  } else await user.selectOptions(screen.getByRole("combobox", { name: "Düzenlenecek hak" }), id);
  return { user, view, read };
}
async function fill(user: ReturnType<typeof userEvent.setup>, label = "Kredi adedi", value = "2") {
  await user.type(screen.getByLabelText(label), value);
  await user.type(screen.getByRole("textbox", { name: "Gerekçe" }), "Kayıt düzeltmesi");
  await user.click(screen.getByRole("button", { name: "Etkileri incele" }));
}
test("credit reduction previews once, requires every protected reservation and journals exact request before writing", async () => {
  const bodies: Record<string, unknown>[] = [];
  vi.spyOn(rightsApi, "preview").mockImplementation(async (_scope, change) =>
    preview(change, true),
  );
  server.use(
    http.post(base + "credit_adjust_v1", async ({ request }) => {
      expect(sessionStorage.getItem(setupStorageKey(scope, `rights:${person}`))).not.toBeNull();
      bodies.push((await request.json()) as Record<string, unknown>);
      return success();
    }),
  );
  const { user, read } = await start();
  await user.selectOptions(screen.getByRole("combobox", { name: "Düzeltme yönü" }), "decrease");
  await fill(user);
  const heading = await screen.findByRole("heading", { name: "Hak değişikliği onayı" });
  expect(heading).toHaveFocus();
  expect(screen.getByText(/10 Kas/)).toBeInTheDocument();
  await user.click(
    screen.getByRole("checkbox", {
      name: "İncelediğim hak değişikliğini ve gerekçesini onaylıyorum.",
    }),
  );
  expect(screen.getByRole("button", { name: "Değişikliği uygula" })).toBeDisabled();
  expect(bodies).toHaveLength(0);
  await user.click(screen.getByRole("checkbox", { name: /Rezervasyon 1:/ }));
  await user.click(screen.getByRole("button", { name: "Değişikliği uygula" }));
  await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
  expect(bodies).toHaveLength(1);
  expect(bodies[0]).toMatchObject({
    org_id: org,
    center_id: center,
    sale_id: id,
    quantity: 2,
    direction: "decrease",
    reason: "Kayıt düzeltmesi",
    impact_approval: { id: org, token: "synthetic-proof" },
    accepted_reservation_ids: [org],
  });
  expect(screen.getByRole("heading", { name: "Satın alınmış haklar" })).toHaveFocus();
});
test.each([
  ["Süreyi uzat", "Yeni bitiş tarihi", "2027-01-01", "entitlement_extend_v1", 7],
  ["Negatif limiti düzenle", "Yeni kişisel negatif limit", "3", "negative_limit_set_v1", 12],
])(
  "%s uses the authoritative version and rereads after success",
  async (kind, label, value, operation, version) => {
    const bodies: Record<string, unknown>[] = [];
    vi.spyOn(rightsApi, "preview").mockImplementation(async (_scope, change) => preview(change));
    server.use(
      http.post(base + operation, async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return success();
      }),
    );
    const onSaved = vi.fn<() => void>();
    const { user, read } = await start(
      kind,
      vi.fn<() => Promise<EntitlementView[]>>().mockResolvedValue([row]),
      true,
      onSaved,
    );
    await fill(user, label, value);
    await screen.findByRole("heading", { name: "Hak değişikliği onayı" });
    await user.click(screen.getByRole("checkbox", { name: /İncelediğim hak/ }));
    await user.click(screen.getByRole("button", { name: "Değişikliği uygula" }));
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
    expect(bodies[0]).toMatchObject({ expected_version: version, accepted_reservation_ids: [] });
    expect(onSaved).toHaveBeenCalledOnce();
    expect(bodies[0]).toMatchObject(
      operation === "negative_limit_set_v1"
        ? { person_id: person, discipline_id: id, allowed_negative_credits: 3 }
        : { sale_id: id, end_date: "2027-01-01" },
    );
  },
);
test("editing the reviewed quantity invalidates approval and requires a new preview", async () => {
  const inspect = vi
    .spyOn(rightsApi, "preview")
    .mockImplementation(async (_scope, change) => preview(change));
  const { user } = await start();
  await fill(user);
  await screen.findByRole("heading", { name: "Hak değişikliği onayı" });
  await user.clear(screen.getByLabelText("Kredi adedi"));
  await user.type(screen.getByLabelText("Kredi adedi"), "4");
  expect(screen.queryByRole("button", { name: "Değişikliği uygula" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Etkileri incele" }));
  await screen.findByRole("heading", { name: "Hak değişikliği onayı" });
  expect(inspect).toHaveBeenCalledTimes(2);
});
test.each(["changed", "person", "blocker", "expired"])("%s preview cannot apply", async (mode) => {
  vi.spyOn(rightsApi, "preview").mockImplementation(async (_scope, change) => {
    const result = preview(change, mode === "person");
    if (mode === "changed")
      result.change = { kind: "credit_adjust", sale_id: id, quantity: 99, direction: "increase" };
    if (mode === "person") result.affected[0]!.person_id = org;
    if (mode === "expired") result.preview.expires_at = "2020-01-01T00:00:00Z";
    if (mode === "blocker")
      result.preview.blockers = [{ code: "FORBIDDEN", retryable: false, trace_id: id }];
    return result;
  });
  const { user } = await start();
  await fill(user);
  await screen.findByRole("alert");
  const apply = screen.queryByRole("button", { name: "Değişikliği uygula" });
  expect(apply === null || (apply as HTMLButtonElement).disabled).toBe(true);
  expect(sessionStorage.getItem(setupStorageKey(scope, `rights:${person}`))).toBeNull();
});
test("uncertain write survives remount and denied rights read, then retries the same proof and key", async () => {
  const bodies: Record<string, unknown>[] = [];
  vi.spyOn(rightsApi, "preview").mockImplementation(async (_scope, change) => preview(change));
  server.use(
    http.post(base + "credit_adjust_v1", async ({ request }) => {
      bodies.push((await request.json()) as Record<string, unknown>);
      return bodies.length === 1 ? HttpResponse.error() : success();
    }),
  );
  const { user, view } = await start();
  await fill(user);
  await screen.findByRole("heading", { name: "Hak değişikliği onayı" });
  await user.click(screen.getByRole("checkbox", { name: /İncelediğim hak/ }));
  await user.click(screen.getByRole("button", { name: "Değişikliği uygula" }));
  await screen.findByRole("button", { name: "Aynı işlemi yeniden gönder" });
  view.unmount();
  render(
    <PersonEntitlements
      scope={scope}
      personId={person}
      management
      read={async () => {
        throw Error("Denied");
      }}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Hakları göster" }));
  await screen.findByText("Haklar okunamadı veya bu kişiye erişimin yok.");
  await user.click(screen.getByRole("button", { name: "Aynı işlemi yeniden gönder" }));
  await waitFor(() => expect(bodies).toHaveLength(2));
  expect({ ...bodies[0], request_id: undefined }).toEqual({ ...bodies[1], request_id: undefined });
  expect(bodies[0]!.request_id).not.toBe(bodies[1]!.request_id);
});
test("wrong center limits fail closed and changing operation resets target selection", async () => {
  vi.mocked(rightsApi.limits).mockResolvedValue({ ...limits, center_id: org });
  const { user } = await start(
    "Negatif limiti düzenle",
    vi.fn<() => Promise<EntitlementView[]>>().mockResolvedValue([row]),
    false,
  );
  await screen.findByRole("alert");
  expect(screen.queryByRole("button", { name: "Etkileri incele" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Kredi düzelt" }));
  expect(screen.getByRole("combobox", { name: "Düzenlenecek hak" })).toHaveValue("");
});
test("late preview after account switch cannot restore another actor approval", async () => {
  let resolve!: (value: ReservationProtectionPreview) => void;
  vi.spyOn(rightsApi, "preview").mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  function Switch() {
    const [actor, setActor] = useState(id);
    return (
      <>
        <button onClick={() => setActor(org)}>Switch actor</button>
        <PersonEntitlements
          scope={{ ...scope, actorId: actor }}
          personId={person}
          read={async () => [row]}
          management
        />
      </>
    );
  }
  const user = userEvent.setup();
  render(<Switch />);
  await user.click(screen.getByRole("button", { name: "Hakları göster" }));
  await user.click(await screen.findByRole("button", { name: "Kredi düzelt" }));
  await user.selectOptions(screen.getByRole("combobox", { name: "Düzenlenecek hak" }), id);
  await fill(user);
  await user.click(screen.getByRole("button", { name: "Switch actor" }));
  await act(async () =>
    resolve(preview({ kind: "credit_adjust", sale_id: id, quantity: 2, direction: "increase" })),
  );
  expect(screen.queryByRole("heading", { name: "Hak değişikliği onayı" })).not.toBeInTheDocument();
});
test("recovery rejects malformed proof, missing center and wrong person negative-limit slots", () => {
  const command = {
    operation: "negative_limit_set_v1",
    input: {
      org_id: org,
      center_id: center,
      operation_key: id,
      person_id: person,
      discipline_id: id,
      expected_version: 12,
      allowed_negative_credits: 0,
      reason: "Düzeltme",
      impact_approval: { id, token: "synthetic" },
      accepted_reservation_ids: [],
    },
  };
  sessionStorage.setItem(setupStorageKey(scope, `rights:${person}`), JSON.stringify({ command }));
  expect(recoverSetup(scope, `rights:${person}`)).toMatchObject({ command });
  sessionStorage.setItem(setupStorageKey(scope, `rights:${org}`), JSON.stringify({ command }));
  expect(recoverSetup(scope, `rights:${org}`)).toBe("invalid");
  const bad = { ...command, input: { ...command.input, center_id: undefined } };
  sessionStorage.setItem(
    setupStorageKey(scope, `rights:${person}`),
    JSON.stringify({ command: bad }),
  );
  expect(recoverSetup(scope, `rights:${person}`)).toBe("invalid");
});
test.each([
  { kind: "timed" as const, version: 7, sale_state: "active" as const },
  { kind: "credits" as const, version: undefined, sale_state: "active" as const },
  { kind: "credits" as const, version: 7, sale_state: "terminated" as const },
])("credit editor excludes timed, missing-version and inactive-sale rows: %j", async (fields) => {
  const user = userEvent.setup();
  render(
    <PersonEntitlements
      scope={scope}
      personId={person}
      read={async () => [{ ...row, ...fields }]}
      management
    />,
  );
  await user.click(screen.getByRole("button", { name: "Hakları göster" }));
  await user.click(await screen.findByRole("button", { name: "Kredi düzelt" }));
  expect(
    screen.getByRole("combobox", { name: "Düzenlenecek hak" }).querySelectorAll("option"),
  ).toHaveLength(1);
  expect(screen.queryByRole("button", { name: "Etkileri incele" })).not.toBeInTheDocument();
});
test("definitive stale write discards the old preview and never retries as a fresh command", async () => {
  vi.spyOn(rightsApi, "preview").mockImplementation(async (_scope, change) => preview(change));
  const writes: unknown[] = [];
  server.use(
    http.post(base + "credit_adjust_v1", async ({ request }) => {
      writes.push(await request.json());
      return HttpResponse.json(
        { ok: false, error: { code: "PREVIEW_STALE", retryable: false, trace_id: id } },
        { status: 409 },
      );
    }),
  );
  const { user } = await start();
  await fill(user);
  await screen.findByRole("heading", { name: "Hak değişikliği onayı" });
  await user.click(screen.getByRole("checkbox", { name: /İncelediğim hak/ }));
  await user.click(screen.getByRole("button", { name: "Değişikliği uygula" }));
  await waitFor(() =>
    expect(sessionStorage.getItem(setupStorageKey(scope, `rights:${person}`))).toBeNull(),
  );
  expect(writes).toHaveLength(1);
  expect(screen.queryByRole("button", { name: "Değişikliği uygula" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Etkileri incele" })).toBeEnabled();
});
test("native rights reads and previews retain explicit scope and fresh request ids", async () => {
  vi.mocked(rightsApi.limits).mockRestore();
  vi.mocked(rightsApi.session).mockRestore();
  const requests: Record<string, unknown>[] = [];
  server.use(
    http.post(base + "negative_limits_get_v1", async ({ request }) => {
      requests.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json({ ok: true, data: limits, trace_id: id });
    }),
    http.post(base + "reservation_impact_preview_v1", async ({ request }) => {
      const input = (await request.json()) as Record<string, unknown>;
      requests.push(input);
      return HttpResponse.json({
        ok: true,
        data: preview({
          kind: "negative_limit",
          person_id: person,
          discipline_id: id,
          allowed_negative_credits: 3,
        }),
        trace_id: id,
      });
    }),
  );
  expect(await rightsApi.limits(scope, person, id)).toEqual(limits);
  await rightsApi.preview(
    scope,
    { kind: "negative_limit", person_id: person, discipline_id: id, allowed_negative_credits: 3 },
    "Düzeltme",
  );
  expect(requests[0]).toMatchObject({
    org_id: org,
    center_id: center,
    person_id: person,
    discipline_id: id,
    client_api_version: 1,
  });
  expect(requests[1]).toMatchObject({
    org_id: org,
    center_id: center,
    reason: "Düzeltme",
    change: {
      kind: "negative_limit",
      person_id: person,
      discipline_id: id,
      allowed_negative_credits: 3,
    },
  });
  expect(requests[0]!.request_id).not.toBe(requests[1]!.request_id);
});
