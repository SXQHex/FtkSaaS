import { useSyncExternalStore } from "react";
import { StateBanner } from "./state-view";
const subscribe = (update: () => void) => {
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  return () => {
    window.removeEventListener("online", update);
    window.removeEventListener("offline", update);
  };
};
export function NetworkNotice() {
  const offline = useSyncExternalStore(
    subscribe,
    () => !navigator.onLine,
    () => false,
  );
  return offline ? <StateBanner kind="offline" /> : null;
}
