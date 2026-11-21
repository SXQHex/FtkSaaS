import type { FocusEvent } from "react";

export function revealFocusedAuthControl({ target }: FocusEvent<HTMLElement>) {
  if (!target.matches(":focus-visible")) return;
  requestAnimationFrame(() => {
    if (document.activeElement !== target) return;
    // WebKit can leave a zoomed control partially outside the viewport.
    const { top, bottom } = target.getBoundingClientRect();
    const clipped = top < 0 || bottom > document.documentElement.clientHeight;
    target.scrollIntoView?.({ block: clipped ? "center" : "nearest" });
  });
}
