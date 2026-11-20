import { beforeEach, expect, it, vi } from "vitest";
import { BackendError } from "../../lib/backend";
import type { AgreementVersionView, DigitalAgreementView } from "@ftksaas/api-contracts";
import {
  readAgreementDocument,
  ownServerAcceptance,
  prepareAgreementAcceptance,
  acceptAgreementDocument,
  readAgreementAcceptanceReceipt,
  readAgreementAcceptanceResult,
} from "./agreement-document";
const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("../../lib/scoped-backend", () => ({ scopedBackend: async () => ({ call }) }));
const id = (n: number) => `019ab7b0-0000-7000-8000-${String(n).padStart(12, "0")}`;
const scope = { accountId: id(1), orgId: id(2), centerId: id(3) };
const agreement: AgreementVersionView = {
  id: id(4),
  person_id: id(99),
  center_id: scope.centerId,
  discipline_id: id(5),
  version: 2,
  format: "group" as const,
  valid: { starts_at: "2026-01-01T00:00:00Z", ends_at: null },
  supersedes_id: id(8),
  published_at: "2026-01-01T00:00:00Z",
  terms: {
    model: "session_fixed" as const,
    currency: "TRY",
    components: [{ kind: "session_fixed" as const, amount_minor: "25000" }],
    room_fee: { kind: "free" as const, order: "before_instructor_share" as const },
  },
};
const binding = { scope, agreement };
let view: DigitalAgreementView;
beforeEach(() => {
  view = {
    agreement: structuredClone(agreement),
    source_content_hash: "facts-hash",
    acceptance: null,
    document_error: null,
    rendered_document: {
      id: id(6),
      source_version: agreement.id,
      source_content_hash: "facts-hash",
      content_hash: "document-hash",
      language: "tr",
      created_at: "2026-11-18T00:00:00Z",
      content: {
        name: "Sentetik anlaşma",
        language: "tr",
        template_id: "instructor",
        template_version: "1",
        text: "Sentetik onaylı şartlar.",
      },
    },
  };
  call
    .mockReset()
    .mockImplementation(async (op: string) =>
      op === "instructor_agreement_get_v1" ? structuredClone(view) : { primary_id: agreement.id },
    );
});
function accepted() {
  view.acceptance = {
    id: id(7),
    account_id: scope.accountId,
    person_id: id(9),
    agreement_id: agreement.id,
    rendered_document_id: view.rendered_document!.id,
    evidence_kind: "server_document",
    accepted_at: "2026-11-18T00:01:00Z",
    content_hash: view.rendered_document!.content_hash,
    source_content_hash: view.source_content_hash,
    displayed_content: structuredClone(view.rendered_document!.content),
  };
}
it("reads a discovered historical alias without rewriting its immutable facts or borrowing a different center", async () => {
  await expect(readAgreementDocument(binding)).resolves.toMatchObject({
    agreement: { person_id: id(99), version: 2 },
  });
  expect(call.mock.calls[0]).toEqual([
    "instructor_agreement_get_v1",
    expect.objectContaining({
      org_id: scope.orgId,
      center_id: scope.centerId,
      agreement_id: agreement.id,
    }),
  ]);
  view.agreement.center_id = id(50);
  await expect(readAgreementDocument(binding)).rejects.toThrow("AGREEMENT_DOCUMENT_UNAVAILABLE");
});
it("accepts a missing approved source as unavailable, while rejecting mismatched document binding", async () => {
  const before = structuredClone(view);
  view.rendered_document = null;
  view.document_error = "POLICY_NOT_CONFIGURED";
  await expect(readAgreementDocument(binding)).resolves.toMatchObject({
    rendered_document: null,
    document_error: "POLICY_NOT_CONFIGURED",
  });
  await expect(prepareAgreementAcceptance(binding, view, true)).rejects.toThrow(
    "AGREEMENT_REVIEW_REQUIRED",
  );
  view = structuredClone(before);
  view.rendered_document!.source_version = id(55);
  await expect(readAgreementDocument(binding)).rejects.toThrow("AGREEMENT_DOCUMENT_UNAVAILABLE");
  view = before;
  view.rendered_document!.source_content_hash = "different";
  await expect(readAgreementDocument(binding)).rejects.toThrow("AGREEMENT_DOCUMENT_UNAVAILABLE");
});
it("requires consent and rechecks the exact displayed document before creating a frozen intent", async () => {
  await expect(prepareAgreementAcceptance(binding, view, false)).rejects.toThrow(
    "AGREEMENT_REVIEW_REQUIRED",
  );
  const before = structuredClone(view);
  view.rendered_document!.id = id(77);
  await expect(prepareAgreementAcceptance(binding, before, true)).rejects.toMatchObject({
    code: "VERSION_CONFLICT",
  });
  expect(call.mock.calls.every(([op]) => op === "instructor_agreement_get_v1")).toBe(true);
});
it("sends only the native document reference and pinned version/hash; retries reuse the operation key", async () => {
  const intent = await prepareAgreementAcceptance(binding, view, true);
  await acceptAgreementDocument(intent);
  await acceptAgreementDocument(intent);
  const writes = call.mock.calls.filter(([op]) => op === "instructor_agreement_accept_v1");
  expect(writes[0]![1]).toEqual({
    client_api_version: 1,
    request_id: expect.any(String),
    org_id: scope.orgId,
    center_id: scope.centerId,
    agreement_id: agreement.id,
    expected_version: 2,
    source_content_hash: "facts-hash",
    rendered_document_id: id(6),
    operation_key: intent.key,
  });
  expect(writes[1]![1].operation_key).toBe(intent.key);
  expect(writes[1]![1].request_id).not.toBe(writes[0]![1].request_id);
  expect(writes[0]![1]).not.toHaveProperty("displayed_content");
});
it("validates receipt operation/key/entity and the exact primary agreement acknowledgement", async () => {
  const intent = await prepareAgreementAcceptance(binding, view, true);
  call.mockResolvedValue({ primary_id: id(88) });
  await expect(acceptAgreementDocument(intent)).rejects.toThrow(
    "AGREEMENT_ACCEPTANCE_ACK_UNAVAILABLE",
  );
  call.mockResolvedValue({
    operation: "instructor_agreement_accept_v1",
    key: intent.key,
    status: "succeeded",
    result_reference: { type: "instructor_agreements", id: agreement.id },
  });
  await expect(readAgreementAcceptanceReceipt(intent)).resolves.toMatchObject({
    status: "succeeded",
  });
  call.mockResolvedValue({
    operation: "instructor_agreement_accept_v1",
    key: intent.key,
    result_reference: { type: "instructor_agreements", id: id(88) },
  });
  await expect(readAgreementAcceptanceReceipt(intent)).rejects.toThrow(
    "AGREEMENT_ACCEPTANCE_RECEIPT_UNAVAILABLE",
  );
});
it("requires the current account's matching server evidence, including for canonical aliases", async () => {
  const intent = await prepareAgreementAcceptance(binding, view, true);
  await expect(readAgreementAcceptanceResult(intent)).rejects.toThrow(
    "AGREEMENT_ACCEPTANCE_UNAVAILABLE",
  );
  accepted();
  await expect(readAgreementAcceptanceResult(intent)).resolves.toMatchObject({
    acceptance: { person_id: id(9), account_id: scope.accountId },
  });
  view.acceptance!.account_id = id(99);
  expect(ownServerAcceptance(view, scope.accountId)).toBe(false);
  await expect(readAgreementAcceptanceResult(intent)).rejects.toThrow(
    "AGREEMENT_ACCEPTANCE_UNAVAILABLE",
  );
  view.acceptance!.account_id = scope.accountId;
  view.acceptance!.evidence_kind = "legacy_client";
  expect(ownServerAcceptance(view, scope.accountId)).toBe(false);
});
it("does not resubmit an accepted server document and propagates native access denial", async () => {
  accepted();
  await expect(prepareAgreementAcceptance(binding, view, true)).rejects.toThrow(
    "AGREEMENT_REVIEW_REQUIRED",
  );
  call.mockRejectedValue(
    new BackendError({ code: "FORBIDDEN", retryable: false, trace_id: id(8) }),
  );
  await expect(readAgreementDocument(binding)).rejects.toMatchObject({ code: "FORBIDDEN" });
});
