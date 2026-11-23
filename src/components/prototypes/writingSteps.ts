import { helpFor } from "./writingHelp";
import { writingHelpPopover } from "./writingHelpPopover";
import {
  examples,
  forms,
  mysteryArc,
  storyFrameworks,
  type Kind,
} from "./writingExamples";
import type { Step } from "./walkthrough";
import {
  animatePress,
  scrollCue,
  centerChoice,
  aimPointer,
  animateOutlineBrackets,
  measureOutlineBrackets,
  animateDictation,
  revealWriting,
  preparePanelChange,
  pendingRevision,
  moveTermLabel,
  revealTarget,
  revealInViewport,
} from "./writingMotion";

type Question =
  "kind" | "lens" | "premise" | "fact" | "viewpoint" | "form" | "craft";
type Leaf = `${number}/${string}`;
type Scroll = {
  zone: "answers" | "question" | "margin" | "essay";
  direction: "left" | "right" | "up" | "down";
};
type BranchState = "undrafted" | "open" | "closed";
type State = {
  kind?: Kind;
  lens?: 0 | 1;
  fact?: 0 | 1;
  outline: BranchState;
  scenes: [BranchState, BranchState, BranchState];
  selected: number;
  forms: number[];
  question: Question;
  leaves: Leaf[];
  details: Partial<Record<Leaf, "closed" | "open">>;
  // A question remembers the answer the writer was inspecting.
  inspected: Partial<Record<Question, string>>;
  visible: boolean;
};
const whole = 0;
const initial = (): State => ({
  outline: "undrafted",
  scenes: ["undrafted", "undrafted", "undrafted"],
  selected: whole,
  forms: [0, 0, 0],
  question: "kind",
  leaves: [],
  details: {},
  inspected: {},
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
function leafAct(leaf: Leaf) {
  return Number(leaf.split("/")[0]);
}
function topSelectedAct(s: State) {
  if (!s.selected && !s.leaves.length) return 0;
  return s.scenes.findIndex((_, i) => {
    const bit = 1 << i;
    return (
      Boolean(s.selected & bit) || s.leaves.some(leaf => leafAct(leaf) === bit)
    );
  });
}
function label(s: State, q: Question) {
  return {
    kind: "document type",
    lens: example(s).lens,
    premise: "emotional arc",
    fact: s.kind === "story" ? "character archetype" : example(s).fact,
    viewpoint: "point of view",
    form: "rhetorical form",
    craft: "story decision",
  }[q];
}
// Sibling order drives both the parent’s answer rail and the horizontal previews.
const storyQuestions: Question[] = [
  "lens",
  "viewpoint",
  "premise",
  "fact",
  "form",
];
function questionNeighbors(
  s: State
): Partial<Record<Scroll["direction"], Question>> {
  if (s.kind !== "story") return {};
  if (s.question === "kind") return { down: "craft" };
  if (s.question === "craft") {
    return {
      up: "kind",
      down: storyQuestions.find(q => label(s, q) === s.inspected.craft),
    };
  }
  const index = storyQuestions.indexOf(s.question);
  return {
    up: "craft",
    left: storyQuestions[index - 1],
    right: storyQuestions[index + 1],
  };
}
function scope(s: State, explicitMask?: number) {
  const mask = explicitMask ?? s.selected;
  if (s.leaves.length && explicitMask === undefined) {
    const passages = version(s).passages;
    const names = s.leaves.map(leaf => {
      const [bit, unit] = leaf.split("/");
      return `${passages[Math.log2(Number(bit))].label}, ${unit === "lead" ? "opening sentence" : "sentence " + (Number(unit) + 1)}`;
    });
    passages.forEach((p, i) => {
      if (mask & (1 << i)) names.push(p.label);
    });
    return names.join(" and ");
  }
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
  return index < 0 ? ["form", whole] : ["viewpoint", 1 << index];
}
// Each slide inherits only from the preceding authored slide.
type Beat = {
  features?: string[];
  action?: string;
  spokenSelection?: string;
  scroll?: Scroll;
  inspect?: string;
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
    features: ["one question at a time", "document type choices"],
    enter: ".blank-sheet",
    changes: { visible: true },
    note: "the writer picks “story” to get a premise to react to.",
  },
  {
    features: ["generate a premise"],
    action: "kind/story",
    exit: ".blank-sheet",
    generated: ".premise-row",
    changes: { kind: "story", question: "lens" },
    note: "the writer scrolls through the genres and chooses “ghost story” to try a supernatural premise.",
  },
  {
    features: ["shape the premise by genre"],
    action: "lens/1",
    generated: ".premise-row",
    changes: { lens: 1, question: "premise" },
    note: "the writer checks what an emotional arc is, then looks up “rise, fall, rise” to see how it might read.",
  },
  {
    features: ["look up definitions and examples"],
    explainArc: true,
    note: "the writer leaves the arc undecided and uses the microphone to ask about nell first.",
  },
  {
    features: ["redirect a question by voice"],
    action: "redirect",
    changes: { question: "fact" },
    note: "the writer chooses “skeptic” for nell. the editor will keep that choice with her name.",
  },
  {
    features: ["attach a character fact to a name"],
    action: "fact/0",
    enter: ".term-annotation",
    changes: { fact: 0, question: "premise" },
    note: "with nell’s character set, the writer opens the ghost story dropdown and chooses “mystery” to try the same premise in another genre.",
  },
  {
    features: ["change genre from the draft"],
    action: "genre/lens/0",
    generated: ".premise-row",
    changes: { lens: 0 },
    note: "the writer chooses “rise, fall, rise” to shape nell’s last collection into three acts.",
  },
  {
    features: ["generate an outline from an arc"],
    action: `arc/${mysteryArc}`,
    generated: ".beat",
    exit: ".premise-text",
    changes: { outline: "open", question: "viewpoint" },
    note: "the writer folds the three acts to read the premise on its own, then reopens them with the same chevron.",
  },
  {
    features: ["fold and reopen the outline"],
    action: "show/outline",
    foldOutlineFirst: true,
    enter: ".beat-list",
    note: "the writer scrolls across the possible narrators to see whose perspective could carry the story.",
  },
  {
    features: ["browse answers without choosing"],
    scroll: { zone: "answers", direction: "right" },
    inspect: "third-person limited",
    note: "“third-person limited” is in view. the writer moves up to the question and scrolls up to see which other story decisions are available.",
  },
  {
    features: ["go to a broader question"],
    scroll: { zone: "question", direction: "up" },
    note: "“point of view” marks the question the writer came from. scrolling down over the heading returns to it.",
  },
  {
    features: ["return to a question and its last answer"],
    scroll: { zone: "question", direction: "down" },
    note: "“third-person limited” is still in view. this time the writer scrolls right over the question itself to visit a question at the same level.",
  },
  {
    features: ["move between sibling questions"],
    scroll: { zone: "question", direction: "right" },
    note: "the question now asks about the emotional arc. scrolling up from here opens the same list of story decisions, this time at “emotional arc.”",
  },
  {
    scroll: { zone: "question", direction: "up" },
    note: "the writer scrolls left through these choices to return to “point of view.”",
  },
  {
    scroll: { zone: "answers", direction: "left" },
    inspect: "point of view",
    note: "with “point of view” in view, the writer scrolls down over the heading to open that question.",
  },
  {
    scroll: { zone: "question", direction: "down" },
    note: "the outline is already open. the writer scrolls down over the story to grow its first leaf, the moment nell hears the letter land.",
  },
  {
    features: ["expand a summary into prose"],
    scroll: { zone: "essay", direction: "down" },
    generated: '.beat[data-act="1"] .scene-prose',
    exit: '.beat[data-act="1"] .act-body > .beat-text',
    note: "act i’s summary gives way to its prose. nell writes down the time. the writer scrolls down again over that sentence to get a more specific detail.",
  },
  {
    features: ["expand a sentence into detail"],
    scroll: { zone: "essay", direction: "down" },
    generated: '[data-child-of="1/lead"]',
    exit: '.passage-lead [data-leaf="1/lead"] > :not(.branch-marker)',
    note: "the time appears in nell’s collection book. the writer uses the sparkle beside act iii to grow the ending as well.",
  },
  {
    features: ["draft an individual scene"],
    action: "expand/4",
    generated: '.beat[data-act="4"] .scene-prose',
    exit: '.beat[data-act="4"] .act-body > .beat-text',
    changes: { scenes: ["open", "undrafted", "open"] },
    note: "the writer wants the moment the baker reveals the hatch. they use the microphone beneath the story to describe it.",
  },
  {
    features: ["select a passage by voice"],
    action: "select-by-voice",
    spokenSelection: "the part where the baker moves the tray",
    changes: { selected: whole, leaves: ["4/0"], question: "form" },
    note: "the sentence where the baker slides the tray aside is selected. the writer follows the editor’s next suggestion to act ii.",
  },
  {
    features: ["follow the next suggested edit"],
    action: "global",
    changes: { selected: 2, leaves: [], question: "viewpoint" },
    note: "act ii is highlighted. scrolling right in the margin keeps it and adds one nearby sentence about nell’s hope that someone remembered.",
  },
  {
    features: ["extend a selection in the margin"],
    scroll: { zone: "margin", direction: "right" },
    changes: { leaves: ["1/2"] },
    note: "the writer scrolls down in the same margin for a different selection. this time they land on two clues, one in the opening and one in the ending.",
  },
  {
    features: ["switch to a different group of passages"],
    scroll: { zone: "margin", direction: "down" },
    changes: { selected: whole, leaves: ["1/0", "4/0"], question: "form" },
    note: "the slot is bolted in act i. the baker reveals the hatch in act iii. with both sentences selected, the writer scrolls up over the prose to fold the upper scene.",
  },
  {
    features: ["track selections inside folded prose"],
    scroll: { zone: "essay", direction: "up" },
    note: "act i’s underlined summary marks the hidden selection. act iii’s sentence is still highlighted. scrolling down over the essay reopens act i.",
  },
  {
    scroll: { zone: "essay", direction: "down" },
    note: "the same two sentences are highlighted again. the writer opens the “concrete detail” label above “hit the tin floor” to work on that phrase.",
  },
  {
    features: ["target a phrase by its label"],
    action: "device/1",
    changes: { question: "form", selected: 1, leaves: [] },
    note: "the highlight narrows to the wording the editor will rewrite. the writer chooses “simile” to change how the falling envelope sounds.",
  },
  {
    features: ["rewrite a phrase in another form"],
    action: "form/2",
    inspect: "simile",
    generated: ".annotated-form[data-editing]",
    changes: { forms: [2, 0, 0] },
    note: "the envelope now lands “like a knuckle tapping tin.” the writer uses act ii’s sparkle to fill in the visit to the bakery.",
  },
  {
    action: "expand/2",
    generated: '.beat[data-act="2"] .scene-prose',
    exit: '.beat[data-act="2"] .act-body > .beat-text',
    changes: { scenes: ["open", "open", "open"] },
    note: "the visit to the bakery fills in the middle of nell’s story. all three acts now have prose.",
  },
];
export const writingSlideCount = tour.length;
const firstSlideByFeature = new Map<string, number>();
for (const [index, beat] of tour.entries()) {
  for (const feature of beat.features ?? []) {
    if (!firstSlideByFeature.has(feature))
      firstSlideByFeature.set(feature, index + 1);
  }
}
export const writingFeatureIndex = Array.from(
  firstSlideByFeature,
  ([feature, slide]) => ({ feature, slide })
);

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
  switch (s.question) {
    case "craft":
      return [
        "which story decision?",
        alternatives(...storyQuestions.map(q => label(s, q))),
      ];
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
    case "viewpoint":
      return [
        "which point of view?",
        alternatives(...storyFrameworks.viewpoint.answers),
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

// Follow document order through already-open branches. A closed branch has saved children.
function essayScroll(s: State, direction: Scroll["direction"]): Partial<State> {
  const index = topSelectedAct(s);
  if (index < 0) return {};
  const bit = 1 << index;
  const first = s.leaves.find(leaf => leafAct(leaf) === bit);
  const opening: Leaf =
    bit === 1 && s.fact !== undefined ? "1/lead" : `${bit}/0`;
  if (s.scenes[index] === "open") {
    let leaf: Leaf = first ? `${bit}/${first.split("/")[1]}` : opening;
    let parent: Leaf | undefined;
    while (s.details[leaf] === "open") {
      parent = leaf;
      leaf = `${leaf}/detail`;
    }
    if (direction === "down" && version(s).leafDetails?.[leaf])
      return {
        details: { ...s.details, [leaf]: "open" },
        ...(s.details[leaf]
          ? {}
          : { selected: whole, leaves: [`${leaf}/detail` as Leaf] }),
      };
    if (direction === "up" && parent)
      return { details: { ...s.details, [parent]: "closed" } };
  }
  const scenes: State["scenes"] = [...s.scenes];
  scenes[index] = direction === "down" ? "open" : "closed";
  return {
    scenes,
    ...(direction === "down" && s.scenes[index] === "undrafted"
      ? { selected: whole, leaves: [opening] }
      : {}),
  };
}
function branchControl(subject: string, state: BranchState, id: string) {
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
  if (generating) {
    control.classList.add("generate-branch");
  } else {
    control.setAttribute("aria-expanded", String(state === "open"));
  }
  const marker = el("span", "branch-marker");
  marker.append(control);
  return marker;
}

function ink(text: string) {
  return el("span", "draft-words", text);
}
function sentenceLeaf(s: State, key: Leaf, content: HTMLElement) {
  const row = el("div", "prose-leaf");
  row.setAttribute("role", "listitem");
  row.dataset.leaf = key;
  row.toggleAttribute("data-selected", s.leaves.includes(key));
  const detail = version(s).leafDetails?.[key];
  const state = s.details[key] ?? "undrafted";
  row.append(branchControl("detail", state, key));
  if (state === "closed" && s.leaves.some(leaf => leaf.startsWith(key + "/")))
    row.dataset.containsSelection = "";
  if (detail && state === "open") {
    const children = el("div", "leaf-detail");
    children.setAttribute("role", "list");
    children.dataset.childOf = key;
    children.append(sentenceLeaf(s, `${key}/detail`, ink(detail)));
    row.append(children);
  } else row.append(content);
  return row;
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
    menu.append(withHelp(item, help(name, helpFor(name)), "choice-item"));
  }
  trigger.setAttribute("aria-expanded", "true");
  const tree = trigger.closest<HTMLElement>(".draft-tree")!;
  const origin = tree.getBoundingClientRect();
  const anchor = trigger.parentElement!.getBoundingClientRect();
  // Sharing the story's grid cell lets the whole draft grow to the menu's bottom.
  tree.append(menu);
  const page = trigger.closest(".draft-page")!.getBoundingClientRect();
  const width = menu.getBoundingClientRect().width;
  const preferredLeft = isGenre || isAct ? anchor.right - width : anchor.left;
  const left = Math.max(
    page.left + 4,
    Math.min(preferredLeft, page.right - width - 4)
  );
  menu.style.marginInlineStart = left - origin.left + "px";
  menu.style.marginBlockStart = anchor.bottom - origin.top + 5 + "px";
  revealInViewport(menu);
  return menu;
}
function renderDraft(root: HTMLElement, s: State) {
  const work = root.querySelector<HTMLElement>(".writing-workbench")!;
  work.inert = !s.visible;
  const page = work.querySelector<HTMLElement>(".draft-page")!;
  const editingForm = s.question === "form" && !s.leaves.length;
  page.toggleAttribute(
    "data-selected",
    s.selected === whole && !s.leaves.length
  );
  page.setAttribute("role", "region");
  page.setAttribute(
    "aria-label",
    `document, ${scope(s)}${editingForm ? " wording" : ""} selected`
  );
  page.replaceChildren();
  if (!s.kind) {
    page.append(el("span", "blank-sheet"));
    return;
  }
  const e = example(s),
    v = version(s);
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
  const sentence = s.lens === undefined ? genericPremise[s.kind] : v.premise;
  const premise = el("div", "premise-row");
  const storyBody = el("div", "story-body");
  const outlineControl = branchControl("outline", s.outline, "outline");
  if (s.outline === "open") storyBody.append(outlineControl);
  else {
    const summary = el("div", "premise-text");
    summary.append(outlineControl, ink(sentence));
    storyBody.append(summary);
  }
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
      item.dataset.act = String(bit);
      item.toggleAttribute(
        "data-selected",
        !editingForm && Boolean(s.selected & bit)
      );
      const branch = el("div", "beat-branch");
      const subject = s.kind === "story" ? "scene" : "passage";
      const hiddenSelection =
        sceneState === "closed" && s.leaves.some(leaf => leafAct(leaf) === bit);
      const control = branchControl(
        hiddenSelection ? subject + " with selected text" : subject,
        sceneState,
        String(bit)
      );
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
      branch.append(row);
      if (expanded) {
        actBody.append(control);
        const scene = el("div", "scene-prose beat-text");
        scene.setAttribute("role", "list");
        if (i === 0 && s.fact !== undefined) {
          const lead = el("div", "passage-lead");
          lead.append(sentenceLeaf(s, `${bit}/lead`, ink(e.leads[s.fact])));
          scene.append(lead);
        }
        const annotated = el("div", "annotated-form");

        const index = s.forms[i];
        const form = forms[index];
        const device = button(form, `device/${bit}`);
        device.setAttribute("aria-label", `${p.label} · ${form}, change form`);
        const text = el("div");
        const phrase = p.formPhrases?.[index];
        const sentences =
          p.lines[index].match(/[^.!?]+[.!?]+[”’"]*|[^.!?]+$/gu) ?? [];
        sentences.forEach((sentence, n) => {
          const copy = sentence.trimStart();
          text.append(
            sentenceLeaf(
              s,
              `${bit}/${n}`,
              phrase && copy.includes(phrase)
                ? annotatePhrase(copy, phrase, device)
                : ink(copy)
            )
          );
        });
        annotated.append(phrase ? text : sentenceAnnotation(text, device));
        if (editingForm && s.selected & bit) {
          annotated.dataset.editing = "";
          const selection =
            annotated.querySelector<HTMLElement>(".term-annotation") ??
            annotated;
          selection.dataset.selected = "";
        }
        scene.append(annotated);
        actBody.append(scene);
      } else {
        const words = el("div", "beat-text");
        words.append(control, ink(p.summary));
        words.toggleAttribute("data-contains-selection", hiddenSelection);
        actBody.append(words);
      }
      item.append(branch);
      list.append(item);
    });
    storyBody.append(list);
  }
  if (s.fact !== undefined) {
    // Attach a character fact to the first visible mention at this level.
    const subject = e.factSubject;
    const mention =
      subject &&
      [...storyBody.querySelectorAll<HTMLElement>(".draft-words")].find(run =>
        run.textContent.includes(subject)
      );
    if (mention && subject) {
      const name = e.factDecision.answers[s.fact];
      const fact = taxonomyTrigger(name, "archetypes");
      fact.setAttribute("aria-label", `${e.fact} · ${name}`);
      mention.replaceWith(annotatePhrase(mention.textContent, subject, fact));
    } else
      labels.append(
        button(`${e.fact} · ${e.factDecision.answers[s.fact]}`, "ask/fact")
      );
  }
}
function panelContents(
  root: HTMLElement,
  s: State,
  help: HelpTrigger
): DocumentFragment {
  const panel = document.createDocumentFragment();
  if (!s.visible) return panel;
  const head = el("div", "decision-head");
  const controls = el("div");
  if (s.outline !== "undrafted") {
    const [q, t] = recommendation(s);
    if (q !== s.question || t !== s.selected) {
      const rec = button(
        `next · ${q === "viewpoint" && t ? scope(s, t) : label(s, q)} ↗`,
        "global"
      );
      rec.title = `${scope(s, t)} · ${label(s, q)}`;
      controls.append(rec);
    }
  }
  if (controls.childElementCount) head.append(controls);
  if (head.childElementCount) panel.append(head);
  const directions = {
    left: "previous question",
    right: "next question",
    up: "broader question",
    down: "narrower question",
  };
  for (const [direction, question] of Object.entries(questionNeighbors(s))) {
    if (!question) continue;
    const preview = el("div", `question-preview preview-${direction}`);
    preview.dataset.question = question;
    preview.dataset.direction = direction;
    const [prompt] = options({ ...s, question });
    const arrow = el("span", "preview-arrow");
    arrow.setAttribute("aria-hidden", "true");
    preview.append(
      arrow,
      el(
        "span",
        "sr-only",
        directions[direction as Scroll["direction"]] + ". "
      ),
      el("span", "preview-copy", prompt)
    );
    panel.append(preview);
  }
  const [prompt, choices] = options(s);
  const list = el("div", "choice-list");
  const strip = el("div", "choice-window");
  const explain = (name: string) => help(name, helpFor(name));
  for (const [text, action] of choices) {
    const choice = button("", action);
    choice.dataset.answer = text;
    choice.append(el("span", "choice-label", text));
    list.append(withHelp(choice, explain(text), "choice-item"));
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
  const heading = withHelp(
    el("h4", undefined, prompt),
    explain(prompt),
    "question-line"
  );
  heading.dataset.question = s.question;
  panel.append(heading, strip);
  list.setAttribute("aria-label", `Answers to “${prompt}”`);
  const template = root.querySelector<HTMLTemplateElement>(
    "template[data-dictation]"
  )!;
  panel.append(template.content.cloneNode(true));
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
  const footer = work.querySelector<HTMLElement>(".selection-dictation")!;
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
    if (beat.scroll?.zone === "question") {
      const target = questionNeighbors(previous)[beat.scroll.direction];
      if (!target)
        throw new Error(
          `no question ${beat.scroll.direction} of ${previous.question}`
        );
      slide.question = target;
      if (target === "craft")
        slide.inspected = {
          ...slide.inspected,
          craft: label(previous, previous.question),
        };
    }
    if (beat.inspect)
      slide.inspected = { ...slide.inspected, [slide.question]: beat.inspect };
    if (beat.scroll?.zone === "essay")
      Object.assign(slide, essayScroll(previous, beat.scroll.direction));
    state = slide;
    const movingSelection =
      previous.selected !== slide.selected ||
      previous.leaves !== slide.leaves ||
      (previous.question === "form") !== (slide.question === "form");
    let direction = 0;
    return {
      title: "",
      description: "",
      target: null,
      result: null,
      prepare(animate) {
        for (const slot of dock.querySelectorAll<HTMLElement>(
          "[data-question-moving]"
        )) {
          for (const motion of slot.getAnimations({ subtree: true }))
            if (motion.id === "question-scroll") motion.cancel();
          delete slot.dataset.questionMoving;
        }
        const pointer = work.querySelector<HTMLElement>(".writing-pointer")!;
        pointer.hidden = true;
        delete pointer.dataset.scroll;
        help.close();
        closeMenu();
        dock
          .querySelector("[data-help-hover]")
          ?.removeAttribute("data-help-hover");
        direction = animate ? Math.sign(i - current) : 0;
        current = i;
      },
      async run({ tween }) {
        const gesture = direction > 0 ? beat.scroll : undefined;
        const fold =
          direction < 0
            ? tour[i + 1]?.scroll?.zone === "essay" && !tour[i + 1]?.generated
            : beat.scroll?.zone === "essay" && !beat.generated;
        const activeAct = topSelectedAct(slide);
        const foldedScene = `.beat[data-act="${1 << activeAct}"] .scene-prose`;
        if (gesture) {
          const targets = {
            answers: ".choice-list",
            question: ".question-line h4",
            margin: ".selection-margin",
            essay: `.beat[data-act="${1 << activeAct}"]`,
          };
          let target = work.querySelector<HTMLElement>(targets[gesture.zone])!;
          if (gesture.zone === "essay")
            target =
              target.querySelector<HTMLElement>(
                "[data-leaf][data-selected], [data-contains-selection]"
              ) ??
              target.querySelector<HTMLElement>(
                ".act-body .draft-words:not(:empty)"
              )!;

          await scrollCue(work, target, gesture.direction, tween);
          if (gesture.zone === "answers" && beat.inspect)
            await centerChoice(dock, beat.inspect, tween);
        }
        if (fold && slide.scenes[activeAct] === "closed") {
          const body = page.querySelector<HTMLElement>(foldedScene);
          if (body)
            await tween(240, p => {
              body.style.opacity = String(1 - p);
            });
        }
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
        const dictating =
          direction > 0 && beat.spokenSelection
            ? "selection"
            : direction > 0 && beat.action === "redirect"
              ? "question"
              : undefined;
        if (dictating === "selection") {
          footer.querySelector(".dictated-words")!.textContent =
            "“" + beat.spokenSelection + "”";
        }
        await animateDictation(scene, dictating, tween);
        // Let the spoken request register before crossfading to the new question.
        if (dictating) await tween(1000, () => {});
        const changing =
          direction > 0 ? parts(beat.rewriteFrom ?? beat.generated) : [];
        let revision: Awaited<ReturnType<typeof pendingRevision>> | undefined;
        const undo = direction < 0 ? tour[i + 1] : undefined;
        const scrollingQuestions =
          direction !== 0 && (undo ?? beat).scroll?.zone === "question";
        const panel = preparePanelChange(
          dock,
          panelContents(root, slide, help.trigger),
          direction !== 0,
          slide.inspected[slide.question],
          scrollingQuestions
        );
        const selectionGesture = (undo ?? beat).scroll;
        const near =
          selectionGesture?.zone === "margin" &&
          ["left", "right"].includes(selectionGesture.direction);
        const addedLeaves = near
          ? parts("[data-leaf][data-selected]").filter(
              el => !slide.leaves.includes(el.dataset.leaf as Leaf)
            )
          : [];
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
          await tween(term || scrollingQuestions ? 480 : 200, p => {
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
            for (const leaf of addedLeaves)
              leaf.style.setProperty("--selection-amount", (1 - p) * 100 + "%");
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
            if (movingSelection && !near)
              page.style.setProperty("--selection-amount", `${(1 - p) * 100}%`);
          });
        }
        const pointer = work.querySelector<HTMLElement>(".writing-pointer")!;
        if (!gesture) pointer.hidden = true;
        const termBeforeUndo = undo?.action?.startsWith("genre/")
          ? page.querySelector(".term-label")?.getBoundingClientRect()
          : undefined;
        const brackets =
          direction !== 0 &&
          (displayed.outline === "open" || slide.outline === "open")
            ? measureOutlineBrackets(page)
            : undefined;
        const beforeFold = fold
          ? [...page.querySelectorAll<HTMLElement>(".act-body")].map(
              row => row.getBoundingClientRect().top
            )
          : [];
        renderDraft(root, slide);
        const rows = beforeFold.length
          ? [...page.querySelectorAll<HTMLElement>(".act-body")]
          : [];
        const offsets = rows.map(
          (row, i) => beforeFold[i] - row.getBoundingClientRect().top
        );
        const foldIn =
          fold && slide.scenes[activeAct] === "open"
            ? page.querySelector<HTMLElement>(foldedScene)
            : null;
        const moveFolds = () =>
          rows.length
            ? tween(420, p => {
                const remaining = (1 - p) ** 2;
                rows.forEach((row, i) => {
                  // Move each whole scene, including its prose, with its summary.
                  row.style.translate =
                    p === 1 ? "" : `0 ${offsets[i] * remaining}px`;
                });
                if (foldIn) foldIn.style.opacity = String(1 - remaining);
              })
            : undefined;
        const incomingLeaves = near
          ? parts("[data-leaf][data-selected]").filter(
              el => !previous.leaves.includes(el.dataset.leaf as Leaf)
            )
          : [];
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
              moveFolds(),
              tween(move || scrollingQuestions ? 450 : 270, p => {
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
            moveFolds(),
            revealWriting(
              parts(beat.generated),
              parts(beat.enter),
              tween,
              (question, answers) => {
                narration.style.opacity = String(question);
                panel.paint(question, answers);
                for (const leaf of incomingLeaves)
                  leaf.style.setProperty(
                    "--selection-amount",
                    question * 100 + "%"
                  );
                if (movingSelection && !near)
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
        const focus = slide.inspected[slide.question];
        if (focus) await centerChoice(dock, focus);
        else {
          const previouslyInspected = dock.querySelector("[data-inspecting]");
          if (previouslyInspected) {
            previouslyInspected.removeAttribute("data-inspecting");
            dock.querySelector(".choice-list")!.scrollLeft = 0;
          }
        }
        if (gesture) {
          await tween(180, p => {
            pointer.style.opacity = String(1 - p);
          });
          pointer.hidden = true;
          delete pointer.dataset.scroll;
        }
        if (direction <= 0 && !focus) {
          const list = dock.querySelector<HTMLElement>(".choice-list");
          if (list) {
            list.scrollLeft = 0;
            const chosen =
              beat.action &&
              list.querySelector<HTMLElement>(
                `[data-write="${CSS.escape(beat.action)}"]`
              );
            if (chosen)
              await revealTarget(
                chosen.closest<HTMLElement>(".choice-item")!,
                tween
              );
          }
        }
        if (dictating) {
          await tween(320, () => {});
          await animateDictation(scene, undefined, tween);
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
