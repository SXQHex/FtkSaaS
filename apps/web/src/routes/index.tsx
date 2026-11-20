import { createFileRoute, redirect } from "@tanstack/react-router";
import { HomePage } from "../components/home-page";

export const Route = createFileRoute("/")({
  beforeLoad: ({ location }) => {
    if (import.meta.env.DEV) {
      const search = new URLSearchParams(location.searchStr);
      if (["__home_example", "__form_example", "__states_example"].some((key) => search.has(key)))
        return;
    }
    const configured =
      import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    throw redirect({ to: configured ? "/account" : "/login" });
  },
  component: import.meta.env.DEV ? HomePage : undefined,
});
