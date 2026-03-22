---
title: "AWS Amplify Sandbox Silently Fails to Hotswap Lambda Code"
pubDatetime: 2026-03-22T12:30:00Z
description: "The Amplify Gen 2 sandbox can silently fail to hotswap Lambda code. Your function keeps running stale code with no error — and cold starts don't help because they recycle the old bundle, not your latest source."
tags:
  - aws-lambda
  - aws-amplify
  - esbuild
  - deployment
  - debugging
draft: false
featured: false
---

## TL;DR

The AWS Amplify Gen 2 sandbox can silently fail to deploy Lambda code changes. The sandbox appears healthy — it watches files, reports no errors — but the Lambda keeps running a stale bundle. A cold start (updating an env var) doesn't help because it restarts the container with the *existing deployed code*, not your latest source. The fix: build locally with esbuild, compare hashes, and deploy via `aws lambda update-function-code` yourself.

## Environment

- AWS Amplify Gen 2 sandbox (`@aws-amplify/backend` 1.x)
- AWS Lambda (nodejs22.x)
- esbuild 0.25.x (local bundling)
- Node.js 24.10.0, macOS 26.3.1

## The Problem

After committing a fix to a Lambda function (a schema-stripping utility for Gemini API compatibility), the fix didn't take effect in production. The Lambda kept returning errors that the fix was supposed to prevent. The Amplify sandbox was running, watching for file changes, and reporting no errors.

## The Investigation

### Round 1: Verify the fix is correct locally

**I noticed:** The fix (`stripGeminiUnsupportedProps`) was committed and the code compiled fine.
**I suspected:** Maybe the stripping logic had a bug.
**I tested it:** Wrote a test script that ran the schema through the stripping pipeline:

```typescript
import { zodSchema, jsonSchema } from "ai";
import { z } from "zod";

const schema = z.object({
  items: z.array(z.object({ text: z.string() })).min(2).max(15),
});

// Convert Zod → JSON Schema
const converted = zodSchema(schema);
console.log(converted.jsonSchema);
// => { ..., items: { type: "array", minItems: 2, maxItems: 15, ... } }

// Strip unsupported properties
const cleaned = stripGeminiUnsupportedProps(converted.jsonSchema);
console.log(cleaned);
// => { ..., items: { type: "array", ... } }  — no minItems/maxItems
```

**What happened:** The stripping works perfectly. `maxItems` and `minItems` are removed.
**Takeaway:** The fix is correct. The problem is somewhere between "committed" and "running in Lambda."

### Round 2: Force a cold start

**I noticed:** Lambda containers cache code in memory. Maybe the container was still running pre-fix code.
**I suspected:** A cold start would force the Lambda to reload from the latest deployed bundle.
**I tested it:** Updated the Lambda's `FORCE_COLD_START` env var to force all warm containers to recycle:

```bash
aws lambda update-function-configuration \
  --function-name "my-lambda" \
  --environment '{"Variables":{"FORCE_COLD_START":"1711108800"}}'
```

**What happened:** The error persisted after the cold start.
**Takeaway:** Cold starts reload from the *deployed bundle*, not from source. If the bundle is stale, cold starts recycle stale code. This is the critical misunderstanding — "cold start" and "redeploy" are different things.

### Round 3: Download and inspect the deployed bundle

**I noticed:** The fix works locally, and cold starts didn't help. Two independent code paths should strip the property (our utility + the SDK's converter). Yet the error persists.
**I suspected:** The Lambda isn't running the code I think it is.
**I tested it:** Downloaded the actual deployed Lambda bundle and searched for the fix:

```bash
# Get the Lambda's deployment package URL
aws lambda get-function \
  --function-name "my-lambda" \
  --query 'Code.Location' --output text \
  | xargs curl -sL -o /tmp/lambda-code.zip

# Extract and search
unzip -o /tmp/lambda-code.zip -d /tmp/lambda-code
grep -c "stripGeminiUnsupportedProps" /tmp/lambda-code/index.mjs
# => 0
```

**What happened:** Zero matches. The fix was committed to git but **never made it into the deployed bundle**. The Amplify sandbox silently failed to hotswap the Lambda.
**Takeaway:** Always verify what's actually deployed, not what's on disk.

### Round 4: Build and deploy manually

**I noticed:** The deployed bundle is stale. The sandbox isn't updating it.
**I suspected:** Building locally with current `node_modules` and deploying directly would work.
**I tested it:** Built the Lambda bundle locally, matching the Amplify sandbox's build process:

