# Joshua Lelon's website

Standalone Astro site for https://joshualelon.com, hosted on Cloudflare Pages.

## Development

Use Node.js 24 (see `.nvmrc`) and pnpm 11.1.1, pinned in package.json.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm build
```

## Posts

Posts are Markdown (`.md`) or MDX (`.mdx`) files in `src/data/blog/`, loaded with Astro's built-in `glob` content loader. Each filename determines its existing `/posts/<slug>/` URL. Keep filenames stable when editing titles.

```yaml
---
title: "Post title"
author: "Joshua Lelon"
pubDatetime: 2026-11-15T12:00:00Z
description: "A short description."
tags:
  - software
draft: false
featured: false
---
```

Write the post body after the frontmatter. Put local public images in `public/assets/` and reference them with `/assets/...`. Reading time is computed from Markdown. No Pantogen service, database, API key, or PANTOGEN_URL is needed. Google Sans Code is downloaded and cached by Astro during builds, then served locally with the site. The same font assets feed Satori and Sharp to generate `/og.png` and each post’s `/posts/<slug>/index.png`; builds need Google Fonts access on a cold cache.

MDX supports imported Astro components and JavaScript expressions. Markdown and MDX both support callouts:

```md
> [!NOTE]
> A useful note.

> [!TIP]- Expand for details
> A collapsible tip.
```

Six posts were restored from the original standalone repository; the revised Next.js/Amplify article was restored from Pantogen's preserved seed body.

## Deployment

Cloudflare Pages project: `joshualelon-com`. Repository root: `/`. Build command: `pnpm build`. Output: `dist`.

```sh
pnpm exec wrangler pages deploy dist --project-name=joshualelon-com --branch=main
```

Production uses this repository's `main` branch, with repository-root builds, `pnpm build`, and output `dist`. Pushes to `main` deploy through the existing Cloudflare Pages project. Set `NODE_VERSION=24` and `PNPM_VERSION=11.1.1` in Pages.

Rollback: the previous production deployment is `cc6efdfa-5c5b-4b9b-9c71-474ebdfc6a97`, built from `sites/joshualelon` in pantogen-v1 at commit `df3c8d461e8aa72915e5dcb50ae7a767eb191a54`. Keep it available in the Pages deployment history. The pre-migration standalone checkout is preserved on `archive/before-local-posts-5e43979be638`.

## Upstream template

The original site was based on [AstroPaper v5.5.0](https://github.com/satnaing/astro-paper/tree/v5.5.0). The [v7.0.0](https://github.com/satnaing/astro-paper/tree/v7.0.0) integration is complete: typed configuration, locale/base-path helpers, theme handling, accessible image zoom, skip-link focus, table alignment, corrected adjacent-post navigation, MDX, callouts, Google Sans Code typography, and the Satori/Sharp social-image pipeline.

Edit site identity, social links, pagination, and feature flags in `astro-paper.config.ts`. Posts remain in `src/data/blog/`, with stable filename-derived URLs. About and Friends content now live in `src/content/pages/`. Custom reading times, section navigation, and collapsible prompt copy controls are preserved.

Dependencies follow the v7.0.0 version ranges, with compatible releases pinned in `pnpm-lock.yaml` (Astro 7.4.12, MDX 7.0.8, Satori 0.33.5, Sharp 0.35.5, and Pagefind 1.6.0). The lockfile consolidates `@types/hast` to keep Astro and callouts compatible. TypeScript configuration drops the deprecated `baseUrl` and unused React JSX settings. The old IBM Plex Mono downloader and Resvg pipeline have been removed. Existing tag slug rules, Cloudflare scripts/configuration, Node 24, and the pnpm 11.1.1 pin are retained.

Validation on Node 24: frozen-lockfile installation, lint, and the full `pnpm build` pass. The build renders 39 pages, generates seven 1200×630 social PNGs, and indexes all six posts with Pagefind. An isolated fixture build verifies Markdown/MDX callouts, imported Astro components, and MDX expressions. Browser checks cover desktop/mobile navigation, pagination, search, theme persistence, reading times, adjacent posts, section controls, horizontally scrolling tables, all 16 collapsed prompt copy buttons, skip-link focus, and keyboard image zoom. All local page, image, and fragment links resolve; the missing Narrations anchor was restored without changing article text.

## Prototypes

`/prototypes/` is an annotated experiment index, separate from posts. Two entries marked `sample: true` exercise the layout and interactions. The index renders each entry’s title, description, tags, and native demo, matching its individual page. Set `draft: true` or remove their MDX files to hide them. The old blog wireframes are not used here.

Copy `src/data/prototypes/_template.mdx` to a stable filename such as `scrubbable-timeline.mdx`. Underscore-prefixed files are excluded; drafts do not generate pages or appear in the index. Set `draft: false` when ready. Entries are sorted by `order` (lowest first), then title. The filename determines `/prototypes/<slug>/`.

Required frontmatter: `title`, `description`, `question`. Optional: `tags`, `order`, `draft`, `sample`, `preview` (image URL/path), `previewAlt`, `sourceUrl`, `relatedPost` (post URL/path). Store preview assets in `public/assets/prototypes/`; previews are optional so a missing image never creates a broken tile. Descriptions and notes are indexed by site search; demo contents are excluded.

Import a native Astro demo component directly in the entry’s MDX. The examples live in `src/components/prototypes/`: `MotionDemo.astro` and `DisclosureDemo.astro` provide scoped markup and styles, `Walkthrough.astro` provides previous/next navigation, and the typed step definitions drive the shared `walkthrough.ts` controller. To add another demo, add its component and step factory, then register its kind in `Walkthrough.astro`.

Prototype pages show a breadcrumb, title, description, tags, and the component. Only the current step’s explanation is displayed. Next is disabled until the action finishes; previous restores the preceding state. Demo components inherit the page theme through CSS, respect reduced motion, and clean up animation frames and listeners when removed. Astro/Vite watches their source files during development, including imported step definitions. No standalone demo pages or iframe synchronization are needed.

Tags are shared across posts and prototypes. A matching tag on either collection links to `/tags/<slug>/`; tag pages label each result and paginate the combined list. Posts retain date order, followed by prototypes in curated order. Drafts are excluded, and scheduled posts follow the existing publication rules. Multiword and differently cased tags use the same normalized URL.
