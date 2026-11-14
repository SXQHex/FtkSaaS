import type { UserIdentity } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import { scanAccessibility } from "./accessibility.js";
import type {
  FailureEnvelope,
  SettingsMediaAsset,
  SuccessMediaGet,
  AccountSessionView,
  SuccessAccountSessionsList,
  SuccessAccountSessionLabel,
  SuccessAccountSessionsRevoke,
  SuccessManagementStateGet,
  SuccessAccountProfileUpdate,
  SuccessAccountGet,
  SuccessOrganizationsList,
  SuccessSettingsGet,
  SuccessSettingsCatalogGet,
  SuccessSettingsUpdate,
} from "../src/lib/api-contracts/generated.js";
export const origin = "http://127.0.0.1:4175";
const id = "019a7b00-0000-7000-8000-000000000001";
const accountId = "019a7b00-0000-7000-8000-000000000002";
const fixtureUser = {
  id,
  email: "fixture@example.invalid",
  aud: "authenticated",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: "2026-11-13T00:00:00Z",
  email_confirmed_at: "2026-11-13T00:00:00Z",
  new_email: undefined as string | undefined,
  identities: [
    {
      identity_id: id,
      id: "fixture-email-provider-id",
      user_id: id,
      provider: "email",
      identity_data: { email: "fixture@example.invalid" },
    },
  ] as UserIdentity[],
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

export async function captureAuth(page: Page, name: string, testInfo: TestInfo, focus?: Locator) {
  await expect(page.locator("main h1")).toBeVisible();
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    for (const colorScheme of ["light", "dark"] as const) {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme });
      await focus?.scrollIntoViewIfNeeded();
      // Scan the stable requested theme, after the registry controls finish their CSS transitions.
      await expect
        .poll(() =>
          page.evaluate(
            "document.getAnimations().filter(animation => animation.playState === 'running' || animation.pending).length",
          ),
        )
        .toBe(0);
      expect(await page.evaluate("document.documentElement.scrollWidth > innerWidth")).toBe(false);
      expect((await scanAccessibility(page, name)).violations).toEqual([]);
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
    theme: "system" as "system" | "light" | "dark",
    themeWritable: true,
    fontScale: null as number | null,
    scaleWritable: true,
    settingsPatches: [] as { theme?: string; font_scale?: number | null }[],
    settingsWriteGate: undefined as Promise<void> | undefined,
    settingsVersion: 0,
    settingsKeys: [] as string[],
    rejectNextSettings: false,
    conflictNextSettings: false,
    blockSettingsReads: false,
    exchange: 0,
    password: 0,
    emailUpdate: 0,
    emailResend: 0,
    rejectNextEmailUpdate: false,
    completeEmailChangeOnExchange: false,
    identityLink: 0,
    identityEmail: "google@example.invalid",
    identityUnlink: 0,
    rejectNextIdentityLink: false,
    rejectNextIdentityUnlink: false,
    blockIdentityReads: false,
    onlyGoogleIdentity: false,
    passwordNeedsCode: false,
    passwordCodeSends: 0,
    rejectCurrentPassword: false,
    rejectPasswordCode: false,
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
    photoWrites: [] as (string | null)[],
    mediaReads: 0,
    rejectNextMedia: false,
    othersKeys: [] as string[],
    othersProofs: [] as string[],
    challenge: 0,
    verify: 0,
    account: 0,
  };
  let photo: SettingsMediaAsset | null = null;
  let photoBytes = "";
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
    const googleIdentity: UserIdentity = {
      identity_id: "019a7b00-0000-7000-8000-000000000903",
      id: "fixture-google-provider-id",
      user_id: id,
      provider: "google",
      identity_data: { email: calls.identityEmail, email_verified: true },
    };
    if (url.pathname === "/auth/v1/user/identities/authorize") {
      calls.identityLink++;
      expect(url.searchParams.get("provider")).toBe("google");
      expect(url.searchParams.get("redirect_to")).toBe(`${origin}/auth/callback`);
      if (calls.rejectNextIdentityLink) {
        calls.rejectNextIdentityLink = false;
        return route.fulfill({
          status: 400,
          headers: { "x-supabase-api-version": "2024-01-01" },
          json: { code: "manual_linking_disabled", msg: "manual_linking_disabled" },
        });
      }
      user.identities = [
        ...user.identities.filter((identity) => identity.provider !== "google"),
        googleIdentity,
      ];
      return route.fulfill({ json: { provider: "google", url: `${origin}/auth/v1/authorize` } });
    }
    if (url.pathname === `/auth/v1/user/identities/${googleIdentity.identity_id}`) {
      expect(route.request().method()).toBe("DELETE");
      calls.identityUnlink++;
      if (calls.rejectNextIdentityUnlink) {
        calls.rejectNextIdentityUnlink = false;
        return route.fulfill({
          status: 400,
          headers: { "x-supabase-api-version": "2024-01-01" },
          json: { code: "single_identity_not_deletable", msg: "single_identity_not_deletable" },
        });
      }
      user.identities = user.identities.filter(
        (identity) => identity.identity_id !== googleIdentity.identity_id,
      );
      return route.fulfill({ json: {} });
    }
    if (url.pathname === "/auth/v1/authorize")
      return route.fulfill({
        status: 302,
        headers: { location: `${origin}/auth/callback?code=fixture-google-code` },
      });
    if (url.pathname === "/auth/v1/token") {
      calls.exchange++;
      if (
        url.searchParams.get("grant_type") === "pkce" &&
        calls.completeEmailChangeOnExchange &&
        user.new_email
      ) {
        user.email = user.new_email;
        user.new_email = undefined;
        user.identities = user.identities.map((identity) =>
          identity.provider === "email"
            ? { ...identity, identity_data: { ...identity.identity_data, email: user.email } }
            : identity,
        );
      }
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
      const request = route.request().postDataJSON();
      if (request.type === "email_change") {
        calls.emailResend++;
        expect(request.email).toBe(user.new_email);
        expect(new URL(url.searchParams.get("redirect_to")!).pathname).toBe("/auth/callback");
      }
      return route.fulfill({ json: {} });
    }
    if (url.pathname === "/auth/v1/reauthenticate") {
      calls.passwordCodeSends++;
      return route.fulfill({ json: {} });
    }
    if (url.pathname === "/auth/v1/user") {
      if (route.request().method() === "GET" && calls.blockIdentityReads)
        return route.fulfill({ status: 503, json: { msg: "temporary failure" } });
      if (calls.onlyGoogleIdentity) user.identities = [googleIdentity];
      if (route.request().method() === "PUT") {
        const request = route.request().postDataJSON();
        if (request.email !== undefined) {
          calls.emailUpdate++;
          expect(new URL(url.searchParams.get("redirect_to")!).pathname).toBe("/auth/callback");
          expect(request).not.toHaveProperty("data");
          if (calls.rejectNextEmailUpdate) {
            calls.rejectNextEmailUpdate = false;
            return route.fulfill({
              status: 400,
              headers: { "x-supabase-api-version": "2024-01-01" },
              json: { code: "email_exists", msg: "email_exists" },
            });
          }
          user.new_email = request.email;
          return route.fulfill({ json: user });
        }
        calls.password++;
        if (
          calls.rejectCurrentPassword ||
          (calls.passwordNeedsCode && (!request.nonce || calls.rejectPasswordCode))
        ) {
          const code = calls.rejectCurrentPassword
            ? "current_password_invalid"
            : calls.rejectPasswordCode
              ? "reauthentication_not_valid"
              : "reauthentication_needed";
          calls.rejectCurrentPassword = false;
          calls.rejectPasswordCode = false;
          return route.fulfill({
            status: 400,
            headers: { "x-supabase-api-version": "2024-01-01" },
            json: { code, msg: code },
          });
        }
        if (request.current_password !== undefined || request.nonce) {
          expect(request.password).toBe("fixture-new-password");
          expect(request.current_password).toBe("fixture-current-password");
          otherActive = false;
          previousActive = false;
        }
      }
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
      const entity = { type: "accounts" as const, id: accountId };
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
                current: { operation: "account_profile_update_v1", values: { ...profile, photo } },
              },
            ],
            next_cursor: null,
            as_of: fixtureUser.created_at,
          },
          trace_id: id,
        } satisfies SuccessManagementStateGet,
      });
    }
    if (url.pathname === "/functions/v1/backend-v1/settings_catalog_get_v1") {
      expect(route.request().postDataJSON().scope).toBe("user");
      return route.fulfill({
        json: {
          ok: true,
          trace_id: id,
          data: {
            scope: "user",
            catalog_version: 23,
            fields: [
              {
                key: "theme",
                group: "appearance",
                consumer: "frontend",
                writable: calls.themeWritable,
              },
              {
                key: "font_scale",
                group: "appearance",
                consumer: "frontend",
                writable: calls.scaleWritable,
              },
            ],
            defaults: { theme: "system", font_scale: null },
            brand_packages: [],
            limitations: [],
          },
        } satisfies SuccessSettingsCatalogGet,
      });
    }
    if (url.pathname === "/functions/v1/backend-v1/settings_get_v1") {
      expect(route.request().postDataJSON().scope).toBe("user");
      if (calls.blockSettingsReads)
        return route.fulfill({
          status: 503,
          json: {
            ok: false,
            error: { code: "TEMPORARY_FAILURE", retryable: true, trace_id: id },
          } satisfies FailureEnvelope,
        });
      return route.fulfill({
        json: {
          ok: true,
          trace_id: id,
          data: {
            scope: "user",
            version: calls.settingsVersion,
            values: {
              theme: calls.theme,
              font_scale: calls.fontScale,
              language: "tr",
              week_start: "monday",
              contrast: "system",
              timezone_mode: "auto",
              timezone_name: null,
              optional_analytics: false,
            },
            overridden_fields: [],
            as_of: fixtureUser.created_at,
          },
        } satisfies SuccessSettingsGet,
      });
    }
    if (url.pathname === "/functions/v1/backend-v1/settings_update_v1") {
      const request = route.request().postDataJSON();
      expect(request.scope).toBe("user");
      expect(Object.keys(request.patch).length).toBe(1);
      expect(["theme", "font_scale"]).toContain(Object.keys(request.patch)[0]);
      calls.settingsPatches.push(request.patch);
      calls.settingsKeys.push(request.operation_key);
      if (calls.settingsWriteGate) {
        const gate = calls.settingsWriteGate;
        calls.settingsWriteGate = undefined;
        await gate;
      }
      if (calls.rejectNextSettings) {
        calls.rejectNextSettings = false;
        return route.fulfill({
          status: 503,
          json: {
            ok: false,
            error: { code: "TEMPORARY_FAILURE", retryable: true, trace_id: id },
          } satisfies FailureEnvelope,
        });
      }
      if (calls.conflictNextSettings) {
        calls.conflictNextSettings = false;
        calls.settingsVersion += 4;
        calls.theme = "light";
        return route.fulfill({
          json: {
            ok: false,
            error: { code: "VERSION_CONFLICT", retryable: false, trace_id: id },
          } satisfies FailureEnvelope,
        });
      }
      expect(request.expected_version).toBe(calls.settingsVersion);
      if (Object.hasOwn(request.patch, "theme")) calls.theme = request.patch.theme;
      else calls.fontScale = request.patch.font_scale;
      calls.settingsVersion += 2;
      return route.fulfill({
        json: {
          ok: true,
          trace_id: id,
          data: { primary_id: accountId, operation_id: id, replayed: false, related: [] },
        } satisfies SuccessSettingsUpdate,
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
      if (Object.hasOwn(request, "photo")) {
        calls.photoWrites.push(request.photo?.checksum ?? null);
        if (request.photo) {
          const bytes = Buffer.from(request.photo.data_base64, "base64");
          expect(createHash("sha256").update(bytes).digest("hex")).toBe(request.photo.checksum);
          expect(bytes.length).toBeLessThanOrEqual(1048576);
          photoBytes = request.photo.data_base64;
          photo = {
            id: `019a7b00-0000-7000-8000-${String(profileVersion).padStart(12, "0")}`,
            mime: request.photo.mime,
            checksum: request.photo.checksum,
            bytes: bytes.length,
          };
        } else {
          photo = null;
          photoBytes = "";
        }
      }
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
            primary_id: accountId,
            version: profileVersion,
            replayed: false,
            related: [],
          },
          trace_id: id,
        } satisfies SuccessAccountProfileUpdate,
      });
    }
    if (url.pathname === "/functions/v1/backend-v1/media_get_v1") {
      calls.mediaReads++;
      const request = route.request().postDataJSON();
      expect(route.request().method()).toBe("POST");
      expect(request.scope).toBe("user");
      if (calls.rejectNextMedia || !photo || request.asset_id !== photo.id) {
        calls.rejectNextMedia = false;
        return route.fulfill({
          status: 404,
          json: {
            ok: false,
            error: { code: "NOT_FOUND", retryable: false, trace_id: id },
          } satisfies FailureEnvelope,
        });
      }
      return route.fulfill({
        headers: { "cache-control": "private, no-store" },
        json: {
          ok: true,
          data: { asset: photo, data_base64: photoBytes },
          trace_id: id,
        } satisfies SuccessMediaGet,
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
            primary_id: accountId,
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
    if (url.pathname === "/functions/v1/backend-v1/organizations_list_v1") {
      return route.fulfill({
        json: {
          ok: true,
          data: { items: [], next_cursor: null, as_of: "2026-11-14T06:00:00Z" },
          trace_id: id,
        } satisfies SuccessOrganizationsList,
      });
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
            id: accountId,
            state: "active",
            display_name: profile.display_name,
            photo,
            identity: {
              given_name: profile.given_name,
              family_name: profile.family_name,
              unverified_phone: profile.unverified_phone,
              email: user.email,
              phone: null,
              pending_email: user.new_email ?? null,
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
