import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { validate } from "uuid";
import { serverClient } from "../../../../../../../lib/supabase/server";
import { personPath } from "../../../../../../../lib/person-route";
import { PersonPage } from "../../../../../../../components/students/person-page";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return {
    title: (await getTranslations("students"))("detailTitle"),
    robots: { index: false, follow: false },
  };
}
export default async function PersonRoute({
  params,
}: {
  params: Promise<{ orgId: string; centerId: string; personId: string }>;
}) {
  const { orgId, centerId, personId } = await params;
  if (![orgId, centerId, personId].every(validate)) notFound();
  const next = encodeURIComponent(personPath(orgId, centerId, personId)),
    client = await serverClient();
  if (!client) redirect(`/login?next=${next}`);
  const result = await client.auth.getUser();
  if (result.error || !result.data.user) redirect(`/login?next=${next}`);
  const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) throw assurance.error;
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2")
    redirect(`/mfa?next=${next}`);
  return (
    <PersonPage
      key={`${result.data.user.id}:${orgId}:${centerId}:${personId}`}
      authUserId={result.data.user.id}
      orgId={orgId}
      centerId={centerId}
      personId={personId}
    />
  );
}
