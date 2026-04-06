# Error Handling and Resilience

## Error Handling

- **Explicit at every boundary** -- Handle errors at service boundaries, API boundaries, and integration points. Never let errors propagate silently through layers.
- **Typed errors** -- Use typed/structured error objects rather than raw strings or generic exceptions. Each error should carry enough context (error code, message, origin) to be actionable.
- **Never swallow silently** -- Every caught error must be either handled meaningfully or re-thrown. Empty catch blocks are forbidden.
- **Log with correlation IDs** -- Attach a correlation ID to every request and propagate it through all log entries. This enables end-to-end tracing across services and layers.

## Scalability

- **Stateless by default** -- Services must not rely on in-memory state between requests. Store state externally (database, cache, queue).
- **Async/non-blocking for I/O** -- All I/O operations (database calls, HTTP requests, file access) must be asynchronous. Never block a thread waiting for I/O.
- **No in-process caches across instances** -- Do not use in-memory caches that cannot be shared across service instances. Use distributed caching (e.g., Redis) when caching is needed.