```bash
# Build with esbuild (same settings as Amplify)
npx esbuild handler.ts \
  --bundle --platform=node --target=es2022 \
  --format=esm --outfile=index.mjs --packages=bundle

# Verify the fix is in the bundle
grep -c "stripGeminiUnsupportedProps" index.mjs
# => 2

# Prepend SSM shims (Amplify injects these for API key resolution)
cat resolve_ssm_params.js invoke_ssm_shim.js index.mjs > final.mjs

# Deploy
zip lambda.zip final.mjs
aws lambda update-function-code \
  --function-name "my-lambda" \
  --zip-file fileb://lambda.zip

# Force cold start to pick up new code
aws lambda update-function-configuration \
  --function-name "my-lambda" \
  --environment '{"Variables":{"FORCE_COLD_START":"1711108801"}}'
```

**What happened:** The error stopped immediately.
**Takeaway:** The fix was always correct. The deployment pipeline was the only problem.

### Round 5: Manual deploys get overwritten by the sandbox

**I noticed:** After writing a deploy script to build and deploy Lambdas manually, the fix worked — then stopped working again minutes later.
**I suspected:** The Amplify sandbox was overwriting my manual deploy with its own stale bundle.
**I tested it:** Deployed manually, verified the fix was in the bundle, waited, then downloaded the bundle again:

```bash
# Deploy and verify — fix is there
aws lambda update-function-code ...
grep -c "stripGeminiUnsupportedProps" /tmp/lambda/index.mjs
# => 4

# Wait for sandbox to detect a file change...
# Download again
grep -c "stripGeminiUnsupportedProps" /tmp/lambda/index.mjs
# => 0  — gone!
```

**What happened:** The sandbox detected a file change, triggered a CDK hotswap, and overwrote my working deploy with its own stale bundle.
**Takeaway:** Manual deploys are temporary. The sandbox will overwrite them on the next file change. You need to fix the sandbox's own bundling.

### Round 6: Find and clear the stale CDK asset cache

**I noticed:** The sandbox's bundle didn't have the fix, but my local esbuild did. Same source, different output.
**I suspected:** CDK was caching a stale build artifact and reusing it instead of rebuilding.
**I tested it:** Checked the CDK output directory for cached Lambda bundles:

```bash
# Check all CDK-cached Lambda bundles
for f in .amplify/artifacts/cdk.out/asset.*/index.mjs; do
  echo "$f: $(grep -c 'stripGeminiUnsupportedProps' "$f")"
done
# asset.1a272720.../index.mjs: 0
# asset.61067302.../index.mjs: 0
# asset.e13b6332.../index.mjs: 0
```

**What happened:** All three cached Lambda bundles (one per function) were stale — zero matches. CDK was reusing these cached artifacts on every hotswap instead of rebuilding from source.
**Takeaway:** CDK caches Lambda bundles in `.amplify/artifacts/cdk.out/asset.*/`. If the cache goes stale (e.g., due to a failed initial build, or a `MultipleLockFilesFound` error), every subsequent hotswap reuses the stale bundle. Clearing the cache forces a fresh build.

## The Root Cause

Two layers of caching conspire to keep your Lambda running stale code:

1. **CDK asset caching.** CDK stores built Lambda bundles in `.amplify/artifacts/cdk.out/asset.*/`. When the sandbox hotswaps, it reuses these cached bundles if CDK's content hash hasn't changed. If the initial build was stale (e.g., due to a `MultipleLockFilesFound` error from conflicting lock files), every subsequent hotswap deploys the same stale bundle — even though your source code has changed.

2. **Lambda warm containers.** Even after deploying new code, warm Lambda containers keep running the old code until they cold-start. A cold start (updating an env var) only helps if the *deployed bundle* is correct — it doesn't trigger a rebuild.

3. **Manual deploys get overwritten.** If you deploy manually via `aws lambda update-function-code`, the sandbox will overwrite your deploy on the next file change, redeploying from its stale CDK cache.

This is especially insidious because:

1. **The sandbox looks healthy.** It starts, watches files, and shows no errors.
2. **Some operations still work.** Operations that don't hit the changed code path continue working, making it look like the Lambda is "running."
3. **Cold starts don't help.** They recycle the container with the *existing deployed bundle* — they don't trigger a new build+deploy.
4. **The code is correct locally.** Running the same code in Node.js locally works perfectly.
5. **Manual deploys are temporary.** The sandbox overwrites them on the next hotswap.

A contributing factor: if both `bun.lock` and `package-lock.json` exist, Amplify's CDK throws `MultipleLockFilesFound` during Lambda bundling. The sandbox swallows this error and keeps running with the last good bundle — which then gets cached as the CDK asset.

## The Fix

### Build-and-deploy script

Instead of trusting the Amplify sandbox to hotswap, build and deploy Lambdas yourself:

