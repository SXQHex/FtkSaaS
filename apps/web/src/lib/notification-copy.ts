import catalog from "../../public/notification-templates/v1.json";
export const notificationCatalog = catalog;
export function notificationCopy(kind: string, templateKey: string, language: string) {
  const locale = language === "en" ? "en" : "tr";
  const mapping = catalog.kind_mapping as Record<string, string>;
  const key = mapping[templateKey] ?? mapping[kind];
  if (!key) return null;
  const template = (catalog.templates as Record<string, { tr: string; en: string }>)[key];
  return template ? { language: locale, title: template[locale] } : null;
}
export function notificationEmail(
  kind: string,
  templateKey: string,
  language: string,
  organization: string,
  origin: string,
) {
  const copy = notificationCopy(kind, templateKey, language);
  if (!copy) throw Error("NOTIFICATION_UNAVAILABLE");
  const url = new URL(origin);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw Error("invalidSettings");
  const name = organization.replace(/[\r\n]/g, " ").slice(0, 100);
  return {
    catalog_version: catalog.version,
    language: copy.language,
    subject: catalog.email_subject.replace("{organization}", name).replace("{title}", copy.title),
    text: catalog.email_text[copy.language as "tr" | "en"].replace("{app_origin}", url.origin),
  };
}
