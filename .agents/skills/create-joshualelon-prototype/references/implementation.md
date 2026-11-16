# repository integration and reference behavior

Treat these paths as a map of the established implementation; inspect current files before relying on their APIs. The default checkout is `/Users/jlm/workspace/JoshuaLelon.com`.

## integration points

| concern | established location | action |
| --- | --- | --- |
| content schema | `src/content.config.ts` | register the new demo key and retain required metadata |
| metadata and writeup | `src/data/prototypes/<slug>.mdx` | use title, description, tags, demo key, order, and draft; add the four body sections |
| starter metadata | `src/data/prototypes/_template.mdx` | inspect required fields; replace its sentence-abstraction demo key |
| component registry | `src/components/prototypes/PrototypeDemo.astro` | map the new demo key to the new component |
| shared tabs and controls | `src/components/prototypes/Walkthrough.astro` | extend its kind type and step-factory dispatch |
| shared step lifecycle | `src/components/prototypes/walkthrough.ts` | reuse transition locking, navigation, refresh, and teardown |
| reference scene | `src/components/prototypes/SentenceAbstractionDemo.astro` | inspect layout and embedded explanations |
| reference state definitions | `src/components/prototypes/sentenceAbstractionSteps.ts` | inspect measuring and rendering without coupling new scenes to its content |
| gallery | `src/pages/prototypes/index.astro` | render title, tags, and registered demo only |
| dedicated route | `src/pages/prototypes/[...slug].astro` | render full metadata, registered demo, then MDX body |
| recorded media | `public/assets/prototypes/` | add theme and size variants |
| research backlog | `docs/ux-writing-prototypes.md` | consult existing concepts when relevant |

The dedicated page inserts the registered component. Keep the MDX body for prose; importing the demo again duplicates it. Reuse shared tag handling so prototype and post tags route consistently.

At the time this format was established, `Walkthrough.astro` called `sentenceAbstractionSteps(this)` directly. A second real prototype needs dispatch by kind; updating only the registry is insufficient. Inspect the current dispatcher before editing. Keep each instance scoped to its own root and make IDs unique if a component can appear more than once.

The original shared recording wrapper used 690 × 322 desktop and 322 × 438 mobile assets. Expose appropriate size/aspect-ratio props when another interaction needs different dimensions. Do not force every prototype into the sentence demo's geometry.

Do not restore the removed placeholders “a transition you can take apart” or “an explanation that opens in place.”

## plan states before motion

Define stable visual states and explanation states separately. Reuse note identity while its wording remains relevant, so next/previous does not needlessly animate the same text.

For text in flowing paragraphs, the reference implementation measures an invisible native paragraph and animates visible words between measured positions. Re-measure after fonts, size, or visibility change. Return the replacement to its actual paragraph position, and allow surrounding text to reflow naturally.

Keep the visible scene and its accessible representation coherent. Hide purely duplicated measurement text from assistive technology. Announce explanations politely without repeatedly announcing the whole scene.

## reference sequence, not a universal template

The “change the form, keep the intent” walkthrough uses this sequence:

1. Establish editing an essay with an explanation alone.
2. Show the full natural paragraph.
3. Explain wanting to preserve intent while exploring versions, and underline the target sentence.
4. Remove the underline as the metaphor underbrace appears; dim surrounding prose.
5. Move the selected sentence and its annotation into the left comparison column; remove other prose.
6. Show an arrow between the metaphor and future simile label positions.
7. Reveal only the simile label.
8. Reveal the replacement sentence and its underbrace together.
9. Explain choosing the form and using AI to supply wording; italicize parenthetical examples.
10. Return the replacement to its paragraph position, explaining the substitution.
11. Fade out the note and annotations; restore surrounding prose and natural flow.

The example changes “Renting is throwing money away.” to “Renting is like pouring money down a drain.” It preserves the intended claim while changing rhetorical form. Do not silently turn this into replacing the writer's underlying position.

The clean demo records the visual change without the explanation-only beats or notes. Use this sequencing only when it fits a new concept.

## record the demo

Read and follow the available browser-control skill before browser work. Reuse the existing local dev server where possible; port 4321 was used for this project. Use the current browser API rather than assuming a previous session's handles remain valid.

Capture the actual scene in light and dark themes at desktop and mobile widths. Match the filenames expected by the shared wrapper:

- `<slug>-light.gif` and `<slug>-dark.gif`
- `<slug>-light-mobile.gif` and `<slug>-dark-mobile.gif`
- matching `.png` stills for reduced motion

Crop out tabs and walkthrough controls; suppress explanatory notes in the recording. Verify the crop visually. If screenshot clipping ignores offsets, capture the full viewport and crop to measured scene bounds with a standard image-processing tool. Never assume the requested crop was honored.

Avoid unintended scroll changes while capturing mobile interactions. Restore temporary viewport/theme changes and remove recording-only instrumentation. Keep asset sizes reasonable without making text unreadable. Verify a full playback loop, not just its first frame.

## validate proportionately

Read `package.json` and use installed project tools. Established checks include `pnpm exec astro check`, Prettier on changed files, and `git diff --check`. Run the build when routing, content generation, or asset integration needs it; the build also generates search assets, so inspect resulting changes.

Inspect these behaviors in the browser:

- gallery has only the requested title, tags, and component for each prototype;
- dedicated page has subheader, breadcrumb, and all four sections in order;
- demo is selected initially and remains free of explanations;
- every walkthrough transition and reverse transition reaches a coherent state;
- next locks during animation, endpoints behave correctly, and tab switches preserve or intentionally reset state;
- no text collision, detached annotation, orphaned word, or overflow at mobile and desktop widths;
- dark mode, reduced motion, keyboard/touch access, and focus behavior remain usable;
- citations open the intended sources and support the nearby claims;
- console is free of new errors, and recorded assets match the finished interaction.

Use authored content for bounded interaction prototypes unless live generation is requested. Do not add API keys, financial data services, or spending merely to illustrate an interaction.
