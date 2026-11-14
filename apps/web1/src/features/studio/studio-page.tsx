import { useCallback, useEffect, useState } from "react";
import { useLoaderData, useParams, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { readWorkspace } from "../workspace/workspace";
import { WorkspaceLayout, type WorkspaceSelection } from "../workspace/workspace-layout";
import { useAccountAppearance } from "../account/use-account-appearance";
import { StudioView, type StudioViewData } from "./studio-view";
import { StudioSheets, type StudioSheetSelection } from "./studio-sheets";
import { StudioInstructorEditor } from "./instructor-editor";
import type { InstructorEditState } from "./instructor-edit";
import { StudioAgreementEditor } from "./agreement-editor";
import { StudioClosureEditor } from "./closure-editor";
import { StudioResourceEditor } from "./resource-editor";
import { StudioAvailabilityReader } from "./availability-reader";
import { readStudioSnapshot, type StudioSnapshot } from "./management-snapshot";
import { studioViewData } from "./studio-data";
import type { StudioScope } from "./studio";
import { NewInstructorPerson } from "./new-instructor-person";
import { InstructorEnrollmentSheet } from "./instructor-enrollment-sheet";
import type { JobRef } from "../../lib/api-contracts/generated";
import type { AccountView } from "../../lib/api-contracts/generated";
import { BackendError } from "../../lib/backend";
import { getSupabaseClient } from "../../lib/supabase";
import { Button } from "../../components/ui/button";
import { Alert, AlertDescription } from "../../components/ui/alert";

const empty: StudioViewData = {
  instructors: [],
  rooms: [],
  roomLimit: null,
  classes: [],
  closures: [],
  agreements: [],
  disciplines: [],
  compatibility: [],
  availability: {},
  setup: [],
};

export function StudioRoutePage() {
  const account = useLoaderData({ from: "/o/$orgId/c/$centerId/studio" });
  const { orgId, centerId } = useParams({ from: "/o/$orgId/c/$centerId/studio" });
  return (
    <StudioPage
      key={`${account.id}:${orgId}:${centerId}`}
      account={account}
      orgId={orgId}
      centerId={centerId}
    />
  );
}

export function StudioPage({
  account,
  orgId,
  centerId,
}: {
  account: AccountView;
  orgId: string;
  centerId: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const router = useRouter();
  const queries = useQueryClient();
  useAccountAppearance(account.id);
  const [organizationId, setOrganizationId] = useState(orgId);
  const [selectedCenterId, setCenterId] = useState<string | undefined>(centerId);
  const [locked, setLocked] = useState(false);
  const [pending, setPending] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  const resolveScope = useCallback(
    (selection: WorkspaceSelection) => {
      if (!selection.organizationId || !selection.centerId || locked) return;
      if (selection.organizationId !== orgId || selection.centerId !== centerId)
        void navigate({
          to: "/o/$orgId/c/$centerId/studio",
          params: { orgId: selection.organizationId, centerId: selection.centerId },
          replace: true,
        });
    },
    [orgId, centerId, locked, navigate],
  );
  async function signOut() {
    if (pending || locked) return;
    setPending(true);
    setSignOutError(false);
    const { error } = await getSupabaseClient().auth.signOut({ scope: "local" });
    if (error) {
      setPending(false);
      setSignOutError(true);
      return;
    }
    queries.clear();
    await navigate({ to: "/login", replace: true });
    await router.invalidate();
  }
  return (
    <WorkspaceLayout
      accountId={account.id}
      name={account.display_name}
      pending={pending || locked}
      onSignOut={() => {
        void signOut();
      }}
      pageTitle={t(($) => $.studio.title)}
      scopeControl={{
        organizationId,
        centerId: selectedCenterId,
        locked,
        onOrganization: (id) => {
          setOrganizationId(id);
          setCenterId(undefined);
        },
        onCenter: setCenterId,
        onResolved: resolveScope,
      }}
    >
      {(selection) => (
        <>
          {signOutError && (
            <Alert variant="destructive">
              <AlertDescription>{t(($) => $.auth.readError)}</AlertDescription>
            </Alert>
          )}
          {selection.organizationId && selection.centerId ? (
            <StudioContent
              key={`${account.id}:${selection.organizationId}:${selection.centerId}`}
              scope={{
                accountId: account.id,
                orgId: selection.organizationId,
                centerId: selection.centerId,
              }}
              onLockChange={setLocked}
            />
          ) : (
            <div className="p-6">
              <h1 className="text-2xl font-semibold">{t(($) => $.studio.title)}</h1>
              <p className="mt-3 text-muted-foreground">{t(($) => $.studio.chooseScope)}</p>
            </div>
          )}
        </>
      )}
    </WorkspaceLayout>
  );
}

function StudioContent({
  scope,
  onLockChange,
}: {
  scope: StudioScope;
  onLockChange: (value: boolean) => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [editor, setEditor] = useState<{
    selection: StudioSheetSelection;
    snapshot: StudioSnapshot;
  }>();
  const [pendingInstructor, setPendingInstructor] = useState<{ personId: string; job?: JobRef }>();
  const selectEnrollmentPerson = useCallback((personId: string) => {
    setPendingInstructor((current) => (current?.personId === personId ? current : { personId }));
  }, []);
  const recordEnrollmentJob = useCallback((personId: string, job: JobRef) => {
    setPendingInstructor((current) =>
      current?.personId === personId ? { ...current, job } : current,
    );
  }, []);
  const [observedInstructors, setObservedInstructors] = useState<
    Record<string, InstructorEditState>
  >({});
  const [interactionLocked, setInteractionLocked] = useState(false);
  const observeInstructor = useCallback((state: InstructorEditState) => {
    setObservedInstructors((current) => ({ ...current, [state.person.id]: state }));
  }, []);
  const publishLock = useCallback(
    (value: boolean) => {
      setInteractionLocked(value);
      onLockChange(value);
    },
    [onLockChange],
  );
  const workspace = useQuery({
    queryKey: ["workspace", scope.accountId, scope.orgId],
    queryFn: () => readWorkspace(scope.accountId, scope.orgId),
    // WorkspaceLayout owns the live read; this observer reuses its result.
    enabled: false,
    retry: false,
  });
  const canReadPlan =
    !workspace.isError &&
    workspace.data?.selected?.id === scope.orgId &&
    Boolean(workspace.data.roles.some((role) => role.role === "owner" && role.state === "active"));
  const query = useQuery({
    queryKey: ["studio", scope.accountId, scope.orgId, scope.centerId, canReadPlan],
    queryFn: () => readStudioSnapshot(scope, canReadPlan),
    retry: false,
  });
  useEffect(() => {
    const error = query.error;
    if (
      (error instanceof BackendError &&
        ["AUTH_REQUIRED", "SESSION_REVOKED"].includes(error.code)) ||
      (error instanceof Error && ["AUTH_REQUIRED", "ACCOUNT_CHANGED"].includes(error.message))
    )
      void router.invalidate();
  }, [query.error, router]);
  // Failed live reads do not render cached private lists as current authority.
  const snapshot = query.isError ? undefined : query.data;
  const mapped = snapshot ? studioViewData(snapshot, t, observedInstructors) : empty;
  const data = {
    ...mapped,
    setup: mapped.setup.map((item) => ({
      ...item,
      available:
        item.available !== false &&
        (!item.route ||
          Object.values(router.routesById).some((route) => route.fullPath === item.route)),
    })),
  };
  const base = `/o/${encodeURIComponent(scope.orgId)}/c/${encodeURIComponent(scope.centerId)}`;
  return (
    <StudioView
      data={data}
      interactionLocked={interactionLocked}
      state={query.isError ? "error" : query.isPending ? "loading" : "ready"}
      settingsHref={`${base}/settings`}
      earningsHref={`${base}/earnings`}
      onRetry={() => {
        void query.refetch();
      }}
      noticeContent={
        pendingInstructor && (
          <Alert role="status">
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              {t(($) => $.studio.resumeInstructorSetup)}
              <Button
                variant="outline"
                isDisabled={!snapshot}
                onPress={() => {
                  if (snapshot) setEditor({ selection: { kind: "instructor" }, snapshot });
                }}
              >
                {t(($) => $.studio.continueEnrollment)}
              </Button>
            </AlertDescription>
          </Alert>
        )
      }
      editorControl={{
        selection: editor?.selection,
        onChange: (selection) => {
          if (!selection) {
            setEditor(undefined);
            return;
          }
          if (snapshot) setEditor({ selection, snapshot });
        },
      }}
      availabilityContent={
        <StudioAvailabilityReader
          scope={scope}
          instructors={data.instructors}
          onLockChange={publishLock}
          onRefresh={async () => {
            await query.refetch({ throwOnError: true });
          }}
        />
      }
      renderEditor={(selection, onClose) => {
        if (!editor) return null;
        const capturedData = studioViewData(editor.snapshot, t);
        if (selection.kind === "room" || selection.kind === "class") {
          return (
            <StudioResourceEditor
              key={`${scope.accountId}:${scope.orgId}:${scope.centerId}:${selection.kind}:${selection.id ?? "new"}`}
              scope={scope}
              selection={{ kind: selection.kind, id: selection.id }}
              resources={editor.snapshot.resources}
              classMeta={capturedData.classes.find((item) => item.id === selection.id)}
              onLockChange={publishLock}
              onRefresh={async () => {
                const result = await query.refetch({ throwOnError: true });
                if (!result.data) throw new Error("STUDIO_UNAVAILABLE");
                return result.data.resources;
              }}
              onClose={onClose}
            />
          );
        }
        if (selection.kind === "instructor" && !selection.id) {
          if (!pendingInstructor)
            return (
              <NewInstructorPerson
                scope={scope}
                onSelected={selectEnrollmentPerson}
                onClose={onClose}
                onLockChange={publishLock}
              />
            );
          return (
            <InstructorEnrollmentSheet
              key={`${scope.accountId}:${scope.orgId}:${scope.centerId}:${pendingInstructor.personId}`}
              scope={scope}
              personId={pendingInstructor.personId}
              initialJob={pendingInstructor.job}
              onJob={(job) => recordEnrollmentJob(pendingInstructor.personId, job)}
              onChooseAnother={() => setPendingInstructor(undefined)}
              onClose={onClose}
              onLockChange={publishLock}
              onReady={async (personId, isCurrent) => {
                const result = await query.refetch({ throwOnError: true });
                if (!result.data) throw new Error("STUDIO_UNAVAILABLE");
                if (!isCurrent()) return;
                setPendingInstructor(undefined);
                setEditor({
                  selection: { kind: "instructor", id: personId },
                  snapshot: result.data,
                });
              }}
            />
          );
        }
        if (selection.kind === "instructor" && selection.id)
          return (
            <StudioInstructorEditor
              key={`${scope.accountId}:${scope.orgId}:${scope.centerId}:${selection.id}`}
              scope={scope}
              personId={selection.id}
              previewData={capturedData}
              onObserved={observeInstructor}
              onLockChange={publishLock}
              onClose={onClose}
              onRefresh={async () => {
                const result = await query.refetch({ throwOnError: true });
                if (!result.data) throw new Error("STUDIO_UNAVAILABLE");
                return result.data;
              }}
            />
          );
        if (selection.kind === "closure" && !selection.id)
          return (
            <StudioClosureEditor
              scope={scope}
              data={{
                ...capturedData,
                rooms: capturedData.rooms.filter((room) => room.active),
                instructors: capturedData.instructors.filter((person) =>
                  editor.snapshot.instructors.some(
                    (item) =>
                      item.person.id === person.id &&
                      item.person.relationships.some(
                        (relation) =>
                          relation.center_id === scope.centerId && relation.state === "active",
                      ),
                  ),
                ),
              }}
              onClose={onClose}
              onLockChange={publishLock}
              onRefresh={async () => {
                await query.refetch({ throwOnError: true });
              }}
            />
          );
        if (selection.kind === "agreement")
          return (
            <StudioAgreementEditor
              key={`${scope.accountId}:${scope.orgId}:${scope.centerId}:${selection.id ?? "new"}`}
              scope={scope}
              selectedId={selection.id}
              personId={
                editor.snapshot.agreements.find((item) => item.id === selection.id)?.person_id
              }
              data={capturedData}
              onClose={onClose}
              onLockChange={publishLock}
              onRefresh={async () => {
                await query.refetch({ throwOnError: true });
              }}
            />
          );
        return <StudioSheets selection={selection} data={capturedData} onClose={onClose} />;
      }}
    />
  );
}
