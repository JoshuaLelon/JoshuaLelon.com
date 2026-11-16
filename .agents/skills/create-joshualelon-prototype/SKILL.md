---
name: create-joshualelon-prototype
description: Build or refine interactive UX prototypes in joshualelon.com. Use when Josh asks to make a prototype, add one to /prototypes, or apply the established demo and walkthrough format. Follow the shared Astro gallery, dedicated-page structure, narrated stepper, recorded demo, citations, and motion conventions.
---

# create a joshualelon.com prototype

Build one focused interaction that makes an idea understandable through use. Treat the existing sentence-abstraction prototype as a reference implementation, not a script every new idea must follow. Honor later user instructions over these defaults.

## establish the task

1. Locate the current joshualelon.com checkout; use the active workspace when available. Read applicable repository instructions and inspect the current implementation before editing.
2. Read [implementation.md](references/implementation.md) for integration points and known traps.
3. Identify the user's action, the resulting change, and the problem this addresses. Use the conversation and existing prototype concepts before asking for missing information.
4. Use renting versus buying as the shared example when it fits. Otherwise move to everyday finance, or another domain the user requests. Do not distort the interaction to preserve a housing example.
5. Inspect relevant local `emil-*` skills and read the ones that materially help with this prototype. Apply their craft guidance within this spec. Do not add variant pickers, extra controls, or approval rounds merely because another skill suggests them.
6. Implement locally when asked to build. Preserve unrelated work. Commit, push, or deploy only when authorized in the current task.

## page contract

Use the following fields consistently. Reuse the site's typography, colors, spacing, navigation, tag routes, and theme system.

| field | dedicated prototype page | /prototypes gallery |
| --- | --- | --- |
| header | short action or benefit; one h1 | same title linking to the dedicated page |
| subheader | one sentence explaining what the interaction enables | omit |
| tags | clickable shared tags | same clickable tags |
| demo + walkthrough | shared component, demo selected initially | same component |
| problem solved | first section below the component | omit |
| interface inspirations | second section | omit |
| interaction patterns | third section | omit |
| design decisions | fourth section | omit |

Keep a breadcrumb back to the gallery on the dedicated page. Do not add an open-questions section unless requested. Avoid extra “what to notice” blocks, iframe wrappers, redundant descriptions, or “open full page” links. Keep visible author-written copy lowercase unless the user requests otherwise; preserve quotations and proper source names when accuracy requires it.

Write the sections as follows:

- **problem solved:** describe the concrete frustration, what the person wants to preserve or change, and how the proposed interaction helps. State the concept without claiming an untested outcome.
- **interface inspirations:** link specific interfaces and explain the particular behavior borrowed from each. Discover relevant examples with Interface Lineage when available, then inspect the source. Favor a few meaningful references over a long link list.
- **interaction patterns:** name actual components, affordances, or principles; link authoritative definitions or original explanations; explain where each appears in this prototype. Do not use a technical-sounding label without checking that it fits.
- **design decisions:** explain why the particular timing, layout, controls, or transitions serve this interaction. Describe the final design, not a history of abandoned alternatives.

Verify new citation URLs and the claims they support. Distinguish inspiration from documented historical lineage. If Interface Lineage is unavailable, use accessible primary sources and acknowledge the limitation briefly; do not invent results or block implementation unnecessarily.

## two views of one interaction

### demo

- Show an actual looping GIF recording of the interaction. Default to this tab.
- Record the same visual states and transitions used by the walkthrough.
- Exclude explanations, captions, step counts, navigation buttons, debug outlines, and browser chrome from the recorded scene.
- Keep the loop understandable without narration; allow enough time to read key states and provide a deliberate return to the start.
- Supply theme-appropriate desktop and mobile recordings, plus meaningful static PNGs for reduced motion.
- Capture the real rendered interaction. Do not substitute a generated image, a narrated slide sequence, or a recording that is stale relative to the implementation.

### walkthrough

- Use manual previous/next navigation centered beneath the scene, with a step count. Show one coherent state at a time. Do not add scrubbers, playback-speed sliders, or animation controls.
- Reserve a stable area in approximately the bottom third of the scene for explanations. Keep the interaction above it so text changes do not shift the whole composition.
- Begin with an explanation establishing the situation before the example appears: for instance, “imagine you’re editing an essay on owning vs. renting a home.”
- Introduce the user's intent before the corresponding action. Let explanations persist across several visual steps when they still apply.
- Crossfade explanations only when the thought changes. Use separate explanation beats where comprehension benefits; do not require a click to repeat or paraphrase the same message.
- Fade the final note out as the interaction resolves when it has served its purpose. Preserve a clean completed state.
- Keep next disabled during an unfinished transition and at the end, and previous disabled at the beginning. Going backward must restore the full prior state, including notes, annotations, emphasis, and layout.
- Support keyboard navigation, visible focus, correctly labeled tabs and controls, touch, and reduced motion. Scope arrow-key handling to the component; do not hijack page scrolling.
- Choose the number of steps to fit the new idea. The reference prototype has eleven steps; eleven is not a requirement.

## preserve continuity

Make the relationship between states visible rather than narrating a jump.

- Start text-based examples with natural paragraphs and line wrapping. Do not isolate the target sentence onto a separate line merely to make later animation easier.
- Preserve the identity of selected words, sentences, labels, and objects as they move. Measure real rendered text where positioning depends on wrapping.
- Fade irrelevant context while retaining the selected object; restore context as the object returns.
- Reserve the incoming object's layout before revealing it. Align comparison columns and annotation baselines intentionally.
- Fit underbraces and annotations to the text they describe, not an arbitrarily wide container. Avoid orphan words caused by mid-transition width changes.
- Attach arrows to the concepts being exchanged: a form-to-form change should connect form labels, not unrelated sentence centers.
- Give labels, annotations, and generated results independent visibility when the concept calls for staged disclosure. Keep their transitions synchronized when they should appear together.
- Use motion to explain movement, substitution, grouping, or changes of scope. Avoid decorative effects that obscure the causal sequence.
- Keep static mock content honest. An authored example can illustrate an AI-mediated experience; do not claim it makes live model calls unless it does.

## implementation and verification

Follow [implementation.md](references/implementation.md) for repository wiring, recording, and scoped checks.

Before finishing, inspect the gallery and dedicated page, both tabs, all walkthrough states forward and backward, the final state, mobile wrapping, both themes, and reduced motion. Verify rapid navigation cannot desynchronize the scene. Check console errors and relevant project validation.

Regenerate recordings whenever the illustrated behavior changes. Confirm that recorded assets have the correct crop, theme, looping behavior, and no walkthrough explanations.

Report what changed, the local route, and the checks actually completed. State any incomplete recording, source verification, or runtime check plainly. Do not claim a live AI integration or a published site when only a local prototype was built.
