---
name: pipeline-template
description: Azure Pipelines reusable template authoring for this repo — stages/jobs/steps templates, parameters, conditions, dependsOn chains, output variables. Use when writing or modifying any .yml template file in stages/, jobs/, or steps/ directories.
---

# Skill: pipeline-template

## Role
You are the **Azure Pipelines Template Author**. You write and maintain reusable YAML pipeline templates for Azure DevOps following the conventions of this repo.

## Repo Structure
```
stages/    → stage-level templates (include jobs via template reference)
jobs/      → job-level templates (include steps via template reference)
steps/     → step-level templates (atomic reusable steps)
assets/    → shared static files
```

## Execution Checklist

### 1. Understand the Requirement
- Is this a `stages/`, `jobs/`, or `steps/` template?
- What parameters are required vs optional (with defaults)?
- What upstream outputs or variable groups does it depend on?
- What conditions guard its execution?

### 2. Design the Template
- Keep templates at ONE level only — stages templates reference job templates, job templates reference step templates; never skip levels
- List all parameters with types and defaults before writing YAML
- Identify any output variables that downstream stages need
- Identify secrets — always via variable group + Key Vault, never inline

### 3. Implement
1. Define all `parameters:` at the top with explicit `type:` and `default:`
2. Use `${{ parameters.name }}` for compile-time substitution
3. Use `$(variableName)` for runtime variable references
4. Reference child templates with relative paths (e.g., `../steps/step-name.yml`)
5. Add `displayName:` to every job, step, and stage
6. Add `condition:` expressions explicitly — never rely on implicit `succeeded()`

### 4. Validate Before Committing
- Every `${{ if }}` block must have matching `${{ else }}` or be clearly intentional
- Every `dependsOn:` job/stage must exist in the same pipeline
- Every output variable reference (`stageDependencies.X.Y.outputs['step.var']`) must match exact names
- Secrets accessed from variable groups must use `$(SECRET_NAME)` syntax, never hardcoded

## Parameter Patterns

### Required parameter (no default)
```yaml
parameters:
  - name: APP_NAME
    type: string
  - name: AGENT_POOL
    type: string
```

### Optional parameter with default
```yaml
parameters:
  - name: condition
    type: string
    default: 'succeeded()'
  - name: dependsOn
    type: object
    default: []
```

### Boolean flag
```yaml
parameters:
  - name: skipScan
    type: boolean
    default: false
```

## Condition Patterns

```yaml
# Skip based on boolean parameter
condition: eq('${{ parameters.skipScan }}', false)

# Wait for upstream + check output variable
condition: |
  and(
    succeeded('PreviousStage'),
    ne(dependencies.PreviousStage.outputs['job.step.varName'], 'true')
  )

# Always run (e.g., notifications)
condition: always()
```

## Output Variable Patterns

```yaml
# Setting an output variable in a step
- task: Bash@3
  name: myStep
  inputs:
    script: echo "##vso[task.setvariable variable=MY_VAR;isOutput=true]someValue"

# Reading output in a downstream stage
variables:
  - name: myValue
    value: $[ stageDependencies.StageName.JobName.outputs['stepName.MY_VAR'] ]
```

## Secret Handling

```yaml
# Correct — reference from variable group linked to Key Vault
variables:
  - group: Secrets

steps:
  - script: echo "$(MY_SECRET)"  # runtime, masked in logs

# Wrong — never do this
variables:
  - name: MY_SECRET
    value: "actual-secret-value"
```

## Template Reference Patterns

```yaml
# From a stage template referencing a job template
jobs:
  - template: ../jobs/job-name.yml
    parameters:
      APP_NAME: '${{ parameters.APP_NAME }}'
      condition: ${{ parameters.condition }}

# From a job template referencing a step template
steps:
  - template: ../steps/step-name.yml
    parameters:
      someParam: '${{ parameters.someParam }}'
```

## Standards

### Naming
- Stage IDs: `SCREAMING_SNAKE_CASE` (e.g., `SAST_BACK`, `ANALYZE_AND_REPORT`)
- Job IDs: `PascalCase` (e.g., `Fortify_SAST`)
- Step `name:` (for output vars): `camelCase` (e.g., `skipPipelineVar`)
- `displayName:` on every stage, job, and task — human readable with emoji for scanability

### Template Parameters
- Always use `type:` — never rely on implicit string type
- Always provide `default:` for optional parameters
- Never use `${{ parameters.secret }}` — pass secrets via variable groups only

### Conditions
- Explicit conditions on every stage and job
- Use `coalesce()` for output variable defaults: `$[ coalesce(dep.outputs['x'], 'None') ]`
- Use `${{ if }}` for compile-time skipping; use `condition:` for runtime skipping

### What to Avoid
- Hardcoded agent pool names — always a parameter
- Inline secrets or connection strings
- Deep template nesting (>3 levels: stage → job → step is the max)
- `continueOnError: true` without an explicit comment explaining why
- Skipping `displayName:` — it makes pipeline run logs unreadable
