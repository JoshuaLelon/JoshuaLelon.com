import { helpFor } from "./writingHelp";
import { writingHelpPopover } from "./writingHelpPopover";
import { examples, forms, mysteryArc, type Kind } from "./writingExamples";
import type { Step } from "./walkthrough";
import {
  animatePress,
  aimPointer,
  animateOutlineBrackets,
  measureOutlineBrackets,
  animateDictation,
  revealWriting,
  preparePanelChange,
  pendingRevision,
  moveTermLabel,
  revealTarget,
} from "./writingMotion";

type Question =
  "kind" | "lens" | "premise" | "fact" | "expand" | "form" | "read";
type Panel = "question" | "selections";
type BranchState = "undrafted" | "open" | "closed";
type State = {
  kind?: Kind;
  lens?: 0 | 1;
  fact?: 0 | 1;
  outline: BranchState;
  scenes: [BranchState, BranchState, BranchState];
  selected: number;
  forms: number[];
  reading: boolean;
  question: Question;
  panel: Panel;
  distance: number;
  group: number;
  visible: boolean;
};
const whole = 0;
const masks = [1, 2, 4, 3, 5, 6, 7];
const size = (mask: number) =>
  [1, 2, 4].filter(bit => (mask & bit) !== 0).length;
const initial = (): State => ({
  outline: "undrafted",
  scenes: ["undrafted", "undrafted", "undrafted"],
  selected: whole,
  forms: [0, 0, 0],
  reading: false,
  question: "kind",
  panel: "question",
  distance: 0,
  group: 0,
  visible: false,
});
const example = (s: State) => examples[s.kind ?? "story"];
const version = (s: State) => example(s).versions[s.lens ?? 0];
const genericPremise = {
  story:
    "a village postbox is about to close. the woman collecting its last letter finds her own name on the envelope.",
  essay: "when does owning two keys actually give you a backup?",
  ad: "a little tag gives lost keys a way home.",
};
const groupNames = ["one passage", "two passages", "all three passages"];
function label(s: State, q: Question) {
  return {
    kind: "document type",
    lens: example(s).lens,
    premise: "premise",
    fact: example(s).fact,
    expand: "level of detail",
    form: "rhetorical form",
    read: "finished draft",
  }[q];
}
function scope(s: State, mask = s.selected) {
  if (!mask) return "document";
  return version(s)
    .passages.filter((_, i) => mask & (1 << i))
    .map(p => p.label)
    .join(" + ");
}
function recommendation(s: State): [Question, number] {
  if (!s.kind) return ["kind", whole];
  if (s.lens === undefined) return ["lens", whole];
  if (s.outline === "undrafted") return ["premise", whole];
  if (s.fact === undefined) return ["fact", whole];
  const index = s.scenes.indexOf("undrafted");
  return index < 0 ? ["read", whole] : ["expand", 1 << index];
}
// Each slide inherits only from the preceding authored slide.
type Beat = {
  action?: string;
  foldOutlineFirst?: boolean;
  explainArc?: boolean;
  changes?: Partial<State>;
  generated?: string;
  rewriteFrom?: string;
  enter?: string;
  exit?: string;
  note: string;
};
const tour: Beat[] = [
  {
    note: "the writer opens a blank page with no plot in mind.",
  },
  {
    enter: ".blank-sheet",
    changes: { visible: true },
    note: "the writer picks “story” to get a premise to react to.",
  },
  {
    action: "kind/story",
    exit: ".blank-sheet",
    generated: ".premise-row",
    changes: { kind: "story", question: "lens" },
    note: "the writer scrolls through the genres and chooses “ghost story” to try a supernatural premise.",
  },
  {
    action: "lens/1",
    generated: ".premise-row",
    changes: { lens: 1, question: "premise" },
    note: "the writer checks what an emotional arc is, then looks up “rise, fall, rise” to see how it might read.",
  },
  {
    explainArc: true,
    note: "the writer leaves the arc undecided and uses the microphone to ask about nell first.",
  },
  {
    action: "redirect",
    changes: { question: "fact" },
    note: "the writer chooses “skeptic” for nell. the editor will keep that choice with her name.",
  },
  {
    action: "fact/0",
    enter: ".term-annotation",
    changes: { fact: 0, question: "premise" },
    note: "with nell’s character set, the writer opens the ghost story dropdown and chooses “mystery” to try the same premise in another genre.",
  },
  {
    action: "genre/lens/0",
    generated: ".premise-row",
    changes: { lens: 0 },
    note: "the writer chooses “rise, fall, rise” to shape nell’s last collection into three acts.",
  },
  {
    action: `arc/${mysteryArc}`,
    generated: ".beat",
    changes: { outline: "open", question: "expand" },
    note: "the writer folds the three acts to read the premise on its own, then reopens them with the same chevron.",
  },
  {
    action: "show/outline",
    foldOutlineFirst: true,
    enter: ".beat-list",
    note: "the highlight covers the premise and all three beats. the writer opens “select passages” to work on a smaller part.",
  },
  {
    action: "browse/selections",
    changes: { panel: "selections" },
    note: "the menu starts with nearby selections. the writer jumps to “far” to see how the full set of selections is grouped.",
  },
  {
    action: "level/2",
    changes: { distance: 2 },
    note: "the writer chooses “one passage.” the editor will show each of the three beats as a selection.",
  },
  {
    action: "group/0",
    changes: { distance: 1 },
    note: "the writer selects “act i · rise” to work on the moment nell hears the letter land.",
  },
  {
    action: "select/1",
    changes: { panel: "question", selected: 1 },
    note: "the writer chooses “draft scene” beside act i. the other two acts stay visible as summaries.",
  },
  {
    action: "expand/1",
    generated: ".beat[data-selected] .scene-prose",
    changes: { scenes: ["open", "undrafted", "undrafted"] },
    note: "nell writes down the time to the minute, putting her skepticism on the page. the writer opens the “concrete detail” label above “hit the tin floor.”",
  },
  {
    action: "device/1",
    changes: { question: "form" },
    note: "the highlight narrows to the wording the editor will rewrite. the writer chooses “simile” to change how the falling envelope sounds.",
  },
  {
    action: "form/2",
    generated: ".annotated-form[data-selected]",
    changes: { forms: [2, 0, 0] },
    note: "the envelope now lands “like a knuckle tapping tin.” the writer chooses “read draft” to expand the remaining beats and read all three together.",
  },
  {
    action: "read",
    generated: ".finished-copy p:nth-child(n + 2)",
    rewriteFrom: ".beat:nth-child(n + 2) .beat-text",
    exit: ".premise-text, .document-labels, .beat .sentence-label, .beat .term-label, .beat .draft-disclosure",
    changes: {
      scenes: ["open", "open", "open"],
      selected: whole,
      reading: true,
    },
    note: "the finished mystery opens with the sound of the envelope and ends with a goodbye from every house on nell’s route.",
  },
];
export const writingSlideCount = tour.length;

