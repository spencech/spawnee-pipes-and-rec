# Task Template Specification

Task templates are the input format for the Agentic Dev Pipeline. They define what work needs to be done, where, and how to validate it.

Templates are YAML files stored in `templates/`.

---

## Schema

### Required Fields

```yaml
# Task type determines planning heuristics and default validation strategies
type: feature | bugfix | refactor

# Target repository and branch
target:
  repo: "https://github.com/org/repo.git"    # Repository URL (HTTPS or SSH)
  branch: "main"                               # Base branch to fork from

# What needs to change and why
description: |
  A clear, specific description of the work to be done.
  Include context about why this change is needed.
  Reference specific modules, files, or behaviors when possible.

# Concrete, testable conditions for success
# Each criterion should be independently verifiable
acceptance_criteria:
  - "The /api/users endpoint returns paginated results with a `next` cursor"
  - "Existing unit tests pass without modification"
  - "New endpoint has at least 80% test coverage"
```

### Optional Fields

```yaml
# Unique identifier for tracking (auto-generated if omitted)
id: "PD-1234"

# Priority: 0=critical, 1=high, 2=medium (default), 3=low, 4=backlog
priority: 2

# Maximum QA validation cycles before escalating to human review
# Default: 3
max_qa_cycles: 3

# Validation strategy — which quality gates to run and in what order
# See validation-gates.md for gate type details
# Default: ["typecheck", "unit"] for refactors, ["typecheck", "unit", "e2e"] for features/bugfixes
validation_strategy:
  - gate: typecheck
    command: "npx tsc --noEmit"
  - gate: unit
    command: "npx jest --ci"
    pattern: "**/*.spec.ts"
  - gate: e2e
    command: "npx cypress run"
    specs:
      - "cypress/e2e/users.cy.ts"
      - "cypress/e2e/pagination.cy.ts"
  - gate: lint
    command: "npx eslint src/"
  - gate: manual
    description: "Review the API contract changes before merging"

# Constraints that limit agent behavior
constraints:
  - "Do not modify the database schema"
  - "Maintain backward compatibility with v2 API clients"
  - "Do not introduce new npm dependencies without justification"

# Files or directories the agent should focus on (narrows ChunkHound search scope)
scope:
  - "src/api/users/"
  - "src/models/user.ts"
  - "tests/api/"

# Additional context files the agent should read before planning
context_files:
  - "docs/api-design.md"
  - "CHANGELOG.md"
```

### EMS-Specific Extensions

When targeting EMS repositories, these additional fields are available:

```yaml
# EMS deployment target
ems:
  stage: "dev"                    # dev | staging | prod
  profile: "ems-dev"             # AWS profile name
  target_type: "angular"          # angular | lambda | shared-lib
  # Angular-specific
  app_name: "admin-portal"       # Angular application name
  # Lambda-specific
  function_name: "api-handler"   # Lambda function name
```

---

## Examples

### Feature Template

```yaml
type: feature
id: "PD-456"
priority: 1

target:
  repo: "https://github.com/ems/admin-portal.git"
  branch: "develop"

description: |
  Add a bulk user import feature to the admin portal.
  Users should be able to upload a CSV file with user records,
  preview the import, and confirm. The backend should validate
  each row and return a detailed error report for invalid entries.

acceptance_criteria:
  - "CSV upload component accepts .csv files up to 10MB"
  - "Preview table shows first 10 rows with validation status per row"
  - "Confirm button triggers POST /api/users/bulk-import"
  - "Backend returns { imported: number, errors: { row: number, field: string, message: string }[] }"
  - "Invalid rows do not prevent valid rows from importing"
  - "E2E test covers: upload, preview, confirm, and error display flows"

validation_strategy:
  - gate: typecheck
    command: "npx tsc --noEmit"
  - gate: unit
    command: "npx karma start --single-run"
  - gate: e2e
    command: "npx cypress run"
    specs:
      - "cypress/e2e/bulk-import.cy.ts"

constraints:
  - "Use the existing FileUploadComponent from ems-web-app-utils"
  - "Follow the AbstractRoute pattern for the new Lambda endpoint"

scope:
  - "src/app/admin/users/"
  - "lambda/routes/users/"

ems:
  stage: "dev"
  profile: "ems-dev"
  target_type: "angular"
```

### Bugfix Template

```yaml
type: bugfix
id: "BUG-789"
priority: 0

target:
  repo: "https://github.com/ems/api-service.git"
  branch: "main"

description: |
  The /api/reports/generate endpoint times out for organizations
  with more than 500 users. The SQL query in ReportRoute.get()
  is doing a full table scan instead of using the org_id index.

acceptance_criteria:
  - "Report generation completes in under 5 seconds for orgs with 1000+ users"
  - "SQL query uses the org_id index (verified via EXPLAIN)"
  - "Existing report output format is unchanged"
  - "Unit test covers the optimized query path"

validation_strategy:
  - gate: typecheck
    command: "npx tsc --noEmit"
  - gate: unit
    command: "npx jasmine --filter='ReportRoute'"

scope:
  - "src/routes/report.mts"
  - "src/queries/reports.mts"
```

### Refactor Template

```yaml
type: refactor
id: "TECH-101"
priority: 3

target:
  repo: "https://github.com/ems/shared-utils.git"
  branch: "main"

description: |
  Migrate the configuration module from callback-based async
  to async/await. The current Configuration.load() uses nested
  callbacks for SSM and Secrets Manager calls.

acceptance_criteria:
  - "Configuration.load() is async/await with no callback nesting"
  - "All existing callers still work without modification"
  - "Error handling preserves the same trace() logging behavior"
  - "No functional changes — only structural refactor"

validation_strategy:
  - gate: typecheck
    command: "npx tsc --noEmit"
  - gate: unit
    command: "npx jasmine"

constraints:
  - "Do not change the public API surface of Configuration"
  - "Do not modify files outside src/config/"
```

---

## Template Validation Rules

1. `type` must be one of: `feature`, `bugfix`, `refactor`
2. `target.repo` must be a valid git URL (HTTPS or SSH)
3. `target.branch` must exist in the remote repository
4. `acceptance_criteria` must have at least one entry
5. `validation_strategy` gates must be one of: `typecheck`, `unit`, `e2e`, `lint`, `manual`
6. `max_qa_cycles` must be a positive integer (1-10)
7. `priority` must be 0-4
8. `constraints` entries should be negative constraints (what NOT to do), not implementation instructions
