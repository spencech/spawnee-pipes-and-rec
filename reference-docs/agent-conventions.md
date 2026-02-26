# Agent Behavior Protocol

These conventions govern how spawned agents operate within the Agentic Dev Pipeline. This document is designed to be injected (in whole or in part) into agent prompts.

---

## Session Lifecycle

Every agent session follows this rhythm:

```
Orient → Claim → Work → Complete → Report
```

1. **Orient** — Read the task prompt, understand the beads issue, and merge any dependency branches
2. **Claim** — Mark the issue as in-progress: `bd update <id> --status=in_progress`
3. **Work** — Implement the change, following the conventions below
4. **Brief** — Write an implementation brief before closing (see below)
5. **Complete** — Close the issue: `bd close <id>`
6. **Report** — Commit, push, and ensure the branch is clean

If you cannot complete the task, do NOT close the issue. Instead, file a blocking issue and leave the original open (see Failure Protocol below).

---

## Beads Integration

Beads is your external memory. Every piece of work, every discovery, and every problem is tracked as a beads issue.

### On Task Completion
```bash
bd close <issue-id>
```

### On Discovering New Work
When you encounter bugs, tech debt, missing capabilities, or anything that should be addressed but is outside your current task:

```bash
bd create --title="<concise summary>" --description="<details including file paths and reproduction steps>" --type=bug --priority=2
```

**Never ignore discovered problems.** Never try to fix them inline if they're outside your task scope. File the issue and continue with your assigned work.

### On Encountering a Blocker
If something prevents you from completing your task:

```bash
# Create the blocking issue
bd create --title="Blocker: <summary>" --description="<what's blocking and why>" --type=bug --priority=1

# Link it as a dependency of your task
bd dep add <your-task-id> <blocker-id>
```

Leave your task issue open. Do not close it or mark it as complete.

---

## Implementation Brief

Before closing your beads issue, document your implementation approach:

```bash
bd update <issue-id> --design="Approach: <what you did and why>. Key files: <list>. Patterns: <what you followed>. Tradeoffs: <decisions made>."
```

This brief is read by QA retry agents if validation gates fail. Write it as if explaining your work to a colleague who needs to fix a bug in it.

The brief should cover:
- **Approach** — what you did and why you chose that path
- **Key files** — files created or significantly modified
- **Patterns** — existing codebase patterns you followed
- **Tradeoffs** — constraints encountered or decisions that could have gone either way

---

## Branch Protocol

### Branch Naming
- Your task branch: `cursor/spawnee/<ticket>-<task-description>`
- The feature branch (shared): `spawnee/<ticket>-<feature-description>`

### For Dependent Tasks
If your task depends on another task's output, merge that branch before starting:

```bash
git fetch origin
git checkout <your-task-branch>
git merge origin/<dependency-branch> --no-edit
```

Verify the merge succeeded before proceeding. If there are conflicts, resolve them. If you cannot resolve them, file a blocking issue.

### Commit Messages
Use this format:
```
<type>(<scope>): <summary>

<body — what changed and why>

Beads: <issue-id>
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

Example:
```
feat(users): add bulk import endpoint

Implements POST /api/users/bulk-import with CSV parsing,
row-level validation, and partial import support.

Beads: abc123
```

### Before Finishing
```bash
git add <changed-files>
git commit -m "<message>"
git push origin <your-task-branch>
```

Stage specific files — do not use `git add -A` or `git add .`.

---

## Code Search

Use ChunkHound to understand the target codebase before making changes.

### When to Use Each Search Mode

| Mode | Use When | Example |
|------|----------|---------|
| **Semantic search** | You're exploring by concept or description | "authentication middleware", "error handling patterns" |
| **Regex search** | You know the exact syntax or name | `class ReportRoute`, `import.*Configuration` |
| **Code research** | You need to understand multi-file architecture | "How does the request lifecycle work from controller to database?" |

### Search Before You Code
1. Search for existing implementations before writing new code — reuse over reinvention
2. Search for the patterns used in the codebase — follow them, don't introduce new ones
3. Search for tests — understand how existing code is tested before writing new tests

---

## Discovery Protocol

While working on your task, you will encounter things outside your scope. Handle them as follows:

| Discovery | Action |
|-----------|--------|
| **Bug in existing code** | File a beads issue with reproduction steps. Do not fix it unless it blocks your task. |
| **Tech debt** | File a beads issue. Continue with your task. |
| **Missing capability you need** | File a beads issue, add it as a dependency of your task, leave your task open. |
| **Unclear requirements** | File a beads issue with `type=task` describing what needs clarification. Do not guess. |
| **Security concern** | File a beads issue with `priority=0`. Flag it in your commit message. |

---

## Failure Protocol

If you cannot complete your assigned task:

1. **Do not close the beads issue** — leave it open
2. **File a blocking issue** explaining why completion is not possible:
   ```bash
   bd create --title="Blocker: <reason>" --description="<full context>" --type=bug --priority=1
   bd dep add <your-task-id> <blocker-id>
   ```
3. **Commit any partial work** to your task branch with a clear message:
   ```
   chore(<scope>): partial implementation — blocked by <blocker-id>
   ```
4. **Push the branch** so the partial work is preserved

Do not:
- Silently skip the task
- Close the issue as if it were complete
- Delete or discard partial work
- Attempt workarounds that compromise code quality

---

## EMS Repository Conventions

When targeting EMS repositories, follow these additional conventions. These are detected from the `ems` section of the task template.

### TypeScript
- Use `.mts` source files that compile to `.mjs`
- Strict mode (`strict: true`) in tsconfig
- Tabs for indentation, double quotes, semicolons
- Explicit return types on all functions and methods
- Interfaces with `I` prefix for contracts

### Angular Targets
- `standalone: false` — do not convert to standalone components
- RxJS `BehaviorSubject` for state management (no Redux/NgRx)
- LESS for styling, separate `.html` template files
- Karma/Jasmine for unit tests

### Lambda Targets
- Extend `AbstractRoute` for new endpoints
- Raw SQL with parameterized queries (no ORM)
- `Configuration.load()` for SSM/Secrets Manager access
- Jasmine for unit tests with spy-based mocking

### General
- `pnpm` as package manager
- `ems-node-app-utils` for `trace()`, `clone()`, `empty()`
- `data-e2e-id` attributes for Cypress test selectors
