# spawnee

Spawn and orchestrate Cursor Cloud Agents from task templates with dependency resolution, parallel execution, automatic retries, and an optional full pipeline with QA validation gates and artifact generation.

## Installation

```bash
npm install -g spawnee
```

## Quick Start

```bash
# Initialize a config file
spawnee init

# Edit .spawneerc.json with your API key

# Validate a template
spawnee validate my-tasks.yaml

# Dry run (preview without spawning agents)
spawnee run my-tasks.yaml --dry-run

# Execute the template
spawnee run my-tasks.yaml

# Execute with validation gates and artifact generation (full pipeline)
spawnee run my-tasks.yaml --validate --artifact --repo-dir /path/to/repo
```

## Configuration

spawnee supports three configuration methods with the following priority (highest to lowest):

1. **CLI flags** - Override everything
2. **Environment variables** - Override config file and defaults
3. **Config file** (`.spawneerc.json`) - Override defaults
4. **Built-in defaults**

### Configuration Options

| Option | CLI Flag | Environment Variable | Config Key | Default |
|--------|----------|---------------------|------------|---------|
| API Key | `--api-key, -k` | `SPAWNEE_API_KEY` | `apiKey` | (required) |
| API Base URL | `--api-url` | `SPAWNEE_API_URL` | `apiBaseUrl` | `https://api.cursor.com` |
| Max Concurrent | `--concurrency, -c` | `SPAWNEE_CONCURRENCY` | `maxConcurrent` | `10` |
| Poll Interval | `--poll-interval` | `SPAWNEE_POLL_INTERVAL` | `pollInterval` | `15000` (ms) |
| Default Timeout | `--timeout, -t` | `SPAWNEE_TIMEOUT` | `defaultTimeout` | `3600000` (ms) |
| State File | `--state-file` | `SPAWNEE_STATE_FILE` | `stateFile` | `.spawnee-state.json` |
| Config File | `--config` | `SPAWNEE_CONFIG` | - | `.spawneerc.json` |
| Verbose | `--verbose, -v` | `SPAWNEE_VERBOSE` | `verbose` | `false` |

### Config File

Create a `.spawneerc.json` file in your project root:

```json
{
  "apiKey": "your-cursor-api-key",
  "apiBaseUrl": "https://api.cursor.com",
  "maxConcurrent": 10,
  "pollInterval": 15000,
  "defaultTimeout": 3600000,
  "stateFile": ".spawnee-state.json",
  "verbose": false
}
```

Or generate one with:

```bash
spawnee init
```

### Environment Variables

```bash
export SPAWNEE_API_KEY="your-cursor-api-key"
export SPAWNEE_CONCURRENCY=5
export SPAWNEE_TIMEOUT=7200000
export SPAWNEE_VERBOSE=true
```

### CLI Flags

```bash
spawnee run my-tasks.yaml \
  --api-key "your-key" \
  --concurrency 5 \
  --timeout 7200000 \
  --poll-interval 10000 \
  --state-file ".my-state.json" \
  --verbose
```

## Commands

### `spawnee run <template>`

Execute a task template. By default runs Phase 3 (agent orchestration) only. Add `--validate` and `--artifact` to enable the full pipeline.

```bash
spawnee run my-tasks.yaml [options]
```

**Options:**
- `-k, --api-key <key>` - Cursor API key
- `--api-url <url>` - API base URL
- `-c, --concurrency <n>` - Max concurrent agents
- `-t, --timeout <ms>` - Default task timeout
- `--poll-interval <ms>` - Status poll interval
- `--state-file <path>` - State file for persistence
- `-d, --dry-run` - Preview task graph without spawning agents
- `--no-persist` - Disable state persistence
- `--update-source` - Update source YAML with task status for resume capability
- `--validate` - Run validation gates after execution (Phase 4)
- `--artifact` - Generate artifacts after validation (Phase 5: PR, test report, beads audit trail)
- `--repo-dir <path>` - Path to checked-out target repo for validation gates (default: cwd)
- `-v, --verbose` - Enable verbose output

### `spawnee validate <template>`

