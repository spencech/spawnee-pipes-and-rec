# spawnee

Spawn and orchestrate Cursor Cloud Agents from task templates with dependency resolution, parallel execution, and automatic retries.

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

Execute a task template.

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
- `-d, --dry-run` - Preview without spawning agents
- `--no-persist` - Disable state persistence
- `--update-source` - Update source YAML with task status for resume capability
- `-v, --verbose` - Enable verbose output

### `spawnee validate <template>`

Validate a task template without running it.

```bash
spawnee validate my-tasks.yaml
```

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

### `spawnee models`

List available models from the Cursor API. Use this to see which model IDs are valid for your templates.

```bash
spawnee models [options]
```

**Options:**
- `-k, --api-key <key>` - Cursor API key
- `--api-url <url>` - API base URL

## Task Templates

Templates can be JSON or YAML. Here's a complete example:

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

  - id: "feature-b"
    name: "Feature B"
    dependsOn: ["setup"]
    priority: 80
    branch: "feature/b"
    prompt: |
      Implement Feature B with tests.

  - id: "integration"
    name: "Integration"
    dependsOn: ["feature-a", "feature-b"]
    priority: 60
    branch: "feature/integration"
    prompt: |
      Integrate features and add integration tests.
    validation:
      command: "npm test"
      successPattern: "passed"
```

### Template Schema

**Required fields:**
- `name` - Template name
- `repository.url` - GitHub repository URL
- `tasks` - Array of tasks

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
- **Validation** - Optional command validation for task completion
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

## Limits

- Maximum 256 concurrent agents per API key
- Usage-based pricing (same as Cursor Background Agents)

## Getting Your API Key

Get your Cursor API key from: **Cursor Dashboard → Integrations → User API Keys**

## License

MIT
