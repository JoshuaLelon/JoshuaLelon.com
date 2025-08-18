# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AstroPaper blog built with Astro, TailwindCSS, and TypeScript. It's a minimal, responsive, and SEO-friendly blog theme configured for static deployment on Cloudflare Pages. The project includes features like dynamic OG image generation, fuzzy search (via Pagefind), dark/light mode toggle, and RSS feed generation.

## Development Commands

**Core Development:**
- `pnpm install` - Install dependencies
- `pnpm run dev` - Start development server at localhost:4321
- `pnpm run build` - Full production build (includes Astro check, build, and Pagefind index generation)
- `pnpm run preview` - Preview production build locally
- `pnpm run preview:cf` - Preview with Wrangler Pages dev server
- `pnpm run deploy:cf` - Deploy to Cloudflare Pages via CLI

**Code Quality:**
- `pnpm run lint` - Run ESLint (configured with TypeScript and Astro rules)
- `pnpm run format:check` - Check code formatting with Prettier
- `pnpm run format` - Auto-format code with Prettier
- `pnpm run sync` - Generate TypeScript types for Astro modules

**Docker (Alternative):**
- `docker compose up -d` - Run in Docker container
- `docker build -t astropaper . && docker run -p 4321:80 astropaper` - Build and run Docker image

## Architecture Overview

**Content Management:**
- Blog posts are stored as Markdown files in `src/data/blog/`
- Content collection schema defined in `src/content.config.ts` with frontmatter validation
- Posts support features like drafts, featured posts, custom OG images, and timezone settings
- Files prefixed with `_` are ignored by the content loader

**Key Configuration:**
- `src/config.ts` - Main site configuration (SITE object with metadata, pagination, features)
- `astro.config.ts` - Astro configuration with static output, TailwindCSS, and markdown processing
- `wrangler.jsonc` - Cloudflare Pages deployment configuration for static site
- Content schema requires: `title`, `description`, `pubDatetime`, `author` (defaults to SITE.author)

**Core Utilities:**
- `src/utils/getSortedPosts.ts` - Sorts posts by publication/modification date
- `src/utils/postFilter.ts` - Filters out draft posts and future-dated posts
- `src/utils/generateOgImages.ts` - Dynamic OG image generation using Satori
- `src/utils/slugify.ts` - URL slug generation from post titles

**Component Structure:**
- Layouts: `Layout.astro` (base), `PostDetails.astro` (blog posts), `Main.astro` (content wrapper)
- Components are primarily `.astro` files with minimal TypeScript props
- Search functionality implemented via Pagefind (built during production build)

**Styling:**
- TailwindCSS v4 with typography plugin for blog content
- CSS custom properties for theme switching (light/dark mode)
- `src/styles/global.css` contains theme definitions and base styles

## Build Process Notes

The build command (`pnpm run build`) performs multiple steps:
1. `astro check` - TypeScript and Astro validation
2. `astro build` - Generate static site to `dist/`
3. `pagefind --site dist` - Build search index
4. `cp -r dist/pagefind public/` - Copy search index to public for deployment

## Content Guidelines

- Blog posts use frontmatter schema defined in `content.config.ts`
- Posts with `draft: true` are filtered out in production
- Posts with future `pubDatetime` are filtered based on `scheduledPostMargin` setting
- Edit URLs are auto-generated based on `editPost.url` config pointing to GitHub
- Support for custom timezones per post (fallback to global `SITE.timezone`)