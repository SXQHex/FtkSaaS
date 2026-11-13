import { expect, type Page, type TestInfo } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type {
  FailureEnvelope,
  AccountSessionView,
  SuccessAccountSessionsList,
  SuccessAccountSessionLabel,
  SuccessAccountSessionsRevoke,
  SuccessManagementStateGet,
  SuccessAccountProfileUpdate,
  SuccessAccountGet,
} from "../src/lib/api-contracts/generated.js";
export const origin = "http://127.0.0.1:4175";
const id = "019a7b00-0000-7000-8000-000000000001";
const fixtureUser = {
  id,
  email: "fixture@example.invalid",
  aud: "authenticated",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: "2026-11-13T00:00:00Z",
  email_confirmed_at: "2026-11-13T00:00:00Z",
};
const token = (aal: "aal1" | "aal2" = "aal1", sessionId = id) =>
  [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
    Buffer.from(
      JSON.stringify({
        sub: id,
        aud: "authenticated",
        role: "authenticated",
        aal,
        amr: [{ method: "password", timestamp: Math.floor(Date.now() / 1000) }],
        exp: Math.floor(Date.now() / 1000) + 3600,
        session_id: sessionId,
      }),
    ).toString("base64url"),
    Buffer.from("fixture-signature").toString("base64url"),
  ].join(".");

export async function captureAuth(page: Page, name: string, testInfo: TestInfo) {
  await expect(page.locator("main h1")).toBeVisible();
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    for (const colorScheme of ["light", "dark"] as const) {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme });
      // Scan the stable requested theme, after the registry controls finish their CSS transitions.
      await expect
        .poll(() =>
          page.evaluate(
            "document.getAnimations().filter(animation => animation.playState === 'running' || animation.pending).length",
          ),
        )
        .toBe(0);
      expect(await page.evaluate("document.documentElement.scrollWidth > innerWidth")).toBe(false);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      const body = await page.screenshot({
        path: `.tmp/${name}-app-${viewport.width}-${colorScheme}.png`,
      });
      await testInfo.attach(`${name}-${viewport.width}-${colorScheme}`, {
        body,
        contentType: "image/png",
      });
    }
  }
}

