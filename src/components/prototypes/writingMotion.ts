import type { Tween } from "./walkthrough";

const smooth = (p: number) => p * p * (3 - 2 * p);
const phase = (time: number, start: number, duration: number) =>
  smooth(Math.max(0, Math.min(1, (time - start) / duration)));
const easeOut = (p: number) => 1 - (1 - p) ** 3;

function carouselEdges(list: HTMLElement) {
  const overflow = Math.max(0, list.scrollWidth - list.clientWidth);
  const left = Math.max(0, Math.min(overflow, list.scrollLeft));
  return {
    overflow,
    position: left,
    left: Math.min(28, left),
    right: Math.min(28, overflow - left),
  };
}

function syncCarousel(list: HTMLElement) {
  const { left, right, overflow, position } = carouselEdges(list);
  const strip = list.parentElement!;
  strip.style.setProperty("--fade-left", `${left}px`);
  strip.style.setProperty("--fade-right", `${right}px`);
  const scrollbar = strip.querySelector<HTMLInputElement>(".choice-scrollbar")!;
  scrollbar.hidden = overflow === 0;
  if (!overflow) return;
  const percent = (100 * position) / overflow;
  scrollbar.value = String(percent);
  scrollbar.setAttribute("aria-valuetext", `${Math.round(percent)}% scrolled`);
  scrollbar.style.setProperty(
    "--thumb-width",
    `${(100 * list.clientWidth) / list.scrollWidth}%`
  );
}

function setupCarousel(dock: HTMLElement, list: HTMLElement) {
  list.tabIndex = 0;
  list.setAttribute("role", "region");
  const scrollbar =
    list.parentElement!.querySelector<HTMLInputElement>(".choice-scrollbar")!;
  syncCarousel(list);
  let idleTimer: number;
  list.onscroll = () => {
    syncCarousel(list);
    scrollbar.dataset.scrolling = "";
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(
      () => delete scrollbar.dataset.scrolling,
      160
    );
  };
  scrollbar.oninput = () => {
    if (!dock.closest('[aria-busy="true"]'))
      list.scrollLeft =
        ((list.scrollWidth - list.clientWidth) * scrollbar.valueAsNumber) / 100;
    syncCarousel(list);
  };
  dock.onwheel = event => {
    if (event.ctrlKey || !event.cancelable || scrollbar.hidden) return;
    event.preventDefault();
    if (dock.closest('[aria-busy="true"]')) return;
    const { deltaMode, deltaX, deltaY } = event;
    let distance = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
    if (deltaMode === WheelEvent.DOM_DELTA_LINE)
      distance *= parseFloat(getComputedStyle(list).lineHeight) || 20;
    if (deltaMode === WheelEvent.DOM_DELTA_PAGE) distance *= list.clientWidth;
    list.scrollLeft += distance;
  };
  let drag: { id: number; x: number; left: number } | undefined;
  list.onpointerdown = event => {
    if (
      (event.target instanceof Element &&
        event.target.closest(".writing-help")) ||
      event.pointerType !== "mouse" ||
      event.button !== 0 ||
      list.scrollWidth <= list.clientWidth
    )
      return;
    drag = { id: event.pointerId, x: event.clientX, left: list.scrollLeft };
    list.setPointerCapture(event.pointerId);
  };
  list.onpointermove = event => {
    if (drag?.id === event.pointerId)
      list.scrollLeft = drag.left + drag.x - event.clientX;
  };
  list.onlostpointercapture = () => {
    drag = undefined;
  };
  list.onkeydown = event => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    list.scrollLeft +=
      (event.key === "ArrowRight" ? 1 : -1) * list.clientWidth * 0.7;
  };
}

// Compare authored controls, ignoring live scroll offsets, focus, and animation styles.
const panelTemplates = new WeakMap<HTMLElement, Node>();

