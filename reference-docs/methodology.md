# Agentic Dev Pipeline — Methodology

## Philosophy

An agentic dev pipeline replaces the traditional human-driven development loop with autonomous AI agents that plan, implement, test, and document software changes. It is not:

- **A CI/CD pipeline** — CI/CD validates and deploys code that humans wrote. This pipeline *writes* the code.
- **An ML pipeline** — ML pipelines train and deploy models. This pipeline uses pre-trained models as agents to produce software artifacts.
- **A chatbot** — Chatbots assist interactively. This pipeline operates autonomously once a task template is submitted.

The pipeline's value proposition is **predictable, auditable, autonomous software delivery** — a structured task goes in, validated code comes out, and every decision along the way is tracked.

### Design Principles

1. **Template-driven** — Every pipeline run starts from a structured task definition. No ambiguous natural language prompts.
2. **Decomposition over monoliths** — Large tasks are broken into small, single-session-completable issues. Agents work on one issue at a time.
3. **Persistent memory via issues** — All state lives in beads issues, not in conversation history. Sessions can restart, compact, or hand off without context loss.
4. **Validation before output** — No code leaves the pipeline without passing through at least one quality gate.
5. **Discovered work is never lost** — When agents encounter bugs, tech debt, or missing capabilities, they file new issues instead of ignoring them or attempting inline fixes.
6. **Human escalation, not human dependence** — The pipeline operates autonomously but escalates to human review when validation cycles are exhausted or when decisions exceed agent authority.

---

## Core Loop

```
Template Input → Planning → Execution → Validation → Artifact Output
                                ↑             |
                                └── Fail ─────┘
```

The pipeline runs five phases sequentially. Phase 4 (Validation) can loop back to Phase 3 (Execution) up to `max_qa_cycles` times before escalating.

---

## Phase 1: Task Intake

**Input:** A YAML task template (see [template-spec.md](./template-spec.md))

**What happens:**
1. The template is validated against the task schema
2. The target repository is cloned (or an existing checkout is used)
3. A feature branch is created: `spawnee/<ticket>-<description>`
4. The ChunkHound index is built (or refreshed) for the target codebase
5. Beads is initialized (or verified) in the pipeline's tracking directory

**Output:** A validated task definition, an indexed codebase, and a clean feature branch.

**Failure modes:**
- Invalid template → reject with schema validation errors
- Unreachable repository → reject with connection error
- Missing required tools (bd, spawnee, chunkhound) → reject with setup instructions

---

## Phase 2: Planning

**Input:** Validated task template + indexed codebase

**What happens:**
1. A planning agent receives the task template and analyzes the target codebase using ChunkHound (semantic search for understanding architecture, regex search for finding specific patterns)
2. The agent decomposes the task into discrete, completable units of work
3. Each unit becomes a beads issue:
   ```bash
   bd create --title="<summary>" --description="<details>" --type=task --priority=<0-4>
   ```
4. Dependency links are established between issues:
   ```bash
   bd dep add <downstream-issue> <upstream-issue>
   ```
5. A spawnee YAML template is generated with one task per beads issue. Each task's prompt includes:
   - The implementation instructions
   - Beads integration commands (close on success, file discovered work)
   - Branch merge instructions for dependent tasks

**Output:** A beads epic with child issues, dependency graph, and a spawnee YAML template ready for execution.

**Planning agent behavior:**
- Prefer fewer, larger issues over many tiny ones — each issue should be completable in a single agent session
- Set dependencies only when ordering genuinely matters (shared files, API contracts, schema migrations)
- Include acceptance criteria in each issue description so validation is unambiguous
- Reference specific files and functions discovered via ChunkHound, not vague descriptions

---

## Phase 3: Execution

**Input:** Spawnee YAML template + beads issue graph

**What happens:**
1. Spawnee dispatches tasks to Cursor Cloud Agents:
   ```bash
   spawnee run templates/<generated>.yaml --update-source
   ```
2. Spawnee resolves the dependency graph and runs independent tasks in parallel
3. Each spawned agent:
   - Creates its task branch: `cursor/spawnee/<ticket>-<task>`
   - For dependent tasks: merges the upstream branch first
   - Claims its beads issue: `bd update <id> --status=in_progress`
   - Implements the change
   - Closes its beads issue on success: `bd close <id>`
   - Files new issues for any discovered work: `bd create --title="..." --type=bug`
   - Commits and pushes to its task branch

**Output:** Task branches with implemented changes, updated beads issues.

**Agent failure handling:**
- If an agent cannot complete its task, it should file a blocking issue explaining why and leave the beads issue open
- Spawnee retries failed tasks up to the configured retry count before marking them as failed
- If a task with dependents fails, downstream tasks are skipped

---

## Phase 4: Validation

**Input:** Completed task branches + validation strategy from the template

**What happens:**
1. All task branches are merged into the feature branch
2. Validation gates run in the order specified by the template's `validation_strategy` (see [validation-gates.md](./validation-gates.md))
3. Each gate produces a pass/fail result with structured output
4. Gate failures are mapped to beads issues:
   ```bash
   bd create --title="QA: <failure summary>" --description="<details>" --type=bug --priority=1
   ```
5. Decision point:
   - **All gates pass** → Proceed to Phase 5
   - **Failures exist AND qa_cycle < max_qa_cycles** → Generate a new spawnee template for the failure issues and re-enter Phase 3
   - **Failures exist AND qa_cycle >= max_qa_cycles** → Escalate to human review

**Output:** Either a green validation result or a set of QA-fix issues feeding back into execution.

**QA cycle tracking:**
- Each cycle increments a counter tracked in the pipeline state
- The beads audit trail captures which issues were created in which QA cycle
- Failure issues include metadata: which gate failed, the error output, and the QA cycle number

---

## Phase 5: Artifact Output

**Input:** Validated feature branch + beads audit trail

**What happens:**
1. All task branches are squash-merged (or merge-committed) into the feature branch
2. A pull request is created with a structured summary (see [artifact-spec.md](./artifact-spec.md))
3. The beads audit trail is exported as part of the PR description or as an attached artifact
4. A test report summarizing all validation gate results across all QA cycles is generated

**Output:** See [artifact-spec.md](./artifact-spec.md) for the complete artifact specification.

---

## Cross-Cutting Concerns

### Error Recovery

| Scenario | Behavior |
|----------|----------|
| Agent cannot complete a task | File blocking issue, leave beads issue open, skip dependents |
| Validation gate fails | Create QA bug issue, retry if under max_qa_cycles |
| All QA cycles exhausted | Escalate to human review with full failure analysis |
| Infrastructure failure (git, network) | Retry with backoff; escalate after 3 attempts |
| Template validation fails | Reject immediately with actionable error message |

### Human Escalation

The pipeline escalates to human review when:
- QA cycles are exhausted without all gates passing
- An agent encounters a decision that exceeds its authority (e.g., breaking API change, security-sensitive modification)
- A blocking issue cannot be resolved automatically

Escalation produces a **failure artifact** (see [artifact-spec.md](./artifact-spec.md)) with all context needed for a human to diagnose and intervene.

### Partial Success

When some tasks complete and pass validation but others fail:
- Completed work is preserved on the feature branch
- Failed work remains as open beads issues
- The artifact output includes both the successful changes and a manifest of remaining work
- The human reviewer can decide whether to merge the partial result or wait for full completion
