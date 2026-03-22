---
title: "AI SDK Google Provider Silently Strips minItems/maxItems From Schemas"
pubDatetime: 2026-03-22T11:06:00Z
description: "The Vercel AI SDK's Google provider silently strips minItems and maxItems from JSON schemas before sending them to Gemini, even though Gemini supports them natively."
tags:
  - ai-sdk
  - gemini
  - typescript
  - zod
draft: false
featured: false
---

## TL;DR

The Vercel AI SDK's Google provider silently strips `minItems` and `maxItems` from JSON schemas before sending them to Gemini, even though Gemini's API supports them natively. If you use Zod's `.length()`, `.min()`, or `.max()` on arrays in structured output schemas, the constraints vanish and the model ignores them.

## Environment

- `ai` 6.0.116 (Vercel AI SDK)
- `@ai-sdk/google` 3.0.52
- `gemini-2.5-flash` model
- Node.js 22, macOS

## The Problem

After switching several content generation operations from `gpt-5-mini` to `gemini-2.5-flash`, auto-generation started failing with:

```
output_config.format.schema: For 'array' type, property 'maxItems' is not supported
```

The Zod schemas used `.length(10)` on arrays (which compiles to `minItems: 10, maxItems: 10` in JSON Schema), and Gemini was rejecting them.

## The Investigation

### Round 1: The obvious fix

**I noticed:** The error says `maxItems` is not supported for arrays.
**I suspected:** Gemini's structured output mode doesn't support array length constraints.
**I tested it:** Checked the [Gemini structured output docs](https://ai.google.dev/gemini-api/docs/json-mode).
**What happened:** The docs explicitly list `minItems` and `maxItems` as supported properties for arrays.
**Takeaway:** Gemini supports these constraints. The problem is somewhere between our code and the API.

### Round 2: Tracing the schema pipeline

**I noticed:** The AI SDK converts Zod schemas to JSON Schema internally via `Output.object({ schema: zodSchema })`, then the Google provider converts JSON Schema to OpenAPI 3.0 before sending to the API.
**I suspected:** The conversion might be stripping the properties.
**I tested it:** Read `@ai-sdk/google`'s `convertJSONSchemaToOpenAPISchema` function:

```typescript
// packages/google/src/convert-json-schema-to-openapi-schema.ts (v3.0.52)
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
**Takeaway:** The AI SDK is the bottleneck. Gemini never sees the constraints.

### Round 3: Wait, then why the error?

**I noticed:** If the AI SDK strips `maxItems` before the request reaches Google, Google should never see it. But the error message (`output_config.format.schema: For 'array' type, property 'maxItems' is not supported`) looks like it comes from Google's API.
**I suspected:** Maybe a stale Lambda deployment was running code from before the schema conversion was in place, or a different code path was being hit.
**I tested it:** Verified there's only one copy of `@ai-sdk/google` (v3.0.52) in the project, and the compiled dist has the same stripping behavior.
**What happened:** The stripping is confirmed in the compiled code. The initial error may have come from a transient deployment state.
**Takeaway:** Regardless of the error's origin, the core issue stands: the AI SDK drops valid schema constraints that Gemini supports.

### Round 4: Is there an upstream fix?

**I noticed:** The AI SDK is open source at `vercel/ai`.
**I suspected:** Maybe this was already fixed on `main`, or there was a `responseJsonSchema` code path that preserves the full schema.
**I tested it:** Cloned the repo and searched the entire git history:

```bash
git log --all --oneline --grep="minItems"     # zero results
git log --all --oneline --grep="maxItems"     # zero results
git log --all --oneline --grep="responseJsonSchema"  # zero results
```

**What happened:** No one has ever worked on this. The conversion function hasn't been updated to pass through array or numeric constraints. The Google Vertex provider reuses the same code.
**Takeaway:** This is a genuine gap in the AI SDK. Time to fix it upstream.

## The Root Cause

`@ai-sdk/google`'s `convertJSONSchemaToOpenAPISchema` function converts JSON Schema 7 to OpenAPI 3.0 using a **whitelist destructuring pattern**. Any JSON Schema property not explicitly listed in the destructuring is silently discarded. The function preserved `minLength` for strings but missed:

- `maxLength` (strings)
- `minimum` / `maximum` (numbers)
- `minItems` / `maxItems` (arrays)

All of these are documented as supported by the Gemini API.

## The Fix

The fix is a two-line addition to the destructuring plus six `if` blocks to pass the values through. Here's a minimal reproduction:

### Setup

```bash
mkdir ai-sdk-schema-test && cd ai-sdk-schema-test
npm init -y
npm install ai@6.0.116 @ai-sdk/google@3.0.52 zod@3.24.4
```

### Reproduce the bug

```typescript
// show-stripped-schema.ts
import { zodSchema } from "ai";
import { z } from "zod";

// This is what a typical structured output schema looks like
const schema = z.object({
  questions: z.array(
    z.object({
      prompt: z.string(),
      answer: z.boolean(),
    })
  ).length(10), // produces minItems: 10, maxItems: 10
});

// Convert to JSON Schema (what the AI SDK does internally)
const converted = zodSchema(schema);
console.log("Zod -> JSON Schema:");
console.log(JSON.stringify(converted.jsonSchema, null, 2));
// Shows: "minItems": 10, "maxItems": 10  <-- present here

// Now simulate what @ai-sdk/google does:
// (simplified version of convertJSONSchemaToOpenAPISchema)
function convertToOpenAPI(jsonSchema: Record<string, any>): Record<string, any> {
  const { type, properties, items, required, description } = jsonSchema;
  // ^ minItems and maxItems are NOT destructured, so they're dropped
  const result: Record<string, any> = {};
  if (type) result.type = type;
  if (description) result.description = description;
  if (required) result.required = required;
  if (properties) {
    result.properties = Object.fromEntries(
      Object.entries(properties).map(([k, v]) => [k, convertToOpenAPI(v as any)])
    );
  }
  if (items) result.items = convertToOpenAPI(items);
  return result;
}

const openapi = convertToOpenAPI(converted.jsonSchema as any);
console.log("\nAfter OpenAPI conversion (sent to Gemini):");
console.log(JSON.stringify(openapi, null, 2));
// minItems and maxItems are GONE
```

### The fix (in `@ai-sdk/google`)

```diff
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
-   minLength,
    enum: enumValues,
+   minLength,
+   maxLength,
+   minimum,
+   maximum,
+   minItems,
+   maxItems,
  } = jsonSchema;

  // ... existing passthrough for minLength ...

  if (minLength !== undefined) {
    result.minLength = minLength;
  }
