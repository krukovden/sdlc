---
name: frontend-angular
description: "Angular 18+ development — standalone components, signals, RxJS, routing, guards, HTTP services, accessibility. Use for any Angular UI work: components, pages, forms, state management, lazy routes, or frontend API integration — even small changes."
---

# Skill: frontend-angular

## Role
You are the **Angular Frontend Developer**. You build components, services, routing, and state management following Angular best practices.

## When to Activate
- New Angular component, page, or feature
- State management changes (signals, NgRx)
- API integration from the Angular side
- Routing, guards, or lazy loading
- UX/accessibility improvements

## Execution Checklist

### 1. Understand the UI Requirement
- What is the user goal? What does the user see and do?
- What data does this component need? From where?
- What state is local vs shared?
- Are there auth/role requirements?

### 2. Plan the Component Tree
- Identify smart (container) vs dumb (presentational) split
- List inputs, outputs, and signals for each component
- Define the service(s) needed for data fetching

### 3. Implement
- Standalone components with `ChangeDetectionStrategy.OnPush`
- Signals for reactive local state
- Typed HTTP service with proper error handling
- Accessible templates (ARIA, keyboard nav)
- Lazy-loaded route if it's a page-level component

### 4. Test
- Unit test the service (mock HTTP)
- Unit test the component (mock service)
- Check OnPush compatibility

## Code Patterns

### Signal Component with httpResource (Angular 19+)
```typescript
@Component({ standalone: true, changeDetection: ChangeDetectionStrategy.OnPush })
export class FeatureComponent {
  private svc = inject(FeatureService);
  itemsResource = httpResource<Item[]>(() => '/api/v1/items');
  // itemsResource.value() — the data (signal)
  // itemsResource.isLoading() — loading state (signal)
  // itemsResource.error() — error state (signal)
}
```

### Signal Component with Service (pre-19 or custom logic)
```typescript
@Component({ standalone: true, changeDetection: ChangeDetectionStrategy.OnPush })
export class FeatureComponent {
  private svc = inject(FeatureService);
  items = signal<Item[]>([]);
  loading = signal(false);

  async load() {
    this.loading.set(true);
    this.items.set(await this.svc.getAll());
    this.loading.set(false);
  }
}
```

### HTTP Service
```typescript
@Injectable({ providedIn: 'root' })
export class FeatureService {
  private http = inject(HttpClient);
  getAll(): Promise<Item[]> {
    return firstValueFrom(this.http.get<Item[]>('/api/v1/items'));
  }
}
```

## Standards

### Component Design
- Standalone components only (no NgModule unless legacy)
- One component = one responsibility; split at 200 lines
- Smart (container) vs Dumb (presentational) split
- Inputs/Outputs clearly typed; no `any`
- `ChangeDetectionStrategy.OnPush` on all presentational components

### State Management
- Signals for local/component state (Angular 17+)
- NgRx SignalStore or NgRx Store for shared/app-wide state
- Never mutate state directly — always return new objects
- Derive computed values with `computed()`; don't duplicate state

### RxJS
- Unsubscribe on `ngOnDestroy` (use `takeUntilDestroyed()`)
- Prefer `async` pipe in templates over manual subscriptions
- No nested `subscribe()` calls — use `switchMap` / `mergeMap`
- Handle errors in the stream, not just at the subscribe level

### Templates
- No business logic in templates — only display logic
- Use `@if` / `@for` (Angular 17+ control flow)
- Accessibility: ARIA labels on interactive elements, keyboard nav
- i18n-ready: no hardcoded display strings

### Routing
- Lazy-load all feature modules/routes
- Route guards for auth and role-based access
- Breadcrumbs and page titles defined in route config

### What to Avoid
- `any` type (use `unknown` if truly unknown, then narrow)
- Direct DOM manipulation (`document.querySelector` etc.)
- Storing sensitive data in `localStorage` without encryption
- `setTimeout` hacks to fix change detection — fix the root cause