Validate a task template without running it.

```bash
spawnee validate my-tasks.yaml
```

### `spawnee validate-pipeline <template>`

Validate that a template has all required fields for the full pipeline (type, target, acceptance_criteria, validation_strategy).

```bash
spawnee validate-pipeline my-pipeline-template.yaml
```

### `spawnee validate-gates <template>`

Run validation gates against an existing checkout without executing agents. Useful for testing gate configuration or re-running QA checks.

```bash
spawnee validate-gates my-tasks.yaml --repo-dir /path/to/repo
```

**Options:**
- `--repo-dir <path>` - Path to checked-out target repo (default: cwd)

### `spawnee status`

Check status of running agents.

```bash
spawnee status [options]
```

**Options:**
- `-k, --api-key <key>` - Cursor API key
- `--api-url <url>` - API base URL

### `spawnee cancel <agent-id>`

Cancel a running agent.

```bash
spawnee cancel abc123def456
```

### `spawnee models`

List available models from the Cursor API.

```bash
spawnee models [options]
```

**Options:**
- `-k, --api-key <key>` - Cursor API key
- `--api-url <url>` - API base URL

### `spawnee init`

Create a `.spawneerc.json` config file.

```bash
spawnee init          # Create config file
spawnee init --force  # Overwrite existing
```

### `spawnee config`

Show the resolved configuration (useful for debugging).

```bash
spawnee config
```

## Pipeline Overview

spawnee can run as a simple task orchestrator or as a full agentic pipeline with QA validation and artifact generation.

### Simple Orchestration (default)

```bash
spawnee run template.yaml
```

Dispatches tasks to Cursor Cloud Agents with dependency resolution, parallel execution, retries, and state persistence. No validation or artifact generation.

### Full Pipeline (`--validate --artifact`)

```bash
spawnee run template.yaml --validate --artifact --repo-dir /path/to/repo
```

Runs the complete pipeline loop:

```
Task Execution (Phase 3) → QA Validation (Phase 4) → Artifact Output (Phase 5)
                                    ↑                        |
                                    └──── Fail (retry) ──────┘
```

1. **Phase 3: Execution** — Spawns agents, resolves dependencies, runs tasks in parallel
2. **Phase 4: Validation** — Runs configurable quality gates (typecheck, unit tests, e2e tests, lint). Failures are mapped to beads issues automatically.
3. **Phase 5: Artifacts** — Merges task branches, creates a PR with structured summary, generates a test report and beads audit trail

If validation gates fail, the pipeline creates beads issues for each failure and re-enters execution. This QA retry loop repeats until all gates pass or `max_qa_cycles` is reached.

### Validation Gates

Define gates in your template's `validation_strategy`:

```yaml
validation_strategy:
  - gate: typecheck
    command: "npx tsc --noEmit"
  - gate: unit
    command: "npx karma start --single-run"
  - gate: e2e
    command: "npx cypress run"
    specs:
      - "cypress/e2e/my-feature.cy.ts"
  - gate: lint
    command: "npx eslint src/"
  - gate: manual
    description: "Review API contract changes before merging"
```

**Gate types:**

| Gate | Purpose | Output Parsing |
|------|---------|----------------|
| `typecheck` | TypeScript compilation check | Extracts file, line, column, error message |
| `unit` | Unit test runner | Extracts failed test names and assertion messages |
| `e2e` | Cypress E2E tests | Extracts spec file, test name, failure reason |
| `lint` | Linter | Extracts file, line, rule name, message |
| `manual` | Human review checkpoint | Pauses for manual approval |

All automated gates run sequentially. Failures are parsed into structured results and (when beads is available) automatically filed as bug issues.

### Artifact Output

When `--artifact` is set, the pipeline produces:

- **Pull Request** — Created on the feature branch with a structured body: summary of changes, acceptance criteria status, test results, and QA cycle history
- **Test Report** — Markdown summary of all gate results across QA cycles
- **Beads Audit Trail** — Full issue lifecycle from planning through execution and QA

## Task Templates

Templates can be JSON or YAML. A template can be a simple task list (for orchestration-only mode) or a full pipeline definition.

