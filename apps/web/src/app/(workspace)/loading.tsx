import { WorkspaceLoading } from "../../components/workspace-loading";

export default function Loading() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto min-h-svh w-full min-w-0 max-w-3xl px-5 py-6 outline-none sm:px-8 sm:py-10"
    >
      <WorkspaceLoading />
    </main>
  );
}
