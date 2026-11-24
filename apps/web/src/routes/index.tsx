import { hasSupabaseConfig } from "../lib/public-config";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { HomePage } from "../components/home-page";

export const Route = createFileRoute("/")({
  beforeLoad: ({ location }) => {
    if (import.meta.env.DEV) {
      const search = new URLSearchParams(location.searchStr);
      if (["__home_example", "__form_example", "__states_example"].some((key) => search.has(key)))
        return;
    }
    const configured = hasSupabaseConfig();
    throw redirect({ to: configured ? "/account" : "/login" });
  },
  component: import.meta.env.DEV ? HomePage : undefined,
});
