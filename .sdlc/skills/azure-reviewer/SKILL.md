---
name: azure-reviewer
description: Review Azure DevOps pull requests via az CLI — fetch PR diff, analyze code, present issues, and post approved comments back to the PR. Use when the user asks to review an Azure DevOps PR, mentions a PR ID/URL, or wants to post review comments to Azure DevOps.
---

# Skill: azure-reviewer

## Role
You review Azure DevOps pull requests by fetching the diff via `az` CLI, analyzing the code against team standards, and posting user-approved comments back to the PR.

## Prerequisites
- `az login` completed (check with `az account show`)
- Azure DevOps extension installed (`az extension add --name azure-devops`)
- Default org/project configured or passed explicitly

## Windows / Git Bash Compatibility

**CRITICAL — apply these rules to ALL `az devops invoke` commands:**

1. **Always prefix** with `MSYS_NO_PATHCONV=1` — Git Bash on Windows converts `/paths` to `C:/Program Files/Git/paths`
2. **Always add** `"includeContent=true"` to query-parameters when fetching file content
3. **Use commit SHA** (from `lastMergeSourceCommit.commitId`) instead of branch name — branches may be deleted
4. **Use Windows paths** for temp files: `$USERPROFILE/pr-comment.json`, NOT `/tmp/pr-comment.json`
5. **Use `--api-version 7.1`** and `--resource pullRequestThreads` when posting comments

## Severity Levels

Every observation gets exactly one tag:

| Tag | Meaning | Blocks merge? | Criteria |
|-----|---------|---------------|----------|
| **[B] Blocking** | Must fix before merge | Yes | Bugs, security issues, data loss risk, broken functionality |
| **[S] Suggest** | Should fix, won't block | No | Better approaches, missing edge cases, maintainability |
| **[N] Nit** | Optional improvement | No | Style preferences, minor naming, formatting |
| **[P] Praise** | Good work worth calling out | No | Clever solutions, thorough testing, clean abstractions |

**Rules:**
- Formatting and naming are almost never Blocking — reserve [B] for bugs, security, and data integrity
- Include at least one [P] per review — only pointing out problems is demoralizing
- Don't comment on code that wasn't changed in this PR — file a separate issue instead

## Workflow

### Step 1: Fetch PR context + iterations (PARALLEL)

Run these two commands in parallel to save time:

```bash
# Command A: PR metadata
az repos pr show --id <PR_ID> --output json

# Command B: Iterations (needs REPO_ID from command A — if unknown, run sequentially)
MSYS_NO_PATHCONV=1 az devops invoke \
  --area git --resource pullRequestIterations \
  --route-parameters project=<PROJECT> repositoryId=<REPO_ID> pullRequestId=<PR_ID> \
  --output json
```

Extract from PR metadata: title, description, source branch, target branch, repository ID, author, **source commit SHA** (`lastMergeSourceCommit.commitId`).

Read the PR description to understand **what** and **why** before looking at code. Assess PR size:

| Size | Files | Lines | Approach |
|------|-------|-------|----------|
| Small | 1–5 | <100 | Read every line |
| Medium | 5–15 | 100–500 | Focus on logic changes, skim config |
| Large | 15–30 | 500–1000 | Review by commit, focus on critical files, flag if should be split |
| XL | 30+ | 1000+ | Flag for splitting. Review only highest-risk files |

### Step 2: Fetch changed files

```bash
MSYS_NO_PATHCONV=1 az devops invoke \
  --area git --resource pullRequestIterationChanges \
  --route-parameters project=<PROJECT> repositoryId=<REPO_ID> pullRequestId=<PR_ID> iterationId=<ITER_ID> \
  --output json
```

### Step 3: Auto-detect skills from file paths

Before fetching content, scan the changed file paths and activate relevant skills:

| File path pattern | Skill to load |
|-------------------|---------------|
| `frontend/**`, `*.component.ts`, `*.html`, `*.scss` | `frontend-angular` |
| `backend/**`, `*.controller.ts`, `*.service.ts`, `*.repository.ts` | `backend-node` |
| `**/*.cs`, `**/Azure.Functions/**` | `backend-csharp` |
| `**/*.yml`, `**/pipelines/**`, `stages/`, `jobs/`, `steps/` | `pipeline-template` |
| `**/*fortify*` | `fortify-sast` |
| `.github/workflows/**` | `devops-github` |

Always load: `enhanced-reviewer` (review gate).

