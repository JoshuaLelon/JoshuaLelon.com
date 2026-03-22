---
title: "AI SDK Google Provider Silently Strips minItems/maxItems From Schemas"
pubDatetime: 2026-03-22T11:06:00Z
description: "The Vercel AI SDK's Google provider silently strips minItems and maxItems from JSON schemas before sending them to Gemini — which is actually correct, because Gemini rejects them despite the docs."
tags:
  - ai-sdk
  - gemini
  - typescript
  - zod
  - aws-lambda
draft: false
featured: false
---

## TL;DR

The Vercel AI SDK's Google provider strips `minItems` and `maxItems` from JSON schemas via a whitelist destructuring pattern in `convertJSONSchemaToOpenAPISchema`. Despite Google's docs listing these as supported, the Gemini API rejects them with `output_config.format.schema: For 'array' type, property 'maxItems' is not supported`. The SDK's stripping is actually *correct* behavior. If you hit this error, your Lambda/server is likely running stale code that predates the stripping.

## Environment

- `ai` 6.0.134 (Vercel AI SDK)
- `@ai-sdk/google` 3.0.52
- `zod` 4.3.6
- `gemini-2.5-flash` model
- Node.js 24.10.0, macOS 26.3.1
- AWS Lambda (nodejs22.x) via AWS Amplify Gen 2 sandbox

## The Problem

After switching content generation operations from `gpt-5-mini` to `gemini-2.5-flash`, auto-generation started failing with:

```
output_config.format.schema: For 'array' type, property 'maxItems' is not supported
```

The Zod schema had `.min(2).max(15)` on an array, which compiles to `minItems: 2, maxItems: 15` in JSON Schema. Gemini rejected the request.

## The Investigation

### Round 1: Check if Gemini supports the constraint

