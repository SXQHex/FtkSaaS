import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { BackendError } from "../../lib/backend";
import { scopedBackend, type ClientScope } from "../../lib/scoped-backend";
import type { AgreementVersionView, DigitalAgreementView } from "../../lib/api-contracts/generated";

export interface AgreementDocumentBinding {
  scope: ClientScope;
  agreement: AgreementVersionView;
}
export async function readAgreementDocument(binding: AgreementDocumentBinding) {
  const view = await (
    await scopedBackend(binding.scope)
  ).call("instructor_agreement_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: binding.scope.orgId,
    center_id: binding.scope.centerId,
    agreement_id: binding.agreement.id,
  });
  const expected = binding.agreement,
    actual = view.agreement;
  // Self discovery authorizes historical aliases. Do not rewrite their immutable person IDs.
  if (
    actual.id !== expected.id ||
    actual.center_id !== binding.scope.centerId ||
    actual.person_id !== expected.person_id ||
    actual.discipline_id !== expected.discipline_id ||
    actual.version !== expected.version ||
    actual.format !== expected.format
  )
    throw Error("AGREEMENT_DOCUMENT_UNAVAILABLE");
  z.string().min(1).parse(view.source_content_hash);
  const doc = view.rendered_document;
  if (doc) {
    z.uuid().parse(doc.id);
    z.string().min(1).parse(doc.content_hash);
    z.iso.datetime({ offset: true }).parse(doc.created_at);
    if (
      view.document_error ||
      doc.source_version !== actual.id ||
      doc.source_content_hash !== view.source_content_hash ||
      doc.language !== doc.content.language
    )
      throw Error("AGREEMENT_DOCUMENT_UNAVAILABLE");
    for (const value of [
      doc.content.name,
      doc.content.text,
      doc.content.language,
      doc.content.template_id,
      doc.content.template_version,
    ])
      z.string().min(1).parse(value);
  } else if (view.document_error !== "POLICY_NOT_CONFIGURED")
    throw Error("AGREEMENT_DOCUMENT_UNAVAILABLE");
  if (view.acceptance) {
    const acceptance = view.acceptance;
    for (const value of [acceptance.id, acceptance.account_id, acceptance.person_id])
      z.uuid().parse(value);
    z.iso.datetime({ offset: true }).parse(acceptance.accepted_at);
    if (acceptance.agreement_id !== actual.id) throw Error("AGREEMENT_DOCUMENT_UNAVAILABLE");
  }
  return view;
}
export function ownServerAcceptance(view: DigitalAgreementView, accountId: string) {
  const a = view.acceptance,
    d = view.rendered_document;
  return !!(
    a &&
    d &&
    a.evidence_kind === "server_document" &&
    a.account_id === accountId &&
    a.agreement_id === view.agreement.id &&
    a.rendered_document_id === d.id &&
    a.content_hash === d.content_hash &&
    a.source_content_hash === view.source_content_hash
  );
}
export async function prepareAgreementAcceptance(
  binding: AgreementDocumentBinding,
  before: DigitalAgreementView,
  reviewed: boolean,
) {
  if (
    !reviewed ||
    !before.rendered_document ||
    before.document_error ||
    ownServerAcceptance(before, binding.scope.accountId)
  )
    throw Error("AGREEMENT_REVIEW_REQUIRED");
  const fresh = await readAgreementDocument(binding);
  if (
    !fresh.rendered_document ||
    fresh.document_error ||
    fresh.rendered_document.id !== before.rendered_document.id ||
    fresh.rendered_document.content_hash !== before.rendered_document.content_hash ||
    fresh.source_content_hash !== before.source_content_hash ||
    ownServerAcceptance(fresh, binding.scope.accountId)
  )
    throw new BackendError({ code: "VERSION_CONFLICT", retryable: false, trace_id: uuidv7() });
  return {
    binding: structuredClone(binding),
    documentId: fresh.rendered_document.id,
    documentHash: fresh.rendered_document.content_hash,
    sourceHash: fresh.source_content_hash,
    key: uuidv7(),
  };
}
export type AgreementAcceptanceIntent = Awaited<ReturnType<typeof prepareAgreementAcceptance>>;
export async function acceptAgreementDocument(intent: AgreementAcceptanceIntent) {
  const { scope, agreement } = intent.binding;
  const result = await (
    await scopedBackend(scope)
  ).call("instructor_agreement_accept_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    center_id: scope.centerId,
    agreement_id: agreement.id,
    expected_version: agreement.version,
    source_content_hash: intent.sourceHash,
    rendered_document_id: intent.documentId,
    operation_key: intent.key,
  });
  if (result.primary_id !== agreement.id) throw Error("AGREEMENT_ACCEPTANCE_ACK_UNAVAILABLE");
  return result;
}
export async function readAgreementAcceptanceReceipt(intent: AgreementAcceptanceIntent) {
  const { scope, agreement } = intent.binding;
  const result = await (
    await scopedBackend(scope)
  ).call("operation_status_get_v1", {
    client_api_version: 1,
    request_id: uuidv7(),
    org_id: scope.orgId,
    operation: "instructor_agreement_accept_v1",
    key: intent.key,
  });
  if (
    result.operation !== "instructor_agreement_accept_v1" ||
    result.key !== intent.key ||
    (result.result_reference &&
      (result.result_reference.type !== "instructor_agreements" ||
        result.result_reference.id !== agreement.id))
  )
    throw Error("AGREEMENT_ACCEPTANCE_RECEIPT_UNAVAILABLE");
  return result;
}
export async function readAgreementAcceptanceResult(
  intent: AgreementAcceptanceIntent,
  id?: string,
) {
  if (id && id !== intent.binding.agreement.id) throw Error("AGREEMENT_ACCEPTANCE_UNAVAILABLE");
  const view = await readAgreementDocument(intent.binding);
  if (
    !ownServerAcceptance(view, intent.binding.scope.accountId) ||
    view.rendered_document?.id !== intent.documentId ||
    view.rendered_document.content_hash !== intent.documentHash ||
    view.source_content_hash !== intent.sourceHash
  )
    throw Error("AGREEMENT_ACCEPTANCE_UNAVAILABLE");
  return view;
}
