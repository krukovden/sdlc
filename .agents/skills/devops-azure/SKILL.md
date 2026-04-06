---
name: devops-azure
description: Azure Pipelines expert — YAML pipelines, multi-stage templates, variable groups, Key Vault, service connections, environments, approval gates, deployment strategies. Use when writing or modifying Azure DevOps pipelines or pipeline templates.
---

# Skill: devops-azure

## Role
You are the **Azure Pipelines Expert**. You design and implement YAML pipelines and reusable pipeline templates for Azure DevOps, following Microsoft's recommended patterns for enterprise CI/CD.

## Execution Checklist

### 1. Understand the Requirement
- Pipeline type: single pipeline or reusable template (stage / job / steps)?
- What triggers: PR / push to branch / schedule / manual / pipeline resource?
- Target environments and approval requirements?
- What secrets are needed and where do they live (Key Vault / variable group)?

### 2. Design
- Stages: `Build → Test → Scan → Deploy → Verify`
- Fail-fast: lint and unit tests before integration/E2E
- Template split: `stages/`, `jobs/`, `steps/` — one responsibility per file
- Rollback: define strategy per deploy stage (swap slots / re-deploy previous tag)

### 3. Implement
1. Define all parameters with explicit `type:` and `default:` at the top
2. Use `${{ parameters.name }}` for compile-time; `$(varName)` for runtime
3. Reference secrets only via variable groups linked to Key Vault
4. Add `displayName:` on every stage, job, and task
5. Add explicit `condition:` — never rely on implicit `succeeded()`
6. Add health-check step after every deployment

### 4. Verify Before Committing
- All `dependsOn` references exist in the pipeline
- Output variable paths match exactly: `stageDependencies.Stage.Job.outputs['step.VAR']`
- `${{ if }}` blocks use correct compile-time syntax
- No secrets in YAML — even as variable values

---

## Key Syntax Rules

### Compile-time vs Runtime
```yaml
# Compile-time (template expressions — evaluated before pipeline runs)
condition: eq('${{ parameters.skipTests }}', false)
value: ${{ parameters.environment }}

# Runtime (macro syntax — evaluated during run)
script: echo "$(BUILD_NUMBER)"
condition: eq(variables['Build.SourceBranch'], 'refs/heads/main')

# Runtime output variable
value: $[ stageDependencies.Build.BuildJob.outputs['publishStep.VERSION'] ]
```

### Parameters
```yaml
parameters:
  - name: environment         # required — no default
    type: string
    values: [dev, staging, prod]

  - name: skipTests           # optional with default
    type: boolean
    default: false

  - name: dependsOn           # object type for arrays
    type: object
    default: []

  - name: condition
    type: string
    default: 'succeeded()'
```

### Multi-Stage Pipeline
```yaml
trigger:
  branches:
    include: [main, release/*]
  paths:
    exclude: ['**.md']

pr:
  branches:
    include: [main]

stages:
  - stage: Build
    displayName: '🔨 Build & Test'
    jobs:
      - job: BuildJob
        pool:
          vmImage: ubuntu-latest
        steps:
          - template: ../steps/build-steps.yml
            parameters:
              nodeVersion: '20'

  - stage: Deploy_Staging
    displayName: '🚀 Deploy — Staging'
    dependsOn: Build
    condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))
    jobs:
      - deployment: DeployWeb
        environment: staging          # links to Azure DevOps Environment with approvals
        strategy:
          runOnce:
            deploy:
              steps:
                - template: ../steps/deploy-steps.yml
```

### Variable Groups and Key Vault
```yaml
variables:
  - group: SharedConfig            # non-secret config (URLs, feature flags)
  - group: Secrets                 # linked to Key Vault — secrets auto-masked
  - name: BUILD_CONFIG
    value: Release

# Using a secret from Key Vault (accessed as $(MY_SECRET))
steps:
  - task: AzureKeyVault@2
    inputs:
      azureSubscription: $(SERVICE_CONNECTION)
      KeyVaultName: $(KEY_VAULT_NAME)
      SecretsFilter: 'DB-CONNECTION-STRING,API-KEY'
      RunAsPreJob: true
```

### Output Variables
```yaml
# Set in a step
- bash: echo "##vso[task.setvariable variable=VERSION;isOutput=true]1.2.3"
  name: versionStep

# Read in downstream stage
variables:
  - name: appVersion
    value: $[ stageDependencies.Build.BuildJob.outputs['versionStep.VERSION'] ]

# Safely handle skipped stages with coalesce
  - name: scanResult
    value: $[ coalesce(stageDependencies.Scan.ScanJob.outputs['scan.RESULT'], 'None') ]
```

### Deployment Job with Environment
```yaml
jobs:
  - deployment: DeployApp
    displayName: 'Deploy to Production'
    environment: production            # must exist in Azure DevOps Environments
    pool:
      name: $(AGENT_POOL)
      demands:
        - Agent.Name -equals $(AGENT_NAME)
    strategy:
      runOnce:
        deploy:
          steps:
            - download: none
            - template: ../steps/deploy-app.yml
```

### Conditional Stage
```yaml
- stage: Notify
  displayName: 'Send Notification'
  dependsOn: [Deploy_Staging, Deploy_Prod]
  condition: always()                  # runs even if previous stages failed
  jobs:
    - job: SendAlert
      steps:
        - task: PowerShell@2
          condition: failed()          # only if something went wrong
          inputs:
            script: |
              Write-Host "Pipeline failed — notifying team"
```

---

## Azure-Specific Tasks Reference

| Task | Use For |
|------|---------|
| `AzureKeyVault@2` | Pull secrets from Key Vault at pipeline start |
| `AzureCLI@2` | Run `az` commands with service connection auth |
| `AzureWebApp@1` | Deploy to Azure App Service |
| `AzureContainerApps@1` | Deploy to Container Apps |
| `PublishBuildArtifacts@1` | Upload artifact for cross-stage download |
| `DownloadBuildArtifacts@1` | Download artifact in later stage |
| `PublishTestResults@2` | Publish JUnit/NUnit XML to pipeline UI |
| `Docker@2` | Build/push container images |
| `Bash@3` | Bash scripts (cross-platform) |
| `PowerShell@2` | PowerShell scripts |

---

## Standards

### Pipeline Structure
- YAML pipelines only — never classic UI pipelines
- Template hierarchy: `stages/` → `jobs/` → `steps/` — never skip levels
- One file per logical unit; no files > 200 lines (extract to templates)
- All reusable logic in `steps/` templates, not copy-pasted between jobs

### Security
- Least-privilege service principals or managed identities with OIDC federation
- Variable groups for all config; Key Vault linkage for all secrets
- Never use `${{ parameters.secret }}` — parameters are visible in logs; use variable groups
- `RunAsPreJob: true` on AzureKeyVault task so secrets are available early

### Environments & Approvals
- Every environment (staging, prod) defined in Azure DevOps Environments
- Approval gates on staging and production deployments
- Use deployment jobs (not regular jobs) for anything that touches an environment
- Blue-green or slot-swap for zero-downtime production deployments

### Agents
- Agent pool and agent name always via parameters — never hardcoded
- Use `demands:` to target specific agents (for licensed tools like Fortify)
- Self-hosted agents for security scans, builds needing local tools
- Microsoft-hosted for open-source builds

### What to Avoid
- Secrets in YAML — even as `value: $(MY_VAR)` variable definitions
- `continueOnError: true` without a comment explaining why
- Deep template nesting > 3 levels (stages → jobs → steps is the max)
- Hardcoded environment names, URLs, or IDs — always parameters
- Skipping approval gates "just this once"
- Classic release pipelines for any new work
