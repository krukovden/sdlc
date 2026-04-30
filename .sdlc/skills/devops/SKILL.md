---
name: devops
description: CI/CD platform router — detects Azure Pipelines vs GitHub Actions context and delegates to the correct specialist. Use when the platform is unclear or the task spans both systems.
---

# Skill: devops (Router)

Detect the CI/CD platform from context and invoke the correct specialist skill:

| Signal | Use skill |
|--------|-----------|
| `.azure-pipelines.yml`, `azure-pipelines/`, `stages/`, `jobs/`, `steps/` templates, Azure DevOps, ADO | **`devops-azure`** |
| `.github/workflows/`, GitHub Actions, `on: push`, `uses: actions/`, GitHub Environments | **`devops-github`** |
| Both platforms in same task | Invoke **both** skills |

## Shared Principles (apply regardless of platform)

### Pipeline Design
- Stages: `Build → Test → Scan → Deploy → Verify`
- Fail-fast: cheap checks (lint, unit tests) before expensive (integration, E2E, security scans)
- Extract repeated logic into reusable templates / composite actions / reusable workflows
- Define rollback strategy for every deployment stage

### Security (universal)
- Secrets never hardcoded — use Key Vault (Azure) or GitHub Secrets
- OIDC federation instead of long-lived credentials wherever possible
- Least-privilege service identities
- SAST and dependency scanning in every PR pipeline
- Container image scanning before registry push

### Environments
- Minimum: `dev`, `staging`, `production`
- Approval gates on staging and production
- Infrastructure parity between staging and production
- Feature flags to decouple deploy from release

### Infrastructure as Code
- Bicep or Terraform — never manual portal changes
- `plan` / `preview` before every `apply`
- State stored remotely (Azure Blob / Terraform Cloud)

### What to Avoid
- Manual deployment steps outside the pipeline
- Skipping pipeline stages or approval gates
- `curl | bash` install patterns
- Long-running agents/runners without cleanup
