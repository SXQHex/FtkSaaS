export function preserveVisibleEventName(element: HTMLElement) {
  const visibleName = element.textContent?.replace(/\s+/g, " ").trim();
  const context = element.getAttribute("aria-label");
  if (visibleName && context && !context.includes(visibleName))
    element.setAttribute("aria-label", `${visibleName}. ${context}`);
}

export function configureSchedulerEvent(
  element: HTMLElement,
  context: string,
  onSelect: () => void,
) {
  element.setAttribute("aria-label", context);
  preserveVisibleEventName(element);
  element.setAttribute("role", "button");
  element.tabIndex = 0;
  // Editing is read-only; opening the application detail is an enabled action.
  element.removeAttribute("aria-disabled");
  let spaceDown = false;
  element.onkeydown = (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Enter" && !event.repeat) onSelect();
    if (event.key === " ") spaceDown = true;
  };
  element.onkeyup = (event) => {
    if (event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    const activate = spaceDown;
    spaceDown = false;
    if (activate && !event.altKey && !event.ctrlKey && !event.metaKey) onSelect();
  };
  element.onblur = () => {
    spaceDown = false;
  };
}
