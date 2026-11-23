import type { Step, Tween } from "./walkthrough";

const original = "Renting is throwing money away.";
const rewritten = "Renting is like pouring money down a drain.";
const before =
  "Buying a home is often described as the next step. Rent is treated as a cost with nothing to show for it. The usual argument sounds straightforward.";
const after = "From that perspective, owning seems like the obvious choice.";
const bracePath =
  "M1 1 C1 9 8 10 20 10 H104 C116 10 118 11 120 18 C122 11 124 10 136 10 H220 C232 10 239 9 239 1";

type Position = {
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  braceOpacity?: number;
};
type Word = { key: string; text: string; rect: Position };

// A persistent explanation needs no extra click until its text changes.
const beats: readonly {
  visual: number;
  explanation: number | null;
  title: string;
  underlined?: boolean;
}[] = [
  { visual: -1, explanation: 0, title: "Imagine editing an essay" },
  { visual: 0, explanation: 0, title: "Show the paragraph" },
  {
    visual: 0,
    explanation: 1,
    underlined: true,
    title: "Keep the intent, change the format",
  },
  { visual: 1, explanation: 1, title: "Name the rhetorical device" },
  {
    visual: 2,
    explanation: 1,
    title: "Move the sentence into the left column",
  },
  { visual: 3, explanation: 1, title: "Connect the rhetorical devices" },
  { visual: 4, explanation: 1, title: "Choose a different device" },
  { visual: 5, explanation: 1, title: "Write into the new form" },
  { visual: 5, explanation: 2, title: "Generate the new text" },
  { visual: 6, explanation: 3, title: "Swap in the replacement" },
  { visual: 7, explanation: null, title: "Resume reading" },
];

export const sentenceSlideCount = beats.length;

