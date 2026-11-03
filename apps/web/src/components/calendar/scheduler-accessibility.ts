export function preserveVisibleEventName(element: HTMLElement) {
  const visibleName = element.textContent?.replace(/\s+/g, " ").trim();
  const context = element.getAttribute("aria-label");
  if (visibleName && context && !context.includes(visibleName))
    element.setAttribute("aria-label", `${visibleName}. ${context}`);
}
