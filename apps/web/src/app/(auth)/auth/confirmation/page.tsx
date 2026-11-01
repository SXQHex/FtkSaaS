import { getTranslations } from "next-intl/server";
import { CallbackConfirmation } from "../../../../components/auth/callback-confirmation";
import { safeReturnPath } from "../../../../lib/config";

export async function generateMetadata() {
  return { title: (await getTranslations("auth"))("confirmationTitle") };
}

export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return <CallbackConfirmation returnTo={safeReturnPath(next)} />;
}
