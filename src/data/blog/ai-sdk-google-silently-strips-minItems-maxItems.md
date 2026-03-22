---
title: "AI Providers Reject minItems/maxItems — And Each SDK Handles It Differently"
pubDatetime: 2026-03-22T11:06:00Z
description: "Gemini AND Anthropic both reject minItems/maxItems in JSON Schema structured output. The AI SDK's Google provider silently strips them; the Anthropic provider doesn't. The fix: never put array constraints in schemas sent to any provider."
tags:
  - ai-sdk
  - gemini
  - anthropic
  - typescript
  - zod
  - aws-lambda
draft: false
featured: false
---

## TL;DR

Both Gemini and Anthropic reject `minItems`/`maxItems` in structured output JSON schemas with the same error: `output_config.format.schema: For 'array' type, property 'maxItems' is not supported`. The Vercel AI SDK's Google provider silently strips them (correct behavior); the Anthropic provider passes them through (crash). The fix: never use `.min()`, `.max()`, or `.length()` on Zod arrays in schemas sent to any AI provider. Specify counts in prompt text instead.

## Environment

- `ai` 6.0.134 (Vercel AI SDK)
- `@ai-sdk/google` 3.0.52
- `@ai-sdk/anthropic` 3.0.63
- `zod` 4.3.6
- `gemini-2.5-flash`, `claude-sonnet-4-5-20250929` models
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

### Round 5: Fix the deployment, strip all Gemini schemas

**I noticed:** The deployed bundle was stale because CDK cached a stale build artifact in `.amplify/artifacts/cdk.out/asset.*/`.
**I suspected:** Clearing the CDK cache + manually deploying would fix it.
**I tested it:** Cleared the CDK cache, rebuilt with esbuild, deployed all 3 Lambdas. Also removed all `.min()`, `.max()`, `.length()` constraints from Zod arrays in every Gemini-path schema (~28 schemas).
**What happened:** The Gemini operations stopped failing. But a *different* operation started failing with the exact same error.
**Takeaway:** Fixing Gemini schemas revealed a deeper problem.

### Round 6: The error is coming from *Anthropic*, not Gemini

**I noticed:** After stripping all Gemini-path schemas, the same `maxItems` error returned for the word "strategic."
**I suspected:** Maybe I missed a schema.
**I tested it:** Pulled the Lambda logs to find the exact operation:

```bash
aws logs filter-log-events \
  --log-group-name "/aws/lambda/my-curriculum-gen-lambda" \
  --filter-pattern "maxItems" --limit 5
```

```json
{
  "ok": false,
  "error": {
    "code": "anthropic_error",
    "message": "output_config.format.schema: For 'array' type, property 'maxItems' is not supported"
  }
}
```

**What happened:** The error code was `anthropic_error`, not `gemini_error`. The failing operation was `generate-definition/anthropic` — an Anthropic Claude call, not Gemini.
**Takeaway:** Anthropic's API **also** rejects `minItems`/`maxItems` in structured output schemas. The error message is identical. This isn't a Gemini-only problem.

### Round 7: Confirm the Anthropic SDK passes constraints through

**I noticed:** The Google provider strips `minItems`/`maxItems` via whitelist destructuring. Does the Anthropic provider also strip them?
**I suspected:** No — if it did, the error wouldn't happen.
**I tested it:** Read `@ai-sdk/anthropic@3.0.63`'s source in `node_modules`:

```typescript
// @ai-sdk/anthropic@3.0.63 — sends schema to API
body: {
  // ...
  output_config: {
    format: {
      type: "json_schema",
      schema: mode.schema,  // raw JSON Schema, no stripping
    },
  },
}
```

**What happened:** The Anthropic provider passes the JSON Schema through unchanged to `output_config.format.schema`. There's no equivalent of Google's `convertJSONSchemaToOpenAPISchema` whitelist. `minItems` and `maxItems` survive the pipeline and hit Anthropic's API, which rejects them.
**Takeaway:** Each AI SDK provider handles unsupported schema properties differently. Google strips them silently. Anthropic passes them through and lets the API reject them. You can't rely on the SDK to sanitize your schemas.

