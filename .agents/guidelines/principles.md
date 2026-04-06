# Design Principles

These principles apply to ALL code written in this system, without exception.

## SOLID

- **Single Responsibility** -- Every class, module, or function should have exactly one reason to change. If a component handles both data fetching and UI rendering logic, split them.
- **Open/Closed** -- Software entities should be open for extension but closed for modification. Use abstractions (interfaces, base classes) so new behavior can be added without altering existing code.
- **Liskov Substitution** -- Subtypes must be substitutable for their base types without breaking the program. If a derived class overrides behavior in a way that violates the base contract, the design is wrong.
- **Interface Segregation** -- Clients should not be forced to depend on interfaces they do not use. Prefer many small, focused interfaces over one large general-purpose interface.
- **Dependency Inversion** -- High-level modules must not depend on low-level modules; both should depend on abstractions. Inject dependencies rather than constructing them internally.

## KISS

- Choose the simplest solution that works correctly.
- Use readable, descriptive names for variables, functions, and classes.
- Prefer explicit code over implicit behavior -- clarity wins over cleverness.

## YAGNI

- Build only what is required right now. Do not add speculative features or abstractions "for the future."
- Remove dead code immediately. Unused code is a maintenance burden and a source of confusion.

## DRY

- Extract shared logic only when there are 3 or more real duplications. Two occurrences may be coincidental.
- Duplication is better than the wrong abstraction. If extracting shared code forces unnatural coupling or complexity, keep the duplication.
