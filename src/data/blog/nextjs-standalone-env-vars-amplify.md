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

I spent hours debugging "Signature verification failed" on AWS Amplify with Next.js standalone mode, convinced that `.env.production` wasn't reaching the Lambda runtime. I tried four different approaches to get env vars into the app. The real problem was **two bugs masking each other**: the signing key genuinely wasn't reaching the app at first, but after fixing that, a *second* bug (Inngest function concurrency limit exceeding the plan) kept producing the same error message. I only found it by curling the endpoint directly instead of trusting the UI.

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

**What happened:** Deployed — but before we could test it, an automated code review (Bugbot) flagged a security concern:

> **Medium Severity: Secret signing key exposed via client-accessible env config**
>
> The `env` block in `next.config.js` makes values available for replacement in both server and client bundles via webpack's DefinePlugin. `INNGEST_SIGNING_KEY` is a cryptographic secret used for signature verification. If any client-side code ever references `process.env.INNGEST_SIGNING_KEY`, the actual secret value would be inlined into the browser bundle.

We immediately moved on to try a "cleaner" approach (Round 3) without ever testing whether this actually fixed the signing key problem. That was a mistake — it sent us on a multi-hour detour through two more failed approaches before circling back.

**Takeaway:** The `env` block uses DefinePlugin, which replaces `process.env.X` in **all** bundles — both client and server. The security concern is real but manageable (values only appear in bundles that reference them). More importantly: **always test before pivoting**.

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

**What happened:** The build logs confirmed "Copied .env.production into standalone output" — but the Inngest sync still failed with "Signature verification failed."

**Takeaway at the time:** We assumed the copy didn't work — that Amplify's SSR adapter doesn't run the server from the standalone directory. **This assumption was wrong.** (See Round 7.)

### Round 4: Write server-env.json and load in instrumentation.ts

**I noticed:** Copying `.env.production` to a specific subdirectory was fragile — we were guessing where Amplify's Lambda runs from.

**I suspected:** If we wrote a JSON file directly into `.next/` (which IS the deployment artifact root), and loaded it in Next.js's `instrumentation.ts` hook (which runs at server startup before any routes), we could populate `process.env` without any bundler involvement.

**I tested it:** Wrote a build script step to generate `.next/server-env.json` with all non-`NEXT_PUBLIC_` vars, and added loading code to `instrumentation.ts` using `process.cwd()` + `.next/server-env.json`.

**What happened:** Deployed and tested — still failed. Same error.

**Takeaway at the time:** We concluded that Amplify's SSR adapter completely controls the Lambda's filesystem layout and working directory, so file-based approaches can't work. **Also wrong.** (See Round 7.)

### Round 5: Understanding the deployment topology

**I noticed:** The Amplify build artifacts are configured as:

```yaml
artifacts:
  baseDirectory: .next
  files:
    - '**/*'
```

**I suspected:** `.env.production` at the project root is **outside** `.next/`, so it's never included in the deployment artifacts.

**I tested it:** Checked the CloudWatch logs for the Lambda compute. No matches for Inngest-related logging — the SDK's signature verification happens before any application code runs.

**Takeaway:** We built a coherent theory: `.env.production` is excluded from deployment artifacts, so runtime `process.env` doesn't have the key. Neat, satisfying, and — as it turned out — only part of the story.

### Round 6: Reading the SDK source code

At this point we went back to the `env` block approach (Round 2). Deployed it. Still got "Signature verification failed." Since the `env` block should have inlined the value, we dug into the SDK to understand why.

**I traced** the signing key read path through `node_modules/inngest/`:

```js
// The SDK spreads the entire process.env object
this._env = { ...allProcessEnv() };

// allProcessEnv() returns process.env as a whole object
const allProcessEnv = () => {
  try {
    if (process.env) return process.env;
  } catch (_err) {}
  return {};
};
```

**I concluded:** DefinePlugin replaces `process.env.INNGEST_SIGNING_KEY` (direct property access) but doesn't add properties to the runtime `process.env` object. When the SDK spreads `process.env`, the key isn't there.

**The fix:** Pass the signing key directly in the SDK's constructor options, where DefinePlugin *can* replace the direct reference:

```js
export const inngest = new Inngest({
  id: "my-app",
  signingKey: process.env.INNGEST_SIGNING_KEY,
  eventKey: process.env.INNGEST_EVENT_KEY,
});
```

This analysis was technically correct about how DefinePlugin works, but it wasn't the actual problem. (See Round 7.)

### Round 7: Deploy a debug endpoint and curl the PUT directly

After deploying the constructor fix, we curled the Inngest serve endpoint:

```bash
curl -s https://staging.alphawords.school/api/inngest | jq .
```

