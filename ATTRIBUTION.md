# Attribution

Parts of this package are adapted from third-party work. This file records what, from
where, and under which licence.

## mattpocock/skills

Source: <https://github.com/mattpocock/skills> — Copyright (c) 2026 Matt Pocock, MIT licence.

| Here | Derived from | Nature of the change |
|------|--------------|----------------------|
| `.sdlc/skills/grilling/` | `skills/productivity/grilling` | Adapted. The four rules are his — one question at a time, look facts up rather than asking, recommend an answer, do not act until confirmed. Rewritten for this package: depth-before-breadth stated explicitly, "explore the environment" widened to name git history, and a closing section on labelling unconfirmed conclusions as assumptions so the Clarify artifact can carry them. |
| `.sdlc/skills/sdlc/references/clarify.md` — the method | `skills/productivity/grilling` | The phase delegates to the vendored skill above rather than restating it. The completion criterion, the `Assumptions (unverified)` artifact section, and the `--auto-approve` rule are this package's. |
| `.sdlc/skills/architect/SKILL.md` — deep-module vocabulary, deletion test, dependency categories, design-it-twice, ADR three-part test | `skills/engineering/codebase-design` (incl. `DEEPENING.md`, `DESIGN-IT-TWICE.md`) and `skills/engineering/domain-modeling` (`ADR-FORMAT.md`) | Adapted, not copied. The vocabulary and heuristics are his; the dispatch-mode ladder, the round budget, the runtime model detection, and the wiring into this package's design phase are ours. |
| `.sdlc/skills/sdlc/references/research.md` — churn-first scoping | `skills/engineering/improve-codebase-architecture` | The "weight the parts that keep changing, scope before you scan" rule. |
| `.sdlc/skills/sdlc/references/design.md` — "Replace, Don't Layer" | `skills/engineering/codebase-design` (`DEEPENING.md`) | The rule that tests bound to a superseded shape are deleted rather than kept alongside the new ones. |

### MIT licence (mattpocock/skills)

```
MIT License

Copyright (c) 2026 Matt Pocock

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Other sources

- The smell vocabulary behind the `architect` skill's design guidance restates ideas from
  Martin Fowler, _Refactoring_ (2nd ed.) and John Ousterhout, _A Philosophy of Software
  Design_ (deep modules, design it twice). The concepts are theirs; the wording and the
  reviewer-facing rules are ours.
- The seam definition is Michael Feathers', _Working Effectively with Legacy Code_.
