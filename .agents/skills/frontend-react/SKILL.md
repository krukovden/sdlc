---
name: frontend-react
description: "React/Next.js development — Vercel best practices, performance optimization, Server Components, data fetching, bundle size, re-render prevention. Use for any React or Next.js work: components, pages, data fetching, routing, or frontend API integration."
---

# Skill: frontend-react

## Role
You are the **React/Next.js Frontend Developer**. You build components, pages, data fetching, and state management following Vercel's React best practices with a focus on performance.

## When to Activate
- New React component, page, or feature
- Next.js pages, layouts, or API routes
- Data fetching (client-side or server-side)
- Bundle size or performance optimization
- Refactoring existing React/Next.js code

## Execution Checklist

### 1. Understand the UI Requirement
- What is the user goal? What does the user see and do?
- What data does this component need? Client or server fetch?
- What state is local vs shared?
- Can this be a Server Component (default) or does it need client interactivity?

### 2. Plan the Component Tree
- Server Components by default — only add `'use client'` when needed (event handlers, hooks, browser APIs)
- Identify data fetching boundaries — fetch in Server Components, pass to Client Components as props
- Define Suspense boundaries for streaming

### 3. Implement
- Follow the performance rules below by priority (Critical → Low)
- Minimize client bundle — keep `'use client'` boundary as low as possible
- Type everything with TypeScript strict mode

### 4. Test
- Unit test components with React Testing Library
- Test data fetching with MSW or similar
- Verify Server vs Client Component boundaries are correct

## Performance Rules by Priority

### CRITICAL: Eliminating Waterfalls
- **Check cheap sync conditions before awaiting** — don't await a flag check if a local variable answers the question
- **Move `await` into branches** — only await in the branch that actually uses the result
- **`Promise.all()` for independent operations** — never await sequentially when operations are independent
- **Start promises early, await late** in API routes — begin the fetch at the top, await when you need the result
- **Use `<Suspense>` boundaries** to stream content progressively instead of blocking on the slowest fetch

### CRITICAL: Bundle Size
- **Import directly, avoid barrel files** — `import { Button } from './Button'` not `import { Button } from './components'`
- **`next/dynamic` for heavy components** — charts, editors, syntax highlighters loaded on demand
- **Defer third-party scripts** — load analytics, logging, chat widgets after hydration
- **Conditional module loading** — load modules only when the feature is activated
- **Preload on hover/focus** — trigger preload for perceived speed on likely interactions

### HIGH: Server-Side Performance
- **Authenticate server actions** like API routes — never trust the client
- **`React.cache()`** for per-request deduplication — same data fetched in layout and page won't hit DB twice
- **LRU cache** for cross-request caching — cache expensive computations across requests
- **Avoid duplicate serialization** in RSC props — don't pass the same large object to multiple Client Components
- **Hoist static I/O** (fonts, logos) to module level — don't re-read static files per request
- **No shared module-level mutable state** in RSC/SSR — module state is shared across requests
- **Minimize data to client** — serialize only what the Client Component needs, not the full query result
- **Parallelize fetches** — restructure components so sibling fetches run concurrently
- **Use `after()`** for non-blocking operations — logging, analytics, cache warming after response

### MEDIUM-HIGH: Client-Side Data Fetching
- **SWR for request deduplication** — multiple components requesting the same data hit the network once
- **Deduplicate global event listeners** — one resize/scroll listener, not one per component
- **Passive event listeners** for scroll — `{ passive: true }` prevents scroll jank
- **Version localStorage schemas** — migrate data on schema change, minimize stored data

### MEDIUM: Re-render Prevention
- **Don't subscribe to state only used in callbacks** — if a value is only read in an onClick, use a ref
- **Extract expensive work into memoized components** — `React.memo()` for components with heavy render
- **Hoist default non-primitive props** — define `const DEFAULT_OPTIONS = {}` outside the component
- **Use primitive dependencies** in effects — `effect(() => {}, [user.id])` not `[user]`
- **Subscribe to derived booleans, not raw values** — `const isAdmin = role === 'admin'` as separate selector
- **Derive state during render, not in effects** — `const fullName = first + ' ' + last` not `useEffect` + `useState`
- **Functional `setState`** for stable callbacks — `setCount(c => c + 1)` keeps callback identity stable
- **Lazy state initialization** — `useState(() => expensiveCompute())` not `useState(expensiveCompute())`
- **Don't `useMemo` simple primitives** — `a + b` is cheaper than memo overhead
- **Split hooks with independent dependencies** — two small effects beat one effect with a union of deps
- **Use `startTransition`** for non-urgent updates — keep the UI responsive during expensive state changes
- **`useDeferredValue`** for expensive renders — defer search results while keeping input responsive
- **Refs for transient frequent values** — mouse position, scroll offset → ref, not state
- **Never define components inside components** — causes full remount on every render

