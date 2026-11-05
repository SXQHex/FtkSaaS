import { useState } from "react";
import { beforeEach, expect, test, vi } from "vitest";
import { screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ProductView, EntitlementView } from "@ftksaas/api-contracts";
import { render } from "./render";
import { server } from "./mocks/server";
import { ProductManager } from "../src/components/products/product-manager";
import { PersonEntitlements } from "../src/components/products/person-entitlements";
import { productTerms } from "../src/lib/product-terms";
import { listProducts, productDisciplines, readEntitlements } from "../src/lib/products";
import { recoverSetup, setupStorageKey } from "../src/lib/studio-setup";
vi.mock("../src/lib/supabase/client", () => ({
  browserClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: { access_token: "synthetic" } }, error: null }),
    },
  }),
}));
const id = "019a2b3c-4d5e-7000-8000-000000000080",
  other = "019a2b3c-4d5e-7000-8000-000000000081",
  center = "019a2b3c-4d5e-7000-8000-000000000082";
const scope = { actorId: id, orgId: other, centerId: center },
  discipline = { id, name: "Salsa", state: "active" as const, version: 1 };
const terms = productTerms(
  {
    name: "Başlangıç",
    disciplineId: id,
    kind: "credits",
    bookingMode: "flexible",
    credits: "8",
    price: "100.50",
    currency: "TRY",
    quotaPeriod: "week",
    quotaLimit: "4",
    refund: "none",
    usedUnitPrice: "",
  },
  discipline,
  center,
);
const product: ProductView = { id, version_id: other, terms };
const endpoint = "https://project.example.invalid/functions/v1/backend-v1/product_publish_v1";
beforeEach(() => {
  sessionStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.example.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "synthetic");
});
function reads() {
  return {
    list: vi
      .fn<typeof listProducts>()
      .mockResolvedValue({ items: [product], next_cursor: null, as_of: "2026-11-05T00:00:00Z" }),
    disciplines: vi.fn<typeof productDisciplines>().mockResolvedValue([discipline]),
  };
}
async function fill(user: ReturnType<typeof userEvent.setup>, kind = "credits") {
  const disciplineControl = await screen.findByRole("combobox", { name: "Disiplin" });
  if (!(disciplineControl as HTMLSelectElement).disabled)
    await user.selectOptions(disciplineControl, id);
  const name = screen.getByRole("textbox", { name: /Paket adı/ });
  if (!(name as HTMLInputElement).readOnly) await user.type(name, "Yeni");
  await user.selectOptions(screen.getByRole("combobox", { name: "Paket türü" }), kind);
  if (kind === "credits")
    await user.type(screen.getByRole("spinbutton", { name: "Kredi adedi" }), "8");
  if (kind === "quota")
    await user.type(screen.getByRole("spinbutton", { name: "Dönem kotası" }), "4");
  await user.type(screen.getByRole("textbox", { name: "Para birimi" }), "TRY");
  await user.type(screen.getByRole("textbox", { name: "Fiyat" }), "123,45");
  await user.click(screen.getByRole("button", { name: "Yayını incele" }));
}
function success() {
  return HttpResponse.json({
    ok: true,
    data: { primary_id: id, operation_id: other, replayed: false, related: [] },
    trace_id: id,
  });
}
test.each(["credits", "quota", "unlimited"])(
  "%s publication requires review and records before sending, then rereads",
  async (kind) => {
    const user = userEvent.setup(),
      api = reads(),
      bodies: Record<string, unknown>[] = [];
    server.use(
      http.post(endpoint, async ({ request }) => {
        expect(sessionStorage.getItem(setupStorageKey(scope, "product-publish"))).not.toBeNull();
        bodies.push((await request.json()) as Record<string, unknown>);
        return success();
      }),
    );
    render(<ProductManager scope={scope} {...api} />);
    await user.click(screen.getByRole("button", { name: "Yeni paket yayımla" }));
    await fill(user, kind);
    expect(bodies).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Bu sürümü yayımla" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Bu sürümü yayımla" }));
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({
      org_id: other,
      center_id: center,
      terms: {
        name: "Salsa Yeni",
        kind: kind === "credits" ? "credits" : "timed",
        price_minor: "12345",
      },
    });
    expect(bodies[0]).not.toHaveProperty("product_id");
    expect(screen.getByRole("heading", { name: "Paket kataloğu" })).toHaveFocus();
  },
);
test("new versions target the product id and editing invalidates the reviewed snapshot", async () => {
  const user = userEvent.setup(),
    api = reads(),
    bodies: Record<string, unknown>[] = [];
  server.use(
    http.post(endpoint, async ({ request }) => {
      bodies.push((await request.json()) as Record<string, unknown>);
      return success();
    }),
  );
  render(<ProductManager scope={scope} {...api} />);
  await user.click(await screen.findByRole("button", { name: "Salsa Başlangıç için yeni sürüm" }));
  await fill(user);
  expect(screen.getByRole("textbox", { name: "Paket adı" })).toHaveAttribute("readonly");
  expect(screen.getByRole("combobox", { name: "Disiplin" })).toBeDisabled();
  await user.clear(screen.getByRole("textbox", { name: "Fiyat" }));
  await user.type(screen.getByRole("textbox", { name: "Fiyat" }), "200.50");
  expect(screen.queryByRole("button", { name: "Bu sürümü yayımla" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Yayını incele" }));
  await user.click(screen.getByRole("button", { name: "Bu sürümü yayımla" }));
  await waitFor(() => expect(bodies).toHaveLength(1));
  expect(bodies[0]).toMatchObject({
    product_id: id,
    terms: { name: "Salsa Başlangıç", price_minor: "20050" },
  });
  expect(product.terms.name).toBe("Salsa Başlangıç");
});
test("uncertain publication survives denied catalog reads and replays the identical version input/key", async () => {
  const user = userEvent.setup(),
    api = reads(),
    bodies: Record<string, unknown>[] = [];
  server.use(
    http.post(endpoint, async ({ request }) => {
      bodies.push((await request.json()) as Record<string, unknown>);
      return bodies.length === 1 ? HttpResponse.error() : success();
    }),
  );
  const view = render(<ProductManager scope={scope} {...api} />);
  await user.click(screen.getByRole("button", { name: "Yeni paket yayımla" }));
  await fill(user);
  await user.click(screen.getByRole("button", { name: "Bu sürümü yayımla" }));
  await screen.findByRole("button", { name: "Aynı işlemi yeniden gönder" });
  view.unmount();
  api.list.mockRejectedValue(Error("denied"));
  render(<ProductManager scope={scope} {...api} />);
  await screen.findByRole("alert");
  await user.click(screen.getByRole("button", { name: "Aynı işlemi yeniden gönder" }));
  await waitFor(() => expect(bodies).toHaveLength(2));
  expect(bodies[1]).toMatchObject({
    terms: bodies[0]?.terms,
    operation_key: bodies[0]?.operation_key,
  });
  expect(bodies[1]?.request_id).not.toBe(bodies[0]?.request_id);
});
test("an unverified discipline cannot open publication fields", async () => {
  const api = reads();
  api.disciplines.mockRejectedValue(Error("denied"));
  render(<ProductManager scope={scope} {...api} />);
  await userEvent.click(screen.getByRole("button", { name: "Yeni paket yayımla" }));
  await screen.findByRole("alert");
  expect(screen.queryByRole("textbox", { name: "Fiyat" })).not.toBeInTheDocument();
});
test("journal recovery rejects changed scope or hidden product terms", () => {
  const key = setupStorageKey(scope, "product-publish"),
    input = { org_id: other, center_id: center, operation_key: id, terms };
  sessionStorage.setItem(
    key,
    JSON.stringify({ command: { operation: "product_publish_v1", input } }),
  );
  expect(recoverSetup(scope, "product-publish")).toMatchObject({ command: { input } });
  for (const changed of [
    { ...input, center_id: undefined },
    { ...input, person_id: id },
    { ...input, terms: { ...terms, extra: true } },
    { ...input, terms: { ...terms, scopes: [{ ...terms.scopes[0], center_id: id }] } },
  ]) {
    sessionStorage.setItem(
      key,
      JSON.stringify({ command: { operation: "product_publish_v1", input: changed } }),
    );
    expect(recoverSetup(scope, "product-publish")).toBe("invalid");
  }
});
const right: EntitlementView = {
  sale_id: id,
  person_id: other,
  start_date: "2026-11-01",
  end_date: "2026-12-01",
  timezone: "Europe/Istanbul",
  state: "active",
  available: 8,
  reserved: 2,
  consumed: 1,
  deficit: 0,
  quotas: [],
  deficit_scopes: [],
  kind: "credits",
};
test("purchased rights are lazy and timed availability is never presented as credits", async () => {
  const user = userEvent.setup(),
    read = vi
      .fn<typeof readEntitlements>()
      .mockResolvedValue([{ ...right, kind: "timed", available: 1 }]);
  render(<PersonEntitlements scope={scope} personId={other} read={read} />);
  expect(read).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Hakları göster" }));
  await screen.findByText(/Süreli hakta kullanılabilirlik/);
  expect(screen.queryByText("Kullanılabilir kredi")).not.toBeInTheDocument();
  expect(read).toHaveBeenCalledWith(scope, other);
});
test("wrong-person rights are rejected and late content cannot survive a scope change", async () => {
  const read = vi.fn<typeof readEntitlements>().mockResolvedValue([{ ...right, person_id: id }]);
  render(<EntitlementScopeSwitch read={read} />);
  await userEvent.click(screen.getByRole("button", { name: "Hakları göster" }));
  await screen.findByRole("alert");
  expect(screen.queryByText("Kullanılabilir kredi")).not.toBeInTheDocument();
  let finish!: (value: EntitlementView[]) => void;
  read.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Yeniden yükle" }));
  await userEvent.click(screen.getByRole("button", { name: "Hesabı değiştir" }));
  await act(async () => finish([right]));
  expect(screen.queryByText("Kullanılabilir kredi")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Hakları göster" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});

function EntitlementScopeSwitch({ read }: { read: typeof readEntitlements }) {
  const [changed, setChanged] = useState(false);
  return (
    <>
      <button onClick={() => setChanged(true)}>Hesabı değiştir</button>
      <PersonEntitlements
        scope={changed ? { ...scope, actorId: other } : scope}
        personId={other}
        read={read}
      />
    </>
  );
}

test("a wider existing product cannot be silently narrowed by the Starter version form", async () => {
  const api = reads();
  api.list.mockResolvedValue({
    items: [{ ...product, terms: { ...terms, freeze: { enabled: true, extends_validity: true } } }],
    next_cursor: null,
    as_of: "2026-11-05T00:00:00Z",
  });
  render(<ProductManager scope={scope} {...api} />);
  await userEvent.click(
    await screen.findByRole("button", { name: "Salsa Başlangıç için yeni sürüm" }),
  );
  await screen.findByText(/Farklı kapsam ya da dondurma içeren ürün/);
  expect(screen.queryByRole("textbox", { name: "Fiyat" })).not.toBeInTheDocument();
});
test("switching a credit-ratio product to timed removes the incompatible refund choice", async () => {
  const user = userEvent.setup();
  render(<ProductManager scope={scope} {...reads()} />);
  await user.click(screen.getByRole("button", { name: "Yeni paket yayımla" }));
  await screen.findByRole("combobox", { name: "Disiplin" });
  await user.selectOptions(screen.getByRole("combobox", { name: "İade hesabı" }), "credit_ratio");
  await user.selectOptions(screen.getByRole("combobox", { name: "Paket türü" }), "quota");
  expect(screen.getByRole("combobox", { name: "İade hesabı" })).toHaveValue("none");
  expect(
    screen.queryByRole("option", { name: "Kullanılmamış kredi oranı" }),
  ).not.toBeInTheDocument();
});
test("native catalog and right readers preserve scoped IDs and explicitly include timed data", async () => {
  const bodies: Record<string, unknown>[] = [];
  server.use(
    http.post(
      "https://project.example.invalid/functions/v1/backend-v1/products_list_v1",
      async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({
          ok: true,
          data: { items: [], next_cursor: null, as_of: "2026-11-05T00:00:00Z" },
          trace_id: id,
        });
      },
    ),
    http.post(
      "https://project.example.invalid/functions/v1/backend-v1/entitlements_get_v1",
      async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ ok: true, data: [], trace_id: id });
      },
    ),
  );
  await listProducts(scope, "cursor");
  await readEntitlements(scope, other);
  expect(bodies[0]).toMatchObject({
    org_id: other,
    center_id: center,
    include_timed_products: true,
    page: { limit: 25, sort: "created_at_asc", cursor: "cursor" },
  });
  expect(bodies[1]).toMatchObject({
    org_id: other,
    center_id: center,
    person_id: other,
    include_timed_rights: true,
  });
  expect(bodies[0]).not.toHaveProperty("actorId");
  expect(bodies[0]?.request_id).not.toBe(bodies[1]?.request_id);
});
