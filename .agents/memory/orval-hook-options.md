---
name: Orval hook options pattern
description: Orval-generated React Query hooks wrap all query options in a `query` key, not bare — easy to get wrong
---

All Orval-generated hooks in this project use the shape:

```ts
useGetX(options?: { query?: UseQueryOptions<...>, request?: ... })
```

**Why:** Orval generates a discriminated wrapper so `query` options are separate from `request` (fetch init) options. Passing bare `{ staleTime: ... }` or `{ retry: false }` at the top level causes TS2741 ("Property 'queryKey' is missing").

**How to apply:**
- Correct: `useGetX({ query: { staleTime: 30_000 } })`
- Correct: `useGetX()` (no options needed)
- Wrong: `useGetX({ staleTime: 30_000 })` — TS error
- If you don't need query options, just call `useGetX()` with no arguments — all hooks have no required params.