export async function mockNative(page: Page, mfa = false) {
  const calls = {
    exchange: 0,
    password: 0,
    recover: 0,
    resend: 0,
    enroll: 0,
    remove: 0,
    rejectNextAccount: false,
    rejectNextLabel: false,
    conflictNextLabel: false,
    rejectNextRevoke: false,
    labelKeys: [] as string[],
    revokeKeys: [] as string[],
    rejectNextOthers: false,
    rejectNextProfile: false,
    conflictNextProfile: false,
    blockProfileReads: false,
    profileKeys: [] as string[],
    othersKeys: [] as string[],
    othersProofs: [] as string[],
    challenge: 0,
    verify: 0,
    account: 0,
  };
  let profileVersion = 7;
  let profile = {
    display_name: "Fixture Account",
    given_name: "Fixture" as string | null,
    family_name: "Account" as string | null,
    unverified_phone: null as string | null,
  };
  let elevated = false;
  let nativeSessionId = id;
  let passwordSignIns = 0;
  let previousActive = false;
  let otherActive = true;
  let sessionLabel: string | null = null;
  let labelVersion = 0;
  const otherSessionId = "550e8400-e29b-41d4-a716-446655440000";
  const user = {
    ...fixtureUser,
    factors: mfa
      ? [
          {
            id,
            status: "verified",
            factor_type: "totp",
            friendly_name: "Fixture TOTP",
            created_at: fixtureUser.created_at,
            updated_at: fixtureUser.created_at,
          },
        ]
      : [],
  };
  const session = () => ({
    access_token: token(elevated ? "aal2" : "aal1", nativeSessionId),
    refresh_token: "fixture-refresh",
    token_type: "bearer",
    expires_in: 3600,
    user,
  });
  await page.context().route("**/*", async (route) => {
    const url = new URL(route.request().url());
    expect(url.origin).toBe(origin);
    if (url.pathname === "/auth/v1/authorize")
      return route.fulfill({
        status: 302,
        headers: { location: `${origin}/auth/callback?code=fixture-google-code` },
      });
    if (url.pathname === "/auth/v1/token") {
      calls.exchange++;
      if (url.searchParams.get("grant_type") === "password") {
        passwordSignIns++;
        elevated = false;
        if (passwordSignIns > 1) {
          nativeSessionId = "550e8400-e29b-41d4-a716-446655440099";
          previousActive = true;
        }
      }
      return route.fulfill({
        json: session(),
      });
    }
    if (url.pathname === "/auth/v1/recover") {
      calls.recover++;
      return route.fulfill({ json: {} });
    }
    if (url.pathname === "/auth/v1/resend") {
      calls.resend++;
      return route.fulfill({ json: {} });
    }
    if (url.pathname === "/auth/v1/user") {
      if (route.request().method() === "PUT") calls.password++;
      return route.fulfill({ json: user });
    }
    if (url.pathname === "/functions/v1/backend-v1/management_state_get_v1") {
      expect(route.request().postDataJSON().operation).toBe("account_profile_update_v1");
      expect(route.request().postDataJSON().selector).toEqual({
        operation: "account_profile_update_v1",
        key: {},
      });
      if (calls.blockProfileReads)
        return route.fulfill({
          status: 503,
          json: {
            ok: false,
            error: { code: "TEMPORARY_FAILURE", retryable: true, trace_id: id },
          } satisfies FailureEnvelope,
        });
      const entity = { type: "accounts" as const, id };
      return route.fulfill({
        json: {
          ok: true,
          data: {
            items: [
              {
                operation: "account_profile_update_v1",
                entity,
                exists: true,
                state: "active",
                versions: [{ entity, version: profileVersion }],
                as_of: fixtureUser.created_at,
                current: { operation: "account_profile_update_v1", values: profile },
              },
            ],
            next_cursor: null,
            as_of: fixtureUser.created_at,
          },
          trace_id: id,
        } satisfies SuccessManagementStateGet,
      });
    }
    if (url.pathname === "/functions/v1/backend-v1/account_profile_update_v1") {
      const request = route.request().postDataJSON();
      calls.profileKeys.push(request.operation_key);
      if (calls.rejectNextProfile) {
        calls.rejectNextProfile = false;
        return route.fulfill({
          status: 503,
          json: {
            ok: false,
            error: { code: "TEMPORARY_FAILURE", retryable: true, trace_id: id },
          } satisfies FailureEnvelope,
        });
      }
      if (calls.conflictNextProfile) {
        calls.conflictNextProfile = false;
        profileVersion++;
        profile = { ...profile, display_name: "Remote profile" };
        return route.fulfill({
          status: 409,
          json: {
            ok: false,
            error: { code: "VERSION_CONFLICT", retryable: false, trace_id: id },
          } satisfies FailureEnvelope,
        });
      }
      expect(request.expected_version).toBe(profileVersion);
      expect(request).not.toHaveProperty("photo");
      expect(request).not.toHaveProperty("email");
      profile = {
        display_name: request.display_name,
        given_name: request.given_name,
        family_name: request.family_name,
        unverified_phone: request.unverified_phone,
      };
      profileVersion++;
      return route.fulfill({
        json: {
          ok: true,
          data: {
            operation_id: id,
            primary_id: id,
            version: profileVersion,
            replayed: false,
            related: [],
          },
          trace_id: id,
        } satisfies SuccessAccountProfileUpdate,
      });
    }
    if (url.pathname === "/functions/v1/backend-v1/account_sessions_list_v1") {
      const current: AccountSessionView = {
        session_id: nativeSessionId,
        current: true,
        created_at: fixtureUser.created_at,
        last_refreshed_at: fixtureUser.created_at,
        expires_at: null,
        aal: elevated ? "aal2" : "aal1",
        user_agent: "Chromium, fixture desktop",
        label: null,
        version: 0,
      };
      const other = {
        ...current,
        session_id: otherSessionId,
        current: false,
        user_agent: "Firefox, fixture phone",
        label: sessionLabel,
        version: labelVersion,
      };
      const cursor = route.request().postDataJSON().cursor;
      return route.fulfill({
        json: {
          ok: true,
          data: {
            items: cursor
              ? [
                  ...(otherActive ? [other] : []),
                  ...(previousActive
                    ? [
                        {
                          ...current,
                          session_id: id,
                          current: false,
                          user_agent: "Previous fixture browser",
                        },
                      ]
                    : []),
                ]
              : [current],
            next_cursor: !cursor && (otherActive || previousActive) ? "fixture-session-page" : null,
            as_of: fixtureUser.created_at,
          },
          trace_id: id,
        } satisfies SuccessAccountSessionsList,
      });
    }
    if (url.pathname === "/functions/v1/backend-v1/account_session_label_v1") {
      const request = route.request().postDataJSON();
      calls.labelKeys.push(request.operation_key);
      if (calls.rejectNextLabel) {
        calls.rejectNextLabel = false;
        return route.fulfill({
          status: 503,
          json: {
            ok: false,
            error: { code: "TEMPORARY_FAILURE", retryable: true, trace_id: id },
          } satisfies FailureEnvelope,
        });
      }
      if (calls.conflictNextLabel) {
        calls.conflictNextLabel = false;
        labelVersion++;
        sessionLabel = "Updated in another tab";
        return route.fulfill({
          status: 409,
          json: {
            ok: false,
            error: { code: "VERSION_CONFLICT", retryable: false, trace_id: id },
          } satisfies FailureEnvelope,
        });
      }
      expect(request.session_id).toBe(otherSessionId);
      expect(request.expected_version).toBe(labelVersion);
      sessionLabel = request.label;
      labelVersion++;
      return route.fulfill({
        json: {
          ok: true,
          data: {
            operation_id: id,
            primary_id: id,
            version: labelVersion,
            replayed: false,
            related: [],
          },
          trace_id: id,
        } satisfies SuccessAccountSessionLabel,
      });
    }
    if (url.pathname === "/functions/v1/backend-v1/account_sessions_revoke_v1") {
      const request = route.request().postDataJSON();
      if (request.mode === "others") {
        calls.othersKeys.push(request.operation_key);
        calls.othersProofs.push(request.reauth);
        const proof = JSON.parse(Buffer.from(request.reauth.split(".")[1], "base64url").toString());
        const bearer = JSON.parse(
          Buffer.from(
            route.request().headers().authorization.split(".")[1],
            "base64url",
          ).toString(),
        );
        expect(proof.session_id).toBe(nativeSessionId);
        expect(bearer.session_id).toBe(nativeSessionId);
        expect(proof.aal).toBe(elevated ? "aal2" : "aal1");
        if (calls.rejectNextOthers) {
          calls.rejectNextOthers = false;
          return route.fulfill({
            status: 503,
            json: {
              ok: false,
              error: { code: "TEMPORARY_FAILURE", retryable: true, trace_id: id },
            } satisfies FailureEnvelope,
          });
        }
        otherActive = false;
        previousActive = false;
        return route.fulfill({
          json: {
            ok: true,
            data: { operation_id: id, affected_count: 2, current_revoked: false, replayed: false },
            trace_id: id,
          } satisfies SuccessAccountSessionsRevoke,
        });
      }
      calls.revokeKeys.push(request.operation_key);
      expect(request.mode).toBe("selected");
      expect(request.session_id).toBe(otherSessionId);
      if (calls.rejectNextRevoke) {
        calls.rejectNextRevoke = false;
        return route.fulfill({
          status: 403,
          json: {
            ok: false,
            error: { code: "FORBIDDEN", retryable: false, trace_id: id },
          } satisfies FailureEnvelope,
        });
      }
      otherActive = false;
      return route.fulfill({
        json: {
          ok: true,
          data: { operation_id: id, affected_count: 1, current_revoked: false, replayed: false },
          trace_id: id,
        } satisfies SuccessAccountSessionsRevoke,
      });
    }
    if (url.pathname === "/auth/v1/factors" && route.request().method() === "POST") {
      calls.enroll++;
      user.factors = [
        {
          id,
          status: "unverified",
          factor_type: "totp",
          friendly_name: "Fixture TOTP",
          created_at: fixtureUser.created_at,
          updated_at: fixtureUser.created_at,
        },
      ];
      return route.fulfill({
        json: {
          id,
          type: "totp",
          friendly_name: "Fixture TOTP",
          totp: {
            secret: "SYNTHETIC-TEST-KEY",
            qr_code:
              '<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144"><path fill="black" d="M8 8h40v40H8zM96 8h40v40H96zM8 96h40v40H8zM72 72h16v16H72z"/></svg>',
            uri: "otpauth://totp/fixture?secret=SYNTHETIC",
          },
        },
      });
    }
    if (url.pathname === `/auth/v1/factors/${id}` && route.request().method() === "DELETE") {
      calls.remove++;
      user.factors = [];
      elevated = false;
      return route.fulfill({ json: { id } });
    }
    if (url.pathname === "/functions/v1/backend-v1/account_security_history_get_v1")
      return route.fulfill({
        json: {
          ok: true,
          data: {
            items: elevated
              ? [
                  {
                    id,
                    at: fixtureUser.created_at,
                    action: "totp_enabled",
                    session_id: id,
                    affected_count: 1,
                  },
                ]
              : [],
            next_cursor: null,
            as_of: fixtureUser.created_at,
          },
          trace_id: id,
        },
      });
    if (url.pathname === `/auth/v1/factors/${id}/challenge`) {
      calls.challenge++;
      return route.fulfill({
        json: { id, type: "totp", expires_at: Math.floor(Date.now() / 1000) + 60 },
      });
    }
    if (url.pathname === `/auth/v1/factors/${id}/verify`) {
      calls.verify++;
      if (route.request().postDataJSON().code !== "123456")
        return route.fulfill({
          status: 422,
          json: { code: "mfa_verification_failed", msg: "Invalid verification code" },
        });
      elevated = true;
      user.factors = user.factors.map((factor) => ({ ...factor, status: "verified" }));
      return route.fulfill({ json: session() });
    }
    if (url.pathname === "/functions/v1/backend-v1/account_get_v1") {
      calls.account++;
      if (calls.rejectNextAccount) {
        calls.rejectNextAccount = false;
        return route.fulfill({
          status: 503,
          json: {
            ok: false,
            error: { code: "TEMPORARY_FAILURE", retryable: true, trace_id: id },
          } satisfies FailureEnvelope,
        });
      }
      if (mfa && !elevated)
        return route.fulfill({
          status: 403,
          json: {
            ok: false,
            error: { code: "AUTH_REQUIRED", retryable: false, trace_id: id },
          } satisfies FailureEnvelope,
        });
      return route.fulfill({
        json: {
          ok: true,
          data: {
            id,
            state: "active",
            display_name: profile.display_name,
            identity: {
              given_name: profile.given_name,
              family_name: profile.family_name,
              unverified_phone: profile.unverified_phone,
              email: fixtureUser.email,
              phone: null,
              pending_email: null,
              pending_phone: null,
              email_verified_at: fixtureUser.email_confirmed_at,
              phone_verified_at: null,
            },
          },
          trace_id: id,
        } satisfies SuccessAccountGet,
      });
    }
    await route.continue();
  });
  return calls;
}