### MEDIUM: Rendering Performance
- **`content-visibility: auto`** for long lists — browser skips rendering off-screen items
- **Extract static JSX outside components** — `const HEADER = <h1>Title</h1>` at module level
- **Reduce SVG coordinate precision** — 2 decimal places, not 15
- **Use ternary `? :` not `&&` for conditionals** — `&&` can render `0` or `""` as text nodes
- **Prefer `useTransition`** over `useState` for loading states
- **Use React DOM resource hints** — `<link rel="preload">` via React APIs for critical resources

### LOW-MEDIUM: JavaScript Performance
- **Group CSS changes** via classes or `cssText` — one reflow, not many
- **Build `Map` for repeated lookups** — O(1) vs O(n) array search
- **Cache object properties in loops** — `const len = arr.length` outside the loop
- **`Set`/`Map` for lookups** — `set.has(x)` over `array.includes(x)` for large collections
- **`flatMap` to map and filter in one pass** — avoids intermediate array allocation
- **Early return from functions** — check preconditions first, avoid deep nesting

## Code Patterns

### Server Component (default)
```tsx
// app/users/page.tsx — no 'use client', this is a Server Component
import { UserList } from './UserList';

export default async function UsersPage() {
  const users = await db.user.findMany();
  return <UserList users={users} />;
}
```

### Client Component (minimal boundary)
```tsx
'use client';
import { useState, startTransition } from 'react';

export function SearchFilter({ onFilter }: { onFilter: (q: string) => void }) {
  const [query, setQuery] = useState('');

  function handleChange(value: string) {
    setQuery(value);
    startTransition(() => onFilter(value));
  }

  return <input value={query} onChange={e => handleChange(e.target.value)} />;
}
```

### Parallel Data Fetching
```tsx
// Good — parallel
const [users, posts] = await Promise.all([
  getUsers(),
  getPosts(),
]);

// Bad — sequential waterfall
const users = await getUsers();
const posts = await getPosts();
```

### Dynamic Import for Heavy Components
```tsx
import dynamic from 'next/dynamic';

const Chart = dynamic(() => import('./Chart'), {
  loading: () => <ChartSkeleton />,
  ssr: false,
});
```

### SWR for Client Data Fetching
```tsx
'use client';
import useSWR from 'swr';

export function UserProfile({ userId }: { userId: string }) {
  const { data, error, isLoading } = useSWR(`/api/users/${userId}`, fetcher);
  if (isLoading) return <Skeleton />;
  if (error) return <ErrorMessage error={error} />;
  return <ProfileCard user={data} />;
}
```

## Standards

### Component Design
- Server Components by default — `'use client'` only for interactivity
- One component = one responsibility; split at 200 lines
- TypeScript strict mode — no `any`
- Props explicitly typed with interfaces
- Collocate styles, tests, and types with their component

### State Management
- Local state: `useState` / `useReducer`
- Server state: SWR or React Query (not Redux for remote data)
- Global client state: Context + `useReducer` or Zustand (only when truly needed)
- Derive state during render — don't sync with effects

### Data Fetching
- Server Components fetch on the server — no client waterfall
- `React.cache()` for per-request deduplication
- SWR/React Query for client-side with stale-while-revalidate
- Never fetch in `useEffect` if a Server Component can do it

### What to Avoid
- `any` type — use `unknown` and narrow
- Fetching data in `useEffect` when Server Components are available
- Barrel file re-exports (`index.ts` that re-exports everything)
- `document.querySelector` or direct DOM manipulation
- Module-level mutable state in Server Components
- Nested `await` chains — use `Promise.all` for independent work
- `&&` for conditional rendering (use ternary)
- Defining components inside other components
