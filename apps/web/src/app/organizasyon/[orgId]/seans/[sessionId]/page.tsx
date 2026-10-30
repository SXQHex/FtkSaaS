import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { validate as isUuid } from "uuid";
import { serverClient } from "../../../../../lib/supabase/server";
import { sessionPath } from "../../../../../lib/session-route";
import { SessionPage } from "../../../../../components/calendar/session-page";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return {
    title: (await getTranslations("calendar"))("detailTitle"),
    robots: { index: false, follow: false },
  };
}
export default async function SessionRoute({
  params,
}: {
  params: Promise<{ orgId: string; sessionId: string }>;
}) {
  const { orgId, sessionId } = await params;
  if (!isUuid(orgId) || !isUuid(sessionId)) notFound();
  const next = encodeURIComponent(sessionPath(orgId, sessionId));
  const client = await serverClient();
  if (!client) redirect(`/login?next=${next}`);
  const result = await client.auth.getUser();
  if (!result.data.user || result.error) redirect(`/login?next=${next}`);
  const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) throw assurance.error;
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2")
    redirect(`/mfa?next=${next}`);
  return (
    <SessionPage
      key={`${orgId}:${sessionId}:${result.data.user.id}`}
      orgId={orgId}
      sessionId={sessionId}
      actorId={result.data.user.id}
    />
  );
}
