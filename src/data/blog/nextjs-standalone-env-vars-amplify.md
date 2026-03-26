---
title: "Next.js Standalone Mode Swallows Your .env.production on AWS Amplify"
pubDatetime: 2026-03-26T20:00:00Z
description: "When deploying Next.js with output: 'standalone' on AWS Amplify, server-side environment variables from .env.production aren't available at runtime — even though the AWS docs say they should be."
tags:
  - "nextjs"
  - "aws-amplify"
  - "environment-variables"
  - "devops"
draft: false
featured: false
---

## TL;DR

With `output: "standalone"` in Next.js on AWS Amplify, `.env.production` at the project root is **not included** in the deployment artifacts (`baseDirectory: .next`), so non-`NEXT_PUBLIC_` env vars are unavailable at runtime. The only fix that works is the `env` block in `next.config.js`, which inlines values at build time via DefinePlugin. It exposes values to both client and server compilation, but they only appear in bundles that reference them — so server-only API route secrets stay server-side in practice.

## Environment

- Next.js 16.1.6 (`output: "standalone"`)
- Inngest 4.0.5
- AWS Amplify Hosting (SSR via Lambda compute)
- Node.js 22

## The Problem

Inngest requires a signing key to verify webhook requests. After deploying to staging on AWS Amplify, syncing Inngest at `/api/inngest` failed with:

```
Signature verification failed. Is your app using the correct signing key?
```