export function sentenceAbstractionSteps(root: HTMLElement): Step[] {
  const scene = root.querySelector<HTMLElement>(".essay-scene")!;
  const measure = scene.querySelector<HTMLElement>(".essay-measure")!;
  const visual = scene.querySelector<HTMLElement>(".essay-visual")!;
  const accessible = scene.querySelector<HTMLElement>(".essay-accessible")!;
  const explanation = scene.querySelector<HTMLElement>(".explanation-current")!;
  const leaving = scene.querySelector<HTMLElement>(".explanation-leaving")!;
  const oldColumn = scene.querySelector<HTMLElement>(".pair-original")!;
  const newColumn = scene.querySelector<HTMLElement>(".pair-replacement")!;
  const nodes = new Map<string, HTMLElement>();
  let positions = new Map<string, Position>();

  function words(parent: HTMLElement, text: string, prefix: string) {
    text.split(" ").forEach((word, index) => {
      const span = document.createElement("span");
      span.dataset.word = `${prefix}:${index}`;
      span.textContent = word;
      parent.append(span, " ");
    });
  }
  function paragraph(sentence: string, prefix: string) {
    measure.replaceChildren();
    for (const key of ["leading", "trailing"]) {
      const ellipsis = document.createElement("span");
      ellipsis.className = "ellipsis";
      ellipsis.dataset.word = key;
      ellipsis.textContent = "…";
      measure.append(ellipsis);
      if (key === "leading") {
        const p = document.createElement("p");
        words(p, before, "before");
        words(p, sentence, prefix);
        words(p, after, "after");
        measure.append(p);
      }
    }
  }
  function rect(element: HTMLElement): Position {
    const box = element.getBoundingClientRect();
    const origin = scene.getBoundingClientRect();
    return {
      x: box.left - origin.left - scene.clientLeft,
      y: box.top - origin.top - scene.clientTop,
      width: box.width,
      height: box.height,
      opacity: 1,
    };
  }
  function read(parent: HTMLElement): Word[] {
    return [...parent.querySelectorAll<HTMLElement>("[data-word]")].map(el => ({
      key: el.dataset.word!,
      text: el.textContent!,
      rect: rect(el),
    }));
  }
  function lines(items: Word[]) {
    const result: Word[][] = [];
    items.forEach(word => {
      const last = result.at(-1);
      if (last && Math.abs(last[0].rect.y - word.rect.y) < 2) last.push(word);
      else result.push([word]);
    });
    return result;
  }
  function node(key: string, text = "") {
    let element = nodes.get(key);
    if (!element) {
      element = document.createElement("span");
      element.dataset.part = key;
      if (key.startsWith("brace")) {
        element.className = "phrase-annotation";
        element.innerHTML = `<svg class="underbrace" viewBox="0 0 240 20" preserveAspectRatio="none"><path d="${bracePath}" fill="none" stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg><span></span>`;
      } else if (key.startsWith("underline")) {
        element.className = "sentence-underline";
      } else if (key === "arrow") {
        element.className = "rewrite-arrow";
        element.innerHTML =
          '<svg viewBox="0 0 32 20" fill="none"><path d="M2 10h27m-8-7 8 7-8 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      } else {
        element.className = "essay-word";
        element.textContent = text;
      }
      nodes.set(key, element);
      visual.append(element);
    }
    return element;
  }
  function apply(layout: Map<string, Position>) {
    nodes.forEach((element, key) => {
      const value = layout.get(key);
      element.style.opacity = String(value?.opacity ?? 0);
      if (!value) return;
      element.style.transform = `translate(${value.x}px, ${value.y}px)`;
      if (key.startsWith("brace"))
        element.querySelector("svg")!.style.opacity = String(
          value.braceOpacity ?? 1
        );
      if (
        key.startsWith("brace") ||
        key.startsWith("underline") ||
        key === "arrow"
      )
        element.style.width = `${value.width}px`;
      if (key === "arrow") {
        element
          .querySelector("svg")!
          .setAttribute("viewBox", `0 0 ${value.width} 20`);
        element
          .querySelector("path")!
          .setAttribute("d", `M1 10H${value.width - 2}m-8-7 8 7-8 7`);
      }
    });
  }
  function addWords(
    layout: Map<string, Position>,
    items: Word[],
    opacity: number
  ) {
    items.forEach(word => {
      node(word.key, word.text);
      layout.set(word.key, { ...word.rect, opacity });
    });
  }
  function addBrace(
    layout: Map<string, Position>,
    key: string,
    bounds: Position,
    label: string,
    opacity: number,
    braceOpacity = 1
  ) {
    node(key).querySelector("span")!.textContent = label;
    layout.set(key, { ...bounds, height: 43, opacity, braceOpacity });
  }
  words(oldColumn, original, "old");
  words(newColumn, rewritten, "new");

  function draw(index: number, underlined = false) {
    scene.dataset.sceneStep = String(index);
    const split = index >= 2 && index <= 5;
    const restored = index >= 6;
    const annotated = index > 0 && index < 7;
    const prefix = restored ? "new" : "old";
    const layout = new Map<string, Position>();

    // Let the browser wrap a real paragraph. Its word rectangles are the
    // destination for the visible text, including sentences sharing a line.
    // Reserve the largest annotated height so the canvas never jumps.
    let requiredHeight = 0;
    for (const [sentence, type] of [
      [original, "old"],
      [rewritten, "new"],
    ]) {
      paragraph(sentence, type);
      const targetLines = lines(
        read(measure).filter(word => word.key.startsWith(type + ":"))
      );
      requiredHeight = Math.max(
        requiredHeight,
        measure.offsetHeight + (targetLines.length - 1) * 27 + 48
      );
    }
    const padding = parseFloat(getComputedStyle(scene).paddingTop);
    // Keep the entire lower third available for narration at every step.
    const contentHeight = Math.max(
      (parseFloat(getComputedStyle(scene).minHeight) * 2) / 3,
      requiredHeight + padding * 2 + 2
    );
    scene.style.height = `${Math.ceil(contentHeight * 1.5)}px`;
    paragraph(restored ? rewritten : original, prefix);
    const passage = read(measure);
    const selected = passage.filter(word => word.key.startsWith(prefix + ":"));
    const selectedLines = lines(selected);
    const selectedLineY = selectedLines.map(line => line[0].rect.y);
    const contextOpacity = split ? 0 : annotated ? 0.35 : 1;
    passage.forEach(word => {
      if (annotated) {
        word.rect.y += selectedLineY.reduce(
          (gap, y, i) =>
            gap +
            (y < word.rect.y - 2
              ? i === selectedLines.length - 1
                ? 48
                : 27
              : 0),
          0
        );
      }
    });
    addWords(
      layout,
      passage.filter(word => !word.key.startsWith(prefix + ":")),
      contextOpacity
    );

    if (!split) {
      addWords(layout, selected, 1);
      // A wrapped sentence gets a brace beneath each line; only its final
      // brace carries the label. No forced line breaks or inline blocks.
      selectedLines.forEach((line, i) => {
        const first = line[0].rect;
        const last = line.at(-1)!.rect;
        const final = i === selectedLines.length - 1;
        const underlineKey = `underline-${prefix}:${i}`;
        node(underlineKey);
        layout.set(underlineKey, {
          ...first,
          y: first.y + first.height - 1,
          width: last.x + last.width - first.x,
          height: 1.5,
          opacity: underlined ? 1 : 0,
        });
        addBrace(
          layout,
          `brace-${prefix}:${final ? 0 : i + 1}`,
          {
            ...first,
            y: first.y + first.height + 3,
            width: last.x + last.width - first.x,
          },
          final ? (restored ? "simile" : "metaphor") : "",
          annotated ? 1 : 0
        );
      });
    }
    for (const [column, type, label] of [
      [oldColumn, "old", "metaphor"],
      [newColumn, "new", "simile"],
    ] as const) {
      if (!split && type === prefix) continue;
      const items = read(column);
      const bounds = rect(column);
      const left = Math.min(...items.map(word => word.rect.x));
      const right = Math.max(
        ...items.map(word => word.rect.x + word.rect.width)
      );
      const textWidth = right - left;
      const textLeft = bounds.x + (bounds.width - textWidth) / 2;
      // Center the wrapped sentence as a unit. The brace follows its actual
      // text bounds, including while the replacement words are still hidden.
      items.forEach(word => {
        word.rect.x += textLeft - left;
      });
      addWords(layout, items, split && (type === "old" || index >= 5) ? 1 : 0);
      const bottom = Math.max(
        ...items.map(word => word.rect.y + word.rect.height)
      );
      addBrace(
        layout,
        `brace-${type}:0`,
        { ...bounds, x: textLeft, y: bottom + 3, width: textWidth },
        label,
        split && (type === "old" || index >= 4) ? 1 : 0,
        // Choose the form first; reveal its brace with the generated words.
        type === "old" || index >= 5 ? 1 : 0
      );
    }
    node("arrow");
    const oldBrace = layout.get("brace-old:0")!;
    const newBrace = layout.get("brace-new:0")!;
    const oldAnnotation = node("brace-old:0");
    const oldLabel = oldAnnotation
      .querySelector("span")!
      .getBoundingClientRect();
    const newLabel = node("brace-new:0")
      .querySelector("span")!
      .getBoundingClientRect();
    const labelCenter =
      oldLabel.top -
      oldAnnotation.getBoundingClientRect().top +
      oldLabel.height / 2;
    const arrowStart = oldBrace.x + (oldBrace.width + oldLabel.width) / 2 + 12;
    const arrowEnd = newBrace.x + (newBrace.width - newLabel.width) / 2 - 12;
    layout.set("arrow", {
      x: arrowStart,
      y: oldBrace.y + labelCenter - 10,
      width: Math.max(20, arrowEnd - arrowStart),
      height: 20,
      opacity: index >= 3 && index <= 5 ? 1 : 0,
    });
    if (index < 0)
      layout.forEach(position => {
        position.opacity = 0;
      });
    accessible.textContent =
      index < 0 ? "" : `${before} ${restored ? rewritten : original} ${after}`;
    positions = layout;
    apply(layout);
  }

  async function transition(
    index: number,
    tween: Tween,
    underlined = false,
    duration = 360
  ) {
    const previous = positions;
    draw(index, underlined);
    const destination = positions;
    const frame = (progress: number) => {
      const eased = progress * progress * (3 - 2 * progress);
      const current = new Map<string, Position>();
      nodes.forEach((_, key) => {
        const from = previous.get(key) ?? {
          ...destination.get(key)!,
          opacity: 0,
        };
        const to = destination.get(key) ?? { ...from, opacity: 0 };
        current.set(key, {
          x: from.x + (to.x - from.x) * eased,
          y: from.y + (to.y - from.y) * eased,
          width: from.width + (to.width - from.width) * eased,
          height: to.height,
          opacity: from.opacity + (to.opacity - from.opacity) * eased,
          braceOpacity:
            (from.braceOpacity ?? 1) +
            ((to.braceOpacity ?? 1) - (from.braceOpacity ?? 1)) * eased,
        });
      });
      apply(current);
    };
    frame(0);
    await tween(duration, frame);
    apply(destination);
  }

  const explanations = [
    "imagine you’re editing an essay on owning vs. renting a home.",
    'I often find myself wanting to keep the "intent" of a sentence but play around with different versions.',
    'The experience I imagine here is swapping out the format (metaphor → simile) and the UI uses AI to generate the new text ("Renting is like...")',
    'And swaps it in ("Renting is throwing.." → "Renting is like..")',
  ] as const;

  function writeExplanation(element: HTMLElement, index: number | null) {
    element.replaceChildren();
    element.dataset.explanation = String(index);
    if (index === null) return;
    if (index !== 2) {
      element.textContent = explanations[index];
      return;
    }
    // Treat the parenthetical examples as asides, including during crossfades.
    for (const part of explanations[index].split(/(\([^)]*\))/g)) {
      if (part.startsWith("(")) {
        const aside = document.createElement("em");
        aside.textContent = part;
        element.append(aside);
      } else element.append(part);
    }
  }
  function setExplanation(index: number | null) {
    if (explanation.dataset.explanation !== String(index))
      writeExplanation(explanation, index);
    explanation.style.opacity = index === null ? "0" : "1";
    leaving.style.opacity = "0";
    leaving.textContent = "";
  }
  function renderStep(index: number) {
    scene.dataset.walkthroughStep = String(index);
    draw(beats[index].visual, beats[index].underlined);
    setExplanation(beats[index].explanation);
  }
  async function crossfade(index: number | null, tween: Tween, duration = 280) {
    leaving.replaceChildren(
      ...[...explanation.childNodes].map(child => child.cloneNode(true))
    );
    writeExplanation(explanation, index);
    explanation.style.opacity = "0";
    leaving.style.opacity = "1";
    await tween(duration, progress => {
      const eased = progress * progress * (3 - 2 * progress);
      explanation.style.opacity = String(index === null ? 0 : eased);
      leaving.style.opacity = String(1 - eased);
    });
    setExplanation(index);
  }

  return beats.map((beat, index): Step => ({
    title: beat.title,
    description:
      beat.explanation === null ? "" : explanations[beat.explanation],
    prepare: () => renderStep(Math.max(0, index - 1)),
    target: null,
    result: null,
    run: async ({ tween }) => {
      scene.dataset.walkthroughStep = String(index);
      if (index === 0) return;
      const previous = beats[index - 1];
      const duration = beat.visual !== previous.visual ? 360 : 280;
      // The swap explanation enters as the replacement returns to the essay.
      await Promise.all([
        beat.visual !== previous.visual ||
        beat.underlined !== previous.underlined
          ? transition(beat.visual, tween, beat.underlined, duration)
          : undefined,
        beat.explanation !== previous.explanation
          ? crossfade(beat.explanation, tween, duration)
          : undefined,
      ]);
    },
  }));
}
