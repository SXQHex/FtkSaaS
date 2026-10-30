import { getTranslations } from "next-intl/server";
import { AuthFields } from "../../../components/auth/auth-fields";
import { publicConfig } from "../../../lib/config";
export async function generateMetadata() {
  return { title: (await getTranslations("auth"))("recoveryTitle") };
}
export default function RecoveryPage() {
  return (
    <>
      <AuthFields mode="recovery" configured={!!publicConfig()} />
    </>
  );
}
