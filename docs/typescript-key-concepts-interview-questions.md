# Senior TypeScript Key Concepts Interview Questions

This question bank is designed for Senior / strong-mid frontend engineer interview preparation. It focuses on TypeScript concepts that show up in real application work: API boundaries, schema validation, React UI state, safe data access, and maintainable domain modeling.

For broader intermediate TypeScript, Node.js, React, and Next.js prep, see [Intermediate TypeScript, Node.js, React, and Next.js Interview Questions](interview-question-bank.md).

The examples use simplified patterns from this repository's job extraction and CV analysis workflows. The snippets are intentionally small enough for interview discussion while preserving the main safety ideas used in the application.

## Navigation

- [1. Why prefer `unknown` over `any` at external boundaries?](#1-why-prefer-unknown-over-any-at-external-boundaries)
- [2. How do custom type guards narrow untrusted data?](#2-how-do-custom-type-guards-narrow-untrusted-data)
- [3. Why are discriminated unions useful for async API state?](#3-why-are-discriminated-unions-useful-for-async-api-state)
- [4. How does an exhaustive `never` check protect future changes?](#4-how-does-an-exhaustive-never-check-protect-future-changes)
- [5. How do generics with constraints improve reusable helpers?](#5-how-do-generics-with-constraints-improve-reusable-helpers)
- [6. How do `keyof` and indexed access types make lookups safer?](#6-how-do-keyof-and-indexed-access-types-make-lookups-safer)
- [7. When should mapped utility types be used?](#7-when-should-mapped-utility-types-be-used)
- [8. How do literal types and `as const` derive domain unions?](#8-how-do-literal-types-and-as-const-derive-domain-unions)
- [9. When is `satisfies` better than an annotation or assertion?](#9-when-is-satisfies-better-than-an-annotation-or-assertion)
- [10. Why does runtime validation still matter with TypeScript?](#10-why-does-runtime-validation-still-matter-with-typescript)
- [11. How do nullable and optional fields model different states?](#11-how-do-nullable-and-optional-fields-model-different-states)
- [12. How should React components avoid unsafe TypeScript casts?](#12-how-should-react-components-avoid-unsafe-typescript-casts)

## 1. Why prefer `unknown` over `any` at external boundaries?

**Question:** A route handler receives JSON from a browser request and JSON from an AI provider. Why should those values start as `unknown` instead of `any`?

**Expected answer:** `unknown` says the value exists but its shape has not been proven. TypeScript forces validation or narrowing before property access. `any` disables that protection and lets invalid data move through the system as if it were trusted. At API, file, URL, and model boundaries, `unknown` keeps the compiler aligned with runtime reality.

**Example:**

```ts
import { z } from "zod";

const extractRequestSchema = z.object({
  inputType: z.enum(["text", "url"]),
  content: z.string().trim().min(1),
});

export async function parseRequest(request: Request) {
  const body: unknown = await request.json();
  const parsed = extractRequestSchema.safeParse(body);

  if (!parsed.success) {
    throw new Error("Invalid request.");
  }

  return parsed.data;
}
```

**Key concepts:** `unknown` versus `any`, trust boundaries, runtime validation, type narrowing, unsafe assertions.

**Follow-ups:**

1. What bug could be hidden by `const body = await request.json() as ExtractRequest`?
2. When is `any` acceptable in a TypeScript codebase?
3. Why does `unknown` fit especially well with Zod's `safeParse`?

## 2. How do custom type guards narrow untrusted data?

**Question:** When would you use a custom type guard instead of a direct type assertion?

**Expected answer:** A custom type guard is useful when the code needs to inspect a value at runtime and communicate the narrowed type to TypeScript. Unlike `as SomeType`, a guard contains actual checks. It is helpful for small shape checks, library callbacks, and places where a full schema would be too heavy, though complex external data should still use a runtime schema.

**Example:**

```ts
type ApiErrorBody = {
  error: string;
  code: string;
};

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    "code" in value &&
    typeof value.error === "string" &&
    typeof value.code === "string"
  );
}

async function readError(response: Response) {
  const payload: unknown = await response.json().catch(() => null);

  if (isApiErrorBody(payload)) {
    return payload.error;
  }

  return "Request failed.";
}
```

**Key concepts:** type predicates, `in` narrowing, object checks, runtime evidence, assertion avoidance.

**Follow-ups:**

1. Why must the guard check `value !== null`?
2. What are the limits of this guard for nested objects?
3. When would a Zod schema be clearer than a hand-written guard?

## 3. Why are discriminated unions useful for async API state?

**Question:** How does a discriminated union improve UI state modeling for a request lifecycle?

**Expected answer:** A discriminated union makes valid states explicit and prevents impossible combinations, such as having both loading and data at the same time. Checking the discriminant narrows the rest of the object, so rendering code can safely access state-specific fields without optional chains or casts.

**Example:**

```tsx
import type { JobRequirements } from "@/lib/schema";

type ExtractState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; result: JobRequirements }
  | { status: "error"; message: string; code?: string };

function ResultPanel({ state }: { state: ExtractState }) {
  if (state.status === "loading") {
    return <p>Extracting requirements...</p>;
  }

  if (state.status === "error") {
    return <p>{state.message}</p>;
  }

  if (state.status === "success") {
    return <h2>{state.result.title}</h2>;
  }

  return null;
}
```

**Key concepts:** discriminated unions, impossible states, control-flow narrowing, UI state modeling, React props.

**Follow-ups:**

1. Why is this safer than `{ loading: boolean; data?: T; error?: string }`?
2. How would you represent a stale result while a refresh is loading?
3. What should happen if the API contract gains a new response state?

## 4. How does an exhaustive `never` check protect future changes?

**Question:** Why add a `never` check when switching over a union?

**Expected answer:** A `never` check turns future union changes into compile-time failures if a branch is not handled. This is useful for domain values like input types, guideline IDs, and API result states. It keeps TypeScript from silently accepting incomplete business logic after a new case is added.

**Example:**

```ts
type JobInput =
  | { inputType: "text"; content: string }
  | { inputType: "url"; content: string };

function resolveInputLabel(input: JobInput) {
  switch (input.inputType) {
    case "text":
      return "Pasted job description";
    case "url":
      return "Public job page";
    default: {
      const unreachable: never = input;
      return unreachable;
    }
  }
}
```

**Key concepts:** exhaustiveness, `never`, switch narrowing, future-proofing, domain unions.

**Follow-ups:**

1. What compiler error appears if `"file"` is added to `JobInput`?
2. Where should exhaustive checks be avoided because they add noise?
3. How does this relate to reducer action handling?

## 5. How do generics with constraints improve reusable helpers?

**Question:** Explain why a generic helper often needs a constraint instead of accepting any value.

**Expected answer:** Generics preserve specific input and output types, while constraints define the minimum shape the helper needs. Without a constraint, the implementation cannot safely access properties. With an overly broad return type, callers lose useful type information. A good generic helper is both reusable and honest about the operations it performs.

**Example:**

```ts
type WithId = {
  id: string;
};

function indexById<TItem extends WithId>(items: readonly TItem[]) {
  const byId: Record<string, TItem> = {};

  for (const item of items) {
    byId[item.id] = item;
  }

  return byId;
}

const guidelines = [
  { id: "skills", label: "Skills", selected: true },
  { id: "clarity", label: "Clarity", selected: false },
];

const guidelineById = indexById(guidelines);
guidelineById.skills?.selected;
```

**Key concepts:** generics, constraints, type preservation, reusable helpers, readonly arrays.

**Follow-ups:**

1. Why is `TItem extends WithId` better than accepting `WithId[]`?
2. What trade-off does `Record<string, TItem>` make?
3. How would you handle duplicate IDs?

## 6. How do `keyof` and indexed access types make lookups safer?

**Question:** How can `keyof` prevent unsafe property access in reusable rendering or formatting code?

**Expected answer:** `keyof` derives valid property names from a type, and indexed access types connect a key to the value type at that key. This prevents typos and avoids accepting arbitrary strings. It is useful for table columns, field formatters, filters, and summary displays.

**Example:**

```ts
type JobSummary = {
  title: string;
  company: string | null;
  requiredSkills: string[];
};

function getField<TObject, TKey extends keyof TObject>(
  object: TObject,
  key: TKey,
): TObject[TKey] {
  return object[key];
}

const job: JobSummary = {
  title: "Frontend Engineer",
  company: null,
  requiredSkills: ["React", "TypeScript"],
};

const title = getField(job, "title");
const skills = getField(job, "requiredSkills");
```

**Key concepts:** `keyof`, indexed access types, generic constraints, safe lookup, typo prevention.

**Follow-ups:**

1. What type is inferred for `title`?
2. Why would `getField(job, "salary")` fail?
3. How would you type a list of display columns for `JobSummary`?

## 7. When should mapped utility types be used?

**Question:** Compare `Record`, `Partial`, `Pick`, and `Omit` in application code. When can they help, and when can they hide domain meaning?

**Expected answer:** Utility types are good for deriving small, mechanical variations from existing types: complete maps, patch objects, public subsets, or internal-only omissions. They become risky when they replace named domain concepts or make invalid states too easy to represent. Senior TypeScript use means choosing between convenience and clarity.

**Example:**

```ts
type CvGuideline = "skills" | "experience" | "education";

type GuidelineLabelMap = Record<CvGuideline, string>;
type GuidelineSelection = Partial<Record<CvGuideline, boolean>>;

type ApiError = {
  error: string;
  code: string;
  retryAfterSeconds?: number;
  internalTraceId: string;
};

type PublicApiError = Omit<ApiError, "internalTraceId">;

const labels: GuidelineLabelMap = {
  skills: "Skills",
  experience: "Experience",
  education: "Education",
};
```

**Key concepts:** mapped types, utility types, exhaustive maps, partial updates, domain clarity.

**Follow-ups:**

1. How does `Partial<Record<CvGuideline, boolean>>` differ from `Record<CvGuideline, boolean>`?
2. Why might `Pick` be clearer than duplicating a public response type?
3. When should you create a named type instead of stacking utility types?

## 8. How do literal types and `as const` derive domain unions?

**Question:** Why derive a union from a constant list instead of writing the same values in multiple places?

**Expected answer:** A constant tuple can be used as a single source of truth for runtime iteration and compile-time types. `as const` prevents string literal widening and preserves the exact values. This reduces drift between UI options, validation schemas, and domain types.

**Example:**

```ts
export const inputTypes = ["text", "url"] as const;

export type InputType = (typeof inputTypes)[number];

const labels: Record<InputType, string> = {
  text: "Paste text",
  url: "Fetch from URL",
};

function isInputType(value: string): value is InputType {
  return inputTypes.includes(value as InputType);
}
```

**Key concepts:** literal types, `as const`, tuple indexing, union derivation, drift prevention.

**Follow-ups:**

1. What type would `inputTypes` have without `as const`?
2. Why does `(typeof inputTypes)[number]` produce a union?
3. What does the cast inside `includes` reveal about TypeScript's array typing?

## 9. When is `satisfies` better than an annotation or assertion?

**Question:** What problem does `satisfies` solve when defining configuration or lookup objects?

**Expected answer:** `satisfies` checks that a value conforms to a target type without widening the value as much as a direct annotation can. It also avoids the unsafety of an assertion. This is useful for configuration maps where you want completeness checking while preserving literal information for downstream inference.

**Example:**

```ts
type FieldConfig = {
  label: string;
  required: boolean;
};

const jobFieldConfig = {
  title: { label: "Title", required: true },
  company: { label: "Company", required: false },
  location: { label: "Location", required: false },
} satisfies Record<string, FieldConfig>;

type JobField = keyof typeof jobFieldConfig;

function getFieldLabel(field: JobField) {
  return jobFieldConfig[field].label;
}
```

**Key concepts:** `satisfies`, type annotations, type assertions, literal preservation, config typing.

**Follow-ups:**

1. How is `satisfies` different from `as Record<string, FieldConfig>`?
2. What literal information is preserved in `typeof jobFieldConfig`?
3. When would a direct annotation be simpler and sufficient?

## 10. Why does runtime validation still matter with TypeScript?

**Question:** If a project has strict TypeScript, why validate AI responses, route requests, and fetched page content at runtime?

**Expected answer:** TypeScript checks source code, not arbitrary data received at runtime. Browser requests, fetched HTML, uploaded files, and model responses can be malformed or malicious. Runtime schemas validate the shape before the value is trusted, while inferred TypeScript types help the rest of the code stay consistent after validation.

**Example:**

```ts
import { z } from "zod";

const jobRequirementsSchema = z.object({
  title: z.string().nullable(),
  requiredSkills: z.array(z.string()),
  responsibilities: z.array(z.string()),
}).strict();

type JobRequirements = z.infer<typeof jobRequirementsSchema>;

function parseModelOutput(value: unknown): JobRequirements {
  const parsed = jobRequirementsSchema.safeParse(value);

  if (!parsed.success) {
    throw new Error("Model returned an invalid shape.");
  }

  return parsed.data;
}
```

**Key concepts:** static types, runtime validation, Zod inference, strict schemas, untrusted data.

**Follow-ups:**

1. What does `.strict()` protect against?
2. Why should the provider schema and Zod schema stay synchronized?
3. Should client code also validate API responses?

## 11. How do nullable and optional fields model different states?

**Question:** Why is `salary: string | null` different from `salary?: string` in an API contract?

**Expected answer:** `null` means the field is intentionally present but the fact is unknown or absent. An optional property means the key itself may be omitted. Stable API contracts often prefer required keys with nullable scalar values because clients can rely on the response shape. Optional fields are better for genuinely optional metadata or backwards-compatible additions.

**Example:**

```ts
type JobRequirements = {
  title: string;
  company: string | null;
  salary: string | null;
  requiredSkills: string[];
};

function renderSalary(job: JobRequirements) {
  return job.salary ?? "Salary not listed";
}

type ErrorResponse = {
  error: string;
  code: string;
  retryAfterSeconds?: number;
};
```

**Key concepts:** nullability, optional properties, API stability, domain modeling, strict null checks.

**Follow-ups:**

1. Why are missing lists often represented as `[]` instead of `null`?
2. When is `undefined` a better model than `null`?
3. How does this choice affect frontend rendering code?

## 12. How should React components avoid unsafe TypeScript casts?

**Question:** How can React event and prop types be modeled so the component does not need unsafe casts?

**Expected answer:** React components should type props at the boundary and use event types or handler inference instead of casting DOM values into domain types. When the DOM only gives a string, the code should validate or narrow it before updating typed state. This keeps UI interactions aligned with the same domain types used by schemas and API contracts.

**Example:**

```tsx
const inputTypes = ["text", "url"] as const;
type InputType = (typeof inputTypes)[number];

function isInputType(value: string): value is InputType {
  return inputTypes.includes(value as InputType);
}

type InputTypeSelectorProps = {
  value: InputType;
  onChange: (value: InputType) => void;
};

function InputTypeSelector({ value, onChange }: InputTypeSelectorProps) {
  return (
    <select
      value={value}
      onChange={(event) => {
        const nextValue = event.currentTarget.value;

        if (isInputType(nextValue)) {
          onChange(nextValue);
        }
      }}
    >
      <option value="text">Text</option>
      <option value="url">URL</option>
    </select>
  );
}
```

**Key concepts:** React props, event typing, DOM string values, type guards, controlled inputs.

**Follow-ups:**

1. Why does `event.currentTarget.value` have type `string`?
2. What risk comes from `onChange(event.currentTarget.value as InputType)`?
3. How would radio buttons or segmented controls change the typing?

## Suggested Practice Approach

1. Explain the type-level idea first, then connect it to runtime behavior.
2. Identify the trust boundary in each example before discussing the code.
3. Say what TypeScript prevents and what it cannot prevent.
4. Rewrite unsafe casts into validation, narrowing, or schema parsing.
5. Practice extending each union or config object and describe what should fail at compile time.

## Related Project References

- [Intermediate Interview Question Bank](interview-question-bank.md)
- [Developer Guide](DEVELOPER_GUIDE.md)
- [`lib/schema.ts`](../lib/schema.ts)
- [`lib/gemini.ts`](../lib/gemini.ts)
- [`lib/url-content.ts`](../lib/url-content.ts)
- [`app/api/extract/route.ts`](../app/api/extract/route.ts)
- [`components/extractor.tsx`](../components/extractor.tsx)
