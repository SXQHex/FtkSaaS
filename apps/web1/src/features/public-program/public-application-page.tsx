import { getRouteApi } from "@tanstack/react-router";
import { PublicShell } from "./public-shell";
import { PublicApplicationView } from "./public-application-view";

const route = getRouteApi("/public/$slug/apply");
export function PublicApplicationRoutePage() {
  const { slug } = route.useParams();
  const calendarHref = `/public/${encodeURIComponent(slug)}/calendar`;
  // No form/consent target is inferred from a slug or from the visitor's native account.
  return (
    <PublicShell calendarHref={calendarHref}>
      <PublicApplicationView />
    </PublicShell>
  );
}