export function preparePanelChange(
  dock: HTMLElement,
  content: DocumentFragment,
  reuse: boolean
) {
  const old = [...dock.children] as HTMLElement[];
  const next = [...content.children] as HTMLElement[];
  const key = (node: HTMLElement) => node.className || node.tagName;
  const oldByKey = new Map(old.map(node => [key(node), node]));
  const nextKeys = new Set(next.map(key));
  const nodes = next.map(node => {
    const prior = oldByKey.get(key(node));
    if (reuse && prior && panelTemplates.get(prior)?.isEqualNode(node))
      return prior;
    panelTemplates.set(node, node.cloneNode(true));
    return node;
  });
  const previousHeading = oldByKey.get("question-line");
  const nextHeading = nodes.find(node =>
    node.classList.contains("question-line")
  );
  const changesQuestion = Boolean(
    previousHeading && nextHeading && previousHeading !== nextHeading
  );
  const midpoint = !old.length
    ? 0
    : !nodes.length
      ? 1
      : changesQuestion
        ? 0.32
        : 0.5;
  let outgoing: HTMLElement | undefined;
  let incoming: HTMLElement | undefined;
  let committed = false;
  function paint(progress: number, answers: number) {
    if (!committed && progress < midpoint) {
      for (const node of old) {
        if (nodes.includes(node)) continue;
        if (changesQuestion && node === previousHeading) {
          node.style.opacity = String(1 - phase(progress, 0, 0.68));
          continue;
        }
        const keepVisible =
          nextKeys.has(key(node)) &&
          !(changesQuestion && node.classList.contains("choice-window"));
        node.style.opacity = String(
          1 - (progress / midpoint) * (keepVisible ? 0.5 : 1)
        );
      }
      if (!nodes.length) dock.style.opacity = String(1 - progress);
      return;
    }
    if (!committed) {
      // Both wordings occupy the same heading slot during the handoff.
      if (changesQuestion && nextHeading && previousHeading && progress < 1) {
        outgoing = document.createElement("span");
        outgoing.textContent =
          previousHeading.querySelector("h4")!.getAttribute("aria-label") ??
          previousHeading.querySelector("h4")!.textContent;
        outgoing.setAttribute("aria-hidden", "true");
        incoming = document.createElement("span");
        const heading = nextHeading.querySelector("h4")!;
        incoming.textContent = heading.textContent;
        heading.setAttribute("aria-label", heading.textContent ?? "");
        heading.replaceChildren(outgoing, incoming);
      }
      const previousList = dock.querySelector(".choice-list");
      for (const node of old) if (!nodes.includes(node)) node.remove();
      nodes.forEach((node, i) => {
        const slot = dock.children[i];
        if (slot !== node) dock.insertBefore(node, slot ?? null);
      });
      const list = dock.querySelector<HTMLElement>(".choice-list");
      if (list !== previousList) {
        dock.onwheel = null;
        if (list) setupCarousel(dock, list);
      }
      committed = true;
    }
    dock.style.opacity = old.length ? "1" : String(progress);
    for (const node of nodes) {
      if (node === nextHeading && progress === 1) {
        const heading = node.querySelector("h4")!;
        if (heading.childElementCount)
          heading.textContent = heading.getAttribute("aria-label");
      }
      if (node === nextHeading && outgoing && incoming) {
        outgoing.style.opacity = String(1 - phase(progress, 0, 0.68));
        incoming.style.opacity = String(
          phase(progress, midpoint, 1 - midpoint)
        );
        continue;
      }
      if (old.includes(node)) {
        if (progress === 1) node.style.removeProperty("opacity");
        continue;
      }
      const start =
        oldByKey.has(key(node)) &&
        !(changesQuestion && node.classList.contains("choice-window"))
          ? 0.5
          : 0;
      const p = node.classList.contains("choice-window") ? answers : progress;
      node.style.opacity = String(
        start + (1 - start) * Math.max(0, (p - midpoint) / (1 - midpoint))
      );
      if (p === 1) node.style.removeProperty("opacity");
    }
  }
  return { paint, duration: changesQuestion ? 1250 : 360 };
}

