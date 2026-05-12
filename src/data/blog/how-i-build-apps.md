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

I build apps in six stages:

| Stage | Summary | Tech introduced | Tests added |
|---|---|---|---|
| **1. HTML wireframe** | **Adds navigation**: static `.html` files linked with `<a>`s | HTML (Wireframe HTML subset) | Structural lint |
| **2. Click-through prototype** | **Adds state**: minimum vanilla JS makes typed input observable on the next screen | inline `<script>` JS, Playwright. | One Playwright e2e per flow (role/label locators) |
| **3. Styled mockup** | **Adds network/style**: real styling, real client state, MSW-mocked network; client-only behaviors[\*](#narration-as-first-class-scaffolding) get implemented | Styling system, state library, MSW. | Edge cases the styled UI now affords: empty states, error paths, autosuggest, toasts, etc |
| **4. Full prototype with mocked backend** | **Adds routing**: framework enters; app runs against MSW handlers in dev — demoable to users without a backend | A routing framework of your choice. | Tests for the framework-dependent behaviors implemented this stage. |
| **5. Real backend, one route at a time** | **Adds backend**: implement a route, delete its MSW handler, re-run the suite — frontend untouched | A backend stack of your choice. | None new — the existing e2e tests now hit real endpoints. |
| **6. Sink toward integration and unit** | **Adds granularity**: targeted unit tests for recurring regressions the e2e is too coarse to point at | A unit-testing framework of your choice. | Targeted unit tests, one per recurring regression. |

**The same Playwright e2e tests run at every stage**, because they're anchored to accessible roles and labels (which survive every rewrite) and to MSW network handlers (which survive every backend swap).

**Only two opinionated tool choices** are baked into this pipeline: Playwright (from Stage 2) and MSW (from Stage 3). Everything else — styling system, state library, framework, backend stack, database, auth provider — is your call, introduced at the stage that makes sense. Each stage below has a click-to-copy prompt with explicit constraints so your AI agent can't drift outside that stage's scope.

## Contents

- [Why bother with a process](#why-bother-with-a-process)
- [The insight](#the-insight)
- [Two opinionated tools, everything else your choice](#two-opinionated-tools-everything-else-your-choice)
- [Narration as first-class scaffolding](#narration-as-first-class-scaffolding)
- [The pipeline](#the-pipeline)
  - [Stage 1: HTML wireframe](#stage-1-html-wireframe)
  - [Stage 2: Click-through prototype](#stage-2-click-through-prototype)
  - [Stage 3: Styled mockup](#stage-3-styled-mockup)
  - [Stage 4: Full prototype with mocked backend](#stage-4-full-prototype-with-mocked-backend)
  - [Stage 5: Backend slices](#stage-5-backend-slices)
  - [Stage 6: Sink toward integration and unit](#stage-6-sink-toward-integration-and-unit)
- [Habits that keep me honest](#habits-that-keep-me-honest)
- [The thing I want you to take from this](#the-thing-i-want-you-to-take-from-this)

## Why bother with a process

Two things matter when you build with AI: taste (what you're building) and evals (knowing it works). Everything else is plumbing.

The temptation is always to "ship first, test later," and later never comes. But the opposite temptation is just as bad: kitchen-sink the testing on day one, write twenty unit tests against scaffolding I'll throw away next week, and burn out before I've validated anything real.

I wanted a process where the tests grow with the product. Coarse at the start, granular when the shape stabilizes. Cheap enough at every stage that I don't have an excuse to skip them.

## The insight

Most testing advice falls apart in practice because **tests break for the wrong reasons**. You write an integration test against `signInWithEmail()`, you refactor the auth module, the test is now a paperweight — even though the product behavior didn't change at all. That's the failure mode: the test was coupled to an implementation detail, not to anything a user or a caller would notice.

The fix isn't to find things that never change. It's to anchor tests to the things that change *only when product behavior changes*. Two qualify:

1. **What the user sees and clicks.** "The button named *Submit*." "The input labelled *Email*." "The heading *Welcome back*." The URL in the address bar counts too — it's something the user perceives and shares. When these change, the product changed: somebody renamed a button, removed a field, reworded a flow, restructured the routes. The test *should* fail; that's the whole point of having it. When you swap React for Svelte, or rewrite the HTML, these don't move, so the test doesn't either.
2. **The I/O at the system boundary.** `POST /notes` takes `{title, content}` and returns `{id, title, content, createdAt}`. The outbound `POST https://hooks.slack.com/...` carries `{channel, text}`. The boundary isn't "frontend ↔ backend" — it's "code I own ↔ code I don't." When any of those contracts change, somebody altered what the system does and the test *should* fail. When the implementation behind them changes — `<script>` tag, MSW handler, real Postgres — the contracts hold and the test rides along.

That's the whole game: tests fail when the product changes and stay quiet when it doesn't. Coupling them to roles, URLs, and boundary I/O is what buys you that property.

## Two opinionated tools, everything else your choice

This pipeline is technology-agnostic by design. The frontend world has too many good options for me to evangelize one, and I want this approach to work whether you reach for React, Svelte, Vue, htmx, or plain HTML modules. So only two tool choices are baked in, and they're the two that make the rest portable:

- **Playwright** (Stage 2+) — because the role/label locator API is what lets the same test survive from a static `.html` file all the way to a production framework. Other e2e tools have similar APIs; the principle works with any of them.
- **MSW** (Stage 3+) — because intercepting at the network layer (not at a function call) is what lets the same handlers serve as the mock backend in tests, in dev, and as the migration checklist when the real backend lands.

Everything else — styling system, state library, routing framework, backend stack, database, ORM, auth provider, deployment target — is your call. Each stage below explicitly lists what tech enters at that stage and what's still off-limits, so you can't accidentally pull a future-stage dependency into an earlier one.

## Narration as first-class scaffolding

At Stage 1 you can't express animation, async state, real-time updates, drag interactions, or anything time-dependent in pure static HTML. Rather than skip those parts of the flow or fake-stub them with broken UI, I render them as **narration blocks**:

```html
<aside class="narration">
  When the user clicks Submit, the note slides up off the screen with a
  200ms ease-out, then a green toast fades in from the bottom reading
  "Note saved" and disappears after 3 seconds.
</aside>
```

A narration is a placeholder *and* a specification, in one element. It marks where future behavior lives, and it describes that behavior precisely enough that the eventual test almost writes itself. As each stage adds capability, narrations within reach of that capability get **replaced by implementation plus a test that asserts the narration's described behavior**. Narrations describing things still out of reach stay in place.

Narrations sort into three buckets, each handled by a different stage:

- **Client-only narrations** — behaviors achievable with HTML/CSS/JS plus a mocked network: modals, toasts, dropdowns, autosuggest, animations, form-validation feedback, empty and error states, inline editing, client-side sorting and filtering. **Stage 3** picks these off.
- **Framework-dependent narrations** — behaviors that need a routing framework: route transitions, loading states tied to navigation, redirects after form submission, auth-gated routes, server-rendered initial state. **Stage 4** picks these off.
- **Backend-dependent narrations** — behaviors that need a real server: persistence across page reloads, real auth sessions, real-time server events, anything where the server's actual response shapes behavior (rate limits, conflict resolution, etc.). **Stage 5** picks these off, one route at a time.

By the end of Stage 5, every narration has been replaced. The count of remaining narrations is a visible progress indicator.

One rule: **narrations are version-controlled like code**, not comments to be deleted casually. They're the spec. Don't delete one without replacing it with implementation and a test.

## The pipeline

### Stage 1: HTML wireframe

A folder of static `.html` files, one per screen, linked with `<a href>`s. The cheapest possible artifact for arguing about the *flow*. Static HTML beats Figma here because you can actually navigate it — you click through and feel whether the flow is right. (Credit to Thariq's [HTML effectiveness](https://thariqs.github.io/html-effectiveness/) post for the framing.) If the flow is wrong, you'd rather discover it now than after you've wired up state management.

**Navigable but not stateful.** Links work, forms render, native disclosures and dialogs open — but when a user types into an input and clicks Submit, the typed value goes nowhere. A `<form>` with no `action` reloads the page; with `action="next.html"` it navigates, but the next page has no way to display what was typed (reading URL params needs JS). This is intentional: it lets you argue about the *flow* without anyone faking the *data flow* of later stages. The only meaningful assertions at this stage are structural — which is what the lint covers.

- **Tech introduced:** HTML (the Wireframe HTML subset, defined below) for the artifact itself; Node + an HTML parser for the structural lint.
- **Off-limits during Build:** CSS, JavaScript, any framework, component libraries, build steps, package managers, any HTML element outside the subset.
- **Narrations:** every behavior that can't be expressed in Wireframe HTML — animations, transitions, async loads, real-time updates, drag-and-drop, time-based events, media playback, custom inputs — lives in an `<aside class="narration">` block at the point in the flow where it would occur.

#### Wireframe HTML

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

Notable omissions and where they go instead: `<img>`, `<canvas>`, `<video>`, `<audio>`, `<input type="range|color|file">`, anything requiring `<script>` → narrations. (For images: anything that needs real visual fidelity — logos, photos, screenshots — is a placeholder you don't have assets for yet, so describe what it's meant to convey. Anything simple enough to express as shapes belongs in inline `<svg>` instead.) Presentational tags (`<b>`, `<i>`, `<small>`, `<br>`, `<hr>`) → wait for Stage 3 styling.

#### Build

Generate the wireframe artifact: one `.html` file per screen, linked with `<a href>`s, using only the Wireframe HTML subset above.

```
You are helping me wireframe a web app: [DESCRIBE THE APP IN 1-2 SENTENCES].

Flows to cover: [LIST FLOWS, e.g. "sign up, create a note, share a note, delete account"].

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

#### Add tests

Write a structural lint that asserts the wireframe is well-formed. Pure static analysis — no browser, no Playwright, no server. These checks survive every later stage unchanged because they assert *positive* invariants (every input has a label, every SVG has a title) rather than per-stage prohibitions.

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

### Stage 2: Click-through prototype

Once a flow feels right, the wireframe gets the minimum vanilla JavaScript that makes it *behaviorally testable*: inline `<script>` blocks that intercept form submits and render the next screen with typed values carried forward. That single capability — **user input becomes observable to the next screen** — is what unlocks the first real Playwright assertion. A test can now type into *Title*, click Submit, and verify the typed value appears as a heading on the next page:

```ts
await page.getByLabel('Title').fill('My note')
await page.getByLabel('Content').fill('Hello world')
await page.getByRole('button', { name: 'Submit' }).click()
await expect(page.getByRole('heading', { name: 'My note' })).toBeVisible()
```

Without that JS, the only thing a test could check is link navigation — which the Stage 1 lint already proves statically. The JS is what gives Stage 2's tests something *new* to assert. Each test is maybe twenty lines and becomes the load-bearing contract for its flow for the rest of the project's life.

- **Tech introduced:** Vanilla JavaScript (inline `<script>` only) at Build; Playwright at Add tests.
- **Off-limits during Build:** CSS, any framework, component libraries, bundlers, state libraries, npm dependencies in the app itself (Playwright is dev-only).
- **Narrations:** untouched. Leave them in place — they describe behavior beyond the reach of this stage.

#### Build

Add the minimum vanilla JS so the static wireframe behaves like a click-through prototype: form submits transition to the next screen with typed values carried forward.

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

#### Add tests

Write the first Playwright e2e per flow. Locators are role/label only — no CSS selectors, no test IDs, no XPath. Each test walks the flow from entry to completion and asserts the user-facing outcome.

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

### Stage 3: Styled mockup

Real styling, real client-side state, real component patterns. The inline `<script>` becomes proper code. The network is mocked with [MSW](https://mswjs.io). Default handlers live in `tests/handlers.ts` — that file is now my materialized backend backlog. The Stage 2 tests still pass, because the roles and labels didn't change.

- **Tech introduced:** a styling approach of your choice (Tailwind, CSS modules, vanilla CSS, whatever), a state-management approach of your choice (vanilla store, Zustand, signals, whatever), MSW.
- **Off-limits:** routing framework, real backend, database, auth provider, server-side rendering.
- **Narrations:** in this stage's Build, replace any narration whose behavior is implementable in client-only code (animations, dropdowns, modals, toasts, autosuggest UI). The matching tests land in Add tests. Leave narrations that require routing or a backend.

#### Build

Upgrade the click-through prototype to a styled mockup with client state and an MSW-mocked network. Replace the in-reach narrations with real implementations — the tests come in the next sub-stage.

```
You are upgrading a click-through HTML prototype into a styled mockup.

You may introduce, of my choice:
- A CSS / component-library approach: [FILL IN, e.g. "Tailwind + shadcn/ui", "Open Props + vanilla CSS modules", "Pico.css"].
- A client-state approach: [FILL IN, e.g. "vanilla JS with a small store class", "Zustand", "Nano Stores", "Solid signals"].
- MSW for mocking all network calls. Default handlers go in tests/handlers.ts and are loaded by both the dev server and the Playwright test setup.

Still OFF-LIMITS — strict:
- No routing framework (Next.js, React Router, SvelteKit, Astro, Remix, etc.).
- No real backend, no real database, no auth provider.
- No server-side rendering.

For every <aside class="narration"> block:
- If the narrated behavior is implementable with client-only code (animations, transitions, dropdowns, modals, toasts, autosuggest UI, form validation feedback, drag-and-drop within a page), REPLACE the narration with the real implementation. Do NOT write tests for it in this sub-stage — that comes next.
- If the narration describes behavior requiring routing or a backend, LEAVE IT IN PLACE unchanged.

Output:
- The styled app.
- An updated tests/handlers.ts with MSW handlers for every network call the app makes.
- A list of <aside class="narration"> blocks that were replaced this stage, with the verbatim text of what each described. This list drives the next sub-stage's tests.
- A list of remaining <aside class="narration"> blocks.
```

#### Add tests

Write one Playwright e2e per narration replaced in Build, asserting the described behavior. Then run the full previous suite; previous tests should pass unchanged.

```
You are writing Playwright e2e tests for behaviors that were just implemented from narrations in the styled mockup.

You will receive a list of <aside class="narration"> blocks that were replaced with implementation, including the verbatim text of each one. For each one:
- Write a Playwright e2e test at tests/e2e/[descriptive-name].test.ts that asserts the narration's described behavior.
- Use ONLY page.getByRole() and page.getByLabel() locators. No CSS selectors, no test IDs.
- If the behavior involves a network call, use the test-scoped network override (e.g. network.use(http.get(...))) to set up the specific scenario the test needs (empty list, error response, populated suggestions).

Before this sub-stage is done, run the full test suite from all previous stages (structural lint + Stage 2 e2e tests). The expectation is that they pass unchanged. If a previous test fails:
1. First check: did this stage's new code change an accessible name, a heading, a label, an MSW handler shape, or a URL? Fix the new code so the previous test passes again. Do NOT change the test.
2. If the failure reflects a deliberate product change (a button renamed on purpose, a flow restructured), update the test in its own commit with a message that names the product change.
3. Do NOT silently disable, skip, weaken, or comment out a previous test.

Output:
- One new test file per replaced narration, under tests/e2e/.
- Test run output showing: structural lint passing, Stage 2 e2e tests passing, all new tests passing.
```

### Stage 4: Full prototype with mocked backend

A routing framework enters. The network is still MSW. In dev, the app itself runs against the mock handlers — this means the prototype is *demoable* to real users before any backend exists. Existing tests don't change.

- **Tech introduced:** a routing framework of your choice (Next.js, React Router, SvelteKit, Astro, Remix, TanStack Router — pick one).
- **Off-limits:** real backend, real database, auth provider. `tests/handlers.ts` is still the entire network layer.
- **Narrations:** in Build, replace any narration whose behavior depends on framework features (loading states, route transitions, redirects, suspense boundaries, error boundaries, auth-gated routes, server-rendered initial state). Tests for them land in Add tests. Backend-dependent narrations stay.

#### Build

Migrate the styled mockup onto a routing framework of your choice. Replace framework-dependent narrations with real implementations — tests come in the next sub-stage. The MSW handler layer remains intact.

```
You are migrating a styled, client-only mockup to a real routing framework.

Framework — my choice: [FILL IN, e.g. "Next.js App Router", "React Router v7 framework mode", "SvelteKit", "Astro with islands", "TanStack Router"].

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

#### Add tests

Write one Playwright e2e per framework-dependent narration replaced in Build. Run the full previous suite; everything from Stages 1–3 should pass unchanged.

```
You are writing Playwright e2e tests for framework-mediated behaviors that were just implemented from narrations.

You will receive a list of <aside class="narration"> blocks that were replaced with implementation, including the verbatim text of each. For each one:
- Write a Playwright e2e test at tests/e2e/[descriptive-name].test.ts that asserts the narration's described behavior end-to-end through the framework's routing.
- Use ONLY page.getByRole() and page.getByLabel() locators. Where a route's URL is part of what the user perceives (shareable URLs, redirect targets), assert on it; otherwise prefer role/label assertions.
- For redirects and loading states, rely on Playwright's auto-waiting via expect(locator).toBeVisible() / .toHaveURL() rather than manual waitForTimeout calls.

Before this sub-stage is done, run the full test suite from all previous stages (structural lint + Stage 2 e2e + Stage 3 e2e). The expectation is that they pass unchanged. If a previous test fails:
1. First check: did this stage's new code change an accessible name, a heading, a label, an MSW handler shape, or a URL? Fix the new code so the previous test passes again. Do NOT change the test.
2. If the failure reflects a deliberate product change, update the test in its own commit with a message that names the change.
3. Do NOT silently disable, skip, weaken, or comment out a previous test.

Output:
- One new test file per replaced narration, under tests/e2e/.
- Test run output showing: structural lint passing, Stage 2 + Stage 3 tests passing, all new tests passing.
```

### Stage 5: Backend slices

This is where the whole approach pays off. To land a real backend endpoint, I implement the route, **delete its handler from `tests/handlers.ts`**, and re-run the e2e suite. The handler removal is the cutover. The tests pass for the same reason they always did — the contract didn't change, just the implementation behind it. Backend lands one route at a time, and each landing is a one-line deletion from a file. Any backend-dependent narration still in the frontend is implemented alongside its corresponding route in this same iteration.

- **Tech introduced:** a backend stack of your choice (runtime, web framework, database, ORM/query layer, auth provider — as needed).
- **Off-limits:** changing the network contract without flagging it. If the real backend would naturally have a different request/response shape than the existing MSW handler, stop and reconcile the contract first.
- **Narrations:** any narration tied to this iteration's endpoint is implemented in Build; its test lands in Add tests. By the end of Stage 5, the narration count is zero.

#### Build

Implement one real route, delete its handler, and (if any narration is tied to it) implement the corresponding UI. Tests come in the next sub-stage.

```
You are replacing ONE MSW handler with a real backend route. This is a one-at-a-time operation.

Backend stack — my choice: [FILL IN, e.g. "Node + Hono + Drizzle + SQLite", "Bun + Elysia + Postgres", "Python + FastAPI + SQLAlchemy + Postgres", "Go + chi + sqlc + Postgres"].

Handler to replace: [HANDLER NAME OR PATH, e.g. "POST /api/notes"].

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

#### Add tests

Write Playwright e2e for any narration that landed with this iteration (often zero). Run the full previous suite — the deleted handler means existing tests are now hitting the real endpoint, and they must still pass.

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
- Test run output showing: structural lint passing, all Stage 2–4 tests passing against the new mix of real backend + remaining MSW.
```

### Stage 6: Sink toward integration and unit

Only now do I write the cheaper, more granular tests — and only for the bits of the e2e that are too expensive to iterate on. The signal is usually "we keep regressing the same subtle edge case and the e2e is too coarse to point at it." Date parsing, permission branches, reducer transitions, currency rounding. The e2e tests remain the load-bearing contract. Unit tests are scaffolding around the parts of it that need finer-grained pressure.

- **Tech introduced:** a unit-testing framework of your choice (vitest, jest, `node:test`, bun's test runner — pick one).
- **Off-limits:** writing unit tests speculatively or for coverage. Only write one in response to a specific, recurring regression the e2e can't pinpoint quickly.
- **Narrations:** none remain. If you find one, you skipped a step earlier — go back.

This stage has no Build sub-stage — it's responding to an existing regression in code that already exists, not introducing new behavior.

#### Add tests

```
You are writing the minimum unit test to pinpoint a specific recurring regression.

The recurring failure: [DESCRIBE THE BEHAVIOR THAT KEEPS BREAKING].
The e2e test that catches it: [PATH TO TEST FILE OR TEST NAME].
The code I believe is responsible: [SPECIFIC FUNCTION / MODULE / FILE].

Unit-test framework — my choice: [FILL IN, e.g. "vitest", "jest", "node:test", "bun:test"].

Constraints — strict:
- Write a unit test for ONE function or behavior — the specific one responsible for the regression.
- Do NOT write unit tests for adjacent code, "while you're in there" coverage, or anything not directly tied to the recurring failure.
- The existing e2e test stays in place. The unit test exists in addition to it, to pinpoint the failure faster, not to replace the e2e.
- The unit test must currently FAIL in a way that mirrors the regression — write the test first, watch it fail, then fix the code.

Before this sub-stage is done, run the full test suite from all previous stages. After the fix, every test must pass — the new unit test, the previously-flaky e2e, the structural lint, and every other Stage 2–4 test. Do NOT silently disable, skip, weaken, or comment out any existing test.

Output:
- One unit test file containing the failing test.
- A short note explaining why a unit test is needed here (i.e. why the e2e alone isn't a tight enough feedback loop).
- The fix to the underlying code.
- Test run output showing the new unit test passing AND every previous test passing.
```

## Habits that keep me honest

- **Run the previous suite at every "Add tests" sub-stage.** Each test-adding prompt requires running the full test suite from earlier stages before the sub-stage is done. This is a property the pipeline aims for, not a guarantee — and "run the previous suite, treat failures as diagnostic, prefer fixing new code over changing old tests" is the discipline that turns it from a hope into a habit.
- **No new flow merges without a Stage-1 e2e**, even when the screens are still HTML. The first test is the hard one to write. Once it exists, AI extends it mechanically.
- **`tests/handlers.ts` is version-controlled from Stage 3 onward.** It's the inventory of "what does the backend owe the frontend." When I do Stage 5, I'm literally deleting from this file. It's a checklist that maintains itself. Handlers for third-party services I don't own — Slack, Stripe, SendGrid — never get deleted; they mark the permanent system boundary, not the migration backlog.
- **Narrations are version-controlled, not comments.** Each `<aside class="narration">` is a spec waiting to be tested. I don't delete one without replacing it with implementation *and* a test that asserts what it described. The narration count goes down monotonically; I can see progress at a glance.
- **One stage at a time, one prompt at a time.** I don't paste the Stage 4 prompt while the Stage 3 work is still landing. The constraints in each prompt are there to keep the agent from pulling in future-stage dependencies that haven't earned their place yet.
- **No unit tests before Stage 6.** They encode an implementation that's still moving. Every refactor breaks them and I stop trusting them. Skip until the shape is stable.
- **AI is best at Stages 1–3. I'm best at Stage 5.** Let it generate the wireframes and the first happy-path e2e — it's good at this; the locators are obvious from the markup. I write the route handlers and the persona/fixture setup, because that's where domain decisions live and where the trade-offs aren't legible without context.

## The thing I want you to take from this

The way tests typically get bolted on after the fact is downstream of one root cause: **most tests are coupled to implementation details that change.** If you decouple them — anchor everything to the two things that don't change (accessibility surface + network contracts) — the tests get cheap enough that there's no excuse to defer them. They become the spine of the build process, not a tax you pay at the end.

Start coarse. Stay coarse until the product stops moving. Then, and only then, sink lower.