## The Root Cause

Three things combined:

1. **Both Gemini and Anthropic reject `minItems`/`maxItems`** in structured output JSON schemas, with the same error message: `output_config.format.schema: For 'array' type, property 'maxItems' is not supported`.

2. **The AI SDK providers handle this inconsistently.** `@ai-sdk/google@3.0.52` silently strips `minItems`/`maxItems` via whitelist destructuring in `convertJSONSchemaToOpenAPISchema` — so Gemini calls usually *don't* fail even if your Zod schema has array constraints. `@ai-sdk/anthropic@3.0.63` passes the JSON Schema through unchanged — so Anthropic calls *do* fail.

3. **Zod compiles array constraints to JSON Schema properties** that look harmless:
   - `.min(N)` → `minItems: N`
   - `.max(N)` → `maxItems: N`
   - `.length(N)` → `minItems: N, maxItems: N`

   These are valid JSON Schema, but AI providers' structured output APIs don't support them.

The most confusing part: the error message (`output_config.format.schema:...`) looks like a Gemini-specific parameter path, but Anthropic uses the *exact same format* when rejecting schemas through their `output_config.format.schema` parameter.

## The Fix

### Remove array constraints from all schemas, regardless of provider

The cleanest and most reliable fix: don't put `.min()`, `.max()`, or `.length()` on arrays in any schema sent to any AI provider. Specify the count in the prompt text instead:

```typescript
// Before (breaks with Gemini AND Anthropic):
const schema = z.object({
  definitions: z.array(z.string()).min(2).max(2),
  partsOfSpeech: z.array(z.string()).min(1).max(5),
});
const prompt = "Generate definitions for the word.";

// After (works everywhere):
const schema = z.object({
  definitions: z.array(z.string()),
  partsOfSpeech: z.array(z.string()),
});
const prompt = "Generate exactly 2 definitions and 1-5 parts of speech.";
```

**Important:** Constraints on `z.string()` and `z.number()` compile to `minLength`/`maxLength` and `minimum`/`maximum` respectively — these *are* generally supported. Only **array** constraints (`minItems`/`maxItems`) cause problems.

### Defense in depth: strip constraints before the SDK sees them

If you can't remove constraints from your Zod schemas (e.g., they're shared with validation logic), strip them at the boundary:

```typescript
import { zodSchema, jsonSchema, generateText, Output } from "ai";
import type { JSONSchema7 } from "json-schema";
import { z } from "zod";

function stripArrayConstraints(
  schema: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === "minItems" || key === "maxItems") continue;
    if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === "object" && item !== null
          ? stripArrayConstraints(item as Record<string, unknown>)
          : item
      );
    } else if (typeof value === "object" && value !== null) {
      result[key] = stripArrayConstraints(
        value as Record<string, unknown>
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}

function toSafeSchema<T>(zodType: z.ZodType<T>) {
  const converted = zodSchema(zodType);
  const cleaned = stripArrayConstraints(
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

// Usage — works with any provider
const result = await generateText({
  model: anyProvider("any-model"),
  output: Output.object({ schema: toSafeSchema(MyZodSchema) }),
  prompt: "Generate 10 items.",
});
```

## What I Should Have Checked First

Pull the Lambda logs and check the **error code**, not just the error message. The error message `output_config.format.schema: For 'array' type, property 'maxItems' is not supported` looks identical across providers. Only the error code (`anthropic_error` vs `gemini_error`) reveals which provider is failing.

After fixing the Gemini schemas and deployment pipeline, I spent hours chasing the same error assuming it was still Gemini — because the message was identical. One `grep "anthropic_error"` on the logs would have immediately redirected the investigation.

Broader lesson: when multiple providers share the same structured output API pattern (`output_config.format.schema`), they can produce identical-looking errors from completely different codepaths. Always check which provider the error originated from.
