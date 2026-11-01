// Only the same tab carries invitation proof across native OAuth/MFA navigation.
// Never put this value in the server-side return cookie or a query parameter.
const key = "ftksaas:pending-invitation";

export function preserveInvitationReturn(destination: string) {
  if (destination !== "/invite") {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // Storage may be disabled. Unrelated native Auth must remain available.
      return;
    }
    return;
  }
  const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
  if (token !== null) {
    sessionStorage.setItem(key, token);
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname + window.location.search,
    );
  }
}

export function consumeInvitationReturn() {
  const fragment = new URLSearchParams(window.location.hash.slice(1)).get("token");
  const token = fragment ?? sessionStorage.getItem(key) ?? "";
  sessionStorage.removeItem(key);
  if (fragment !== null)
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname + window.location.search,
    );
  return token;
}
