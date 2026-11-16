import type { Step } from "./walkthrough";
export function disclosureSteps(root: HTMLElement): Step[] {
  const terms = [...root.querySelectorAll<HTMLButtonElement>(".term")];
  function setOpen(button: HTMLButtonElement, open: boolean) {
    button.setAttribute("aria-expanded", String(open));
    root.querySelector<HTMLElement>(
      `#${button.getAttribute("aria-controls")}`
    )!.hidden = !open;
  }
  function state(openIds: string[] = []) {
    terms.forEach(button =>
      setOpen(button, openIds.includes(button.getAttribute("aria-controls")!))
    );
  }
  const first = terms[0],
    nested = terms[1],
    second = terms[2];
  return [
    {
      title: "Start with the short version",
      description:
        "The underlined phrases offer more detail. Advance to see each explanation open in place.",
      prepare: () => state(),
      target: null,
      result: first,
      run: async () => {},
    },
    {
      title: "Open an explanation in place",
      description:
        "The highlighted phrase opens an explanation beneath it, pushing the rest of the sentence down.",
      prepare: () => state(),
      target: first,
      result: root.querySelector("#detail-one"),
      run: async () => {
        setOpen(first, true);
      },
    },
    {
      title: "Go one layer deeper",
      description:
        "The highlighted question opens a nested explanation inside its parent, preserving the relationship between them.",
      prepare: () => state(["detail-one"]),
      target: nested,
      result: root.querySelector("#detail-nested"),
      run: async () => {
        setOpen(nested, true);
      },
    },
    {
      title: "Open a separate thread",
      description:
        "A second phrase opens independently. Both threads stay open, moving the closing question further down the page.",
      prepare: () => state(["detail-one", "detail-nested"]),
      target: second,
      result: root.querySelector("#detail-two"),
      run: async () => {
        setOpen(second, true);
      },
    },
    {
      title: "Return to the short version",
      description:
        "All three explanations close. The original passage returns without navigating away.",
      prepare: () => state(["detail-one", "detail-nested", "detail-two"]),
      target: root.querySelector(".article"),
      result: root.querySelector(".article"),
      run: async () => state(),
    },
  ];
}
