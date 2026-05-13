---
title: "How I Build Apps Now"
pubDatetime: 2026-05-12T10:00:00Z
description: "A pipeline for building apps with AI where tests ride along from the very first HTML wireframe through to production, anchored by role-based locators and a single mock-network seam."
tags:
  - ai
  - testing
  - playwright
  - prototyping
  - frontend
draft: false
featured: false
---

I build apps in seven stages:

| Stage | Summary | Tech introduced | Tests added |
|---|---|---|---|
| **1. Click-through prototype** | **Adds navigation**: static `.html` files linked with `<a>`s | HTML (Wireframe HTML subset) | Structural lint |
| **2. Custom-input prototype** | **Adds single-hop state**: minimum vanilla JS makes typed input observable on the next screen | inline `<script>` JS, Playwright. | One Playwright e2e per flow (role/label locators) |
| **3. Stateful prototype** | **Adds global state**[\*](#narrations): refactor wireframes into React components; hooks replace inline `<script>`s; state persists across screens | React, React hooks, a bundler (default: Vite) | Behaviors needing cross-screen state: in-memory lists, modal/dropdown toggles, client-side sorting/filtering |
| **4. Mocked network** | **Adds network**[\*](#narrations): MSW intercepts client fetches; "persisted" data can be loaded and saved via the mock seam | MSW, `fetch` in the app | Network-dependent behaviors: autosuggest, server errors, save-then-reload round trips |
| **5. Styled mockup** | **Adds style**[\*](#narrations): Tailwind + shadcn/ui replace bare HTML; visual-fidelity narrations become real components | Tailwind, shadcn/ui | Regression check (role/label locators survive); tests for any visual-fidelity narrations implemented this stage |
| **6. Full prototype with mocked backend** | **Adds routing**: framework enters; app runs against MSW handlers in dev — demoable to users without a backend | A routing framework of your choice. | Tests for the framework-dependent behaviors implemented this stage. |
| **7. Real backend, one route at a time** | **Adds backend**: implement a route, delete its MSW handler, re-run the suite — frontend untouched | A backend stack of your choice. | None new — the existing e2e tests now hit real endpoints. |

After Stage 7 you have a deployed app with a real backend and an e2e suite covering every flow. Where you go from there is up to you — [a few directions worth knowing about](#you-can-take-it-from-here).

Throughout this post we'll use a small **notes app** as a running example — sign up, list your notes, create / edit / delete, share with a teammate. Each stage has an "Example" collapsible showing what the notes app looks like at that stage, so the abstract operations have something concrete to land on.

## Contents

- [Why bother with a process](#why-bother-with-a-process)
- [The pipeline](#the-pipeline)
  - [Stage 1: Click-through prototype](#stage-1-click-through-prototype)
  - [Stage 2: Custom-input prototype](#stage-2-custom-input-prototype)
  - [Stage 3: Stateful prototype](#stage-3-stateful-prototype)
  - [Stage 4: Mocked network](#stage-4-mocked-network)
  - [Stage 5: Styled mockup](#stage-5-styled-mockup)
  - [Stage 6: Full prototype with mocked backend](#stage-6-full-prototype-with-mocked-backend)
  - [Stage 7: Backend slices](#stage-7-backend-slices)
- [You can take it from here](#you-can-take-it-from-here)

## Why bother with a process

Two things matter when you build with AI: taste (what you're building) and evals (knowing it works). Everything else is plumbing.

The temptation is always to "ship first, test later," and "test later" ends up competing with other new priorities. 

But the opposite temptation is just as bad: kitchen-sink the testing on day one, write twenty unit tests against scaffolding I'll throw away next week, and burn out before I've validated anything real.

I wanted a process where the tests grow with the product. Coarse at the start, granular when the shape stabilizes. Cheap enough at every stage that I don't have an excuse to skip them.

## The pipeline

### Stage 1: Click-through prototype

Generate static HTML wireframes — one file per screen, linked with `<a href>`s.

| Tech | Output | Narrations addressed |
|---|---|---|
| HTML (Wireframe HTML subset); Node + HTML parser | Static HTML wireframes; clickable links between screens | Authored here (not replaced) |

**Steps:**

1. Tell the AI in chat about the app you want to build — what it does, who it's for, the main flows.
2. Paste the **Build prompt**. The agent generates static HTML wireframes; iterate with it until the flow feels right.
3. Paste the **Add tests prompt**. The agent generates a structural lint at `tests/wireframe-lint.mjs`.
4. Run `npm run lint:wireframe` — every input has a label, every SVG has a title, every `<a href>` resolves.

<details>
<summary>Build prompt</summary>

```
You are wireframing the web app we just discussed.

Cover the core flows: the primary value flow plus the supporting flows (sign-up / auth, settings, etc.) that the app needs. If a flow we haven't talked about yet should obviously exist, propose it inline and continue.

Constraints — strict:
- Only static .html files. One file per screen.
- <a href="..."> is the ONLY legal way to move between screens.
- NO CSS. NO JavaScript. NO frameworks. NO component libraries. NO build step. NO package.json. NO tests.
- Allowed HTML elements only (the "Wireframe HTML" subset):
  - Scaffold: <!doctype html>, <html>, <head>, <title>, <body>
  - Regions: <main>, <header>, <footer>, <nav>, <section>, <article>
  - Headings: <h1>–<h6>
  - Text & lists: <p>, <ul>, <ol>, <li>
  - Tables: <table>, <thead>, <tbody>, <tr>, <th>, <td>
  - Disclosure: <details>, <summary>
  - Dialogs: <dialog open>
  - Links: <a href>
  - Forms: <form>, <fieldset>, <legend>, <label for>, <input> (types: text, email, password, number, tel, url, search, date, checkbox, radio, hidden, submit), <textarea>, <select>, <option>, <button>
  - SVG diagrams: <svg> with <title> (required), <desc>, and shape children (<g>, <rect>, <circle>, <ellipse>, <line>, <polyline>, <polygon>, <path>, <text>). Use this for icons, arrows, status indicators, flow diagrams, simple charts.
  - Narrations: <aside class="narration">
- Any element NOT in this list is forbidden. If you need behavior requiring a forbidden element (<img>, <canvas>, <video>, <audio>, range/color/file inputs, anything needing <script>), insert an <aside class="narration"> at that point describing in plain English what should happen, when, and why. Be specific enough that a future test could be written from the narration alone.
- For images specifically: if it needs real visual fidelity (logos, photos, screenshots), use a narration describing what it conveys. If it can be expressed as shapes (icons, arrows, status indicators, simple charts), use inline <svg> with a <title>.
- Use proper heading hierarchy. Use <label for="..."> on every form input. Every <svg> must have a <title>. Accessible names matter — they will become test locators in the next stage.

Output:
- A folder of .html files I can open directly in a browser.
- A short index.html with a list of all flows and entry points.
- No other files.
```

</details>

<details>
<summary>Add tests prompt</summary>

```
You are writing a structural lint for a folder of static HTML wireframes.

Constraints — strict:
- Pure static analysis. NO browser, NO Playwright, NO server, NO running JavaScript from the wireframes.
- Use a single Node script: tests/wireframe-lint.mjs.
- Pick any HTML parser of your choice (e.g. node-html-parser, cheerio, linkedom).
- Exit code 0 on pass, non-zero on fail.

Assertions — must all pass:
1. For every <input> element across all .html files, there exists a <label> in the same file whose "for" attribute matches the input's id.
2. Every <svg> element has a <title> direct child with non-empty text.
3. Every .html file has exactly one <h1>. Heading levels within a file do not skip (i.e. no <h3> appears before any <h2> within the same document).
4. Every <a href="..."> pointing to a relative path resolves to an existing file in the wireframe folder.

Tracked metrics — report but do not fail on:
- Count of <aside class="narration"> blocks per file and total across the wireframe.

Output:
- tests/wireframe-lint.mjs (the script).
- A package.json with one script entry: "lint:wireframe": "node tests/wireframe-lint.mjs".
- Example run output showing the assertions passing and the narration count.
```

</details>

<details>
<summary>Background</summary>

A folder of static `.html` files, one per screen, linked with `<a href>`s. The cheapest possible artifact for arguing about the *flow*. Static HTML beats Figma here because you can actually navigate it — you click through and feel whether the flow is right. (Credit to Thariq's [HTML effectiveness](https://thariqs.github.io/html-effectiveness/) post for the framing.) If the flow is wrong, you'd rather discover it now than after you've wired up state management.

**Navigable but not stateful.** Links work, forms render, native disclosures and dialogs open — but when a user types into an input and clicks Submit, the typed value goes nowhere. A `<form>` with no `action` reloads the page; with `action="next.html"` it navigates, but the next page has no way to display what was typed (reading URL params needs JS). This is intentional: it lets you argue about the *flow* without anyone faking the *data flow* of later stages. The only meaningful assertions at this stage are structural — which is what the lint covers.

- **Tech introduced:** HTML (the Wireframe HTML subset, defined below) for the artifact itself; Node + an HTML parser for the structural lint.
- **Off-limits during Build:** CSS, JavaScript, any framework, component libraries, build steps, package managers, any HTML element outside the subset.
- **Narrations:** every behavior that can't be expressed in Wireframe HTML — animations, transitions, async loads, real-time updates, drag-and-drop, time-based events, media playback, custom inputs — lives in an `<aside class="narration">` block at the point in the flow where it would occur.

**Narrations**

At Stage 1 you can't express animation, async state, real-time updates, drag interactions, or anything time-dependent in pure static HTML. Rather than skip those parts of the flow or fake-stub them with broken UI, render them as **narration blocks**:

```html
<aside class="narration">
  When the user clicks Submit, the note slides up off the screen with a
  200ms ease-out, then a green toast fades in from the bottom reading
  "Note saved" and disappears after 3 seconds.
</aside>
```

A narration is a placeholder *and* a specification, in one element. It marks where future behavior lives, and it describes that behavior precisely enough that the eventual test almost writes itself. As each later stage adds capability, narrations within reach of that capability get **replaced by implementation plus a test that asserts the narration's described behavior**. Narrations describing things still out of reach stay in place.

Narrations sort into five buckets, each handled by a different stage:

- **State-only narrations** — behaviors achievable with React and in-memory state alone: in-memory modal/dropdown toggles, client-side sorting and filtering, list rendering from local state, tab switching, in-page accordions. **Stage 3** picks these off.
- **Network-dependent narrations** — behaviors needing a network seam: autosuggest (debounced fetch), server errors, optimistic UI with rollback, save-then-reload round trips, anything where the response shape matters. **Stage 4** picks these off.
- **Style-only narrations** — behaviors specifying visual fidelity: specific card layouts, animations and transitions, hover states, color schemes, focus indicators, spacing rhythms. **Stage 5** picks these off.
- **Framework-dependent narrations** — behaviors needing a routing framework: route transitions, loading states tied to navigation, redirects after form submission, auth-gated routes, server-rendered initial state. **Stage 6** picks these off.
- **Backend-dependent narrations** — behaviors needing a real server: persistence across page reloads, real auth sessions, real-time server events, anything where the server's actual response shapes behavior (rate limits, conflict resolution, etc.). **Stage 7** picks these off, one route at a time.

By the end of Stage 7, every narration has been replaced. The count of remaining narrations is a visible progress indicator.

One rule: **narrations are version-controlled like code**, not comments to be deleted casually. They're the spec. Don't delete one without replacing it with implementation and a test.

**Wireframe HTML**

A strict subset of HTML is sufficient to describe the flow of any app, given that narrations are the escape hatch. The rule for inclusion is one question: *does this element create a stable role-or-label locator a future Playwright test could target?* If yes, it's in. If no, it's a narration.

- **Document scaffold:** `<!doctype html>`, `<html>`, `<head>`, `<title>`, `<body>`.
- **Regions:** `<main>`, `<header>`, `<footer>`, `<nav>`, `<section>`, `<article>` — landmark elements.
- **Headings:** `<h1>`–`<h6>`.
- **Text & lists:** `<p>`, `<ul>`, `<ol>`, `<li>`.
- **Tables:** `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>`.
- **Disclosure:** `<details>`, `<summary>` — native expand/collapse, no JS required.
- **Dialogs:** `<dialog open>` — native modal, kept in the always-open state for wireframing.
- **Links:** `<a href>` — the only legal way to move between screens.
- **Forms:** `<form>`, `<fieldset>`, `<legend>`, `<label for>`, `<input>` (types `text`, `email`, `password`, `number`, `tel`, `url`, `search`, `date`, `checkbox`, `radio`, `hidden`, `submit`), `<textarea>`, `<select>`, `<option>`, `<button>`.
- **SVG diagrams:** inline `<svg>` with `<title>` (required — it's the accessible name a test will locate by), `<desc>`, and the core shape children `<g>`, `<rect>`, `<circle>`, `<ellipse>`, `<line>`, `<polyline>`, `<polygon>`, `<path>`, `<text>`. Use this for icons, arrows, status indicators, flow diagrams, simple charts — anything the agent can express as shapes.
- **The escape hatch:** `<aside class="narration">`.

Notable omissions and where they go instead: `<img>`, `<canvas>`, `<video>`, `<audio>`, `<input type="range|color|file">`, anything requiring `<script>` → narrations. (For images: anything that needs real visual fidelity — logos, photos, screenshots — is a placeholder you don't have assets for yet, so describe what it's meant to convey. Anything simple enough to express as shapes belongs in inline `<svg>` instead.) Presentational tags (`<b>`, `<i>`, `<small>`, `<br>`, `<hr>`) → wait for Stage 5 styling.

</details>

<details>
<summary>Example</summary>

Before pasting Stage 1's Build prompt, I told the agent in chat: *"I want a small notes app — sign up, list my notes, create new ones with tags, and share a note with one teammate."*

The agent's first pass had five screens but treated note creation and editing as separate flows. I asked it to combine them. It also asked whether *share* should be a public URL or an invite to a specific person — I picked invite, so it added a share-modal narration to the note view.

The flow we settled on:

```
index.html → signup.html → notes.html ⇄ new-note.html
                                ↕
                            note.html  → (delete-confirm modal)
                                       → (share modal)
```

A snippet of `new-note.html`:

```html
<form>
  <label for="title">Title</label>
  <input id="title" name="title" type="text" required>

  <label for="content">Content</label>
  <textarea id="content" name="content" required></textarea>

  <label for="tags">Tags</label>
  <input id="tags" name="tags" type="text">
  <aside class="narration">
    As the user types, autosuggest from prior tags appears as a listbox.
  </aside>

  <button type="submit">Submit</button>
  <aside class="narration">
    On Submit, the note slides up off the screen and a green
    "Note saved" toast fades in for ~3s.
  </aside>
</form>
```

Four narrations end up authored across the screens (slide-up + toast, sort dropdown on the list, delete-confirm modal, tags autosuggest). Everything else is plain Wireframe HTML.

</details>

### Stage 2: Custom-input prototype

Add the minimum vanilla JavaScript so typed input flows to the next screen.

| Tech | Output | Narrations addressed |
|---|---|---|
| Vanilla JS (inline `<script>`); Playwright | Wireframes where typed input renders on the next screen | None — narrations stay in place |

**Steps:**

1. Paste the **Build prompt**. The agent adds inline `<script>` to each form so typed values flow to the next screen.
2. Paste the **Add tests prompt**. The agent writes one Playwright e2e per flow at `tests/e2e/`.
3. Run `npx playwright test` — every flow's happy path passes; the structural lint from Stage 1 stays green.

<details>
<summary>Build prompt</summary>

```
You are extending an HTML wireframe with the minimum behavior to make form-submit flows navigable.

For each flow in this folder:
- Add inline <script> tags inside the existing .html files that capture form submissions with event.preventDefault() and render the next screen with typed values visible (e.g., a typed Title appears as the <h1> on the next screen).
- Use plain DOM APIs only — no fetch, no libraries.

Constraints — strict:
- Do NOT introduce any framework, component library, bundler, CSS, or styling.
- Do NOT add data-testid or any other attribute purely for testing. Behavior must be observable through semantic HTML alone (headings, labels, button names).
- Do NOT touch <aside class="narration"> blocks. Leave them as-is.
- Do NOT add npm dependencies to the app itself. Any tooling installed (e.g. for serving the files) is dev-only.

Output:
- Updated .html files with inline <script> blocks.
- A short description of what each flow now does end-to-end.
```

</details>

<details>
<summary>Add tests prompt</summary>

```
You are writing the first Playwright e2e tests against a click-through HTML prototype.

For each flow, write ONE Playwright test at tests/e2e/[flow-name].test.ts. The test must:
- Use ONLY page.getByRole() and page.getByLabel() locators. No CSS selectors, no test IDs, no XPath.
- Walk every screen in the flow from entry to completion.
- Assert the user-facing outcome (a heading, visible text the user typed, a navigation result).

Constraints — strict:
- Do NOT modify the wireframes or add JS to make tests pass. Tests must pass against the existing HTML + inline JS.
- Do NOT add test IDs or data-attributes to the HTML.
- Do NOT install any state-management or UI library — Playwright is the only new dependency.

Before this sub-stage is done, run the existing structural lint (`npm run lint:wireframe`). It must still pass. If it doesn't, fix the wireframe — do not weaken the lint.

Output:
- A playwright.config.ts with a webServer entry that serves the static files locally.
- One test file per flow under tests/e2e/.
- All tests pass when I run `npx playwright test`. Existing structural lint still passes.
```

</details>

<details>
<summary>Background</summary>

Once a flow feels right, the wireframe gets the minimum vanilla JavaScript that makes it *behaviorally testable*: inline `<script>` blocks that intercept form submits and render the next screen with typed values carried forward. That single capability — **user input becomes observable to the next screen** — is what unlocks the first real Playwright assertion. A test can now type into *Title*, click Submit, and verify the typed value appears as a heading on the next page:

```ts
await page.getByLabel('Title').fill('My note')
await page.getByLabel('Content').fill('Hello world')
await page.getByRole('button', { name: 'Submit' }).click()
await expect(page.getByRole('heading', { name: 'My note' })).toBeVisible()
```

Without that JS, the only thing a test could check is link navigation — which the Stage 1 lint already proves statically. The JS is what gives Stage 2's tests something *new* to assert. Each test is maybe twenty lines and becomes the load-bearing contract for its flow for the rest of the project's life.

The state model here is **single-hop**: typed values flow as a side effect of one navigation, then evaporate. Hit back, refresh, or take a different path and they're gone. No store, no persistence, no cross-screen visibility. That's deliberate — it's the simplest model that's behaviorally testable, and it's enough to validate that the *flow* works before anything richer enters.

Playwright enters here as one of the two locked-in tools — its role/label locator API is the contract that survives every subsequent rewrite, which is why it isn't swappable.

- **Tech introduced:** Vanilla JavaScript (inline `<script>` only) at Build; Playwright at Add tests.
- **Off-limits during Build:** CSS, any framework, component libraries, bundlers, state libraries, npm dependencies in the app itself (Playwright is dev-only).
- **Narrations:** untouched. Leave them in place — they describe behavior beyond the reach of this stage.

**Why anchor on roles and labels**

Most testing advice falls apart in practice because **tests break for the wrong reasons**. You write an integration test against `signInWithEmail()`, you refactor the auth module, the test is now a paperweight — even though the product behavior didn't change at all. That's the failure mode: the test was coupled to an implementation detail, not to anything a user or a caller would notice.

The fix isn't to find things that never change. It's to anchor tests to the things that change *only when product behavior changes*. Two qualify:

1. **What the user sees and clicks.** "The button named *Submit*." "The input labelled *Email*." "The heading *Welcome back*." The URL in the address bar counts too — it's something the user perceives and shares. When these change, the product changed: somebody renamed a button, removed a field, reworded a flow, restructured the routes. The test *should* fail; that's the whole point of having it. When you swap React for Svelte, or rewrite the HTML, these don't move, so the test doesn't either.
2. **The I/O at the system boundary.** `POST /notes` takes `{title, content}` and returns `{id, title, content, createdAt}`. The outbound `POST https://hooks.slack.com/...` carries `{channel, text}`. The boundary isn't "frontend ↔ backend" — it's "code I own ↔ code I don't." When any of those contracts change, somebody altered what the system does and the test *should* fail. When the implementation behind them changes — `<script>` tag, MSW handler, real Postgres — the contracts hold and the test rides along.

That's the whole game: tests fail when the product changes and stay quiet when it doesn't. Coupling them to roles, URLs, and boundary I/O is what buys you that property. The role/label half is what's anchoring the test above; the boundary-I/O half becomes explicit at Stage 4 when MSW arrives and the network contracts move into version control.

</details>

<details>
<summary>Example</summary>

Stage 1's Add tests prompt produced the structural lint, which flagged one input on the share modal that was missing a `<label for>`. I asked the agent to fix it; it patched the wireframe and the lint went green.

Then Stage 2's Build prompt. The agent asked whether to carry form values via URL params or `sessionStorage`. I picked URL params — simpler, less hidden state, and Playwright can verify the URL too. It added inline `<script>` to `new-note.html` and `note.html`:

```html
<!-- new-note.html, appended -->
<script>
  document.querySelector('form').addEventListener('submit', e => {
    e.preventDefault();
    const params = new URLSearchParams(new FormData(e.target));
    location.href = `note.html?${params}`;
  });
</script>
```

```html
<!-- note.html, appended -->
<script>
  const params = new URLSearchParams(location.search);
  document.querySelector('h1').textContent = params.get('title') || 'Untitled';
  document.querySelector('.content').textContent = params.get('content') || '';
</script>
```

Stage 2's Add tests prompt landed one Playwright test per flow. The "create note" one:

```ts
test('create note flow', async ({ page }) => {
  await page.goto('/new-note.html');
  await page.getByLabel('Title').fill('My first note');
  await page.getByLabel('Content').fill('Hello world');
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByRole('heading', { name: 'My first note' })).toBeVisible();
});
```

The four Stage 1 narrations stay in place — they all describe behavior beyond what plain JS can deliver here.

</details>

### Stage 3: Stateful prototype

Refactor wireframes into React components with hooks for state.

| Tech | Output | Narrations addressed |
|---|---|---|
| React, React hooks, Vite (or your bundler) | React app with global-ish state; unstyled | State-only |

**Steps:**

1. Paste the **Build prompt**. The agent refactors the wireframes into React components with hooks for state, and replaces any state-only narrations.
2. Paste the **Add tests prompt**. The agent writes a Playwright e2e for each replaced narration.
3. Run the full suite — structural lint + Stage 2 e2e + the new tests all pass.

<details>
<summary>Build prompt</summary>

```
You are refactoring a click-through HTML prototype into a React app with global-ish state. No styling, no network, no routing framework, no backend.

You will introduce:
- **React** as the runtime. (Swap: replace with Svelte, Vue, Solid, or another framework — if you do, the rest of the stack defaults shift accordingly.)
- **React hooks** (`useState`, `useReducer`, `useContext`) for client state — built-in, no new dependency. (Swap: Zustand, Nano Stores, signals, or whatever fits.)
- **A bundler** of your choice (default: Vite). Whatever it takes to serve the React app for the Playwright webServer in `playwright.config.ts`.

Still OFF-LIMITS — strict:
- No CSS, no Tailwind, no component library. Default browser rendering only.
- No `fetch`, no MSW, no network calls of any kind.
- No routing framework. Single-page app or per-screen entry points served by the bundler; navigation via `<a href>` or framework-free `history.pushState`.
- No real backend, no real database, no auth provider.

For every <aside class="narration"> block:
- If the narrated behavior is achievable with React + in-memory state alone (in-memory modal/dropdown toggles, client-side sorting/filtering, list rendering from local state, tab switching, in-page accordions, drag-and-drop within a page), REPLACE the narration with the real implementation. Do NOT write tests for it in this sub-stage — that comes next.
- If the narration needs network calls, styling fidelity, framework routing, or a backend, LEAVE IT IN PLACE unchanged.

Output:
- The React app.
- A list of <aside class="narration"> blocks that were replaced this stage, with the verbatim text of each. This list drives the next sub-stage's tests.
- A list of remaining <aside class="narration"> blocks, partitioned by category (network-dependent, style-only, framework-dependent, backend-dependent).
```

</details>

<details>
<summary>Add tests prompt</summary>

```
You are writing Playwright e2e tests for state-only behaviors that were just implemented from narrations in a React app.

You will receive a list of <aside class="narration"> blocks that were replaced with implementation, including the verbatim text of each one. For each one:
- Write a Playwright e2e test at tests/e2e/[descriptive-name].test.ts that asserts the narration's described behavior.
- Use ONLY page.getByRole() and page.getByLabel() locators. No CSS selectors, no test IDs.
- Tests assert in-app state transitions (a modal opening when a button is clicked, a filtered list updating when a search input changes, etc.).

Before this sub-stage is done, run the full test suite from all previous stages (structural lint + Stage 2 e2e tests). The expectation is that they pass unchanged. If a previous test fails:
1. First check: did this stage's new code change an accessible name, a heading, a label, or a URL? Fix the new code so the previous test passes again. Do NOT change the test.
2. If the failure reflects a deliberate product change (a button renamed on purpose, a flow restructured), update the test in its own commit with a message that names the product change.
3. Do NOT silently disable, skip, weaken, or comment out a previous test.

Output:
- One new test file per replaced narration, under tests/e2e/.
- Test run output showing: structural lint passing, Stage 2 e2e passing, all new tests passing.
```

</details>

<details>
<summary>Background</summary>

This is where React enters and the state model jumps a level. Stage 2 was single-hop (one form → one destination, then gone); Stage 3 is the first stage with anything **global-ish**. The inline `<script>` blocks become real components; React hooks (`useState`, `useReducer`, `useContext`) hold in-memory state at the component or context level. Values become referenceable from anywhere in the app, mutable, displayable in multiple places — which is what unlocks lists, filters, inline editing, and any cross-screen invariant the tests want to assert. There's no network yet, and no styling yet either. The artifact at the end of this stage is ugly but stateful.

React is the default runtime from this stage onward — the rest of the stack defaults (hooks, Tailwind, shadcn/ui) are React-shaped. To swap React out, edit the Build prompt below; note that the styling and state defaults are React-specific, so a framework swap also swaps those.

- **Tech introduced:** React (default — swap to Svelte/Vue/Solid by editing the prompt), React hooks for state, a bundler (default: Vite).
- **Off-limits:** styling beyond default browser rendering, network calls, routing framework, real backend.
- **Narrations:** in Build, replace any *state-only* narration whose behavior needs only React + in-memory state (in-memory modal/dropdown toggles, client-side sorting/filtering, list rendering from local state, tab switching). The matching tests land in Add tests. Leave narrations that need network, styling, framework routing, or a backend.

</details>

<details>
<summary>Example</summary>

Stage 3's Build prompt refactored the HTML into React. The agent picked Vite as the bundler without asking — that's the default; fine. It proposed `useReducer` for the notes collection since we'll be appending and removing entries; I agreed.

The component tree it landed on:

```
App
├─ NotesProvider     — useReducer over notes[]
└─ Routes
   ├─ NotesList      — sort dropdown + list of links
   ├─ NoteForm       — create / edit form
   └─ NoteDetail     — read view, Delete button, delete-confirm modal
```

Two narrations got replaced this stage:

- **Sort dropdown** → a `<select>` with `useState`; the list re-renders a `useMemo`-sorted array.
- **Delete-confirm modal** → a controlled boolean state, rendered as an unstyled `<div role="dialog">` with Cancel / Confirm.

The sort, in code:

```jsx
function NotesList({ notes }) {
  const [sort, setSort] = useState('newest');
  const sorted = useMemo(() => sortNotes(notes, sort), [notes, sort]);
  return (
    <>
      <select aria-label="Sort" value={sort} onChange={e => setSort(e.target.value)}>
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
        <option value="title">Title A–Z</option>
      </select>
      <ul>{sorted.map(n => <li key={n.id}><Link to={`/notes/${n.id}`}>{n.title}</Link></li>)}</ul>
    </>
  );
}
```

Three narrations still in place: slide-up + toast (Stage 5), autosuggest tags (Stage 4), route transitions (Stage 6).

</details>

### Stage 4: Mocked network

Add MSW; wire up `fetch` calls for network-dependent behaviors.

| Tech | Output | Narrations addressed |
|---|---|---|
| MSW; `fetch` in the app | React app with mocked network; persisted-feel behaviors work | Network-dependent |

**Steps:**

1. Paste the **Build prompt**. The agent adds MSW, wires `fetch` calls in the app, and replaces network-dependent narrations.
2. Paste the **Add tests prompt**. The agent writes Playwright tests using `network.use(...)` for per-test scenarios (empty list, error response, populated suggestions).
3. Run the full suite — Stages 2–3 e2e + the new tests all pass; structural lint stays green.

<details>
<summary>Build prompt</summary>

```
You are adding a mocked-network layer (MSW) to a working React app with global state. No styling, no routing framework, no real backend.

You will introduce:
- **MSW** for mocking all network calls (locked in — do not swap). Default handlers go in `tests/handlers.ts` and are loaded by both the dev server and the Playwright test setup.
- **`fetch` calls** (or a thin wrapper of your choice — TanStack Query, swr, or vanilla — pick one) at the points in the app that need "persisted" data or server interaction.

Still OFF-LIMITS — strict:
- No CSS, no Tailwind, no component library. Default browser rendering only.
- No routing framework.
- No real backend, no real database, no auth provider.

For every <aside class="narration"> block remaining:
- If the narrated behavior needs the network seam (autosuggest with debounced fetch, server errors, optimistic UI with rollback, save-then-reload round trips, anything where a response shape matters), REPLACE the narration with the real implementation. Do NOT write tests for it in this sub-stage — that comes next.
- If the narration needs styling fidelity, framework routing, or a real backend, LEAVE IT IN PLACE.

Output:
- The updated React app with `fetch` calls and an MSW setup.
- `tests/handlers.ts` with mock handlers for every network call the app makes.
- A list of <aside class="narration"> blocks that were replaced this stage, with verbatim text. This list drives the next sub-stage's tests.
- A list of remaining <aside class="narration"> blocks, partitioned by category (style-only, framework-dependent, backend-dependent).
```

</details>

<details>
<summary>Add tests prompt</summary>

```
You are writing Playwright e2e tests for network-dependent behaviors that were just implemented from narrations.

For each replaced narration:
- Write a Playwright e2e test at tests/e2e/[descriptive-name].test.ts that asserts the narration's described behavior.
- Use ONLY page.getByRole() and page.getByLabel() locators. No CSS selectors, no test IDs.
- Use the test-scoped network override (e.g. `network.use(http.get(...))`) to set up the specific scenario the test needs: empty list, error response, populated suggestions, slow response, etc.

Before this sub-stage is done, run the full test suite from all previous stages (structural lint + Stage 2 e2e + Stage 3 e2e). The expectation is that they pass unchanged. If a previous test fails:
1. First check: did this stage's new code change an accessible name, a heading, a label, an MSW handler shape, or a URL? Fix the new code so the previous test passes again. Do NOT change the test.
2. If the failure reflects a deliberate product change, update the test in its own commit with a message that names the product change.
3. Do NOT silently disable, skip, weaken, or comment out a previous test.

Output:
- One new test file per replaced narration, under tests/e2e/.
- Test run output showing: structural lint passing, Stage 2 + Stage 3 e2e passing, all new tests passing.
```

</details>

<details>
<summary>Background</summary>

MSW arrives as the network seam. The React app from Stage 3 can now make `fetch` calls; MSW intercepts them and returns mocked responses. Default handlers live in `tests/handlers.ts` — that file is now my materialized backend backlog. Anything that previously couldn't be expressed because it required a network round-trip (autosuggest, server errors, optimistic UI, save-then-reload) becomes implementable. The artifact at the end of this stage is functionally complete but visually still bare.

MSW is the second of the two locked-in tools. Intercepting at the network layer (not at a function call) is what lets the same handlers serve as the mock backend in tests, in dev, and as the migration checklist when the real backend lands at Stage 7.

- **Tech introduced:** MSW (locked in — do not swap), `fetch` calls in the app.
- **Off-limits:** styling, routing framework, real backend, database, auth provider.
- **Narrations:** in Build, replace any *network-dependent* narration (autosuggest, server errors, optimistic UI with rollback, save-then-reload round trips). The matching tests land in Add tests. Leave narrations that need styling, framework routing, or a real backend.

</details>

<details>
<summary>Example</summary>

Stage 4's Build prompt added MSW and four handlers. The agent suggested using TanStack Query for fetch ergonomics; I declined for this iteration (vanilla `fetch` + `useEffect` is enough for now, and one less dependency to learn).

`tests/handlers.ts` ended up as:

```ts
import { http, HttpResponse } from 'msw'

let notes = [{ id: '1', title: 'Welcome', content: '...', tags: ['intro'] }]
const allTags = ['intro', 'todo', 'shopping', 'ideas']

export const handlers = [
  http.get('/api/notes', () => HttpResponse.json(notes)),
  http.post('/api/notes', async ({ request }) => {
    const note = { id: crypto.randomUUID(), ...(await request.json() as object) }
    notes.push(note)
    return HttpResponse.json(note)
  }),
  http.delete('/api/notes/:id', ({ params }) => {
    notes = notes.filter(n => n.id !== params.id)
    return new HttpResponse(null, { status: 204 })
  }),
  http.get('/api/tags', ({ request }) => {
    const q = new URL(request.url).searchParams.get('q') ?? ''
    return HttpResponse.json(allTags.filter(t => t.startsWith(q)))
  }),
]
```

Two narrations got replaced this stage:

- **Autosuggest tags** → debounced fetch to `/api/tags?q=…`, rendered as a `<ul role="listbox">` of options.
- **Error toast on save failure** → a Playwright test overrides `POST /api/notes` to return 500 (`network.use(http.post(…))`), and the app's error path renders a visible error message.

Slide-up animation (Stage 5) and route transitions (Stage 6) stay narrated.

</details>

### Stage 5: Styled mockup

Apply Tailwind + shadcn/ui across the components.

| Tech | Output | Narrations addressed |
|---|---|---|
| Tailwind, shadcn/ui | Styled, polished React app — looks like an app | Style-only |

**Steps:**

1. Paste the **Build prompt**. The agent adopts Tailwind + shadcn/ui across the components, replaces style-only narrations, and preserves accessible names.
2. Paste the **Add tests prompt**. Mostly a regression check — confirm every role/label locator from Stages 2–4 still resolves. Add new tests only for style behaviors that are independently testable.
3. Run the full suite. Any failure is almost always a wrapped element that lost its role; fix the markup, not the test.

<details>
<summary>Build prompt</summary>

```
You are styling a working React app with mocked-network behaviors. The app's behavior is already complete; this stage is the visual layer.

You will introduce:
- **Tailwind CSS** for utility-class styling. (Swap: vanilla CSS modules, Open Props, Pico.css, or another approach.)
- **shadcn/ui** for component primitives (Button, Dialog, DropdownMenu, Toast, etc.). (Swap: another component library, or roll your own — but ensure the replacement preserves the ARIA roles emitted by the underlying HTML so the existing Playwright tests keep finding their locators.)

Still OFF-LIMITS — strict:
- No routing framework.
- No real backend, no real database, no auth provider.

For every <aside class="narration"> block remaining:
- If the narrated behavior is style-only (a specific card layout, an animation, a hover state, a color scheme, a focus indicator, spacing), REPLACE the narration with the real implementation.
- If the narration needs framework routing or a real backend, LEAVE IT IN PLACE.

Critical constraint: **preserve accessible names**. Every `<button>` named "Submit" must remain findable as `getByRole('button', { name: 'Submit' })` after styling. If shadcn/ui's wrapper components change the underlying role (rare but possible), adjust the wrapping so accessibility roles are preserved. Do NOT add test IDs to compensate; fix the markup.

Output:
- The styled app.
- A list of <aside class="narration"> blocks that were replaced this stage, with verbatim text — flagged by whether each is independently testable (animations triggered by user action: yes; static color schemes: no, just visual). This list drives the next sub-stage's tests.
- A list of remaining <aside class="narration"> blocks (these should all be framework- or backend-dependent at this point).
```

</details>

<details>
<summary>Add tests prompt</summary>

```
You are running the regression check after a styling pass, and writing targeted tests for any style-only narrations whose behavior is testable.

First and most important: run the full test suite from all previous stages (structural lint + Stage 2 e2e + Stage 3 e2e + Stage 4 e2e). The expectation is that they pass unchanged. If a previous test fails:
1. First check: did the styling pass wrap a component in a way that changed its accessible role, or did a class swap drop a `<button>` for a `<div onclick>`? Fix the styled code so the previous test passes again. Do NOT change the test.
2. Do NOT add test IDs to compensate for broken role detection — the failure is a signal that the markup is wrong, and adding a test ID hides the bug instead of fixing it.
3. Do NOT silently disable, skip, weaken, or comment out a previous test.

For each style-only narration whose behavior is independently testable (animations triggered by user action, hover states with content changes, focus indicators, `prefers-reduced-motion` paths):
- Write a Playwright e2e test at tests/e2e/[descriptive-name].test.ts asserting the described behavior.
- Use ONLY page.getByRole() and page.getByLabel() locators.

Output:
- (Possibly empty) test files for testable style-only narrations.
- Test run output showing: structural lint passing, Stages 2–4 e2e passing, any new tests passing.
```

</details>

<details>
<summary>Background</summary>

The polish pass. The app already works — state, behaviors, and network seam are all in place from Stages 3 and 4. This stage makes it look like an app. Tailwind + shadcn/ui replace bare HTML elements with styled components. Any narration that specified visual fidelity (a specific card layout, an animation, a hover state) becomes a real implementation. The biggest risk at this stage is accidentally breaking accessible names — a careless wrap around a button or a class swap that drops the `<button>` role for a `<div onclick>` will break every prior Playwright test. The Add tests sub-stage here is mostly a regression check.

Tailwind + shadcn/ui are the styling defaults — Tailwind is framework-agnostic; shadcn/ui is React-specific (community ports exist for Svelte/Solid/Vue). Swap to Open Props, Pico.css, or another approach by editing the Build prompt.

- **Tech introduced:** Tailwind (default — swap by editing the prompt), shadcn/ui for components (default — React-specific; community ports exist for Svelte/Solid/Vue).
- **Off-limits:** routing framework, real backend, database, auth provider.
- **Narrations:** in Build, replace any *style-only* narration (specific card layouts, animations and transitions, hover states, color schemes, focus indicators, spacing rhythms). The matching tests (where the behavior is testable — most aren't) land in Add tests. Leave narrations that need framework routing or a backend.

</details>

<details>
<summary>Example</summary>

Stage 5's Build prompt swapped Stage 3's bare HTML primitives for shadcn/ui components and laid Tailwind utilities on top. The agent flagged one issue mid-swap: replacing the unstyled `<div role="dialog">` from Stage 3 with shadcn's `<Dialog>` *almost* dropped the `role="dialog"` attribute (different markup tree). It paused, asked me to confirm the Stage 3 test should keep finding the dialog by role, and emitted the swap with the role preserved.

Three narrations got replaced this stage:

- **Slide-up + green toast on save** → a CSS transition on `NoteDetail` mount, plus `toast.success('Note saved')` via Sonner.
- **Hover state on note cards** → `hover:shadow-md hover:-translate-y-0.5` lifts the card and reveals a quick-actions menu.
- **Focus indicators** → `focus-visible:ring-2 focus-visible:ring-accent` on every interactive element.

One representative diff — the form's Submit button:

```diff
- <button type="submit">Submit</button>
+ <Button type="submit">Submit</Button>
```

shadcn's `<Button>` renders an underlying `<button>`, so `getByRole('button', { name: 'Submit' })` from the Stage 2 test still resolves. The regression-check pass found and fixed the one ARIA slip described above; the suite went green.

The app reads as a real product now, not a sketch.

</details>

### Stage 6: Full prototype with mocked backend

Migrate the prototype onto a routing framework of your choice.

| Tech | Output | Narrations addressed |
|---|---|---|
| A routing framework of your choice (menu in Background) | Framework-routed app; still MSW-backed; demoable | Framework-dependent |

**Steps:**

1. Pick a routing framework with the AI in chat — the Background's **Framework menu** is your reference if you haven't decided.
2. Paste the **Build prompt**. The agent migrates the components into framework routes and replaces framework-dependent narrations.
3. Paste the **Add tests prompt**. The agent writes Playwright tests for the new routing behaviors (loading states, redirects, auth gates).
4. Run the full suite — Stages 2–5 e2e tests still pass against the migrated app.

<details>
<summary>Build prompt</summary>

```
You are migrating a styled, client-only mockup to a real routing framework.

Routing framework: use whichever framework we agreed on earlier in this chat. If we haven't picked one, recommend the best fit for this app (see the Background section's Framework menu for the trade-offs) and proceed.

You may:
- Migrate existing screens to be framework routes with the framework's conventions.
- Use the framework's data-loading, form-handling, and navigation primitives.
- Continue using MSW for all network calls — tests/handlers.ts remains the source of truth for network behavior.

Still OFF-LIMITS — strict:
- No real backend, no real database, no auth provider.
- Do NOT delete any handlers from tests/handlers.ts.
- Do NOT introduce a server-side ORM or query layer.

For every remaining <aside class="narration"> block:
- If the narrated behavior depends on framework features (loading states, route transitions, redirects, suspense, error boundaries, auth-gated routes, optimistic UI tied to navigation), REPLACE the narration with the real implementation. Do NOT write tests for it in this sub-stage — that comes next.
- If the narration describes backend-dependent behavior, LEAVE IT IN PLACE.

Output:
- The framework-migrated app.
- Updated tests/handlers.ts if new mocked endpoints emerged from framework data-loading patterns.
- A list of <aside class="narration"> blocks that were replaced this stage, with the verbatim text of each. This list drives the next sub-stage's tests.
- A list of remaining <aside class="narration"> blocks (these should all be backend-dependent at this point).
```

</details>

<details>
<summary>Add tests prompt</summary>

```
You are writing Playwright e2e tests for framework-mediated behaviors that were just implemented from narrations.

You will receive a list of <aside class="narration"> blocks that were replaced with implementation, including the verbatim text of each. For each one:
- Write a Playwright e2e test at tests/e2e/[descriptive-name].test.ts that asserts the narration's described behavior end-to-end through the framework's routing.
- Use ONLY page.getByRole() and page.getByLabel() locators. Where a route's URL is part of what the user perceives (shareable URLs, redirect targets), assert on it; otherwise prefer role/label assertions.
- For redirects and loading states, rely on Playwright's auto-waiting via expect(locator).toBeVisible() / .toHaveURL() rather than manual waitForTimeout calls.

Before this sub-stage is done, run the full test suite from all previous stages (structural lint + Stages 2–5 e2e). The expectation is that they pass unchanged. If a previous test fails:
1. First check: did this stage's new code change an accessible name, a heading, a label, an MSW handler shape, or a URL? Fix the new code so the previous test passes again. Do NOT change the test.
2. If the failure reflects a deliberate product change, update the test in its own commit with a message that names the change.
3. Do NOT silently disable, skip, weaken, or comment out a previous test.

Output:
- One new test file per replaced narration, under tests/e2e/.
- Test run output showing: structural lint passing, Stages 2–5 e2e passing, all new tests passing.
```

</details>

<details>
<summary>Background</summary>

A routing framework enters. The network is still MSW. In dev, the app itself runs against the mock handlers — this means the prototype is *demoable* to real users before any backend exists. Existing tests don't change.

- **Tech introduced:** a routing framework of your choice (menu below).
- **Off-limits:** real backend, real database, auth provider. `tests/handlers.ts` is still the entire network layer.
- **Narrations:** in Build, replace any narration whose behavior depends on framework features (loading states, route transitions, redirects, suspense boundaries, error boundaries, auth-gated routes, server-rendered initial state). Tests for them land in Add tests. Backend-dependent narrations stay.

**Framework menu**

No prescribed default — pick by what your app needs to do:

- **Next.js App Router** — the most batteries-included option. Server components, image optimization, file-based routing, first-class Vercel deployment. Strong choice if you want minimal infrastructure decisions and Vercel-style hosting.
- **React Router v7 (framework mode)** — closest to plain React, less opinionated. Strong choice if you want flexibility and a smaller surface area.
- **TanStack Router** — newer, with route-level type safety better than either of the above. Strong choice if type-safe routing is the property you care most about.
- **Astro (with React islands)** — content-first, hydrates interactivity selectively. Strong choice if most of your app is content with sprinkles of interaction.

The only hard constraint: the framework migration must preserve accessible names. Your Stages 2–5 Playwright tests are anchored to roles and labels, not to component identities — if those don't move, the tests keep passing.

</details>

<details>
<summary>Example</summary>

The chat had already landed on **React Router v7 (framework mode)** as the framework. Next.js was the runner-up; I picked React Router because I wanted to keep deployment flexible (any static host or Node server).

Stage 6's Build prompt migrated the components into file-based routes:

```
app/
  root.tsx                 — layout shell
  routes.ts                — route config
  routes/
    _index.tsx             — landing
    signup.tsx
    login.tsx
    notes._index.tsx       — list
    notes.$id.tsx          — detail / edit
    notes.new.tsx          — create
```

Three narrations got replaced this stage:

- **Loading state on `/notes`** → the route loader returns a Promise; `<Suspense>` shows a skeleton card list while it resolves.
- **Auth-gated `/notes`** → the loader does `if (!session) throw redirect('/login')`; unauthenticated users land on the login screen.
- **Optimistic save** → `useFetcher` renders the new note immediately and reconciles when the response lands.

`tests/handlers.ts` is unchanged — every fetch still goes through MSW. The Stage 2–5 e2e tests pass against the migrated app because the role/label locators didn't move (the agent's first migration broke one — a wrapped `<form>` lost its accessible name; the regression check caught it and the fix was a one-liner).

</details>

### Stage 7: Backend slices

Replace one MSW handler with a real backend route. Repeat.

| Tech | Output | Narrations addressed |
|---|---|---|
| A backend stack of your choice (menu in Background) | Real backend behind one route; rest still MSW | Backend-dependent |

**Steps (repeat per handler):**

1. Pick a backend stack with the AI in chat — the Background's **Backend menu** is your reference if you haven't decided.
2. Pick the next handler from `tests/handlers.ts` to migrate. Typically the one blocking the most user flows from working against real data.
3. Paste the **Build prompt**. The agent implements the real route with the same request/response shape, deletes the corresponding MSW handler, and (if any narration is tied to it) replaces it with real UI.
4. Paste the **Add tests prompt**. The agent runs the existing suite against the new mix of real backend + remaining MSW; adds a test for any narration that landed.
5. Repeat steps 2–4 until `tests/handlers.ts` contains only third-party services.

<details>
<summary>Build prompt</summary>

```
You are replacing ONE MSW handler with a real backend route. This is a one-at-a-time operation.

Backend stack: use the stack we agreed on earlier in this chat. If we haven't picked one, recommend the best fit for this app (see the Background section's Backend menu for the trade-offs) and proceed.

Handler to replace: pick the next handler from tests/handlers.ts to migrate — typically whichever blocks the most user flows from working against real data. Tell me which handler you picked before implementing.

Steps — in order, do not skip:
1. Read the existing MSW handler in tests/handlers.ts to learn the exact request and response shape.
2. Implement the real route with the SAME request and response contract. If the real implementation genuinely cannot match the contract, STOP and explain why before proceeding — do not silently change the contract.
3. Delete only that one handler from tests/handlers.ts.
4. If any <aside class="narration"> block in the frontend is tied to this endpoint, replace it with real UI now. Note its verbatim text for the next sub-stage.

Constraints — strict:
- Change ONLY this one route this iteration. Do not touch other handlers or other routes.
- Do NOT modify frontend code unless the contract genuinely needs to change — and if it does, flag it before making any changes.
- Do NOT add or modify tests in this sub-stage. Tests come next.

Output:
- The new route implementation and any minimal infra needed (migrations, DB schema).
- A diff of tests/handlers.ts showing the one deletion.
- A list (possibly empty) of <aside class="narration"> blocks that were replaced this iteration, with verbatim text.
```

</details>

<details>
<summary>Add tests prompt</summary>

```
You are writing Playwright e2e tests for any narration that landed alongside the backend route that just replaced an MSW handler.

For each <aside class="narration"> block that was replaced in this iteration's Build (the list may be empty):
- Write a Playwright e2e test at tests/e2e/[descriptive-name].test.ts that asserts the narration's described behavior end-to-end against the real backend.
- Use ONLY page.getByRole() and page.getByLabel() locators.

In all cases, run the full test suite from all previous stages. The MSW handler for this iteration's route has been deleted, so existing tests are now hitting the real endpoint — they must still pass. If a previous test fails:
1. First check: did the real route's request/response shape diverge from the deleted handler's contract? If yes, the divergence should have been flagged at Build — restore parity or document the deliberate contract change.
2. For latency-related flakiness, rely on Playwright's auto-waiting (expect(locator).toBeVisible() etc.). Do NOT add manual waitForTimeout calls.
3. If the failure reflects a deliberate product change, update the test in its own commit with a message that names the change.
4. Do NOT silently disable, skip, weaken, or comment out a previous test.

Output:
- New test files for any narrations landed this iteration (may be zero).
- Test run output showing: structural lint passing, all Stages 2–6 tests passing against the new mix of real backend + remaining MSW.
```

</details>

<details>
<summary>Background</summary>

This is where the whole approach pays off. To land a real backend endpoint, I implement the route, **delete its handler from `tests/handlers.ts`**, and re-run the e2e suite. The handler removal is the cutover. The tests pass for the same reason they always did — the contract didn't change, just the implementation behind it. Backend lands one route at a time, and each landing is a one-line deletion from a file. Any backend-dependent narration still in the frontend is implemented alongside its corresponding route in this same iteration.

- **Tech introduced:** a backend stack of your choice (menu below).
- **Off-limits:** changing the network contract without flagging it. If the real backend would naturally have a different request/response shape than the existing MSW handler, stop and reconcile the contract first.
- **Narrations:** any narration tied to this iteration's endpoint is implemented in Build; its test lands in Add tests. By the end of Stage 7, the narration count is zero.

**Backend menu**

No prescribed default — pick by where the app needs to run and how much infrastructure you want to operate:

- **Self-hosted Node / Bun + ORM + DB** — a runtime (Node or Bun) plus a server framework (Hono, Elysia, Express, Fastify), an ORM (Drizzle, Prisma, Kysely), and a database (SQLite for local, Postgres for production). Full type safety end-to-end with React; full control over hosting and cost.
- **Managed BaaS** — Convex, Supabase, Firebase. Auth + database + functions bundled. Convex is the most React-native (functions are TypeScript, queries are reactive by default). Supabase is the closest drop-in for "Postgres + auth + storage." Firebase has the best mobile story.
- **Edge / serverless** — Cloudflare Workers, AWS Lambda, Vercel Functions, Deno Deploy. Pay-per-request, no servers to keep running. Strong choice if traffic is spiky or you don't want to operate infrastructure.
- **Hybrid** — e.g., Supabase for auth + DB, Workers or Lambdas for heavier compute. The most common production pattern in practice.

The contract you have to keep is whatever was in the MSW handler. Pick the backend that lets you preserve the request/response shape with the least ceremony, and you'll be replacing handlers one at a time without touching the frontend.

</details>

<details>
<summary>Example</summary>

The chat had landed on **Hono + Drizzle + SQLite** as the backend stack — easy to run locally, easy to swap SQLite → Postgres later without touching Drizzle code.

**Iteration 1: `GET /api/notes`.** I pasted Stage 7's Build prompt; the agent picked GET as the first handler to migrate (lowest risk, sets up the schema + table + auth-context plumbing). It generated `server/db/schema.ts`, a migration, and the route:

```ts
// server/routes/notes.ts
app.get('/api/notes', async c => {
  const userId = c.get('userId')
  const rows = await db.select().from(notes).where(eq(notes.userId, userId))
  return c.json(rows)
})
```

Then the one-line deletion in `tests/handlers.ts`:

```diff
- http.get('/api/notes', () => HttpResponse.json(notes)),
```

Stage 7's Add tests prompt ran the suite. Stages 2–6 e2e tests passed against the real route. No new test was needed (no narration was tied to GET).

**Iteration 2: `POST /api/notes`.** Same dance. The agent caught one contract drift — the real route returned the saved note plus a server-set `createdAt` field that the MSW handler hadn't included; the frontend already rendered `note.createdAt` (it was already in the type, just often undefined), so no frontend change was needed. Suite passed.

**Iteration 3: auth (`POST /api/signup`, `POST /api/login`, session cookie).** Coupled, so one iteration covered all three. The session-cookie change touched the route loaders from Stage 6; the suite caught one regression where the login redirect target was wrong, fixed in two lines.

By the end of Stage 7, `tests/handlers.ts` contained only handlers for third-party services I don't own — those mark the permanent system boundary, not the migration backlog.

</details>

## You can take it from here

After Stage 7 you have a deployed app with a real backend and an e2e suite that covers every flow. Past that point, the right next move depends entirely on what your app needs to do — there's no universal protocol because every product diverges here. A few directions worth knowing about:

- **Granular tests.** Sink from e2e toward integration and unit tests for the specific bits of code that keep regressing the same subtle way — date parsing, permission branches, reducer transitions, currency rounding. A unit test pinpoints those failures faster than an e2e can. Resist writing unit tests speculatively or for coverage; only add one in response to a recurring regression.
- **Backend depth.** More routes, complex queries, transactions, background jobs, real-time subscriptions, auth at scale, multi-tenancy. Each new endpoint is a new MSW handler first, then a Stage-7-style cutover.
- **New features.** For any new product surface, start with a Stage 1 wireframe for *just* that feature and walk the pipeline again — narrations carry the design intent forward; the e2e harness catches regressions in everything else.
- **Performance.** Bundle size, server response time, database indexes, caching layers, CDN strategy. Measure first; optimize the slowest thing.
- **Operational maturity.** Monitoring, error tracking, log aggregation, on-call rotation, runbooks.

The pipeline above is intentionally opinionated about *getting started fast with tests baked in from the wireframe*. Everything past that is your call.
