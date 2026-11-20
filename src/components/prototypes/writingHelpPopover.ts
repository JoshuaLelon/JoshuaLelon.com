import type { Help } from "./writingHelp";

export function writingHelpPopover(root: HTMLElement) {
  const card = root.querySelector<HTMLElement>(".writing-help-card")!;
  const title = card.querySelector("strong")!;
  const definition = card.querySelector("p")!;
  const sample = card.querySelector<HTMLElement>("figure div")!;
  const credit = card.querySelector("footer")!;
  const dismiss = card.querySelector("button")!;
  const references = new WeakMap<
    HTMLButtonElement,
    { label: string; help: Help }
  >();
  let anchor: HTMLButtonElement | undefined;
  let events: AbortController | undefined;
  dismiss.popoverTargetElement = card;
  dismiss.popoverTargetAction = "hide";

  function position() {
    if (!anchor) return;
    const box = anchor.getBoundingClientRect();
    const rail = anchor.closest(".choice-list")?.getBoundingClientRect();
    if (
      !box.width ||
      box.bottom <= 0 ||
      box.top >= innerHeight ||
      (rail && (box.right <= rail.left || box.left >= rail.right))
    ) {
      card.hidePopover();
      return;
    }
    const above = box.top - 8;
    const below = innerHeight - box.bottom - 8;
    const opensAbove = above >= 220 || above > below;
    card.style.maxHeight =
      Math.max(50, (opensAbove ? above : below) - 8) + "px";
    card.style.top = opensAbove ? "auto" : box.bottom + 8 + "px";
    card.style.bottom = opensAbove ? innerHeight - box.top + 8 + "px" : "auto";
    card.style.setProperty("--help-x", box.left + box.width / 2 + "px");
  }
  card.onbeforetoggle = event => {
    events?.abort();
    if (event.newState === "closed") {
      anchor?.setAttribute("aria-expanded", "false");
      anchor = undefined;
      return;
    }
    events = new AbortController();
    const { signal } = events;
    document.addEventListener("scroll", position, {
      capture: true,
      passive: true,
      signal,
    });
    window.addEventListener("resize", position, { signal });
  };
  function show(button: HTMLButtonElement, scripted = false) {
    const { label, help } = references.get(button)!;
    anchor?.setAttribute("aria-expanded", "false");
    anchor = button;
    button.setAttribute("aria-expanded", "true");
    title.textContent = button.closest(".question-line") ? "" : label;
    card.setAttribute("aria-label", label);
    definition.textContent = help.definition;
    sample.textContent = help.example ?? "";
    sample.parentElement!.hidden = !help.example;
    credit.replaceChildren();
    if (help.source.url) {
      const link = document.createElement("a");
      link.href = help.source.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = help.source.name;
      credit.append(link);
    } else credit.textContent = help.source.name;
    dismiss.autofocus = !scripted;
    card.showPopover();
    position();
  }
  function trigger(label: string, help: Help) {
    const button = document.createElement("button");
    references.set(button, { label, help });
    button.type = "button";
    button.className = "writing-help";

    button.setAttribute("aria-label", "about " + label.replace(/\?$/, ""));
    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-expanded", "false");
    button.popoverTargetElement = card;
    button.popoverTargetAction = "show";
    button.onclick = event => {
      event.preventDefault();
      if (
        root.querySelector('.tour-stage[aria-busy="true"]') ||
        (anchor === button && card.matches(":popover-open"))
      ) {
        card.hidePopover();
        return;
      }
      show(button);
    };
    return button;
  }
  return { trigger, show, close: () => card.hidePopover() };
}