export async function revealTarget(target: HTMLElement, tween: Tween) {
  const scroller = target.closest<HTMLElement>(".choice-list, .draft-page");
  if (!scroller) return;
  const horizontal = scroller.classList.contains("choice-list");
  const box = scroller.getBoundingClientRect();
  const item = target.getBoundingClientRect();
  const lead = horizontal ? item.left - box.left : item.top - box.top;
  const size = horizontal ? item.width : item.height;
  const view = horizontal ? scroller.clientWidth : scroller.clientHeight;
  const edges = horizontal ? carouselEdges(scroller) : { left: 0, right: 0 };
  if (lead >= edges.left && lead + size <= view - edges.right) return;
  const key = horizontal ? "scrollLeft" : "scrollTop";
  const start = scroller[key];
  const limit =
    (horizontal ? scroller.scrollWidth : scroller.scrollHeight) - view;
  const end = Math.max(0, Math.min(limit, start + lead + (size - view) / 2));
  await tween(420, p => {
    scroller[key] = start + (end - start) * smooth(p);
    if (horizontal) syncCarousel(scroller);
  });
}

export async function aimPointer(
  work: HTMLElement,
  target: HTMLElement,
  tween: Tween,
  from?: HTMLElement
) {
  const pointer = work.querySelector<HTMLElement>(".writing-pointer")!;
  const glyph = pointer.querySelector("svg")!;
  const area = work.getBoundingClientRect();
  const origin = from?.getBoundingClientRect();
  const startX = origin
    ? origin.left + origin.width / 2 - area.left
    : area.width / 2;
  const startY = origin
    ? origin.top + origin.height / 2 - area.top
    : area.height / 2;
  const move = (x: number, y: number) => {
    pointer.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };
  pointer.hidden = false;
  glyph.style.removeProperty("scale");
  move(startX, startY);
  if (!from) {
    pointer.style.opacity = "0";
    await tween(190, p => {
      pointer.style.opacity = String(easeOut(p));
    });
  }
  await revealTarget(
    target.closest<HTMLElement>(".choice-item") ?? target,
    tween
  );

  const bounds = target.getBoundingClientRect();
  const dx = bounds.left + bounds.width / 2 - area.left - startX;
  const dy = bounds.top + bounds.height / 2 - area.top - startY;
  // A shallow arc and a brief dwell separate aiming from pressing.
  await tween(690, p => {
    const t = smooth(p);
    if (p > 0.7 && target.classList.contains("writing-help"))
      target.parentElement!.dataset.helpHover = "";
    move(
      startX +
        dx * t +
        Math.min(18, Math.abs(dy) * 0.09) * Math.sin(Math.PI * t),
      startY + dy * t
    );
  });
  await tween(150, () => {});
  return pointer;
}

export async function animatePress(
  work: HTMLElement,
  target: HTMLElement,
  tween: Tween
) {
  const pointer = await aimPointer(work, target, tween);
  const glyph = pointer.querySelector("svg")!;
  target.style.setProperty("--press-fill", "0%");
  target.dataset.chosen = "true";
  try {
    await tween(240, p => {
      target.style.setProperty("--press-fill", `${phase(p, 0, 0.55) * 100}%`);
      const pressure = Math.sin(Math.PI * p);
      glyph.style.scale = String(1 - pressure * 0.08);
      target.style.scale = String(1 - pressure * 0.035);
    });
    await tween(150, p => {
      pointer.style.opacity = String(1 - smooth(p));
      target.style.setProperty("--press-fill", `${(1 - smooth(p)) * 100}%`);
    });
  } finally {
    pointer.hidden = true;
    delete target.dataset.chosen;
    target.style.removeProperty("--press-fill");
    target.style.removeProperty("scale");
  }
}

