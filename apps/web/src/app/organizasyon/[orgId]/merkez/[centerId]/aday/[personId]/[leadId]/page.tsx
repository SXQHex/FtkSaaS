import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { validate } from "uuid";
import { serverClient } from "../../../../../../../../lib/supabase/server";
import { leadPath } from "../../../../../../../../lib/lead-route";
import { LeadPage } from "../../../../../../../../components/crm/lead-page";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return {
    title: (await getTranslations("crm"))("details"),
    robots: { index: false, follow: false },
  };
}
export default async function LeadRoute({
  params,
}: {
  params: Promise<{ orgId: string; centerId: string; personId: string; leadId: string }>;
}) {
  const { orgId, centerId, personId, leadId } = await params;
  if (![orgId, centerId, personId, leadId].every(validate)) notFound();
  const next = encodeURIComponent(leadPath(orgId, centerId, personId, leadId)),
    client = await serverClient();
  if (!client) redirect(`/login?next=${next}`);
  const result = await client.auth.getUser();
  if (result.error || !result.data.user) redirect(`/login?next=${next}`);
  const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) throw assurance.error;
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2")
    redirect(`/mfa?next=${next}`);
  return (
    <LeadPage
      key={`${result.data.user.id}:${orgId}:${centerId}:${personId}:${leadId}`}
      authUserId={result.data.user.id}
      orgId={orgId}
      centerId={centerId}
      personId={personId}
      leadId={leadId}
    />
  );
}