Read the skill files from `.claude/skills/SKILL.<name>.md` — do NOT use the Skill tool (it won't find them).

### Step 4: Fetch file content (ALL IN PARALLEL)

**Fetch ALL changed files in a single parallel batch.** Skip binary files (`.zip`, `.exe`, `.dll`, `.png`, `.jpg`, etc.).

Use the **source commit SHA** (not branch name) to avoid failures on deleted branches:

```bash
MSYS_NO_PATHCONV=1 az devops invoke \
  --area git --resource items \
  --route-parameters project=<PROJECT> repositoryId=<REPO_ID> \
  --query-parameters "path=<FILE_PATH>" "versionDescriptor.version=<COMMIT_SHA>" "versionDescriptor.versionType=commit" "includeContent=true" \
  --output json
```

**For edited files (not new):** also fetch base versions in the same parallel batch using the target commit SHA (`lastMergeTargetCommit.commitId`) or `versionDescriptor.version=main versionDescriptor.versionType=branch`.

### Step 5: Analyze

Review the overall design first — understand the forest before examining trees. Then evaluate each file using the loaded skills:

- **Correctness** — Does the code do what the PR description says? Edge cases handled?
- **Error handling** — Explicit at boundaries? Typed errors? Nothing swallowed silently?
- **Security** — Input validation, secrets, injection, auth checks
- **Architecture** — Layer violations, responsibility placement, dependency direction
- **SOLID / KISS / YAGNI / DRY** — principles from `enhanced-reviewer`
- **Stack-specific** — Apply checks from the auto-detected skills loaded in Step 3
- **Tests** — Do tests cover the changes? Are edge cases and error paths tested?

### Step 6: Present review to user

The findings table MUST include a **Comment** column with simple English explanation (for non-native speakers). This comment text is what gets posted to the PR.

```
## PR Review: #<PR_ID> — <title>
**Author:** <author>  **Branch:** <source> → <target>
**Size:** <Small/Medium/Large/XL> (<N> files, ~<N> lines)
**Skills:** <list of auto-detected skills used>

### Summary
<One sentence confirming what the PR accomplishes>

### Findings
| # | Tag | File | Line | Issue | Suggested Fix | Comment |
|---|-----|------|------|-------|---------------|---------|
| 1 | [B] | auth.ts | 42 | No input validation | Add Zod schema | There is no check on user input. Bad data can break the system. Please add validation. |
| 2 | [S] | api.ts  | 15 | Unparameterized query | Use parameterized query | The query is built with string concatenation. This can cause SQL injection. Please use parameters. |
| 3 | [N] | utils.ts | 8 | Unused import | Remove import | This import is not used anywhere. Please remove it to keep the code clean. |
| 4 | [P] | auth.service.ts | 30 | Clean error hierarchy | — | Good job on the error handling. Clean and easy to follow. |

### Verdict
<APPROVE / REQUEST CHANGES / COMMENT>
- Approve only if zero [B] items
- Request Changes if any [B] items remain

### Passed Checks
- No hardcoded secrets ✓
- Layered architecture respected ✓
- Tests cover happy + error paths ✓

Which findings should I post as PR comments? (e.g., "1,2" or "all" or "none")
```

**STOP — wait for user to select which comments to post.**

### Step 7: Post approved comments

Write comment JSON files using Windows-compatible paths, then post using `pullRequestThreads` resource with `--api-version 7.1`.

**Comment format: NO severity tags.** Use only the plain title + simple English comment:

```bash
# Write comment file (use $USERPROFILE for Windows compatibility)
cat > "$USERPROFILE/pr-comment.json" << 'JSONEOF'
{
  "comments": [
    {
      "content": "**<plain issue title>**\n\n<simple English comment from Comment column>",
      "commentType": 1
    }
  ],
  "status": 1,
  "threadContext": {
    "filePath": "/<file-path>",
    "rightFileStart": { "line": <line>, "offset": 1 },
    "rightFileEnd": { "line": <line>, "offset": 1 }
  }
}
JSONEOF

# Post comment
MSYS_NO_PATHCONV=1 az devops invoke \
  --area git --resource pullRequestThreads \
  --route-parameters project=<PROJECT> repositoryId=<REPO_ID> pullRequestId=<PR_ID> \
  --http-method POST \
  --in-file "$USERPROFILE/pr-comment.json" \
  --api-version 7.1 \
  --output json
```

**Post ALL approved comments in parallel** — write all JSON files first, then send all POST requests in a single parallel batch.

Thread status values: `1` = active, `2` = fixed, `4` = wontfix, `0` = unknown.

### Step 8: Report and cleanup

```
## Comments Posted
| # | Tag | File | Line | Status |
|---|-----|------|------|--------|
| 1 | [B] | auth.ts | 42 | Posted |
| 2 | [S] | api.ts | 15 | Posted |

PR URL: <link>
```

Clean up temp JSON files from `$USERPROFILE` after posting.

## Pitfalls to Avoid

- **Rubber-stamping** — approving without reading the diff. Every approval is an assertion of quality
- **Nit avalanche** — drowning the author in style preferences. Save nits for mentoring; skip in time-sensitive reviews
- **Missing the forest** — reviewing line-by-line without understanding overall design
- **Blocking on style** — formatting and naming are almost never [B]. Reserve Blocking for bugs, security, data integrity
- **No praise** — always include at least one [P]. Good code deserves recognition
- **Scope creep** — commenting on unchanged code. If pre-existing issues bother you, file a separate issue
- **Sequential API calls** — always batch file fetches in parallel. Never fetch one file at a time.

## Validation Checklist

Before presenting the review, confirm:
- [ ] PR context understood (purpose, size, CI status)
- [ ] Relevant skills auto-detected and loaded from file paths
- [ ] All changed files reviewed (or highest-risk files for XL PRs)
- [ ] Feedback classified by severity ([B]/[S]/[N]/[P])
- [ ] Blocking items have specific fix suggestions
- [ ] At least one [P] Praise included
- [ ] Comment column has simple English for every finding
- [ ] Verdict matches findings (approve only if zero [B])
- [ ] No comments on unchanged code

## Error Handling
- If `az account show` fails → tell user to run `az login`
- If PR not found → check org/project config: `az devops configure --list`
- If 403 on comment post → user may lack "Contribute to pull requests" permission
- If branch not found → use source commit SHA instead of branch name
- If `--in-file` fails → ensure using Windows path (`$USERPROFILE`), not `/tmp/`
- If `--resource threads` fails → use `--resource pullRequestThreads --api-version 7.1`
