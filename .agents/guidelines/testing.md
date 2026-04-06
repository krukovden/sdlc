# Testing Standards

## Test Pyramid

Follow the test pyramid strictly: **Unit > Integration > E2E**.

- **Unit tests** are the foundation. They should cover the majority of logic, run fast, and have no external dependencies.
- **Integration tests** verify that components work together correctly (e.g., service + repository, API + database).
- **E2E tests** cover critical user journeys only. They are expensive to maintain and slow to run -- use them sparingly.

## What to Test

- Test **edges and invariants**, not just happy paths. This includes:
  - Boundary values (empty inputs, maximum sizes, off-by-one scenarios)
  - Error conditions and failure modes
  - Concurrency and race conditions where applicable
  - Invalid or malformed inputs
- Every public API surface should have at least one test covering its contract.

## Non-Negotiables

- **Never write code before a spec/plan is approved.** Tests are part of the plan -- define expected behavior before implementation.
- **`enhanced-reviewer` runs before every commit.** Code that does not pass review cannot be committed.
- **Secrets never in source.** Test configurations must use environment variables or test-specific secret stores, never hardcoded values. Use Azure Key Vault or GitHub Secrets in CI/CD pipelines.