// The dock gains exactly the space the mic travels. Its question and carousel stay anchored.
export async function animateDictation(
  scene: HTMLElement,
  spoken: boolean,
  tween: Tween
) {
  if (!spoken && !scene.hasAttribute("data-dictating")) return;
  const row = scene.querySelector<HTMLElement>(".decision-dock .dictation-row");
  if (!row) return;
  const words = row.querySelector<HTMLElement>(".dictated-words")!;
  const mic = row.querySelector<HTMLButtonElement>(".dictation-mic")!;
  const from =
    parseFloat(scene.style.getPropertyValue("--dictation-space")) || 0;
  const ink = Number(scene.style.getPropertyValue("--dictation-opacity"));
  const to = spoken ? words.offsetHeight + 6 : 0;
  const targetOpacity = Number(spoken);
  scene.setAttribute("data-dictating", "");
  mic.setAttribute("aria-pressed", String(spoken));
  if (from !== to || ink !== targetOpacity) {
    await tween(660, p => {
      const movement = spoken ? phase(p, 0, 0.76) : phase(p, 0.24, 0.76);
      const fade = spoken ? phase(p, 0.32, 0.68) : phase(p, 0, 0.64);
      scene.style.setProperty(
        "--dictation-space",
        `${from + (to - from) * movement}px`
      );
      scene.style.setProperty(
        "--dictation-opacity",
        String(ink + (targetOpacity - ink) * fade)
      );
    });
  }
  if (!spoken) {
    scene.removeAttribute("data-dictating");
    scene.style.removeProperty("--dictation-space");
    scene.style.removeProperty("--dictation-opacity");
  }
}

const labelSelector = ".taxonomy-trigger, .term-label";
// Capture both the line and its caption: on narrow screens the genre sits at the top.
export function measureOutlineBrackets(page: HTMLElement) {
  const brackets = new Map<string, { line: DOMRect; caption: DOMRect }>();
  for (const scope of page.querySelectorAll(".document-labels, .beat-label")) {
    const trigger = scope.querySelector<HTMLElement>(".taxonomy-trigger");
    if (trigger)
      brackets.set(trigger.dataset.write!, {
        line: scope.getBoundingClientRect(),
        caption: trigger.getBoundingClientRect(),
      });
  }
  return brackets;
}
export function animateOutlineBrackets(
  page: HTMLElement,
  before: ReturnType<typeof measureOutlineBrackets>,
  tween: Tween
) {
  const motions: ((remaining: number) => void)[] = [];
  for (const scope of page.querySelectorAll<HTMLElement>(
    ".document-labels, .beat-label"
  )) {
    const caption = scope.querySelector<HTMLElement>(".taxonomy-trigger");
    const old = caption && before.get(caption.dataset.write!);
    if (!caption || !old) continue;
    const line = scope.getBoundingClientRect(),
      label = caption.getBoundingClientRect();
    const x = old.line.left - line.left,
      y = old.line.top - line.top + (old.line.height - line.height) / 2;
    const scale = (old.line.height - 4) / Math.max(1, line.height - 4);
    const dx = old.caption.left - label.left,
      dy = old.caption.top - label.top;
    if (!x && !y && scale === 1 && !dx && !dy) continue;
    motions.push((p: number) => {
      scope.style.setProperty(
        "--scope-line-transform",
        `translate(${x * p}px, ${y * p}px) scaleY(${1 + (scale - 1) * p})`
      );
      caption.style.translate = `${dx * p}px ${dy * p}px`;
      if (p === 0) {
        scope.style.removeProperty("--scope-line-transform");
        caption.style.removeProperty("translate");
      }
    });
  }
  if (!motions.length) return Promise.resolve();
  for (const move of motions) move(1);
  return tween(520, p => {
    for (const move of motions) move(1 - smooth(p));
  });
}
const labelKey = (label: HTMLElement) => label.dataset.write ?? "";
export function moveTermLabel(label?: HTMLElement | null, from?: DOMRect) {
  const term = label?.closest<HTMLElement>(".term-annotation");
  if (!term || !label || !from) return;
  const to = label.getBoundingClientRect();
  return (progress: number) => {
    if (progress === 1) {
      term.style.removeProperty("--term-x");
      term.style.removeProperty("--term-y");
    } else {
      term.style.setProperty(
        "--term-x",
        (from.left - to.left) * (1 - progress) + "px"
      );
      term.style.setProperty(
        "--term-y",
        (from.top - to.top) * (1 - progress) + "px"
      );
    }
  };
}
export async function pendingRevision(targets: HTMLElement[], tween: Tween) {
  const labels = new Map<
    string,
    { text: string; bracket?: DOMRect; term?: DOMRect }
  >();
  for (const target of targets) {
    target.setAttribute("aria-busy", "true");
    for (const label of target.querySelectorAll<HTMLElement>(labelSelector)) {
      const bracket = label
        .closest(".document-labels")
        ?.getBoundingClientRect();
      const term = label.matches(".term-label")
        ? label.getBoundingClientRect()
        : undefined;
      labels.set(labelKey(label), {
        text: label.textContent ?? "",
        bracket,
        term,
      });
    }
  }
  await tween(760, p => {
    for (const target of targets) {
      target.style.setProperty(
        "--prose-opacity",
        String(1 - 0.48 * phase(p, 0, 0.38))
      );
      const menu = target.querySelector<HTMLElement>(".genre-menu");
      if (menu) menu.style.opacity = String(1 - phase(p, 0, 0.35));
    }
  });
  // A visual copy retains the original line breaks while the replacement arrives.
  const page = targets[0].closest<HTMLElement>(".draft-page")!;
  for (const target of targets) target.dataset.revisionSource = "";
  const overlay = document.createElement("div");
  overlay.className = "revision-overlay";
  overlay.inert = true;
  overlay.setAttribute("aria-hidden", "true");
  overlay.append(page.firstElementChild!.cloneNode(true));
  for (const target of targets) delete target.dataset.revisionSource;
  return { labels, overlay, page };
}

