import { Preferences } from "./preferences";
// Layout from the official shadcn/ui login-01 page; source in registry-sources.json.
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-svh w-full flex-col items-center justify-center gap-6 p-6 md:p-10">
      <Preferences />
      <div className="w-full min-w-0 max-w-sm">{children}</div>
    </main>
  );
}