### Simple Template

```yaml
name: "My Task Plan"
repository:
  url: "https://github.com/your-org/your-repo"
  branch: "main"
  baseBranch: "develop"

defaults:
  model: "auto"
  timeout: 3600000
  retries: 2

context:
  instructions: |
    You are implementing features for a Node.js application.
    Follow existing code patterns and conventions.
  files:
    - "README.md"
    - "package.json"

tasks:
  - id: "setup"
    name: "Project Setup"
    priority: 100
    branch: "feature/setup"
    prompt: |
      Initialize the project structure:
      1. Create necessary directories
      2. Set up configuration files

  - id: "feature-a"
    name: "Feature A"
    dependsOn: ["setup"]
    priority: 80
    branch: "feature/a"
    prompt: |
      Implement Feature A with tests.
    files:
      - "src/features/"

  - id: "integration"
    name: "Integration"
    dependsOn: ["feature-a"]
    priority: 60
    branch: "feature/integration"
    prompt: |
      Integrate features and add integration tests.
    validation:
      command: "npm test"
      successPattern: "passed"
```

### Pipeline Template

Pipeline templates include additional fields for QA validation and artifact generation:

```yaml
name: "PD-456: Bulk User Import"
type: feature
id: "PD-456"
priority: 1

target:
  repo: "https://github.com/org/repo.git"
  branch: "develop"

description: |
  Add a bulk user import feature to the admin portal.

acceptance_criteria:
  - "CSV upload component accepts .csv files up to 10MB"
  - "Backend returns structured error report for invalid entries"
  - "E2E test covers upload, preview, confirm, and error flows"

max_qa_cycles: 3

validation_strategy:
  - gate: typecheck
    command: "npx tsc --noEmit"
  - gate: unit
    command: "npx karma start --single-run"
  - gate: e2e
    command: "npx cypress run"
    specs:
      - "cypress/e2e/bulk-import.cy.ts"
  - gate: manual
    description: "Review the API contract changes before merging"

constraints:
  - "Use the existing FileUploadComponent"
  - "Follow the AbstractRoute pattern"

scope:
  - "src/app/admin/users/"
  - "lambda/routes/users/"

defaults:
  model: "composer-1"
  timeout: 3600000
  retries: 2

tasks:
  - id: "setup-branch"
    name: "Create feature branch and scaffold"
    branch: "cursor/spawnee/PD-456-setup"
    prompt: |
      Create the feature branch and scaffold the component structure.

  - id: "implement-upload"
    name: "Implement CSV upload and preview"
    branch: "cursor/spawnee/PD-456-upload"
    dependsOn: ["setup-branch"]
    prompt: |
      Implement the CSV upload component and preview table.

  - id: "implement-backend"
    name: "Implement bulk import API endpoint"
    branch: "cursor/spawnee/PD-456-backend"
    dependsOn: ["setup-branch"]
    prompt: |
      Implement the POST /api/users/bulk-import endpoint.

  - id: "integration"
    name: "Integration and E2E tests"
    branch: "cursor/spawnee/PD-456-integration"
    dependsOn: ["implement-upload", "implement-backend"]
    prompt: |
      Connect the frontend upload to the backend API.
      Write E2E tests covering the full flow.
```

### Template Schema

**Core fields:**
- `name` (required) - Template name
- `repository.url` (required) - GitHub repository URL
- `tasks` (required) - Array of tasks