function markDrafting(target: HTMLElement) {
  const copy = [...target.children] as HTMLElement[];
  const bounds = target.getBoundingClientRect();
  const firstWord = target
    .querySelector<HTMLElement>(".draft-words")
    ?.getClientRects()[0];
  target.dataset.drafting = "";
  target.setAttribute("aria-busy", "true");
  const loader = document.createElement("span");
  loader.className = "writing-loader";
  loader.setAttribute("role", "status");
  loader.setAttribute("aria-label", "drafting text");
  loader.style.left = `${Math.max(0, (firstWord?.left ?? bounds.left) - bounds.left)}px`;
  loader.style.top = `${Math.max(0, (firstWord?.top ?? bounds.top) - bounds.top)}px`;
  const lines = [0, 1, 2].map(() => document.createElement("i"));
  loader.append(...lines);
  for (const el of copy) {
    el.setAttribute("aria-hidden", "true");
  }
  target.append(loader);
  return { target, copy, loader, lines };
}

// Only the short replacement phase splits the incoming text into words.
function incomingWords(target: HTMLElement) {
  const words: HTMLElement[] = [];
  const ink = [...target.querySelectorAll<HTMLElement>(".draft-words")];
  let finished = false;
  for (const run of ink) {
    const tokens = (run.textContent ?? "").match(/\s+|\S+/gu) ?? [];
    run.replaceChildren(
      ...tokens.map(token => {
        if (!token.trim()) return token;
        const word = document.createElement("span");
        word.className = "revision-word";
        word.textContent = token;
        words.push(word);
        return word;
      })
    );
  }
  return {
    paint(time: number) {
      if (finished) return;
      target.style.setProperty(
        "--revision-fill",
        phase(time, 0, 310) * 100 + "%"
      );
      words.forEach((word, i) => {
        const delay = (150 * i) / Math.max(1, words.length - 1);
        const p = phase(time, delay, 310);
        word.style.opacity = String(p);
        word.style.transform = `translateY(${4 * (1 - p)}px)`;
      });
      if (time >= 460) {
        for (const run of ink) run.textContent = run.textContent;
        target.style.removeProperty("--revision-fill");
        finished = true;
      }
    },
  };
}

