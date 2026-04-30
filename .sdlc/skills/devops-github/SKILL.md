---
name: devops-github
description: GitHub Actions expert — workflows, reusable workflows, composite actions, secrets, environments, OIDC, matrix builds, caching, artifacts, security hardening. Use when writing or modifying GitHub Actions workflows or composite actions.
---

# Skill: devops-github

## Role
You are the **GitHub Actions Expert**. You design and implement GitHub Actions workflows following GitHub's security and reliability best practices for enterprise CI/CD.

## Execution Checklist

### 1. Understand the Requirement
- Trigger: push / PR / schedule / workflow_dispatch / workflow_call?
- Reusable workflow or one-off? Should it be a composite action?
- Deployment target and what credentials are needed (OIDC preferred)?
- Required environments, protection rules, and reviewers?

### 2. Design
- Jobs: `lint → test → build → security → deploy → verify`
- Fail-fast: cheap checks before expensive ones
- Extract repeated logic to composite actions or reusable workflows
- Use environments with protection rules for staging and production

### 3. Implement
1. Set minimal `permissions:` at workflow and job level
2. Pin all actions to full commit SHA for security (see Security Hardening below)
3. Use OIDC for cloud authentication — no long-lived secrets
4. Set `concurrency:` to cancel stale PR runs
5. Cache dependencies to speed up runs
6. Upload artifacts for cross-job sharing

### 4. Verify Before Committing
- All action versions pinned to full commit SHA with version comment
- `GITHUB_TOKEN` permissions are minimal and explicitly set
- Secrets referenced as `${{ secrets.NAME }}` — never `env:` with hardcoded values
- No `pull_request_target` without careful untrusted-input handling

---

## Key Syntax Patterns

### Standard CI Workflow
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true             # cancel stale PR runs

permissions:
  contents: read                       # minimal — add only what's needed

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'                 # built-in dependency cache
      - run: npm ci
      - run: npm run lint
      - run: npm test -- --coverage
```

### OIDC Authentication (Azure)
```yaml
permissions:
  id-token: write                      # required for OIDC
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
          # No client secret — uses OIDC federation token
```

### Reusable Workflow (caller)
```yaml
jobs:
  deploy-staging:
    uses: ./.github/workflows/deploy.yml        # same repo
    with:
      environment: staging
      image-tag: ${{ needs.build.outputs.tag }}
    secrets: inherit                            # passes all caller secrets
```

### Reusable Workflow (definition)
```yaml
on:
  workflow_call:
    inputs:
      environment:
        required: true
        type: string
      image-tag:
        required: true
        type: string
    secrets:
      DEPLOY_TOKEN:
        required: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}      # links to GitHub Environment
    steps:
      - run: echo "Deploying ${{ inputs.image-tag }} to ${{ inputs.environment }}"
```

### Matrix Build
```yaml
jobs:
  test:
    strategy:
      fail-fast: false                          # don't cancel other matrix jobs on failure
      matrix:
        node: [18, 20, 22]
        os: [ubuntu-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
```

### Artifact Sharing Between Jobs
```yaml
jobs:
  build:
    steps:
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: dist-${{ github.sha }}
          path: dist/
          retention-days: 1

  deploy:
    needs: build
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: dist-${{ github.sha }}
          path: dist/
```

### Environment with Protection Rules
```yaml
jobs:
  deploy-prod:
    runs-on: ubuntu-latest
    environment:
      name: production                          # must exist in GitHub repo settings
      url: https://myapp.example.com
    steps:
      - run: ./deploy.sh
```

### Composite Action (`action.yml`)
```yaml
# .github/actions/setup-app/action.yml
name: Setup App
description: Install dependencies and configure environment
inputs:
  node-version:
    required: false
    default: '20'
runs:
  using: composite
  steps:
    - uses: actions/setup-node@v4
      with:
        node-version: ${{ inputs.node-version }}
        cache: npm
    - run: npm ci
      shell: bash
```

### Dependency Caching
```yaml
- uses: actions/cache@v4
  with:
    path: ~/.npm
    key: ${{ runner.os }}-npm-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-npm-
```

### Conditional Job
```yaml
jobs:
  deploy:
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    needs: [lint, test, build]
    runs-on: ubuntu-latest
```

---

## Security Hardening

### Action Pinning
```yaml
# Pin to full commit SHA with version comment — look up the real SHA on the action's releases page
- uses: actions/checkout@<full-sha>  # v4.2.2

# Use Dependabot (see below) to keep SHAs up to date automatically
```

### Minimal Permissions
```yaml
# Workflow level — deny everything by default
permissions: {}

# Job level — grant only what this job needs
jobs:
  publish:
    permissions:
      packages: write                  # push to GitHub Packages
      contents: read
```

### Protecting Against Script Injection
```yaml
# Dangerous — user-controlled input goes directly into shell
- run: echo "${{ github.event.pull_request.title }}"

# Safe — pass via environment variable
- run: echo "$PR_TITLE"
  env:
    PR_TITLE: ${{ github.event.pull_request.title }}
```

### `pull_request_target` Warning
Only use `pull_request_target` if you explicitly need write permissions from forks. It runs in the context of the base branch — untrusted fork code + write permissions = RCE risk. Prefer `pull_request` for most CI work.

---

## Standards

### Workflow Organization
```
.github/
  workflows/
    ci.yml              # PR checks — lint, test, build
    cd-staging.yml      # deploy to staging on merge to main
    cd-production.yml   # deploy to prod (manual trigger or tag)
    security.yml        # CodeQL, Dependabot, container scanning
  actions/
    setup-node/         # composite action for shared setup
      action.yml
```

### Triggers
- PRs: `pull_request` with `branches: [main]`
- Deployments: `push` to main or tag pattern `v*`
- Scheduled scans: `schedule` with cron
- Manual: `workflow_dispatch` with inputs for environment selection
- Reusable: `workflow_call` with typed inputs and secrets

### Secrets and Environments
- Long-lived cloud credentials: replace with OIDC federation
- Short-lived tokens (`GITHUB_TOKEN`): always set minimal permissions
- Environment secrets for staging/prod: scoped to specific GitHub Environments
- Repository secrets for shared non-sensitive config

### Runners
- GitHub-hosted (`ubuntu-latest`, `windows-latest`) for most workloads
- Self-hosted for: licensed tools, private network access, specific hardware
- Never put sensitive secrets in self-hosted runner environment variables

### Dependabot for Actions
```yaml
# .github/dependabot.yml
updates:
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
    groups:
      actions:
        patterns: ['*']
```

### What to Avoid
- `@main` or `@master` action refs — pin to commit SHA or at minimum a version tag
- `permissions: write-all` — enumerate what you actually need
- Printing secrets to logs (even `echo ${{ secrets.X }}` risks exposure)
- `continue-on-error: true` in security-critical jobs
- Storing build artifacts in the repo (use `upload-artifact`)
- Long retention on artifacts (default 90 days — set `retention-days` explicitly)
