import { z } from 'zod';
import { TaskInput } from '../core/task-queue.js';
declare const TaskSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    prompt: z.ZodString;
    dependsOn: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    files: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    branch: z.ZodOptional<z.ZodString>;
    priority: z.ZodDefault<z.ZodNumber>;
    timeout: z.ZodOptional<z.ZodNumber>;
    retries: z.ZodOptional<z.ZodNumber>;
    validation: z.ZodOptional<z.ZodObject<{
        command: z.ZodString;
        successPattern: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        command: string;
        successPattern: string;
    }, {
        command: string;
        successPattern: string;
    }>>;
    complete: z.ZodOptional<z.ZodBoolean>;
    model: z.ZodOptional<z.ZodString>;
    repository: z.ZodOptional<z.ZodObject<{
        url: z.ZodString;
        branch: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        url: string;
        branch?: string | undefined;
    }, {
        url: string;
        branch?: string | undefined;
    }>>;
    breakpoint: z.ZodDefault<z.ZodBoolean>;
    status: z.ZodOptional<z.ZodEnum<["pending", "started", "completed", "failed"]>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    prompt: string;
    dependsOn: string[];
    priority: number;
    breakpoint: boolean;
    timeout?: number | undefined;
    status?: "completed" | "failed" | "pending" | "started" | undefined;
    branch?: string | undefined;
    files?: string[] | undefined;
    retries?: number | undefined;
    validation?: {
        command: string;
        successPattern: string;
    } | undefined;
    complete?: boolean | undefined;
    model?: string | undefined;
    repository?: {
        url: string;
        branch?: string | undefined;
    } | undefined;
}, {
    id: string;
    name: string;
    prompt: string;
    timeout?: number | undefined;
    status?: "completed" | "failed" | "pending" | "started" | undefined;
    dependsOn?: string[] | undefined;
    priority?: number | undefined;
    branch?: string | undefined;
    files?: string[] | undefined;
    retries?: number | undefined;
    validation?: {
        command: string;
        successPattern: string;
    } | undefined;
    complete?: boolean | undefined;
    model?: string | undefined;
    repository?: {
        url: string;
        branch?: string | undefined;
    } | undefined;
    breakpoint?: boolean | undefined;
}>;
declare const TemplateSchema: z.ZodObject<{
    name: z.ZodString;
    repository: z.ZodObject<{
        url: z.ZodString;
        branch: z.ZodDefault<z.ZodString>;
        baseBranch: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        url: string;
        branch: string;
        baseBranch?: string | undefined;
    }, {
        url: string;
        branch?: string | undefined;
        baseBranch?: string | undefined;
    }>;
    defaults: z.ZodDefault<z.ZodObject<{
        model: z.ZodDefault<z.ZodString>;
        timeout: z.ZodDefault<z.ZodNumber>;
        retries: z.ZodDefault<z.ZodNumber>;
        createPR: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        timeout: number;
        retries: number;
        model: string;
        createPR: boolean;
    }, {
        timeout?: number | undefined;
        retries?: number | undefined;
        model?: string | undefined;
        createPR?: boolean | undefined;
    }>>;
    context: z.ZodDefault<z.ZodObject<{
        files: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        instructions: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        files: string[];
        instructions?: string | undefined;
    }, {
        files?: string[] | undefined;
        instructions?: string | undefined;
    }>>;
    tasks: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        prompt: z.ZodString;
        dependsOn: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        files: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        branch: z.ZodOptional<z.ZodString>;
        priority: z.ZodDefault<z.ZodNumber>;
        timeout: z.ZodOptional<z.ZodNumber>;
        retries: z.ZodOptional<z.ZodNumber>;
        validation: z.ZodOptional<z.ZodObject<{
            command: z.ZodString;
            successPattern: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            command: string;
            successPattern: string;
        }, {
            command: string;
            successPattern: string;
        }>>;
        complete: z.ZodOptional<z.ZodBoolean>;
        model: z.ZodOptional<z.ZodString>;
        repository: z.ZodOptional<z.ZodObject<{
            url: z.ZodString;
            branch: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            url: string;
            branch?: string | undefined;
        }, {
            url: string;
            branch?: string | undefined;
        }>>;
        breakpoint: z.ZodDefault<z.ZodBoolean>;
        status: z.ZodOptional<z.ZodEnum<["pending", "started", "completed", "failed"]>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
        prompt: string;
        dependsOn: string[];
        priority: number;
        breakpoint: boolean;
        timeout?: number | undefined;
        status?: "completed" | "failed" | "pending" | "started" | undefined;
        branch?: string | undefined;
        files?: string[] | undefined;
        retries?: number | undefined;
        validation?: {
            command: string;
            successPattern: string;
        } | undefined;
        complete?: boolean | undefined;
        model?: string | undefined;
        repository?: {
            url: string;
            branch?: string | undefined;
        } | undefined;
    }, {
        id: string;
        name: string;
        prompt: string;
        timeout?: number | undefined;
        status?: "completed" | "failed" | "pending" | "started" | undefined;
        dependsOn?: string[] | undefined;
        priority?: number | undefined;
        branch?: string | undefined;
        files?: string[] | undefined;
        retries?: number | undefined;
        validation?: {
            command: string;
            successPattern: string;
        } | undefined;
        complete?: boolean | undefined;
        model?: string | undefined;
        repository?: {
            url: string;
            branch?: string | undefined;
        } | undefined;
        breakpoint?: boolean | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    name: string;
    repository: {
        url: string;
        branch: string;
        baseBranch?: string | undefined;
    };
    tasks: {
        id: string;
        name: string;
        prompt: string;
        dependsOn: string[];
        priority: number;
        breakpoint: boolean;
        timeout?: number | undefined;
        status?: "completed" | "failed" | "pending" | "started" | undefined;
        branch?: string | undefined;
        files?: string[] | undefined;
        retries?: number | undefined;
        validation?: {
            command: string;
            successPattern: string;
        } | undefined;
        complete?: boolean | undefined;
        model?: string | undefined;
        repository?: {
            url: string;
            branch?: string | undefined;
        } | undefined;
    }[];
    defaults: {
        timeout: number;
        retries: number;
        model: string;
        createPR: boolean;
    };
    context: {
        files: string[];
        instructions?: string | undefined;
    };
}, {
    name: string;
    repository: {
        url: string;
        branch?: string | undefined;
        baseBranch?: string | undefined;
    };
    tasks: {
        id: string;
        name: string;
        prompt: string;
        timeout?: number | undefined;
        status?: "completed" | "failed" | "pending" | "started" | undefined;
        dependsOn?: string[] | undefined;
        priority?: number | undefined;
        branch?: string | undefined;
        files?: string[] | undefined;
        retries?: number | undefined;
        validation?: {
            command: string;
            successPattern: string;
        } | undefined;
        complete?: boolean | undefined;
        model?: string | undefined;
        repository?: {
            url: string;
            branch?: string | undefined;
        } | undefined;
        breakpoint?: boolean | undefined;
    }[];
    defaults?: {
        timeout?: number | undefined;
        retries?: number | undefined;
        model?: string | undefined;
        createPR?: boolean | undefined;
    } | undefined;
    context?: {
        files?: string[] | undefined;
        instructions?: string | undefined;
    } | undefined;
}>;
export type Template = z.infer<typeof TemplateSchema>;
export type TemplateTask = z.infer<typeof TaskSchema>;
export interface ParsedTemplate {
    name: string;
    repository: {
        url: string;
        branch: string;
        baseBranch?: string;
    };
    defaults: {
        model: string;
        timeout: number;
        retries: number;
        createPR: boolean;
    };
    context: {
        files: string[];
        instructions?: string;
    };
    tasks: TaskInput[];
}
export declare function parseTemplate(filePath: string): ParsedTemplate;
export declare function validateTemplateFile(filePath: string): {
    valid: boolean;
    errors: string[];
};
export {};
