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

Posts are Markdown files in `src/data/blog/`, loaded with Astro's built-in `glob` content loader. Each filename determines its existing `/posts/<slug>/` URL. Keep filenames stable when editing titles.

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

Write the post body after the frontmatter. Put local public images in `public/assets/` and reference them with `/assets/...`. Reading time is computed from Markdown. No Pantogen service, database, API key, or PANTOGEN_URL is needed. The existing social-image generator still downloads its fonts from Google Fonts during builds.

Six posts were restored from the original standalone repository; the revised Next.js/Amplify article was restored from Pantogen's preserved seed body.

## Deployment

Cloudflare Pages project: `joshualelon-com`. Repository root: `/`. Build command: `pnpm build`. Output: `dist`.

```sh
pnpm exec wrangler pages deploy dist --project-name=joshualelon-com --branch=main
```

Production uses this repository's `main` branch, with repository-root builds, `pnpm build`, and output `dist`. Pushes to `main` deploy through the existing Cloudflare Pages project. Set `NODE_VERSION=24` and `PNPM_VERSION=11.1.1` in Pages.

Rollback: the previous production deployment is `cc6efdfa-5c5b-4b9b-9c71-474ebdfc6a97`, built from `sites/joshualelon` in pantogen-v1 at commit `df3c8d461e8aa72915e5dcb50ae7a767eb191a54`. Keep it available in the Pages deployment history. The pre-migration standalone checkout is preserved on `archive/before-local-posts-5e43979be638`.
