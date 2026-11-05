import { getTranslations } from "next-intl/server";
import { FlowsPreview } from "../../../components/admin/flows-preview";
export async function generateMetadata() {
  return {
    title: (await getTranslations("flows"))("demoTitle"),
    robots: { index: false, follow: false },
  };
}
export default function Page() {
  return <FlowsPreview />;
}
