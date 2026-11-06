import { useState } from "react";
import { beforeEach, expect, test, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "./render";
import { ProProductFields } from "../src/components/products/pro-product-fields";
import type { ProductDraft } from "../src/lib/product-terms";
const call = vi.hoisted(() => vi.fn<typeof import("../src/lib/studio-setup").setupCall>());
vi.mock("../src/lib/studio-setup", async (load) => ({
  ...(await load<typeof import("../src/lib/studio-setup")>()),
  setupCall: call,
}));
const id = "019a2b3c-4d5e-7000-8000-000000000001",
  discipline = "019a2b3c-4d5e-7000-8000-000000000002",
  scope = { actorId: id, orgId: id, centerId: id };
const base: ProductDraft = {
  name: "Pro",
  disciplineId: "",
  kind: "credits",
  bookingMode: "flexible",
  credits: "8",
  price: "100",
  currency: "TRY",
  quotaPeriod: "month",
  quotaLimit: "",
  refund: "none",
  usedUnitPrice: "",
};
const ready = vi.fn<(ready: boolean) => void>();
function Harness({ initial = base }: { initial?: ProductDraft }) {
  const [draft, setDraft] = useState(initial);
  return (
    <>
      <ProProductFields
        scope={scope}
        draft={draft}
        onChange={setDraft}
        onReady={ready}
        disabled={false}
        disciplines={[{ id: discipline, name: "Tango", state: "active", version: 1 }]}
      />
      <output aria-label="draft">{JSON.stringify(draft)}</output>
    </>
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  call.mockResolvedValue({ plan: "pro" } as Awaited<ReturnType<typeof call>>);
});
test("first explicit Pro discipline replaces an empty base selection instead of retaining a ghost scope", async () => {
  render(<Harness />);
  const user = userEvent.setup();
  await user.click(await screen.findByLabelText("Tango"));
  const draft = JSON.parse(screen.getByLabelText("draft").textContent!);
  expect(draft.scopes).toEqual([
    {
      scope_kind: "center_discipline",
      center_id: id,
      discipline_id: discipline,
      usage_targets: ["lesson"],
    },
  ]);
});
test("heterogeneous restricted scopes remain intact while freeze terms change", async () => {
  const scopes: NonNullable<ProductDraft["scopes"]> = [
    {
      scope_kind: "center_discipline",
      center_id: id,
      discipline_id: discipline,
      class_id: id,
      usage_targets: ["lesson"],
    },
    {
      scope_kind: "center_discipline",
      center_id: id,
      discipline_id: discipline,
      event_id: id,
      usage_targets: ["event"],
    },
  ];
  render(<Harness initial={{ ...base, scopes }} />);
  const user = userEvent.setup();
  await user.click(await screen.findByLabelText("Dondurma kullanılabilir"));
  const draft = JSON.parse(screen.getByLabelText("draft").textContent!);
  expect(draft.scopes).toEqual(scopes);
  expect(draft.freeze).toEqual({ enabled: true, extends_validity: false });
  expect(screen.queryByLabelText("Merkezdeki tüm disiplinler")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Tango")).not.toBeInTheDocument();
});