// Preserve a shared suffix (story → ghost story). Other labels dissolve in place.
function changeLabel(label: HTMLElement, before: string, after: string) {
  const shared = after.endsWith(" " + before);
  const wrap = document.createElement("span");
  wrap.className = "revision-label";
  const outgoing = document.createElement("span");
  const incoming = document.createElement("span");
  outgoing.textContent = before;
  incoming.textContent = shared ? after.slice(0, -before.length) : after;
  wrap.append(outgoing, incoming);
  const accessible = label.getAttribute("aria-label");
  label.setAttribute("aria-label", accessible ?? after);
  wrap.setAttribute("aria-hidden", "true");
  label.replaceChildren(wrap);
  const oldWidth = outgoing.getBoundingClientRect().width;
  const incomingWidth = incoming.getBoundingClientRect().width;
  const width = incomingWidth + (shared ? oldWidth : 0);
  wrap.style.width = width + "px";
  return {
    paint(p: number) {
      outgoing.style.opacity = String(shared ? 1 : 1 - p);
      outgoing.style.transform = shared
        ? `translateX(${incomingWidth * p}px)`
        : `translateY(${-2 * p}px)`;
      incoming.style.opacity = String(p);
      incoming.style.transform = `translateY(${3 * (1 - p)}px)`;
      label.style.setProperty(
        "--caret-offset",
        (oldWidth - width) * (1 - p) + "px"
      );
    },
    finish() {
      label.textContent = after;
      if (accessible === null) label.removeAttribute("aria-label");
      label.style.removeProperty("--caret-offset");
    },
  };
}

