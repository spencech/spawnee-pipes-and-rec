# Validation Strategy Guide

Validation gates are quality checks that run after agent execution to verify that the work meets acceptance criteria. The pipeline supports multiple gate types that can be combined in sequence.

---

## Gate Types

### `typecheck` — TypeScript Type Checking

Runs the TypeScript compiler in check-only mode to catch type errors without emitting output.

```yaml
- gate: typecheck
  command: "npx tsc --noEmit"
```

**Pass condition:** Exit code 0 (no type errors).

**Failure mapping:** Each type error becomes a beads issue with:
- Title: `QA: Type error in <file>:<line>`
- Description: The full error message and surrounding context
- Type: `bug`
- Priority: `1`

---

### `unit` — Unit Test Suite

Runs the project's unit test framework and parses results.

```yaml
- gate: unit
  command: "npx jasmine"              # or jest, karma, vitest
  pattern: "**/*.spec.mts"            # optional: filter to specific tests
```

**Pass condition:** All tests pass (exit code 0).

**Failure mapping:** Each failed test becomes a beads issue with:
- Title: `QA: Test failure — <test name>`
- Description: The assertion error, expected vs actual values, and stack trace
- Type: `bug`
- Priority: `1`

---

### `e2e` — End-to-End Tests

Runs Cypress (or another E2E framework) against the application.

```yaml
- gate: e2e
  command: "npx cypress run"
  specs:                               # optional: limit to specific specs
    - "cypress/e2e/bulk-import.cy.ts"
    - "cypress/e2e/users.cy.ts"
```

**Pass condition:** All specified specs pass.

**Failure mapping:** Each failed spec/test becomes a beads issue with:
- Title: `QA: E2E failure — <spec name> > <test name>`
- Description: The failure message, screenshot path (if available), and the Cypress command that failed
- Type: `bug`
- Priority: `1`

**Prerequisites:** The application must be running (or a `beforeAll` in the spec must start it). The template should specify any setup commands needed.

---

### `lint` — Linter

Runs the project's configured linter.

```yaml
- gate: lint
  command: "npx eslint src/"
```

**Pass condition:** No errors (warnings are allowed). Exit code 0 or 1 with only warnings.

**Failure mapping:** Lint errors are grouped by file. Each file with errors becomes a beads issue with:
- Title: `QA: Lint errors in <file>`
- Description: All lint errors for that file with rule names and line numbers
- Type: `bug`
- Priority: `2`

---

### `manual` — Human Review Checkpoint

Pauses the pipeline and waits for human approval.

```yaml
- gate: manual
  description: "Review the API contract changes before proceeding"
```

**Pass condition:** Human approves via pipeline interface.

**Failure mapping:** If the human rejects, they provide feedback that becomes a beads issue with:
- Title: `QA: Manual review — <reviewer summary>`
- Description: The reviewer's feedback
- Type: `task`
- Priority: `1`

**When to use:** Security-sensitive changes, breaking API changes, database migrations, or any change where automated validation is insufficient.

---

## Combining Gates

Templates can specify multiple gates. They run **in sequence**, left to right. If a gate fails, subsequent gates still run — all failures are collected before deciding whether to retry.

```yaml
validation_strategy:
  - gate: typecheck
    command: "npx tsc --noEmit"
  - gate: lint
    command: "npx eslint src/"
  - gate: unit
    command: "npx jest --ci"
  - gate: e2e
    command: "npx cypress run"
    specs: ["cypress/e2e/feature.cy.ts"]
```

**Recommended ordering:** typecheck → lint → unit → e2e → manual

This order runs fastest/cheapest gates first. While all gates run regardless, seeing cheaper failures first provides faster feedback in the QA issue descriptions.

---

## Failure-to-Issue Mapping

When a gate fails, the pipeline creates beads issues with structured metadata:

```bash
bd create \
  --title="QA: <gate>: <failure summary>" \
  --description="<structured failure details>" \
  --type=bug \
  --priority=1
```

### Issue Metadata Convention

The issue description follows a structured format that agents can parse:

```
## Gate
<gate type>

## QA Cycle
<cycle number> of <max_qa_cycles>

## Command
<the command that was run>

## Error Output
<raw error output, truncated to 2000 chars>

## Files Involved
- <file1>:<line>
- <file2>:<line>

## Acceptance Criteria Reference
<which acceptance criterion this failure relates to, if determinable>
```

---

## Retry Logic

### QA Cycle Counter

- Each template specifies `max_qa_cycles` (default: 3)
- After each validation run, if any gate failed:
  - Increment the cycle counter
  - If `cycle < max_qa_cycles`: create bug issues for failures, generate a new spawnee template targeting those issues, and re-enter execution (Phase 3)
  - If `cycle >= max_qa_cycles`: escalate to human review

### Retry Scope

Only failed gates' issues are retried. If typecheck and unit pass but e2e fails, the retry cycle only addresses the e2e failures. Gates that previously passed are re-run to verify no regressions were introduced.

### Escalation

When max cycles are exhausted:
1. All remaining QA issues are left open in beads
2. A failure artifact is generated (see [artifact-spec.md](./artifact-spec.md))
3. The pipeline notifies the human reviewer with the full QA cycle history

---

## Partial Success

When some gates pass and others fail within a cycle:

- **All gate results are recorded** — the test report includes pass/fail per gate per cycle
- **Passing gates do not suppress failures** — all gates run, all results are captured
- **Retry targets only failing issues** — agents in the retry cycle work on the specific failures, not the entire task

When some *tasks* pass validation but others don't:
- Completed, validated work is preserved on the feature branch
- Failed work remains as open beads issues
- The artifact output documents both the successful changes and the remaining work