```bash
#!/bin/bash
# deploy-lambda.sh — Build, hash, and conditionally deploy a Lambda

FN_DIR="$1"       # e.g., "amplify/functions/my-lambda"
FN_NAME="$2"      # e.g., "my-lambda-function-name"
HASH_DIR=".deploy-hashes"

mkdir -p "$HASH_DIR"

# Build
BUILD_DIR=$(mktemp -d)
npx esbuild "${FN_DIR}/handler.ts" \
  --bundle --platform=node --target=es2022 \
  --format=esm --outfile="$BUILD_DIR/index.mjs" \
  --packages=bundle

if [ $? -ne 0 ]; then
  echo "Build failed"
  rm -rf "$BUILD_DIR"
  exit 1
fi

# Hash and compare
NEW_HASH=$(shasum -a 256 "$BUILD_DIR/index.mjs" | cut -d' ' -f1)
OLD_HASH=$(cat "$HASH_DIR/$(basename "$FN_DIR").sha256" 2>/dev/null)

if [ "$NEW_HASH" = "$OLD_HASH" ]; then
  echo "No changes — skipping deploy"
  rm -rf "$BUILD_DIR"
  exit 0
fi

# Deploy
(cd "$BUILD_DIR" && zip -q lambda.zip index.mjs)
aws lambda update-function-code \
  --function-name "$FN_NAME" \
  --zip-file "fileb://$BUILD_DIR/lambda.zip" \
  --no-cli-pager > /dev/null

# Force cold start
ENV=$(aws lambda get-function-configuration \
  --function-name "$FN_NAME" \
  --query 'Environment' --output json)
UPDATED=$(echo "$ENV" | jq --arg ts "$(date +%s)" \
  '.Variables.FORCE_COLD_START = $ts')
aws lambda update-function-configuration \
  --function-name "$FN_NAME" \
  --environment "$UPDATED" \
  --no-cli-pager > /dev/null

# Save hash
echo "$NEW_HASH" > "$HASH_DIR/$(basename "$FN_DIR").sha256"
echo "Deployed successfully"
rm -rf "$BUILD_DIR"
```

### Clear the CDK asset cache

The most important fix: clear the stale CDK cache so the sandbox rebuilds from current source.

```bash
# Nuclear option: clear all Amplify artifacts (forces full re-synthesis)
rm -rf .amplify/artifacts/cdk.out

# Then restart the sandbox — it will rebuild all Lambda bundles from scratch
npx ampx sandbox
```

Wire this into your dev server start scripts so it happens automatically:

```bash
# In your start script, before launching the sandbox:
rm -rf .amplify/artifacts/cdk.out
```

### Key points

1. **Clear the CDK cache on every start** — `rm -rf .amplify/artifacts/cdk.out` forces the sandbox to rebuild Lambda bundles from current source instead of reusing stale cached artifacts.
2. **Build locally as backup** — esbuild produces the same ESM bundle Amplify would, in ~50ms.
3. **Hash the bundle** — SHA256 comparison means the fast path (no changes) takes ~200ms. Only deploy when the code actually changed.
4. **Force cold starts after deploy** — update a `FORCE_COLD_START` env var so warm containers recycle and pick up the new code.
5. **Run on every dev server start** — wire this into your start scripts so you never forget.

### Verify your deployed code

When something doesn't work in production despite working locally, always start here:

```bash
# Download what's actually running
aws lambda get-function --function-name "$FN" \
  --query 'Code.Location' --output text \
  | xargs curl -sL -o /tmp/lambda.zip
unzip -o /tmp/lambda.zip -d /tmp/lambda

# Search for your fix
grep -c "myFixFunction" /tmp/lambda/index.mjs
# 0 = not deployed, N = deployed
```

## What I Should Have Checked First

Download the deployed Lambda bundle and grep for the fix. One command would have immediately shown the fix was never deployed:

```bash
aws lambda get-function --function-name "$FN" \
  --query 'Code.Location' --output text \
  | xargs curl -sL -o /tmp/lambda.zip && \
  unzip -o /tmp/lambda.zip -d /tmp/lambda && \
  grep -c "stripGeminiUnsupportedProps" /tmp/lambda/index.mjs
```

Instead, I spent time verifying the fix locally (it was correct), tracing through the AI SDK's schema pipeline (it was working), and writing test scripts (they passed). All of that was wasted because the fix was never deployed.

The diagnostic hierarchy for "my fix doesn't work in production":
1. **Is the fix deployed?** — download the artifact and grep for it
2. **Is the fix running?** — add a log line, check the logs
3. **Is the fix correct?** — write a test

Most people start at 3. Start at 1.
