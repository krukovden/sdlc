---
name: grilling
description: Relentless interview that walks a decision tree one question at a time until there is shared understanding. Use when a plan, scope, or design decision is still fuzzy — the Clarify phase runs on this, and any phase can invoke it when a decision needs pinning down.
---

# Skill: grilling

Interview the user relentlessly about every aspect of this until you reach a shared understanding. Walk down each branch of the decision tree, resolving dependencies between decisions one by one.

## The four rules

1. **One question at a time.** Wait for the answer before asking the next. Asking several at once is bewildering, and it hides which answer drove which decision.

2. **Recommend an answer with every question.** Never ask a bare question. State the option you'd pick and why, so the user can accept it in a word — and so your assumption is on the table where they can correct it. Prefer multiple choice over open prose.

3. **Look facts up; ask only for decisions.** If something is discoverable in the environment — a file, a dependency version, a config value, an existing convention, git history — go find it. Spend the user's attention only on choices that are genuinely theirs. A question the repository already answers is a question you should not have asked.

4. **Depth before breadth.** A topic is not covered because you asked about it once. Follow each branch until the decisions underneath it are settled, then move to the next branch. Answers reshape the tree: a scope decision can make three later questions irrelevant, or create five new ones. Recompute as you go.

## Finishing

Do not act on any of it until the user confirms you have reached shared understanding.

When you stop, every decision you record must trace to something the user actually said. Anything you concluded on your own is an **assumption**, not a decision — label it as such and show it, so the user can see what you filled in for them.