+ if (maxLength !== undefined) {
+   result.maxLength = maxLength;
+ }
+ if (minimum !== undefined) {
+   result.minimum = minimum;
+ }
+ if (maximum !== undefined) {
+   result.maximum = maximum;
+ }
+ if (minItems !== undefined) {
+   result.minItems = minItems;
+ }
+ if (maxItems !== undefined) {
+   result.maxItems = maxItems;
+ }
```

PR: [vercel/ai#13721](https://github.com/vercel/ai/pull/13721)

### Workaround (until the PR ships)

Strip the constraints yourself before passing to `Output.object()`, keeping Zod validation for the response:

```typescript
import { generateText, jsonSchema, Output, zodSchema } from "ai";
import { z } from "zod";

function toGeminiSafeSchema<T>(zodType: z.ZodType<T>) {
  const converted = zodSchema(zodType);
  const cleaned = stripArrayConstraints(
    converted.jsonSchema as Record<string, unknown>
  );
  return jsonSchema<T>(cleaned, {
    validate: (value) => {
      const parsed = zodType.safeParse(value);
      if (parsed.success) return { success: true, value: parsed.data };
      return { success: false, error: parsed.error };
    },
  });
}

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
      result[key] = stripArrayConstraints(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// Usage:
const mySchema = z.object({
  questions: z.array(z.object({ text: z.string() })).length(10),
});

const result = await generateText({
  model: google("gemini-2.5-flash"),
  output: Output.object({
    schema: toGeminiSafeSchema(mySchema), // cleaned for Gemini
  }),
  prompt: "Generate exactly 10 questions about TypeScript.",
});
// Zod .length(10) still validates the response after generation
```

## What I Should Have Checked First

Read the `convertJSONSchemaToOpenAPISchema` source in `node_modules/@ai-sdk/google`. The whitelist destructuring pattern on line 30 immediately reveals which properties survive and which are dropped. A 10-second read of that function would have explained the entire issue.
