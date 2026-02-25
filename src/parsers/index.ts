import { z } from 'zod';
import * as yaml from 'yaml';
import { readFileSync } from 'fs';
import { TaskInput } from '../core/task-queue.js';

const ValidationSchema = z.object({
  command: z.string(),
  successPattern: z.string(),
}).optional();

// Model is now a string - use `spawnee models` to see available models from the API
const ModelSchema = z.string();

// Task-level repository override schema
const TaskRepositorySchema = z.object({
  url: z.string().url(),
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
  model: ModelSchema.optional(),              // Task-level model override
  repository: TaskRepositorySchema,          // Task-level repository override
  breakpoint: z.boolean().default(false),    // Pause for human review when task completes
  status: TaskStatusSchema,                  // For YAML persistence/resume
});

const RepositorySchema = z.object({
  url: z.string().url(),
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

const TemplateSchema = z.object({
  name: z.string(),
  repository: RepositorySchema,
  defaults: DefaultsSchema,
  context: ContextSchema,
  tasks: z.array(TaskSchema).min(1, 'At least one task is required'),
});

export type Template = z.infer<typeof TemplateSchema>;
export type TemplateTask = z.infer<typeof TaskSchema>;

export interface ParsedTemplate {
  name: string;
  repository: { url: string; branch: string; baseBranch?: string };
  defaults: { model: string; timeout: number; retries: number; createPR: boolean };
  context: { files: string[]; instructions?: string };
  tasks: TaskInput[];
}

export function parseTemplate(filePath: string): ParsedTemplate {
  const content = readFileSync(filePath, 'utf-8');
  const isYaml = filePath.endsWith('.yaml') || filePath.endsWith('.yml');
  const raw = isYaml ? yaml.parse(content) : JSON.parse(content);
  const validated = TemplateSchema.parse(raw);

  const tasks: TaskInput[] = validated.tasks.map(t => ({
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
    complete: t.complete || t.status === 'completed',  // Treat status: "completed" same as complete: true
    model: t.model ?? validated.defaults.model,        // Task model, fallback to default
    repository: t.repository,                          // Task-level repository override
    breakpoint: t.breakpoint,                          // Breakpoint for human review
  }));

  validateDependencies(tasks);

  return {
    name: validated.name,
    repository: validated.repository,
    defaults: validated.defaults,
    context: validated.context,
    tasks,
  };
}

function validateDependencies(tasks: TaskInput[]): void {
  const taskIds = new Set(tasks.map(t => t.id));
  const errors: string[] = [];

  for (const task of tasks) {
    for (const depId of task.dependsOn) {
      if (!taskIds.has(depId)) errors.push(`Task "${task.id}" depends on unknown task "${depId}"`);
    }
  }

  if (hasCycle(tasks)) errors.push('Circular dependency detected in task graph');
  if (errors.length > 0) throw new Error(`Template validation failed:\n${errors.join('\n')}`);
}

function hasCycle(tasks: TaskInput[]): boolean {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const taskMap = new Map(tasks.map(t => [t.id, t]));

  function dfs(taskId: string): boolean {
    visited.add(taskId);
    recursionStack.add(taskId);
    const task = taskMap.get(taskId);
    if (!task) return false;

    for (const depId of task.dependsOn) {
      if (!visited.has(depId) && dfs(depId)) return true;
      if (recursionStack.has(depId)) return true;
    }

    recursionStack.delete(taskId);
    return false;
  }

  for (const task of tasks) {
    if (!visited.has(task.id) && dfs(task.id)) return true;
  }

  return false;
}

export function validateTemplateFile(filePath: string): { valid: boolean; errors: string[] } {
  try {
    parseTemplate(filePath);
    return { valid: true, errors: [] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { valid: false, errors: [message] };
  }
}

