import { useTranslation } from "react-i18next";
import { SchemaForm } from "./schema-form";

export default function FormPreview() {
  const { t } = useTranslation("common");
  return (
    <main className="p-6">
      <h1>{t(($) => $.formExample.title)}</h1>
      <SchemaForm />
    </main>
  );
}
