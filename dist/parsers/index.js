import { z } from 'zod';
import * as yaml from 'yaml';
import { readFileSync } from 'fs';
// --- Shared schemas ---
// Git URL validator: accepts HTTPS URLs, SSH URLs (git@host:path), and file:// URLs
const GitUrlSchema = z.string().refine((val) => val.startsWith('https://') || val.startsWith('http://') || val.startsWith('git@') || val.startsWith('file://'), { message: 'Must be an HTTPS, SSH, or file:// git URL' });
const ValidationSchema = z.object({
    command: z.string(),
    successPattern: z.string(),
}).optional();
// Model is now a string - use `spawnee models` to see available models from the API
const ModelSchema = z.string();
// Task-level repository override schema
const TaskRepositorySchema = z.object({
    url: GitUrlSchema,
    branch: z.string().optional(),
}).optional();
// Task status for YAML persistence/resume
const TaskStatusSchema = z.enum(['pending', 'started', 'completed', 'failed']).optional();
const TaskSchema = z.object({
    id: z.string(),
    name: z.string(),
    prompt: z.string(),
    dependsOn: z.array(z.string()).default([]),
    files: z.array(z.string()).optional(),
    branch: z.string().optional(),
    priority: z.number().default(0),
    timeout: z.number().optional(),
    retries: z.number().optional(),
    validation: ValidationSchema,
    complete: z.boolean().optional(),
    model: ModelSchema.optional(), // Task-level model override
    repository: TaskRepositorySchema, // Task-level repository override
    breakpoint: z.boolean().default(false), // Pause for human review when task completes
    status: TaskStatusSchema, // For YAML persistence/resume
    beadsIssueId: z.string().optional(), // Beads issue ID for context bridging
});
// --- Template-level schemas ---
const RepositorySchema = z.object({
    url: GitUrlSchema,
    branch: z.string().default('main'),
    baseBranch: z.string().optional(),
});
const DefaultsSchema = z.object({
    model: ModelSchema.default('auto'),
    timeout: z.number().default(3600000),
    retries: z.number().default(2),
    createPR: z.boolean().default(true),
}).default({});
const ContextSchema = z.object({
    files: z.array(z.string()).default([]),
    instructions: z.string().optional(),
}).default({});
// --- Pipeline-specific schemas ---
const TaskTypeSchema = z.enum(['feature', 'bugfix', 'refactor']);
const TargetSchema = z.object({
    repo: GitUrlSchema,
    branch: z.string().default('main'),
});
const GateTypeSchema = z.enum(['typecheck', 'unit', 'e2e', 'lint', 'manual']);
const ValidationGateSchema = z.object({
    gate: GateTypeSchema,
    command: z.string().optional(),
    pattern: z.string().optional(),
    specs: z.array(z.string()).optional(),
    description: z.string().optional(),
}).refine((data) => {
    if (data.gate === 'manual')
        return !!data.description;
    return !!data.command;
}, { message: 'Automated gates require "command"; manual gates require "description"' });
const EmsTargetTypeSchema = z.enum(['angular', 'lambda', 'shared-lib']);
const EmsExtensionsSchema = z.object({
    stage: z.enum(['dev', 'staging', 'prod']),
    profile: z.string(),
    target_type: EmsTargetTypeSchema.optional(),
    app_name: z.string().optional(),
    function_name: z.string().optional(),
});
// --- Main template schema ---
const TemplateSchema = z.object({
    // Existing fields (repository now optional for backward compat with target)
    name: z.string(),
    repository: RepositorySchema.optional(),
    defaults: DefaultsSchema,
    context: ContextSchema,
    tasks: z.array(TaskSchema).min(1, 'At least one task is required'),
    // Pipeline fields (all optional for backward compat with execution-only templates)
    type: TaskTypeSchema.optional(),
    target: TargetSchema.optional(),
    id: z.string().optional(),
    description: z.string().optional(),
    acceptance_criteria: z.array(z.string()).default([]),
    priority: z.number().int().min(0).max(4).default(2),
    max_qa_cycles: z.number().int().min(1).max(10).default(3),
    validation_strategy: z.array(ValidationGateSchema).default([]),
    constraints: z.array(z.string()).default([]),
    scope: z.array(z.string()).default([]),
    context_files: z.array(z.string()).default([]),
    ems: EmsExtensionsSchema.optional(),
}).refine((data) => !!(data.repository || data.target), { message: 'Either "repository" or "target" must be provided' });
// --- Parse function ---
export function parseTemplate(filePath) {
    const content = readFileSync(filePath, 'utf-8');
    const isYaml = filePath.endsWith('.yaml') || filePath.endsWith('.yml');
    const raw = isYaml ? yaml.parse(content) : JSON.parse(content);
    // Normalize target → repository if target is provided and repository is not
    if (raw.target && !raw.repository) {
        raw.repository = {
            url: raw.target.repo,
            branch: raw.target.branch || 'main',
        };
    }
    const validated = TemplateSchema.parse(raw);
    const tasks = validated.tasks.map(t => ({
        id: t.id,
        name: t.name,
        prompt: t.prompt,
        dependsOn: t.dependsOn,
        priority: t.priority,
        branch: t.branch,
        files: t.files,
        timeout: t.timeout ?? validated.defaults.timeout,
        retries: t.retries ?? validated.defaults.retries,
        validation: t.validation,
        complete: t.complete || t.status === 'completed', // Treat status: "completed" same as complete: true
        model: t.model ?? validated.defaults.model, // Task model, fallback to default
        repository: t.repository, // Task-level repository override
        breakpoint: t.breakpoint, // Breakpoint for human review
        beadsIssueId: t.beadsIssueId, // Beads issue ID for context bridging
    }));
    validateDependencies(tasks);
    return {
        name: validated.name,
        repository: validated.repository, // Safe: refine guarantees repository or target exists, and we normalize target→repository
        defaults: validated.defaults,
        context: validated.context,
        tasks,
        type: validated.type,
        id: validated.id,
        description: validated.description,
        acceptance_criteria: validated.acceptance_criteria,
        priority: validated.priority,
        max_qa_cycles: validated.max_qa_cycles,
        validation_strategy: validated.validation_strategy,
        constraints: validated.constraints,
        scope: validated.scope,
        context_files: validated.context_files,
        ems: validated.ems,
    };
}
// --- Dependency validation ---
function validateDependencies(tasks) {
    const taskIds = new Set(tasks.map(t => t.id));
    const errors = [];
    for (const task of tasks) {
        for (const depId of task.dependsOn) {
            if (!taskIds.has(depId))
                errors.push(`Task "${task.id}" depends on unknown task "${depId}"`);
        }
    }
    if (hasCycle(tasks))
        errors.push('Circular dependency detected in task graph');
    if (errors.length > 0)
        throw new Error(`Template validation failed:\n${errors.join('\n')}`);
}
function hasCycle(tasks) {
    const visited = new Set();
    const recursionStack = new Set();
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    function dfs(taskId) {
        visited.add(taskId);
        recursionStack.add(taskId);
        const task = taskMap.get(taskId);
        if (!task)
            return false;
        for (const depId of task.dependsOn) {
            if (!visited.has(depId) && dfs(depId))
                return true;
            if (recursionStack.has(depId))
                return true;
        }
        recursionStack.delete(taskId);
        return false;
    }
    for (const task of tasks) {
        if (!visited.has(task.id) && dfs(task.id))
            return true;
    }
    return false;
}
// --- Validation functions ---
export function validateTemplateFile(filePath) {
    try {
        parseTemplate(filePath);
        return { valid: true, errors: [] };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { valid: false, errors: [message] };
    }
}
/**
 * Validates that a template has all required fields for the full pipeline
 * (planning → execution → validation → artifact generation).
 * Stricter than parseTemplate() which allows execution-only templates.
 */
export function validatePipelineTemplate(filePath) {
    try {
        const template = parseTemplate(filePath);
        const errors = [];
        if (!template.type) {
            errors.push('Pipeline templates require "type" (feature | bugfix | refactor)');
        }
        if (!template.description) {
            errors.push('Pipeline templates require "description"');
        }
        if (template.acceptance_criteria.length === 0) {
            errors.push('Pipeline templates require at least one entry in "acceptance_criteria"');
        }
        return { valid: errors.length === 0, errors };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { valid: false, errors: [message] };
    }
}
//# sourceMappingURL=index.js.map