type Choice = [string, string?];
const alternatives = (...names: string[]): Choice[] =>
  names.map(name => [name]);
function lensChoices(s: State): Choice[] {
  const e = example(s);
  return [
    ...alternatives(
      ...(s.kind === "story"
        ? ["adventure", "romance", "fantasy", "thriller"]
        : s.kind === "ad"
          ? ["testimonial", "before and after", "demonstration"]
          : ["comparison", "argument", "chronology"])
    ),
    ...e.versions.map((v, i): Choice => [v.label, `lens/${i}`]),
    ...(s.kind === "story" ? alternatives("historical fiction", "comedy") : []),
  ];
}
function options(s: State): [string, Choice[]] {
  const e = example(s);
  if (s.panel === "selections") {
    if (s.distance === 2)
      return [
        "what do you want to select?",
        [
          ["whole document", "select/0"],
          ...groupNames.map((x, i): Choice => [x, `group/${i}`]),
        ],
      ];
    const available =
      s.distance === 0
        ? [0, ...masks].filter(m => size(m ^ s.selected) === 1)
        : masks.filter(m => size(m) === s.group + 1);
    return [
      s.distance === 0 ? "near this selection" : groupNames[s.group],
      available.map(m => [scope(s, m), `select/${m}`]),
    ];
  }
  const selectionDrafted = s.scenes.every(
    (state, i) =>
      (s.selected !== whole && !(s.selected & (1 << i))) ||
      state !== "undrafted"
  );
  switch (s.question) {
    case "kind":
      return [
        "what are you making?",
        [
          ...(Object.keys(examples) as Kind[]).map((k): Choice => [
            k,
            `kind/${k}`,
          ]),
          ...alternatives("poem", "speech", "script", "letter"),
        ],
      ];
    case "lens":
      return [`which ${e.lens}?`, lensChoices(s)];
    case "premise": {
      const { question, answers } = version(s).premiseDecision;
      return [
        question,
        s.kind === "story"
          ? answers.map((answer): Choice => [answer, `arc/${answer}`])
          : alternatives(...answers),
      ];
    }
    case "fact":
      return [
        e.factDecision.question,
        e.factDecision.answers.map((answer, i): Choice =>
          i < e.leads.length ? [answer, `fact/${i}`] : [answer]
        ),
      ];
    case "expand":
      return [
        "how much detail?",
        [
          selectionDrafted
            ? ["choose a form", "ask/form"]
            : ["draft scene", "expand"],
          ...alternatives(
            "one sentence",
            "one paragraph",
            "a full scene",
            "dialogue only"
          ),
          ...(s.selected === whole
            ? alternatives("draft another outline")
            : selectionDrafted
              ? alternatives("draft another scene")
              : []),
          ["read draft", "read"],
        ],
      ];
    case "form":
      return [
        "which rhetorical form?",
        [
          ...forms.map((x, i): Choice => [x, `form/${i}`]),
          ...alternatives(
            "personification",
            "understatement",
            "repetition",
            "hyperbole"
          ),
        ],
      ];
    case "read":
      return ["ready to read it together?", [["read draft", "read"]]];
  }
}
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  content?: string
) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (content) node.textContent = content;
  return node;
}
function button(text: string, action?: string) {
  const b = el("button", undefined, text);
  b.type = "button";
  b.disabled = true;
  if (action) b.dataset.write = action;
  return b;
}
function passageText(s: State, i: number) {
  const lead =
    s.fact !== undefined && i === 0 ? example(s).leads[s.fact] + " " : "";
  return lead + version(s).passages[i].lines[s.forms[i]];
}
function branchControl(
  subject: string,
  state: BranchState,
  id: string,
  showCaption = false
) {
  const generating = state === "undrafted";
  const action = generating
    ? id === "outline"
      ? "outline"
      : `expand/${id}`
    : `${state === "open" ? "hide" : "show"}/${id}`;
  const control = button("", action);
  control.className = "draft-disclosure";
  control.dataset.branch = id;
  const verb = generating ? "draft" : state === "open" ? "hide" : "show";
  const name = `${verb} ${subject}`;
  control.setAttribute("aria-label", name);
  control.title = name;
  if (generating) {
    control.classList.add("generate-branch");
    if (showCaption) control.dataset.caption = name;
  } else {
    control.setAttribute("aria-expanded", String(state === "open"));
  }
  return control;
}

