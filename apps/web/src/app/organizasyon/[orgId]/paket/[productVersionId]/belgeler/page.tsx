import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { validate as isUuid } from "uuid";
import { serverClient } from "../../../../../../lib/supabase/server";
import { saleDocumentPath } from "../../../../../../lib/sale-document-route";
import { SaleDocumentsPage } from "../../../../../../components/documents/sale-documents-page";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return {
    title: (await getTranslations("documents"))("saleTitle"),
    robots: { index: false, follow: false },
  };
}
export default async function SaleDocumentsRoute({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string; productVersionId: string }>;
  searchParams?: Promise<{ center?: string | string[] }>;
}) {
  const { orgId, productVersionId } = await params;
  const center = (await searchParams)?.center;
  if (!isUuid(orgId) || !isUuid(productVersionId) || typeof center !== "string" || !isUuid(center))
    notFound();
  const next = encodeURIComponent(saleDocumentPath(orgId, center, productVersionId));
  const client = await serverClient();
  if (!client) redirect(`/login?next=${next}`);
  const result = await client.auth.getUser();
  if (!result.data.user || result.error) redirect(`/login?next=${next}`);
  const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) throw assurance.error;
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2")
    redirect(`/mfa?next=${next}`);
  return (
    <SaleDocumentsPage
      key={`${orgId}:${center}:${productVersionId}:${result.data.user.id}`}
      orgId={orgId}
      centerId={center}
      productVersionId={productVersionId}
      authUserId={result.data.user.id}
    />
  );
}