**I noticed:** The error says `maxItems` is not supported for arrays.
**I suspected:** Gemini's structured output mode doesn't support array length constraints.
**I tested it:** Checked the [Gemini structured output docs](https://ai.google.dev/gemini-api/docs/json-mode).
**What happened:** The docs explicitly list `minItems` and `maxItems` as supported properties for arrays.
**Takeaway:** The docs say "supported" but the API says otherwise. Trust the error, not the docs.

### Round 2: Trace the AI SDK's schema pipeline

**I noticed:** The AI SDK converts Zod schemas to JSON Schema via `Output.object({ schema })`, then the Google provider converts JSON Schema to OpenAPI 3.0 before sending to the API.
**I suspected:** The conversion might be stripping the properties.
**I tested it:** Read `@ai-sdk/google`'s `convertJSONSchemaToOpenAPISchema` function in `node_modules`:

```typescript
// @ai-sdk/google@3.0.52 — convertJSONSchemaToOpenAPISchema
const {
  type,
  description,
  required,
  properties,
  items,
  allOf,
  anyOf,
  oneOf,
  format,
  const: constValue,
  minLength,
  enum: enumValues,
} = jsonSchema;
```

**What happened:** The function uses destructuring as a whitelist. Only the properties listed above survive. `minItems`, `maxItems`, `minimum`, `maximum`, and `maxLength` are all silently dropped.
**Takeaway:** The AI SDK in v3.0.52 *does* strip `maxItems`. So the error shouldn't happen with this version. Something else is going on.

### Round 3: Write and deploy a workaround

**I noticed:** The AI SDK strips the properties, but the error keeps happening in production (Lambda).
**I suspected:** Maybe the Lambda is running a different code path or older SDK version.
**I tested it:** Wrote a `toGeminiSafeSchema` wrapper that strips `minItems`/`maxItems` before the SDK even sees them. Committed it. Forced a Lambda cold start via `aws lambda update-function-configuration` (updating a `FORCE_COLD_START` env var).
**What happened:** The error *still* happened after the cold start.
**Takeaway:** The cold start restarts the Lambda with its *existing deployed code* — it doesn't redeploy. The fix was committed to git but never made it to the Lambda.

### Round 4: Prove the Lambda is running stale code

**I noticed:** Every code path was verified locally. The stripping function works. The AI SDK's converter also strips. Two independent layers should prevent `maxItems` from reaching Gemini. Yet it does.
**I suspected:** The Lambda isn't running the code I think it is.
**I tested it:** Downloaded the actual deployed Lambda bundle:

```bash
# Download the Lambda deployment package
aws lambda get-function \
  --function-name "my-curriculum-gen-lambda" \
  --query 'Code.Location' --output text \
  | xargs curl -sL -o /tmp/lambda-code.zip

# Extract and search
unzip /tmp/lambda-code.zip -d /tmp/lambda-code
grep -c "toGeminiSafeSchema" /tmp/lambda-code/index.mjs
# => 0
```

**What happened:** Zero instances of `toGeminiSafeSchema` or `stripGeminiUnsupportedProps` in the deployed bundle. The workaround was committed but **never deployed**. The Amplify sandbox silently failed to hotswap.
**Takeaway:** The Lambda was running code from before the fix. The cold start only recycled the *old* code. You must verify what code is actually deployed, not what's on disk.

### Round 5: Verify the fix works end-to-end

**I noticed:** The deployed bundle also lacked the `convertJSONSchemaToOpenAPISchema` improvements from v3.0.52 — the bundle was built with an older `@ai-sdk/google` version that didn't strip `maxItems`.
**I suspected:** Building locally with current `node_modules` and deploying manually would fix it.
**I tested it:** Built the Lambda bundle with esbuild, prepended the Amplify SSM shims, zipped, and uploaded:

```bash
# Build
npx esbuild handler.ts --bundle --platform=node \
  --target=es2022 --format=esm --outfile=index.mjs

# Verify fix is in the bundle
grep -c "toGeminiSafeSchema" index.mjs
# => 2

# Deploy
zip lambda.zip index.mjs
aws lambda update-function-code \
  --function-name "my-lambda" \
  --zip-file fileb://lambda.zip
```

**What happened:** After manual deploy + cold start, the error stopped.
**Takeaway:** The fix was always correct. The deployment pipeline was the problem.

## The Root Cause

Two-layer failure:

1. **Gemini rejects `maxItems`** despite the docs claiming support. The error `output_config.format.schema: For 'array' type, property 'maxItems' is not supported` is real.

2. **The Amplify sandbox silently failed to hotswap** the Lambda after code changes. The Lambda kept running a stale bundle that had neither our `toGeminiSafeSchema` workaround nor the current `@ai-sdk/google@3.0.52` which strips these properties in `convertJSONSchemaToOpenAPISchema`.

The confusing part: the Lambda *appeared* to be working (definition generation with Gemini succeeded) because those operations used schemas without `minItems`/`maxItems`. Only the spelling distractors schema with `.min(2).max(15)` triggered the error.

## The Fix

### 1. Belt-and-suspenders: strip constraints from Zod schemas used with Gemini

```typescript
// Strip minItems/maxItems from JSON Schema before sending to Gemini.
// The @ai-sdk/google provider's convertJSONSchemaToOpenAPISchema also
// strips them, but we do it ourselves for defense in depth.
import { generateText, jsonSchema, Output, zodSchema } from "ai";
import type { JSONSchema7 } from "json-schema";
import { z } from "zod";

function stripGeminiUnsupported(
  schema: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === "minItems" || key === "maxItems") continue;
    if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === "object" && item !== null
          ? stripGeminiUnsupported(item as Record<string, unknown>)
          : item
      );
    } else if (typeof value === "object" && value !== null) {
      result[key] = stripGeminiUnsupported(
        value as Record<string, unknown>
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}

function toGeminiSafeSchema<T>(zodType: z.ZodType<T>) {
  const converted = zodSchema(zodType);
  const cleaned = stripGeminiUnsupported(
    converted.jsonSchema as Record<string, unknown>
  );
  return jsonSchema<T>(cleaned as JSONSchema7, {
    validate: (value) => {
      const parsed = zodType.safeParse(value);
      if (parsed.success) return { success: true, value: parsed.data };
      return { success: false, error: parsed.error };
    },
  });
}
```

### 2. Remove array constraints from schemas used with Gemini

The cleanest fix: don't put `.min()` / `.max()` / `.length()` on arrays in schemas sent to Gemini. Specify the count in the prompt text instead:

```typescript
// Before (breaks with Gemini):
const schema = z.object({
  items: z.array(z.object({ text: z.string() })).min(2).max(15),
});

// After (works everywhere):
const schema = z.object({
  items: z.array(z.object({ text: z.string() })),
});
// Put the count in the prompt: "Generate 12 items"
```

### 3. Verify your Lambda is running the code you think it is

```bash
# Download and inspect the deployed bundle
aws lambda get-function --function-name "$FN" \
  --query 'Code.Location' --output text \
  | xargs curl -sL -o /tmp/lambda.zip
unzip -o /tmp/lambda.zip -d /tmp/lambda
grep -c "yourFunctionName" /tmp/lambda/index.mjs
```

If the count is 0, your code hasn't been deployed.

## What I Should Have Checked First

Download the deployed Lambda bundle and verify the fix is in it. One `grep` on the deployed `index.mjs` would have immediately shown the fix was never deployed. Instead, I spent time tracing through the AI SDK's schema pipeline (which was working correctly), writing tests that proved the stripping logic works locally (which it does), and blaming the AI SDK (which was innocent).

The diagnostic hierarchy for "my fix doesn't work in production":
1. **Is the fix deployed?** — download the artifact and grep for it
2. **Is the fix running?** — add a log line, check the logs
3. **Is the fix correct?** — write a test

Most people start at 3. Start at 1.
