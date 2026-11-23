export interface WalkthroughPageProps {
  prototypePath?: string;
  slide?: number;
}
export type Tween = (
  duration: number,
  update: (progress: number) => void
) => Promise<void>;
export interface Step {
  title: string;
  description: string;
  prepare: (animate: boolean) => void;
  target: Element | null;
  result: Element | null;
  run: (context: {
    tween: Tween;
    cue: (element: Element | null, kind: "action" | "result") => void;
  }) => Promise<void>;
}
export function walkthrough(
  root: HTMLElement,
  steps: Step[],
  initialSlide: number,
  onNavigate: (slide: number) => void
) {
  const panel = root.querySelector<HTMLElement>(".walkthrough")!;
  const stage = root.querySelector<HTMLElement>(".tour-stage")!;
  const caption = panel.querySelector<HTMLElement>(".walkthrough-caption")!;
  const back = root.querySelector<HTMLButtonElement>("[data-back]")!;
  const next = root.querySelector<HTMLButtonElement>("[data-next]")!;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let index = initialSlide - 1,
    running = false,
    controller: AbortController | undefined;
  function clear() {
    controller?.abort();
    root
      .querySelectorAll("[data-tour-cue]")
      .forEach(el => el.removeAttribute("data-tour-cue"));
  }
  function text(title: string, body: string) {
    caption.querySelector("strong")!.textContent = title;
    caption.querySelector("p")!.textContent = body;
  }
  function controls() {
    stage.setAttribute("aria-busy", String(running));
    back.disabled = index === 0;
    next.disabled = running || index === steps.length - 1;
    root.querySelector(".walkthrough-count")!.textContent =
      `${index + 1} / ${steps.length}`;
  }
  async function show(animate = true) {
    if (!stage.clientWidth) return;
    clear();
    controller = new AbortController();
    const signal = controller.signal;
    const step = steps[index];
    running = true;
    controls();
    text(step.title, step.description);
    step.prepare(animate);
    const cue = (element: Element | null, kind: "action" | "result") => {
      signal.throwIfAborted();
      root
        .querySelectorAll("[data-tour-cue]")
        .forEach(el => el.removeAttribute("data-tour-cue"));
      element?.setAttribute("data-tour-cue", kind);
      if (element && stage.scrollHeight > stage.clientHeight) {
        const bounds = stage.getBoundingClientRect();
        const target = element.getBoundingClientRect();
        if (
          target.top < bounds.top + 12 ||
          target.bottom > bounds.bottom - 12
        ) {
          stage.scrollTop += target.top - bounds.top - 16;
        }
      }
    };
    const tween: Tween = (duration, update) =>
      new Promise<void>((resolve, reject) => {
        signal.throwIfAborted();
        if (!animate || reduced.matches) {
          update(1);
          resolve();
          return;
        }
        let frame: number;
        const abort = () => {
          cancelAnimationFrame(frame);
          reject(signal.reason);
        };
        signal.addEventListener("abort", abort, { once: true });
        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min(1, (now - start) / duration);
          update(progress);
          if (progress < 1) frame = requestAnimationFrame(tick);
          else {
            signal.removeEventListener("abort", abort);
            resolve();
          }
        };
        frame = requestAnimationFrame(tick);
      });
    try {
      cue(step.target, "action");
      if (step.target) await tween(550, () => {});
      signal.throwIfAborted();
      await step.run({ tween, cue });
      signal.throwIfAborted();
      cue(step.result, "result");
      running = false;
      controls();
    } catch (error) {
      if (!signal.aborted) throw error;
    }
  }
  async function navigate(direction: -1 | 1, event: MouseEvent) {
    if (direction === -1 && index === 0) return;
    if (direction === 1 && (running || index === steps.length - 1)) return;
    const keyboard = event.detail === 0;
    const trigger = direction === 1 ? next : back;
    index += direction;
    onNavigate(index + 1);
    await show(
      root.dataset.embeddedExplanations === "true" ||
        (direction === 1 && !keyboard)
    );
    // A native disabled button loses focus at either end of the tour.
    // Keep keyboard users in the navigation rather than dropping onto body.
    if (
      keyboard &&
      trigger.disabled &&
      (document.activeElement === trigger ||
        document.activeElement === document.body)
    ) {
      (direction === 1 ? back : next).focus({ preventScroll: true });
    }
  }
  back.onclick = event => {
    void navigate(-1, event);
  };
  next.onclick = event => {
    void navigate(1, event);
  };
  const onMotionChange = () => {
    void show(false);
  };
  const onVisibility = () => {
    if (document.hidden) clear();
    else void show(false);
  };
  reduced.addEventListener("change", onMotionChange);
  document.addEventListener("visibilitychange", onVisibility);
  let width = root.clientWidth;
  const resize = new ResizeObserver(() => {
    if (root.clientWidth === width) return;
    width = root.clientWidth;
    void show(false);
  });
  resize.observe(root);
  void show(false);
  const destroy = () => {
    clear();
    back.onclick = null;
    next.onclick = null;
    reduced.removeEventListener("change", onMotionChange);
    document.removeEventListener("visibilitychange", onVisibility);
    resize.disconnect();
  };
  return {
    destroy,
    get slide() {
      return index + 1;
    },
    refresh: () => {
      void show(false);
    },
  };
}
