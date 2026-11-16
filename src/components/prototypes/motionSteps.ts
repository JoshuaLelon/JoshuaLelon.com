import type { Step } from "./walkthrough";
export function motionSteps(root: HTMLElement): Step[] {
  const card = root.querySelector<HTMLElement>("#card")!;
  function draw(progress: number, easing = "linear") {
    const v =
      easing === "smooth" ? progress * progress * (3 - 2 * progress) : progress;
    card.style.transform = `translateY(${18 * (1 - v)}px) scale(${0.94 + 0.06 * v})`;
  }
  return [
    {
      title: "The compact state",
      description:
        "The card starts slightly smaller and lower. The faint outline marks where it will finish.",
      prepare: () => draw(0),
      target: null,
      result: card,
      run: async () => {},
    },
    {
      title: "A quarter of the way through",
      description:
        "With constant-speed motion, the card has completed a quarter of its growth and upward movement.",
      prepare: () => draw(0),
      target: card,
      result: card,
      run: async ({ tween }) => tween(1000, t => draw(t * 0.25)),
    },
    {
      title: "Same moment, different timing",
      description:
        "Easing starts more slowly. At the same moment, the card is still closer to its compact state. Only the timing changed.",
      prepare: () => draw(0.25),
      target: card,
      result: card,
      run: async () => draw(0.25, "smooth"),
    },
    {
      title: "Settle into the expanded state",
      description:
        "The card speeds up, then slows as it reaches its final size and position. Both timing curves end here.",
      prepare: () => draw(0.25, "smooth"),
      target: card,
      result: card,
      run: async ({ tween }) =>
        tween(1500, t => draw(0.25 + t * 0.75, "smooth")),
    },
  ];
}