function ink(text: string) {
  return el("span", "draft-words", text);
}
// Both the bracket and its label take their position from the annotated text.
function sentenceAnnotation(copy: HTMLElement, label: HTMLElement) {
  const row = el("div", "sentence-annotation");
  label.classList.add("sentence-label");
  row.append(copy, label);
  return row;
}
function annotatePhrase(text: string, phrase: string, label: HTMLElement) {
  const offset = text.indexOf(phrase);
  if (offset < 0) {
    return sentenceAnnotation(ink(text), label);
  }
  const copy = el("span", "annotated-text");
  const term = el("span", "term-annotation");
  label.classList.add("term-label");
  term.append(ink(phrase), label);
  copy.append(
    ink(text.slice(0, offset)),
    term,
    ink(text.slice(offset + phrase.length))
  );
  return copy;
}

type HelpTrigger = ReturnType<typeof writingHelpPopover>["trigger"];
function withHelp(
  control: HTMLElement,
  icon: HTMLButtonElement,
  className: string
) {
  const wrap = el("span", className);
  if (className === "question-line")
    icon.setAttribute("aria-label", "explain this question");
  wrap.append(control, icon);
  return wrap;
}
function taxonomyTrigger(
  name: string,
  action: "genres" | "archetypes" | `act/${number}`
) {
  const trigger = button(name, action);
  trigger.className = "taxonomy-trigger";
  trigger.disabled = false;
  trigger.setAttribute("aria-haspopup", "menu");
  trigger.setAttribute("aria-expanded", "false");
  return trigger;
}
function openTaxonomyMenu(trigger: HTMLElement, s: State, help: HelpTrigger) {
  const menu = el("span", "genre-menu");
  menu.setAttribute("role", "menu");
  const e = example(s);
  const v = version(s);
  const isGenre = trigger.dataset.write === "genres";
  const isAct = trigger.dataset.write?.startsWith("act/");
  menu.setAttribute(
    "aria-label",
    isAct ? "emotional direction" : isGenre ? e.lens : e.fact
  );
  const choices = isGenre
    ? lensChoices(s)
    : isAct
      ? alternatives("rise", "fall")
      : alternatives(...e.factDecision.answers);
  const selected = trigger.dataset.value ?? trigger.textContent;
  for (const [name, action] of choices) {
    const item = button(
      name,
      isGenre && action ? `genre/${action}` : undefined
    );
    item.setAttribute("role", "menuitemradio");
    item.setAttribute("aria-checked", String(name === selected));
    menu.append(
      withHelp(
        item,
        help(name, helpFor(name, action, v.passages)),
        "choice-item"
      )
    );
  }
  trigger.setAttribute("aria-expanded", "true");
  trigger.after(menu);
  const page = trigger.closest(".draft-page")!.getBoundingClientRect();
  const bounds = menu.getBoundingClientRect();
  const left = Math.max(
    page.left + 4,
    Math.min(bounds.left, page.right - bounds.width - 4)
  );
  menu.style.translate = `${left - bounds.left}px 0`;
  return menu;
}
function renderDraft(root: HTMLElement, s: State) {
  const work = root.querySelector<HTMLElement>(".writing-workbench")!;
  work.inert = !s.visible;
  const page = work.querySelector<HTMLElement>(".draft-page")!;
  const editingForm = !s.reading && s.question === "form";
  page.toggleAttribute("data-selected", s.selected === whole);
  page.setAttribute("role", "region");
  page.setAttribute(
    "aria-label",
    `document, ${scope(s)}${editingForm ? " wording" : ""} selected`
  );
  page.replaceChildren();
  if (!s.kind) page.append(el("span", "blank-sheet"));
  else {
    const e = example(s),
      v = version(s);
    if (s.reading) {
      const copy = el("div", "finished-copy");
      v.passages.forEach((_, i) => {
        const paragraph = el("p");
        paragraph.append(ink(passageText(s, i)));
        copy.append(paragraph);
      });
      page.append(copy);
    } else {
      const tree = el("div", "draft-tree");
      const labels = el("span", "document-labels");
      const taxonomy = el("span", "document-type");
      const typeLabel = s.lens === undefined ? s.kind : v.label;
      const trigger = taxonomyTrigger(typeLabel, "genres");
      // Keep the bracket anchored as the genre changes width.
      taxonomy.style.setProperty(
        "--genre-chars",
        String(Math.max(s.kind.length, ...e.versions.map(v => v.label.length)))
      );
      taxonomy.append(trigger);
      labels.append(taxonomy);
      const sentence =
        s.lens === undefined ? genericPremise[s.kind] : v.premise;
      const premiseCopy = el("div", "premise-text");
      if (
        s.fact !== undefined &&
        e.factSubject &&
        sentence.includes(e.factSubject)
      ) {
        const fact = taxonomyTrigger(
          e.factDecision.answers[s.fact],
          "archetypes"
        );
        fact.setAttribute(
          "aria-label",
          `${e.fact} · ${e.factDecision.answers[s.fact]}`
        );
        premiseCopy.append(annotatePhrase(sentence, e.factSubject, fact));
      } else {
        premiseCopy.append(ink(sentence));
        if (s.fact !== undefined)
          labels.append(
            button(`${e.fact} · ${e.factDecision.answers[s.fact]}`, "ask/fact")
          );
      }
      const premise = el("div", "premise-row");
      premiseCopy.prepend(branchControl("outline", s.outline, "outline"));
      const storyBody = el("div", "story-body");
      storyBody.append(premiseCopy);
      premise.append(sentenceAnnotation(storyBody, labels));
      tree.append(premise);
      page.append(tree);

      if (s.outline === "open") {
        const list = el("ol", "beat-list");
        v.passages.forEach((p, i) => {
          const bit = 1 << i;
          const sceneState = s.scenes[i];
          const expanded = sceneState === "open";
          const item = el("li", "beat");
          item.toggleAttribute(
            "data-selected",
            !editingForm && Boolean(s.selected & bit)
          );
          const branch = el("div", "beat-branch");
          const words = el("div", "beat-text");
          const subject = s.kind === "story" ? "scene" : "passage";
          const control = branchControl(
            subject,
            sceneState,
            String(bit),
            !editingForm && s.selected === bit
          );
          words.append(control, ink(p.summary));
          const actBody = el("div", "act-body");
          const actLabel = el("span", "beat-label");
          if (p.direction) {
            const anchor = el("span", "act-menu-anchor");
            const trigger = taxonomyTrigger(p.label, `act/${i}`);
            trigger.dataset.value = p.direction;
            anchor.append(trigger);
            actLabel.append(anchor);
          } else actLabel.textContent = p.label;
          const row = sentenceAnnotation(actBody, actLabel);
          const caption = el("span", "branch-caption", control.dataset.caption);
          caption.setAttribute("aria-hidden", "true");
          actBody.append(caption, words);
          branch.append(row);
          if (expanded) {
            const scene = el("div", "scene-prose beat-text");
            if (i === 0 && s.fact !== undefined) {
              const lead = el("div", "passage-lead");
              lead.append(ink(e.leads[s.fact]));
              scene.append(lead);
            }
            const annotated = el("div", "annotated-form");
            annotated.toggleAttribute(
              "data-selected",
              editingForm && Boolean(s.selected & bit)
            );
            const index = s.forms[i];
            const form = forms[index];
            const device = button(form, `device/${bit}`);
            device.setAttribute(
              "aria-label",
              `${p.label} · ${form}, change form`
            );
            annotated.append(
              p.formPhrases
                ? annotatePhrase(p.lines[index], p.formPhrases[index], device)
                : sentenceAnnotation(ink(p.lines[index]), device)
            );
            scene.append(annotated);
            actBody.append(scene);
          }
          item.append(branch);
          list.append(item);
        });
        storyBody.append(list);
      }
    }
  }
}
function panelContents(
  root: HTMLElement,
  s: State,
  help: HelpTrigger
): DocumentFragment {
  const panel = document.createDocumentFragment();
  if (!s.visible || s.reading) return panel;
  const head = el("div", "decision-head");
  if (s.panel === "question" && s.outline !== "undrafted") {
    head.append(button("select passages", "browse/selections"));
    if (s.question === "form") head.append(button("read draft", "read"));
  } else if (s.panel !== "question") {
    head.append(el("span", "panel-label", "browse selections"));
  }
  const controls = el("div");
  if (s.panel === "question" && s.outline !== "undrafted") {
    const [q, t] = recommendation(s);
    if (q !== s.question || t !== s.selected) {
      const rec = button(
        `next · ${q === "expand" && t ? scope(s, t) : label(s, q)} ↗`,
        "global"
      );
      rec.title = `${scope(s, t)} · ${label(s, q)}`;
      controls.append(rec);
    }
  } else if (s.panel !== "question") controls.append(button("close", "back"));
  if (controls.childElementCount) head.append(controls);
  if (head.childElementCount) panel.append(head);
  const [prompt, choices] = options(s);
  const list = el("div", "choice-list");
  const strip = el("div", "choice-window");
  const v = version(s);
  const explain = (name: string, action?: string) =>
    help(name, helpFor(name, action, v.passages));
  for (const [text, action] of choices) {
    const choice = button("", action);
    choice.append(el("span", "choice-label", text));
    list.append(withHelp(choice, explain(text, action), "choice-item"));
  }
  const scrollbar = el("input", "choice-scrollbar");
  scrollbar.type = "range";
  scrollbar.min = "0";
  scrollbar.max = "100";
  scrollbar.step = "any";
  scrollbar.value = "0";
  scrollbar.hidden = true;
  scrollbar.setAttribute("aria-label", "scroll through answers");
  strip.append(list, scrollbar);
  panel.append(
    withHelp(el("h4", undefined, prompt), explain(prompt), "question-line"),
    strip
  );
  list.setAttribute("aria-label", `Answers to “${prompt}”`);
  if (s.panel === "question") {
    const template = root.querySelector<HTMLTemplateElement>(
      "template[data-dictation]"
    )!;
    panel.append(template.content.cloneNode(true));
  }
  if (s.panel === "selections") {
    const range = el("div", "range-controls");
    for (const [title, level] of [
      ["⇤ close", 0],
      ["− notch", s.distance - 1],
      ["+ notch", s.distance + 1],
      ["far ⇥", 2],
    ] as const) {
      const b = button(title, `level/${level}`);
      b.toggleAttribute(
        "data-unavailable",
        level === s.distance || level < 0 || level > 2
      );
      range.append(b);
    }
    panel.append(range);
  }
  return panel;
}
export function writingSteps(root: HTMLElement): Step[] {
  const work = root.querySelector<HTMLElement>(".writing-workbench")!;
  const narration = root.querySelector<HTMLElement>(".writing-narration p")!;
  const page = work.querySelector<HTMLElement>(".draft-page")!;
  const dock = work.querySelector<HTMLElement>(".decision-dock")!;
  const help = writingHelpPopover(root);
  const scene = root.querySelector<HTMLElement>(".writing-scene")!;
  const parts = (selector?: string) =>
    selector ? [...page.querySelectorAll<HTMLElement>(selector)] : [];
  let state = initial();
  let current = 0;
  let displayed = state;
  let menuEvents: AbortController | undefined;
  function closeMenu() {
    menuEvents?.abort();
    page.querySelector(".genre-menu")?.remove();
    page
      .querySelector('.taxonomy-trigger[aria-expanded="true"]')
      ?.setAttribute("aria-expanded", "false");
  }
  page.onclick = event => {
    const trigger =
      event.target instanceof Element &&
      event.target.closest<HTMLElement>(".taxonomy-trigger");
    if (!trigger || work.closest('[aria-busy="true"]')) return;
    const wasOpen = trigger.getAttribute("aria-expanded") === "true";
    closeMenu();
    if (wasOpen) return;
    const menu = openTaxonomyMenu(trigger, displayed, help.trigger);
    menuEvents = new AbortController();
    const { signal } = menuEvents;
    document.addEventListener(
      "pointerdown",
      e => {
        if (
          e.target instanceof Node &&
          !menu.contains(e.target) &&
          !trigger.contains(e.target) &&
          !scene.querySelector(".writing-help-card")?.contains(e.target)
        )
          closeMenu();
      },
      { signal }
    );
    document.addEventListener(
      "keydown",
      e => {
        if (e.key === "Escape" && !scene.querySelector(":popover-open")) {
          closeMenu();
          trigger.focus({ preventScroll: true });
        }
      },
      { signal }
    );
  };
  return tour.map((beat, i) => {
    const previous = state;
    const slide = { ...state, ...beat.changes };
    state = slide;
    const movingSelection =
      previous.selected !== slide.selected ||
      (previous.question === "form") !== (slide.question === "form");
    let direction = 0;
    return {
      title: "",
      description: "",
      target: null,
      result: null,
      prepare(animate) {
        help.close();
        closeMenu();
        dock
          .querySelector("[data-help-hover]")
          ?.removeAttribute("data-help-hover");
        direction = animate ? Math.sign(i - current) : 0;
        current = i;
      },
      async run({ tween }) {
        if (direction > 0 && beat.foldOutlineFirst) {
          const fold = page.querySelector<HTMLElement>(
            '[data-write="hide/outline"]'
          )!;
          await animatePress(work, fold, tween);
          const acts = page.querySelector<HTMLElement>(".beat-list")!;
          await tween(230, p => {
            acts.style.opacity = String(1 - p);
          });
          const brackets = measureOutlineBrackets(page);
          displayed = { ...previous, outline: "closed" };
          renderDraft(root, displayed);
          await animateOutlineBrackets(page, brackets, tween);
          await tween(800, () => {});
        }
        if (direction > 0 && beat.action?.startsWith("genre/")) {
          const trigger = page.querySelector<HTMLElement>(
            '[data-write="genres"]'
          )!;
          await animatePress(work, trigger, tween);
          const menu = openTaxonomyMenu(trigger, previous, help.trigger);
          menu.style.opacity = "0";
          await tween(260, p => {
            menu.style.opacity = String(p);
          });
          await tween(800, () => {});
        }
        const hit =
          direction > 0 && beat.action
            ? work.querySelector<HTMLElement>(`[data-write="${beat.action}"]`)
            : null;
        if (hit) await animatePress(work, hit, tween);
        const dictating = direction > 0 && beat.action === "redirect";
        await animateDictation(scene, dictating, tween);
        // Let the spoken request register before crossfading to the new question.
        if (dictating) await tween(1000, () => {});
        const changing =
          direction > 0 ? parts(beat.rewriteFrom ?? beat.generated) : [];
        let revision: Awaited<ReturnType<typeof pendingRevision>> | undefined;
        const panel = preparePanelChange(
          dock,
          panelContents(root, slide, help.trigger),
          direction !== 0
        );
        const undo = direction < 0 ? tour[i + 1] : undefined;
        const draftFloor = !slide.visible || !slide.kind ? 0 : 0.52;
        if (direction < 0) {
          // Returning to a known revision needs no simulated generation wait.
          const fromDraft = Number(getComputedStyle(page).opacity);
          const fromNote = Number(getComputedStyle(narration).opacity);
          const term =
            undo?.enter === ".term-annotation"
              ? page.querySelector<HTMLElement>(undo.enter)
              : null;
          const space = Number(
            term?.style.getPropertyValue("--term-space") || 1
          );
          const ink = Number(
            term?.style.getPropertyValue("--annotation-opacity") || 1
          );
          await tween(term ? 480 : 200, p => {
            if (term) {
              const ease = p * p * (3 - 2 * p);
              term.style.setProperty(
                "--term-space",
                String(space * (1 - ease))
              );
              term.style.setProperty(
                "--annotation-opacity",
                String(ink * Math.max(0, 1 - 2 * p))
              );
            }
            if (undo?.generated || !slide.visible)
              page.style.opacity = String(
                fromDraft + (draftFloor - fromDraft) * p
              );
            panel.paint(p / 2, p / 2);
            narration.style.opacity = String(fromNote * (1 - p));
          });
        } else if (direction > 0) {
          const outgoing = parts(beat.exit);
          if (changing.length)
            revision = await pendingRevision(changing, tween);
          await tween(230, p => {
            const opacity = String(1 - p);
            narration.style.opacity = opacity;
            for (const target of outgoing) target.style.opacity = opacity;
            if (movingSelection)
              page.style.setProperty("--selection-amount", `${(1 - p) * 100}%`);
          });
        }
        work.querySelector<HTMLElement>(".writing-pointer")!.hidden = true;
        const termBeforeUndo = undo?.action?.startsWith("genre/")
          ? page.querySelector(".term-label")?.getBoundingClientRect()
          : undefined;
        const brackets =
          direction !== 0 &&
          (displayed.outline === "open" || slide.outline === "open")
            ? measureOutlineBrackets(page)
            : undefined;
        renderDraft(root, slide);
        const moveBrackets = () =>
          brackets && animateOutlineBrackets(page, brackets, tween);
        displayed = slide;
        narration.textContent = beat.note;
        page.style.removeProperty("--selection-amount");
        if (direction <= 0) {
          if (direction < 0) {
            const move = moveTermLabel(
              page.querySelector(".term-label"),
              termBeforeUndo
            );
            move?.(0);
            await Promise.all([
              moveBrackets(),
              tween(move ? 450 : 270, p => {
                move?.(p * p * (3 - 2 * p));
                if (undo?.generated || !slide.visible)
                  page.style.opacity = String(
                    draftFloor + (1 - draftFloor) * p
                  );
                narration.style.opacity = String(p);
                panel.paint(0.5 + p / 2, 0.5 + p / 2);
              }),
            ]);
          }
          panel.paint(1, 1);
          page.style.removeProperty("opacity");
          work.style.opacity = narration.style.opacity = "1";
        } else {
          work.style.opacity = "1";
          await Promise.all([
            moveBrackets(),
            revealWriting(
              parts(beat.generated),
              parts(beat.enter),
              tween,
              (question, answers) => {
                narration.style.opacity = String(question);
                panel.paint(question, answers);
                if (movingSelection)
                  page.style.setProperty(
                    "--selection-amount",
                    `${question * 100}%`
                  );
              },
              panel.duration,
              revision,
              hit?.classList.contains("generate-branch") ? hit : undefined
            ),
          ]);
          page.style.removeProperty("--selection-amount");
        }
        if (dictating) {
          await tween(320, () => {});
          await animateDictation(scene, false, tween);
        }
        if (beat.explainArc) {
          const answer = dock.querySelector<HTMLButtonElement>(
            `[data-write="arc/${mysteryArc}"] + .writing-help`
          )!;
          if (direction > 0) {
            const question = dock.querySelector<HTMLButtonElement>(
              ".question-line > .writing-help"
            )!;
            await aimPointer(work, question, tween);
            help.show(question, true);
            await tween(4500, () => {});
            help.close();
            question.parentElement!.removeAttribute("data-help-hover");
            const pointer = await aimPointer(work, answer, tween, question);
            help.show(answer, true);
            await tween(180, p => {
              pointer.style.opacity = String(1 - p);
            });
            pointer.hidden = true;
            answer.parentElement!.removeAttribute("data-help-hover");
          } else {
            await revealTarget(answer.parentElement!, tween);
            help.show(answer, true);
          }
        }
      },
    };
  });
}