**Pipeline fields (for `--validate`/`--artifact`):**
- `type` - Task type: `feature`, `bugfix`, `refactor`
- `id` - External ticket ID (e.g., `PD-456`)
- `target` - `{ repo, branch }` for the target repository
- `description` - What needs to change and why
- `acceptance_criteria` - Array of testable conditions for success
- `validation_strategy` - Array of gate configurations (see [Validation Gates](#validation-gates))
- `max_qa_cycles` - Max QA retry loops before escalating (default: 3)
- `constraints` - Implementation constraints for agents
- `scope` - File/directory scope hints
- `context_files` - Additional files to include in agent context

**Task fields:**
- `id` (required) - Unique task identifier
- `name` (required) - Human-readable name
- `prompt` (required) - Instructions for the agent
- `dependsOn` - Array of task IDs this task depends on
- `priority` - Higher runs first (default: 0)
- `branch` - Git branch for the task
- `files` - Files to include in context
- `timeout` - Task-specific timeout (ms)
- `retries` - Max retry attempts
- `complete` - Mark as already complete (skip)
- `status` - Task status for resume: `pending`, `started`, `completed`, `failed`
- `model` - Override default model for this task
- `repository` - Override plan-level repository: `{ url, branch }`
- `breakpoint` - Pause for human review when task completes
- `validation.command` - Command to verify completion
- `validation.successPattern` - Expected output pattern

## Features

- **Dependency Resolution** - Tasks run in correct order based on `dependsOn`
- **Parallel Execution** - Independent tasks run concurrently (up to `maxConcurrent`)
- **Automatic Retries** - Failed tasks retry with configurable attempts
- **State Persistence** - Resume interrupted runs from where they left off
- **Validation Gates** - Configurable quality gates: typecheck, unit, e2e, lint, manual review
- **QA Retry Loop** - Failed gates generate issues and re-enter execution automatically
- **Artifact Generation** - PR creation, test reports, and beads audit trails on completion
- **Beads Integration** - Gate failures automatically mapped to beads issues via `bd create`
- **Dry Run** - Preview task graph without spawning agents
- **Breakpoints** - Pause for human review at critical tasks
- **Multi-Repository** - Tasks can target different repositories
- **Task-Level Overrides** - Override model, repository, timeout per task

## Best Practices

### Same-Repository Dependencies

When tasks depend on each other in the **same repository**, include instructions in your prompts for agents to pull dependent branches:

```yaml
tasks:
  - id: "base-feature"
    name: "Base Feature"
    branch: "feature/base"
    prompt: |
      Implement the base authentication system.

  - id: "extended-feature"
    name: "Extended Feature"
    dependsOn: ["base-feature"]
    branch: "feature/extended"
    prompt: |
      Extend the authentication with OAuth support.

      **Before starting:** Pull changes from the `feature/base` branch to get the base authentication code.
```

spawnee automatically adds dependency context to prompts, including branch names and PR links. For same-repo dependencies, it instructs agents to pull dependent branches.

### Cross-Repository Dependencies

Tasks can depend on work in different repositories. spawnee will:
- Track dependencies correctly
- Include reference to the other repo's PR in the prompt
- **Not** prompt agents to pull from other repos (since they're separate repositories)

```yaml
tasks:
  - id: "api-update"
    name: "Update API"
    repository:
      url: "https://github.com/org/backend"
    prompt: "Add new endpoint for user profiles"

  - id: "frontend-integration"
    name: "Frontend Integration"
    dependsOn: ["api-update"]
    repository:
      url: "https://github.com/org/frontend"
    prompt: |
      Integrate with the new user profile API endpoint.
      Refer to the backend PR for API documentation.
```

### Bottleneck Tasks Pattern

Use "bottleneck" tasks to integrate parallel work and enable human review:

```yaml
tasks:
  # Wave 1: Parallel independent tasks
  - id: "feature-a"
    name: "Feature A"
    prompt: "Implement feature A"

  - id: "feature-b"
    name: "Feature B"
    prompt: "Implement feature B"

  - id: "feature-c"
    name: "Feature C"
    prompt: "Implement feature C"

  # Bottleneck: Integrates all Wave 1 work
  - id: "integration"
    name: "Integration & Review"
    dependsOn: ["feature-a", "feature-b", "feature-c"]
    breakpoint: true  # Pause for human review
    prompt: |
      Integrate all features from the dependent tasks:
      1. Pull all feature branches
      2. Resolve any conflicts
      3. Ensure all tests pass
      4. Create unified documentation
```

When `integration` completes, spawnee will pause and prompt you to review before continuing to any tasks that depend on it.

For multi-repo projects, create separate bottleneck tasks for each repository.

### Parallel Execution Guidelines

Tasks run in parallel when:
- They have no dependencies on each other
- Concurrency limit hasn't been reached

Design your task graph for maximum parallelism when tasks don't conflict:

```yaml
# Good: Independent features run in parallel
tasks:
  - id: "docs"
    prompt: "Write documentation"
  - id: "tests"
    prompt: "Add test coverage"
  - id: "ci"
    prompt: "Set up CI pipeline"
```

### Task Granularity

A single agent can perform multiple related tasks. Consider grouping related work:

```yaml
# Instead of many tiny tasks:
tasks:
  - id: "auth-complete"
    name: "Complete Auth System"
    prompt: |
      Implement the complete authentication system:
      1. User registration with email verification
      2. Login with JWT tokens
      3. Password reset flow
      4. Session management
```

### Resuming Interrupted Runs

Use `--update-source` to track progress in the YAML file:

```bash
spawnee run my-tasks.yaml --update-source
```

This updates the source YAML with `status: started` and `status: completed` fields. If interrupted, re-running the same command will skip completed tasks.

### Task-Level Overrides

Override plan-level defaults at the task level:

```yaml
defaults:
  model: "auto"
  timeout: 3600000

tasks:
  - id: "simple-task"
    prompt: "Quick formatting fix"
    model: "gpt-4o"  # Faster model for simple task
    timeout: 300000  # 5 min timeout

  - id: "complex-task"
    prompt: "Architect new microservice"
    model: "claude-4.5-opus-high-thinking"  # More capable model
    timeout: 7200000  # 2 hour timeout

  - id: "other-repo-task"
    prompt: "Update shared library"
    repository:
      url: "https://github.com/org/shared-lib"
      branch: "develop"
```

## Project Structure

```
spawnee/
├── src/
│   ├── index.ts                   # CLI entry point (Commander.js)
│   ├── core/
│   │   ├── orchestrator.ts        # Phase 3: Agent spawning & monitoring
│   │   ├── pipeline-controller.ts # Full pipeline controller (Phases 3→4→5)
│   │   └── task-queue.ts          # Dependency resolution & scheduling
│   ├── validation/
│   │   ├── validation-runner.ts   # Phase 4: Sequential gate orchestration
│   │   ├── gate-runner.ts         # Individual gate execution
│   │   ├── gate-parsers.ts        # Output parsers (typecheck, unit, e2e, lint)
│   │   ├── beads-mapper.ts        # Map gate failures → beads issues
│   │   └── types.ts               # Gate & validation interfaces
│   ├── artifact/
│   │   ├── generator.ts           # Phase 5: PR, test report, audit trail
│   │   └── types.ts               # Artifact interfaces
│   ├── cursor/
│   │   ├── client.ts              # Cursor Cloud API client (Axios + retry)
│   │   └── types.ts               # API type definitions
│   ├── storage/
│   │   ├── state-store.ts         # State persistence interface
│   │   ├── file-adapter.ts        # File-based state store
│   │   └── yaml-persistence.ts    # YAML resume support
│   ├── parsers/
│   │   └── index.ts               # Zod schemas + template parsing
│   └── utils/
│       ├── config.ts              # Config loader (file/env/CLI merge)
│       ├── logger.ts              # Colored console logging
│       ├── git.ts                 # Git operations utility
│       ├── shell.ts               # Shell execution (execFile wrapper)
│       ├── retry.ts               # Retry logic with backoff
│       └── breakpoint-handler.ts  # Interactive breakpoint prompts
├── templates/
│   ├── examples/                  # Example task templates
│   └── schemas/
│       └── task-template.schema.json
├── reference-docs/                # Methodology documentation
│   ├── methodology.md
│   ├── template-spec.md
│   ├── agent-conventions.md
│   ├── validation-gates.md
│   └── artifact-spec.md
├── package.json
├── tsconfig.json
└── README.md
```

## Limits

- Maximum 256 concurrent agents per API key
- Usage-based pricing (same as Cursor Background Agents)

## Getting Your API Key

Get your Cursor API key from: **Cursor Dashboard → Integrations → User API Keys**

## License

MIT
