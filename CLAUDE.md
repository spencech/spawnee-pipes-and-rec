# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ems-ai-pipeline** is an Agentic Dev Pipeline that orchestrates autonomous AI agents to plan, implement, test, and document software changes. The pipeline accepts templated task inputs (features, bugfixes, refactors), runs agent-driven planning and execution cycles, validates output via configurable quality gates, and produces documented artifacts.

### Core Loop

```
Template Input → Planning → Execution → QA Validation → Artifact Output
                                ↑              |
                                └── Fail ──────┘
```

1. **Template Input** — A structured task definition (feature, bugfix, refactor) with acceptance criteria, target repository, and constraints.
2. **Planning** — Agents analyze the codebase and produce an implementation plan decomposed into trackable issues.
3. **Execution** — Spawnee dispatches work to Cursor Cloud Agents. Each agent claims a beads issue, implements it, and closes it on completion.
4. **QA Validation** — Configurable quality gates (E2E, unit, typecheck, lint, manual review) validate agent output. Failures generate new beads issues.
5. **QA Retry Loop** — Failed QA issues feed back into execution. The cycle repeats until gates pass or a max-retry threshold is reached.
6. **Artifact Output** — On success, the pipeline produces: committed code on a feature branch, a PR with summary, test results, and a beads audit trail.

## Tooling

| Tool | Purpose | Version |
|------|---------|---------|
| **beads (`bd`)** | Issue tracking, dependency graphs, cross-session memory | 0.54.0 |
| **spawnee** | Agent orchestration — dispatches tasks to Cursor Cloud Agents | 1.0.0 |
| **chunkhound** | Semantic and regex code search via MCP | 4.0.1 |

### Beads Conventions

- All pipeline work is tracked in beads — not markdown files, not TodoWrite.
- Issues map 1:1 to spawnee tasks when dispatching to agents.
- QA failures become new beads issues with `type=bug` and a `discovered-from` link to the parent feature.
- The beads audit trail (issue lifecycle timestamps, dependency graph) is part of the final artifact.

### Spawnee Conventions

- Templates live in `templates/` as YAML files.
- Branch naming: `spawnee/<ticket>-<description>` for feature branches, `cursor/spawnee/<ticket>-<task>` for agent working branches.
- Every spawnee task prompt must include beads integration instructions (close issue on success, file new issues for discovered work).
- Use `--update-source` for resumable runs.

## Project Structure

```
spawnee-pipes-and-rec/
├── CLAUDE.md              # This file
├── templates/             # Spawnee YAML task templates
│   └── *.yaml
├── schemas/               # JSON schemas for template inputs
├── scripts/               # Pipeline orchestration scripts
├── lib/                   # Shared TypeScript utilities
├── docs/                  # Methodology documentation and artifact templates
└── .chunkhound/           # Semantic search index
```

## Commands

```bash
# Initialize beads tracking
bd init

# Initialize git
git init && git add -A && git commit -m "Initial commit"

# Index codebase for semantic search
chunkhound index .

# Validate a spawnee template
spawnee validate templates/<template>.yaml

# Dry-run a pipeline dispatch
spawnee run templates/<template>.yaml --dry-run

# Execute a pipeline dispatch
spawnee run templates/<template>.yaml --update-source

# Check agent status
spawnee status

# Review pipeline state
bd ready                    # What's next
bd list --status=open       # All open work
bd blocked                  # What's stuck
```

## Pipeline Methodology

### Phase 1: Task Intake

A task template defines:
- **type**: `feature` | `bugfix` | `refactor`
- **target**: Repository URL and base branch
- **description**: What needs to change and why
- **acceptance_criteria**: Concrete, testable conditions for success
- **e2e_specs**: Which Cypress spec files or patterns validate the work (if applicable)
- **max_qa_cycles**: How many QA retry loops before escalating to human review (default: 3)

### Phase 2: Planning

An agent (or Claude Code session) receives the template and:
1. Analyzes the target codebase using ChunkHound semantic search
2. Creates a beads epic with child issues for each discrete unit of work
3. Sets dependency links between issues
4. Generates a spawnee YAML template with tasks mapped to beads issues

### Phase 3: Execution

```bash
spawnee run templates/<generated>.yaml --update-source
```

Each spawned agent:
- Merges dependency branches before starting
- Implements its assigned beads issue
- Runs `bd close <id>` on success
- Files `bd create` for any discovered work
- Commits and pushes to its task branch

### Phase 4: QA Validation

After all execution tasks complete:
1. Merge all task branches into the feature branch
2. Run E2E tests: `npx cypress run --spec <specs>`
3. Parse test results
4. If all pass → proceed to artifact output
5. If failures exist → create beads issues for each failure, link as dependencies of a new QA-fix epic, generate a new spawnee template, and re-enter Phase 3

### Phase 5: Artifact Output

The final artifact includes:
- Feature branch with all changes committed
- Pull request with structured summary (what changed, why, test results)
- Beads audit trail: full issue lifecycle from planning through QA cycles
- Test report: pass/fail breakdown with any QA cycle history

## Detailed Documentation

| Document | Purpose |
|----------|---------|
| [docs/methodology.md](docs/methodology.md) | Core philosophy, design principles, and phase-by-phase walkthrough |
| [docs/template-spec.md](docs/template-spec.md) | Task template schema, field definitions, and examples for each task type |
| [docs/agent-conventions.md](docs/agent-conventions.md) | Agent behavior protocol — injected into spawned agent prompts |
| [docs/validation-gates.md](docs/validation-gates.md) | Quality gate types, combining strategies, retry logic, and failure-to-issue mapping |
| [docs/artifact-spec.md](docs/artifact-spec.md) | Output format specification for success and failure artifacts |
