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

## TL;DR

I build apps in five stages — HTML wireframe → click-through prototype → styled mockup → full frontend with mocked backend → real backend, one route at a time. **The same Playwright e2e tests run at every stage**, because they're anchored to accessible roles and labels (which survive every rewrite) and to MSW network handlers (which survive every backend swap). I don't write unit tests until the surface stops moving.

## Why bother with a process

Two things matter when you build with AI: taste (what you're building) and evals (knowing it works). Everything else is plumbing.

The plumbing problem is that if I don't bake tests in from the start, I never do. Or I do them badly. The temptation is always to "ship first, test later," and later never comes. But the opposite temptation is just as bad: kitchen-sink the testing on day one, write twenty unit tests against scaffolding I'll throw away next week, and burn out before I've validated anything real.

I want a process where the tests grow with the product. Coarse at the start, granular when the shape stabilizes. Cheap enough at every stage that I don't have an excuse to skip them.

## The insight

Most testing advice falls apart in practice because **the artifact changes too fast for the tests to keep up**. You write an integration test against `signInWithEmail()`, you refactor the auth module, the test is now a paperweight.

But two things turn out to be remarkably stable across the entire lifecycle of a feature:

1. **What the user sees and clicks.** "The button named *Submit*." "The input labelled *Email*." "The heading *Welcome back*." These don't change when you swap React for Svelte, or HTML for a real framework. They only change when the *product* changes — and if the product changes, the test *should* fail.
2. **The shape of the data crossing the network.** `POST /notes` takes `{title, content}` and returns `{id, title, content, createdAt}`. That contract is the same whether the backend is a `<script>` tag mocking it locally, an MSW handler, or a real Postgres-backed endpoint.

If you anchor every test to those two things — accessible roles + network shapes — your tests survive every implementation rewrite underneath them. That's the whole game.

## The pipeline

### Stage 0: HTML wireframe

A folder of static `.html` files, one per screen, linked with `<a href>`s. No JS. No framework. No tests yet.

This is the cheapest possible artifact for arguing about the *flow*. AI is excellent at this — prompt it to give you five linked screens with the right form fields and you're done in two minutes. The point of this stage is to click through and feel whether the flow is right. Static HTML beats Figma here because you can actually navigate it. (Credit to Thariq's [HTML effectiveness](https://thariqs.github.io/html-effectiveness/) post for the framing.)

If the flow is wrong, you'd rather discover it now than after you've wired up state management.

### Stage 1: First e2e test

Once a flow feels right, I write *one* Playwright test per flow. It walks every screen using only role/label locators:

```ts
await page.getByLabel('Title').fill('My note')
await page.getByLabel('Content').fill('Hello world')
await page.getByRole('button', { name: 'Submit' }).click()
await expect(page.getByRole('heading', { name: 'My note' })).toBeVisible()
```

It fails, because the HTML is static. I add the minimum JS — an inline `<script>` that handles the form submit and renders the next screen with the typed value. The test passes.

This is the moment testing enters my loop, and it enters cheap. The test is maybe twenty lines. It's the load-bearing contract for this flow for the rest of the project's life.

### Stage 2: Mockup

Real styling, real component library, real client-side state. The inline `<script>` becomes proper code. The network is mocked with [MSW](https://mswjs.io). Default handlers live in `tests/handlers.ts` — that file is now my materialized backend backlog.

The Stage 1 test still passes, because the roles and labels didn't change. I add a second wave of e2e tests: empty states, error paths, the autosuggest dropdown populating, the toast on save. Each test is short, each is still end-to-end, each survives the next stage.

### Stage 3: Full prototype, mocked backend

Real framework (I've been using React Router). Real routing, real client state. The network is still MSW. In dev, the app itself runs against the mock handlers — this means the prototype is *demoable* to users before any backend exists.

Tests don't change.

### Stage 4: Backend slices

This is where the whole approach pays off. To land a real backend endpoint, I:

1. Implement the route (Prisma, whatever).
2. **Delete its handler from `tests/handlers.ts`.**
3. Re-run the e2e suite.

That's it. The handler removal is the cutover. The tests pass for the same reason they always did — the contract didn't change, just the implementation behind it. Backend lands one route at a time, and each landing is a one-line deletion from a file.

### Stage 5: Sink toward integration and unit

Only now do I write the cheaper, more granular tests — and only for the bits of the e2e that are too expensive to iterate on. The signal is usually "we keep regressing the same subtle edge case and the e2e is too coarse to point at it." Date parsing, permission branches, reducer transitions.

The e2e tests remain the load-bearing contract. The unit tests are scaffolding around the parts of it that need finer-grained pressure.

## Habits that keep me honest

- **No new flow merges without a Stage-1 e2e**, even when the screens are still HTML. The first test is the hard one to write. Once it exists, AI extends it mechanically.
- **`tests/handlers.ts` is version-controlled from Stage 2 onward.** It's the inventory of "what does the backend owe the frontend." When I do Stage 4, I'm literally deleting from this file. It's a checklist that maintains itself.
- **No unit tests before Stage 5.** They encode an implementation that's still moving. Every refactor breaks them and I stop trusting them. Skip until the shape is stable.
- **AI is best at Stages 0–2. I'm best at Stage 4.** Let it generate the wireframes and the first happy-path e2e — it's good at this; the locators are obvious from the markup. I write the route handlers and the persona/fixture setup, because that's where domain decisions live and where the trade-offs aren't legible without context.

## The thing I want you to take from this

The way tests typically get bolted on after the fact is downstream of one root cause: **most tests are coupled to implementation details that change.** If you decouple them — anchor everything to the two things that don't change (accessibility surface + network contracts) — the tests get cheap enough that there's no excuse to defer them. They become the spine of the build process, not a tax you pay at the end.

Start coarse. Stay coarse until the product stops moving. Then, and only then, sink lower.