```json
{
  "has_signing_key": true,
  "has_event_key": true,
  "function_count": 2,
  "mode": "cloud"
}
```

The key was reaching the app. But syncing still "failed." We deployed a debug endpoint to see the full runtime state:

```bash
curl -s https://staging.alphawords.school/api/debug-env | jq .
```

```json
{
  "cwd": "/tmp/app",
  "envProductionExists": true,
  "processEnvHasKey": true,
  "processEnvKeyCount": 88,
  "inngestClientHasSigningKey": true,
  "directAccess": "signkey-test... (77 chars)"
}
```

Wait. `envProductionExists: true`? `.env.production` IS available at `/tmp/app`. And `processEnvHasKey: true` — the signing key IS in `process.env`. Everything we thought was broken... wasn't.

**The `.env.production` copy step from Round 3 had been working the whole time.** Amplify's SSR adapter extracts the standalone app to `/tmp/app/`, so `.next/standalone/.env.production` becomes `/tmp/app/.env.production`. Next.js loads it at startup. `process.env` has all the keys.

So why was the sync failing? We tried something we should have done from the start — curled the PUT directly instead of relying on the Inngest dashboard UI:

```bash
curl -X PUT https://staging.alphawords.school/api/inngest
```

```json
{
  "message": "The function 'curriculum/word.generate' has higher concurrency limits (100) than your plan limit of 5",
  "modified": false
}
```

**The signing key was fine. The sync was failing because the function's concurrency limit (100) exceeded the Inngest plan's maximum (5).** The Inngest dashboard was showing "Signature verification failed" — a misleading error message that sent us on hours of env var debugging when the real problem was a plan limit.

After upgrading the Inngest plan:

```bash
curl -X PUT https://staging.alphawords.school/api/inngest
```

```json
{"message": "Successfully registered", "modified": true}
```

## The Root Cause(s)

**Two bugs masked each other:**

1. **The signing key genuinely wasn't reaching the app initially** — before adding the `env` block or the `.env.production` copy step. This produced "Signature verification failed" legitimately.

2. **After fixing the signing key, the function's concurrency limit (100) exceeded the plan limit (5).** The Inngest dashboard continued to show "Signature verification failed" even though the actual error was a plan limit violation. We assumed the key was still broken and kept trying different approaches to deliver it.

Because both bugs produced the same user-facing error, we couldn't distinguish between them. Every "fix" for bug #1 appeared to fail because bug #2 was still blocking.

## What Actually Works

For getting `.env.production` to the Amplify Lambda runtime with `output: "standalone"`:

**Copy `.env.production` into `.next/standalone/` after the build:**

```bash
if [ -f .env.production ] && [ -d .next/standalone ]; then
  cp .env.production .next/standalone/.env.production
fi
```

Amplify's SSR adapter extracts the standalone directory to `/tmp/app/` in the Lambda. The file ends up at `/tmp/app/.env.production`, where Next.js's `loadEnvConfig` finds it at startup. All non-`NEXT_PUBLIC_` vars are available via `process.env` at runtime.

The `env` block in `next.config.js` and explicit constructor options also work but are belt-and-suspenders — the `.env.production` copy is sufficient.

## What I Should Have Done Differently

**1. Curl the endpoint directly.** The Inngest serve endpoint exposes `has_signing_key` via GET — one curl would have shown the key was present. And `curl -X PUT` would have shown the *real* error (concurrency limit) instead of the misleading dashboard message.

**2. Deploy a debug endpoint first.** Before touching any code, deploy an endpoint that inspects the runtime environment. Remember to add it to your auth middleware's public paths or you'll get a 401 and waste another deploy cycle.

```ts
import { NextResponse } from "next/server";
import { existsSync } from "node:fs";

export function GET() {
  return NextResponse.json({
    cwd: process.cwd(),
    envProductionExists: existsSync(".env.production"),
    hasSigningKey: !!process.env.INNGEST_SIGNING_KEY,
    processEnvKeys: Object.keys(process.env).sort(),
  });
}
```

**3. Test before pivoting.** We never confirmed whether Round 2 (the `env` block) actually fixed the problem before the Bugbot review scared us into trying alternatives. Every approach from Round 2 onward probably worked — we just couldn't tell because the concurrency limit was also blocking.

**4. Don't trust UI error messages during debugging.** The Inngest dashboard said "Signature verification failed." The actual error was "concurrency limits (100) exceed plan limit of 5." These are completely different problems with completely different fixes. Always get the raw response.

**5. Read the SDK source when something doesn't make sense.** The DefinePlugin analysis in Round 6 was a useful exercise — it's genuinely how DefinePlugin works and it's a real gotcha for SDKs that spread `process.env`. But it wasn't the actual problem here. Reading the SDK source is valuable; just make sure you've ruled out simpler explanations first.