The signing key was stored in AWS Secrets Manager and written to `.env.production` during the build — the [standard approach recommended by AWS](https://docs.aws.amazon.com/amplify/latest/userguide/ssr-environment-variables.html).

## The Investigation

### Round 1: Is the signing key in the build environment?

**I noticed:** The error said "signing key" — maybe the key wasn't reaching the app at all.

**I suspected:** The key might not be in Secrets Manager or the build script wasn't fetching it.

**I tested it:** Checked Secrets Manager directly:

```bash
aws secretsmanager get-secret-value \
  --secret-id alphawords/staging/timeback-sso \
  --query SecretString --output text | \
  python3 -c "import json,sys; d=json.load(sys.stdin); \
  [print(f'{k}={v}') for k,v in d.items() if 'INNGEST' in k.upper()]"
```

**What happened:** Both `INNGEST_SIGNING_KEY` and `INNGEST_EVENT_KEY` were present and correct.

**Takeaway:** The key existed in Secrets Manager. The build script was already writing it to `.env.production`. The problem was downstream.

### Round 2: Use the `env` block in next.config.js

**I noticed:** Other env vars like `COGNITO_OAUTH_CLIENT_ID` worked fine, and they were listed in the `env` block in `next.config.js`.

**I suspected:** The `env` block inlines values at build time — maybe adding the Inngest keys there would fix it.

**I tested it:** Added the keys to `next.config.js`:

```js
env: {
  // ...existing vars...
  INNGEST_SIGNING_KEY: process.env.INNGEST_SIGNING_KEY,
  INNGEST_EVENT_KEY: process.env.INNGEST_EVENT_KEY,
},
```

**What happened:** Deployed, and it worked — Inngest could sync successfully. But then an automated code review (Bugbot) flagged it:

> **Medium Severity: Secret signing key exposed via client-accessible env config**
>
> The `env` block in `next.config.js` makes values available for replacement in both server and client bundles via webpack's DefinePlugin. `INNGEST_SIGNING_KEY` is a cryptographic secret used for signature verification. If any client-side code ever references `process.env.INNGEST_SIGNING_KEY`, the actual secret value would be inlined into the browser bundle.

**Takeaway:** The `env` block works but uses DefinePlugin, which replaces `process.env.X` in **all** bundles — both client and server. For non-secret config this is fine. For cryptographic signing keys, it's a leak waiting to happen.

### Round 3: Copy .env.production into standalone output

**I noticed:** The `env` block was the wrong tool. Non-`NEXT_PUBLIC_` vars should be server-only by default in Next.js — just read from `process.env` at runtime.

**I suspected:** The `.env.production` file existed at build time, but maybe it wasn't making it to the runtime environment. The standalone server calls `loadEnvConfig(dir)` at startup — maybe the file wasn't at the right path.

**I tested it:** Added a post-build step to copy `.env.production` into `.next/standalone/`:

```bash
# In the build script, after `next build`:
if [ -f .env.production ] && [ -d .next/standalone ]; then
  cp .env.production .next/standalone/.env.production
  echo "Copied .env.production into standalone output"
fi
```

**What happened:** The build logs confirmed "Copied .env.production into standalone output" — but the signing key was still unavailable at runtime. Inngest sync still failed.

**Takeaway:** `.next/standalone/` is where `server.js` lives, but Amplify's SSR adapter doesn't necessarily run the server from that directory. The adapter repackages the deployment, and the file ended up in the wrong place.

### Round 4: Write server-env.json and load in instrumentation.ts

**I noticed:** Copying `.env.production` to a specific subdirectory was fragile — we were guessing where Amplify's Lambda runs from.

**I suspected:** If we wrote a JSON file directly into `.next/` (which IS the deployment artifact root), and loaded it in Next.js's `instrumentation.ts` hook (which runs at server startup before any routes), we could populate `process.env` without any bundler involvement.

**I tested it:** Wrote a build script step to generate `.next/server-env.json` with all non-`NEXT_PUBLIC_` vars, and added loading code to `instrumentation.ts` using `process.cwd()` + `.next/server-env.json`.

**What happened:** Deployed and tested — still failed. The Amplify Lambda's `process.cwd()` doesn't resolve to where we expect, so the file read either fails silently (ENOENT caught) or reads from the wrong location.

**Takeaway:** Amplify's SSR adapter completely controls the Lambda's filesystem layout and working directory. We can't rely on file paths being predictable at runtime. The only reliable mechanism is build-time inlining.

### Round 5: Understanding the deployment topology

**I noticed:** The Amplify build artifacts are configured as:

```yaml
artifacts:
  baseDirectory: .next
  files:
    - '**/*'
```

**I suspected:** `.env.production` at the project root is **outside** `.next/`, so it's never included in the deployment artifacts. The AWS docs' recommended approach — writing `.env.production` before `next build` — works for non-standalone deployments where the entire project directory is available at runtime. With `output: "standalone"`, only `.next/` is deployed.

**I tested it:** Checked the CloudWatch logs for the Lambda compute:

```bash
aws logs filter-log-events \
  --log-group-name "/aws/amplify/<app-id>" \
  --log-stream-name-prefix "staging" \
  --filter-pattern "inngest OR signing OR env.production"
```

**What happened:** No matches. The Inngest SDK's signature verification happens inside its middleware before any application logging runs. The verification reads `process.env.INNGEST_SIGNING_KEY`, gets `undefined`, and returns the error.

**Takeaway:** The gap is clear:
1. Build script writes `.env.production` to project root ✅
2. `next build` reads it during compilation ✅
3. Amplify packages only `.next/**/*` as deployment artifacts ✅
4. `.env.production` is **not inside `.next/`** so it's excluded ❌
5. Runtime Lambda has no `.env.production` → `process.env.INNGEST_SIGNING_KEY` is undefined ❌

## The Root Cause

The [AWS docs](https://docs.aws.amazon.com/amplify/latest/userguide/ssr-environment-variables.html) recommend writing env vars to `.env.production` before running the build. This works when Amplify deploys the full project directory. But with Next.js `output: "standalone"`, the deployment artifacts are just the `.next/` directory — and `.env.production` sits at the project root, outside that boundary.

Next.js treats `NEXT_PUBLIC_` and non-`NEXT_PUBLIC_` vars differently:
- **`NEXT_PUBLIC_` vars** are inlined into the JavaScript bundle at build time by the bundler. They survive because they're embedded in the code.
- **Non-`NEXT_PUBLIC_` vars** are read from `process.env` at runtime. They are NOT inlined. They rely on the runtime environment having them set — which means `.env.production` must be loadable by the server process.

The `env` block in `next.config.js` bypasses this distinction by using DefinePlugin to force-inline everything into all bundles. It works, but it's a security footgun for secrets.

## The Fix

Use the `env` block in `next.config.js`:

```js
// next.config.js
const nextConfig = {
  output: "standalone",
  env: {
    MY_SIGNING_KEY: process.env.MY_SIGNING_KEY,
  },
};
```

This is the **only approach that works** on Amplify with standalone mode. It inlines the value at build time via DefinePlugin.

DefinePlugin replaces `process.env.MY_SIGNING_KEY` in compiled output wherever it appears. Critically, the replacement only happens in files that reference the variable. If only server-side code (like an API Route Handler) references it, the value only appears in server bundles — client bundles won't contain it because no client code references it.

This is a weaker guarantee than `NEXT_PUBLIC_` enforcement (which is a bundler-level boundary), but it's the only game in town for Amplify + standalone.

### What doesn't work

We tested two alternatives that both failed:

1. **Copying `.env.production` into `.next/standalone/`** — the file was confirmed present in the build output, but Amplify's SSR adapter repackages the deployment and the Lambda doesn't run from that directory.

2. **Writing `server-env.json` into `.next/` and loading it in `instrumentation.ts`** — the file was in the deployment artifacts, but `process.cwd()` in the Amplify Lambda doesn't resolve to where we expected, so the file read failed silently.

Both approaches fail because Amplify's SSR adapter is a black box — you can't predict or control the Lambda's filesystem layout or working directory at runtime.

## What I Should Have Checked First

Before touching any code, I should have verified what files actually exist at runtime in the Amplify Lambda:

```ts
// Temporary debug endpoint: app/api/debug-env/route.ts
import { NextResponse } from "next/server";
import { readdirSync, existsSync } from "node:fs";

export function GET() {
  return NextResponse.json({
    cwd: process.cwd(),
    envProductionExists: existsSync(".env.production"),
    dotNextContents: readdirSync(".next").slice(0, 20),
    hasSigningKey: !!process.env.INNGEST_SIGNING_KEY,
  });
}
```

One `curl` to this endpoint would have immediately shown that `.env.production` was missing from the runtime filesystem, saving three rounds of hypothesis → deploy → test.