// Keep the finished layout in place while its ink and annotations arrive separately.
export async function revealWriting(
  generated: HTMLElement[],
  arriving: HTMLElement[],
  tween: Tween,
  showPanel: (question: number, answers: number) => void,
  panelDuration: number,
  revision?: Awaited<ReturnType<typeof pendingRevision>>,
  generatingControl?: HTMLElement
) {
  const drafting = revision ? [] : generated.map(markDrafting);
  const words = revision ? generated.map(incomingWords) : [];
  const savedControl =
    generatingControl &&
    generated[0]
      ?.closest(".draft-page")
      ?.querySelector<HTMLElement>(
        `[data-branch="${generatingControl.dataset.branch}"]`
      );
  const savedCaption = savedControl
    ?.closest(".sentence-annotation")
    ?.querySelector<HTMLElement>(".branch-caption");
  if (savedControl && generatingControl) {
    if (savedCaption)
      savedCaption.textContent = generatingControl.dataset.caption ?? "";
    generatingControl.setAttribute("aria-hidden", "true");
    savedControl.before(generatingControl);
  }
  const revisedLabels = generated.flatMap(target =>
    [...target.querySelectorAll<HTMLElement>(labelSelector)].map(label => {
      const previous = revision?.labels.get(labelKey(label));
      const text = label.textContent ?? "";
      const change =
        previous && previous.text !== text
          ? changeLabel(label, previous.text, text)
          : undefined;
      const bracket = label.closest<HTMLElement>(".document-labels");
      const bounds = bracket?.getBoundingClientRect();
      const move = moveTermLabel(label, previous?.term);
      return { label, previous, change, bracket, bounds, move };
    })
  );
  if (revision) revision.page.append(revision.overlay);
  const proseStart = revision ? 0 : 960;
  const proseDuration = 460;
  const readingPause = 1000;
  const labelStart = proseStart + proseDuration + readingPause;
  const labelDuration = 410;
  const hasLabels = generated.some(target =>
    target.querySelector(".sentence-label, .term-label, .draft-disclosure")
  );
  const stagger = 95;
  const panelStart = generated.length
    ? (hasLabels
        ? labelStart + labelDuration + readingPause
        : proseStart + proseDuration + 160) +
      (generated.length - 1) * stagger
    : arriving.length
      ? 220
      : 0;
  const answersDelay = 110;
  const duration = panelStart + answersDelay + panelDuration;

  const paint = (time: number) => {
    for (const target of arriving) {
      if (target.classList.contains("term-annotation"))
        target.style.setProperty("--term-space", String(phase(time, 0, 550)));
      else target.style.opacity = String(phase(time, 0, 360));
      target.style.setProperty(
        "--annotation-opacity",
        String(phase(time, 390, 300))
      );
    }
    if (savedControl && generatingControl) {
      const p = phase(time, proseStart, 300);
      generatingControl.style.opacity = String(1 - p);
      savedControl.style.opacity = String(p);
      if (savedCaption) savedCaption.style.opacity = String(1 - p);
      if (p === 1 && generatingControl.isConnected) {
        generatingControl.remove();
        if (savedCaption) {
          savedCaption.textContent = "";
          savedCaption.style.removeProperty("opacity");
        }
      }
    }
    if (revision) {
      const retire = phase(time, 0, 280);
      revision.overlay.style.opacity = String(1 - retire);
      revision.overlay.style.transform = `translateY(${-3 * retire}px)`;
      if (retire === 1 && revision.overlay.isConnected)
        revision.overlay.remove();
      words.forEach((run, i) => run.paint(time - i * stagger));
      const p = phase(time, labelStart, labelDuration);
      for (const {
        label,
        previous,
        change,
        bracket,
        bounds,
        move,
      } of revisedLabels) {
        if (!previous) {
          (
            label.closest<HTMLElement>(".term-annotation") ?? label
          ).style.setProperty("--annotation-opacity", String(p));
        }
        change?.paint(p);
        move?.(phase(time, 0, 600));
        if (bracket && bounds && previous?.bracket) {
          const remain = 1 - phase(time, 0, proseDuration);
          const old = previous.bracket;
          const x = (old.left - bounds.left) * remain;
          const y =
            (old.top - bounds.top + (old.height - bounds.height) / 2) * remain;
          bracket.style.transform = `translate(${x}px,${y}px)`;
          bracket.style.setProperty(
            "--bracket-scale",
            String(1 + (old.height / bounds.height - 1) * remain)
          );
        }
      }
    }
    drafting.forEach(({ target, lines, loader }, i) => {
      const t = time - i * stagger;
      loader.style.opacity = String(
        phase(t, 0, 260) * (1 - phase(t, 660, 300))
      );
      lines.forEach((line, index) => {
        const written = phase(t, 45 + index * 120, 300);
        line.style.transform = `scaleX(${0.18 + 0.82 * written})`;
      });
      target.style.setProperty(
        "--prose-opacity",
        String(phase(t, proseStart, proseDuration))
      );
      target.style.setProperty(
        "--annotation-opacity",
        String(phase(t, labelStart, labelDuration))
      );
      target.style.setProperty(
        "--branch-action-opacity",
        String(phase(t, labelStart + labelDuration + 400, 280))
      );
    });
    showPanel(
      phase(time, panelStart, panelDuration),
      phase(time, panelStart + answersDelay, panelDuration)
    );
  };

  paint(0);
  await tween(duration, p => paint(p * duration));
  for (const { target, copy, loader } of drafting) {
    loader.remove();
    delete target.dataset.drafting;
    target.removeAttribute("aria-busy");
    target.style.removeProperty("--prose-opacity");
    target.style.removeProperty("--annotation-opacity");
    target.style.removeProperty("--branch-action-opacity");
    for (const el of copy) el.removeAttribute("aria-hidden");
  }
  for (const target of generated)
    target.style.removeProperty("--prose-opacity");
  revision?.overlay.remove();
  savedControl?.style.removeProperty("opacity");
  for (const { label, change, bracket } of revisedLabels) {
    change?.finish();
    bracket?.style.removeProperty("transform");
    bracket?.style.removeProperty("--bracket-scale");
    (
      label.closest<HTMLElement>(".term-annotation") ?? label
    ).style.removeProperty("--annotation-opacity");
  }
  for (const target of arriving) {
    target.style.removeProperty("--term-space");
    target.style.removeProperty("opacity");
    target.style.removeProperty("--annotation-opacity");
  }
}
