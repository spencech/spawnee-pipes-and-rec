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
        url: z.ZodEffects<z.ZodString, string, string>;
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
    beadsIssueId: z.ZodOptional<z.ZodString>;
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
    beadsIssueId?: string | undefined;
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
    beadsIssueId?: string | undefined;
}>;
declare const TemplateSchema: z.ZodEffects<z.ZodObject<{
    name: z.ZodString;
    repository: z.ZodOptional<z.ZodObject<{
        url: z.ZodEffects<z.ZodString, string, string>;
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
    }>>;
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
            url: z.ZodEffects<z.ZodString, string, string>;
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
        beadsIssueId: z.ZodOptional<z.ZodString>;
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
        beadsIssueId?: string | undefined;
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
        beadsIssueId?: string | undefined;
    }>, "many">;
    type: z.ZodOptional<z.ZodEnum<["feature", "bugfix", "refactor"]>>;
    target: z.ZodOptional<z.ZodObject<{
        repo: z.ZodEffects<z.ZodString, string, string>;
        branch: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        branch: string;
        repo: string;
    }, {
        repo: string;
        branch?: string | undefined;
    }>>;
    id: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    acceptance_criteria: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    priority: z.ZodDefault<z.ZodNumber>;
    max_qa_cycles: z.ZodDefault<z.ZodNumber>;
    validation_strategy: z.ZodDefault<z.ZodArray<z.ZodEffects<z.ZodObject<{
        gate: z.ZodEnum<["typecheck", "unit", "e2e", "lint", "manual"]>;
        command: z.ZodOptional<z.ZodString>;
        pattern: z.ZodOptional<z.ZodString>;
        specs: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        description: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        gate: "typecheck" | "unit" | "e2e" | "lint" | "manual";
        description?: string | undefined;
        pattern?: string | undefined;
        command?: string | undefined;
        specs?: string[] | undefined;
    }, {
        gate: "typecheck" | "unit" | "e2e" | "lint" | "manual";
        description?: string | undefined;
        pattern?: string | undefined;
        command?: string | undefined;
        specs?: string[] | undefined;
    }>, {
        gate: "typecheck" | "unit" | "e2e" | "lint" | "manual";
        description?: string | undefined;
        pattern?: string | undefined;
        command?: string | undefined;
        specs?: string[] | undefined;
    }, {
        gate: "typecheck" | "unit" | "e2e" | "lint" | "manual";
        description?: string | undefined;
        pattern?: string | undefined;
        command?: string | undefined;
        specs?: string[] | undefined;
    }>, "many">>;
    constraints: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    scope: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    context_files: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    ems: z.ZodOptional<z.ZodObject<{
        stage: z.ZodEnum<["dev", "staging", "prod"]>;
        profile: z.ZodString;
        target_type: z.ZodOptional<z.ZodEnum<["angular", "lambda", "shared-lib"]>>;
        app_name: z.ZodOptional<z.ZodString>;
        function_name: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        stage: "dev" | "staging" | "prod";
        profile: string;
        target_type?: "angular" | "lambda" | "shared-lib" | undefined;
        app_name?: string | undefined;
        function_name?: string | undefined;
    }, {
        stage: "dev" | "staging" | "prod";
        profile: string;
        target_type?: "angular" | "lambda" | "shared-lib" | undefined;
        app_name?: string | undefined;
        function_name?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    priority: number;
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
        beadsIssueId?: string | undefined;
    }[];
    acceptance_criteria: string[];
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
    max_qa_cycles: number;
    validation_strategy: {
        gate: "typecheck" | "unit" | "e2e" | "lint" | "manual";
        description?: string | undefined;
        pattern?: string | undefined;
        command?: string | undefined;
        specs?: string[] | undefined;
    }[];
    constraints: string[];
    scope: string[];
    context_files: string[];
    target?: {
        branch: string;
        repo: string;
    } | undefined;
    id?: string | undefined;
    repository?: {
        url: string;
        branch: string;
        baseBranch?: string | undefined;
    } | undefined;
    type?: "feature" | "bugfix" | "refactor" | undefined;
    description?: string | undefined;
    ems?: {
        stage: "dev" | "staging" | "prod";
        profile: string;
        target_type?: "angular" | "lambda" | "shared-lib" | undefined;
        app_name?: string | undefined;
        function_name?: string | undefined;
    } | undefined;
}, {
    name: string;
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
        beadsIssueId?: string | undefined;
    }[];
    target?: {
        repo: string;
        branch?: string | undefined;
    } | undefined;
    id?: string | undefined;
    priority?: number | undefined;
    repository?: {
        url: string;
        branch?: string | undefined;
        baseBranch?: string | undefined;
    } | undefined;
    type?: "feature" | "bugfix" | "refactor" | undefined;
    description?: string | undefined;
    acceptance_criteria?: string[] | undefined;
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
    max_qa_cycles?: number | undefined;
    validation_strategy?: {
        gate: "typecheck" | "unit" | "e2e" | "lint" | "manual";
        description?: string | undefined;
        pattern?: string | undefined;
        command?: string | undefined;
        specs?: string[] | undefined;
    }[] | undefined;
    constraints?: string[] | undefined;
    scope?: string[] | undefined;
    context_files?: string[] | undefined;
    ems?: {
        stage: "dev" | "staging" | "prod";
        profile: string;
        target_type?: "angular" | "lambda" | "shared-lib" | undefined;
        app_name?: string | undefined;
        function_name?: string | undefined;
    } | undefined;
}>, {
    name: string;
    priority: number;
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
        beadsIssueId?: string | undefined;
    }[];
    acceptance_criteria: string[];
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
    max_qa_cycles: number;
    validation_strategy: {
        gate: "typecheck" | "unit" | "e2e" | "lint" | "manual";
        description?: string | undefined;
        pattern?: string | undefined;
        command?: string | undefined;
        specs?: string[] | undefined;
    }[];
    constraints: string[];
    scope: string[];
    context_files: string[];
    target?: {
        branch: string;
        repo: string;
    } | undefined;
    id?: string | undefined;
    repository?: {
        url: string;
        branch: string;
        baseBranch?: string | undefined;
    } | undefined;
    type?: "feature" | "bugfix" | "refactor" | undefined;
    description?: string | undefined;
    ems?: {
        stage: "dev" | "staging" | "prod";
        profile: string;
        target_type?: "angular" | "lambda" | "shared-lib" | undefined;
        app_name?: string | undefined;
        function_name?: string | undefined;
    } | undefined;
}, {
    name: string;
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
        beadsIssueId?: string | undefined;
    }[];
    target?: {
        repo: string;
        branch?: string | undefined;
    } | undefined;
    id?: string | undefined;
    priority?: number | undefined;
    repository?: {
        url: string;
        branch?: string | undefined;
        baseBranch?: string | undefined;
    } | undefined;
    type?: "feature" | "bugfix" | "refactor" | undefined;
    description?: string | undefined;
    acceptance_criteria?: string[] | undefined;
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
    max_qa_cycles?: number | undefined;
    validation_strategy?: {
        gate: "typecheck" | "unit" | "e2e" | "lint" | "manual";
        description?: string | undefined;
        pattern?: string | undefined;
        command?: string | undefined;
        specs?: string[] | undefined;
    }[] | undefined;
    constraints?: string[] | undefined;
    scope?: string[] | undefined;
    context_files?: string[] | undefined;
    ems?: {
        stage: "dev" | "staging" | "prod";
        profile: string;
        target_type?: "angular" | "lambda" | "shared-lib" | undefined;
        app_name?: string | undefined;
        function_name?: string | undefined;
    } | undefined;
}>;
export type Template = z.infer<typeof TemplateSchema>;
export type TemplateTask = z.infer<typeof TaskSchema>;
export interface IValidationGate {
    gate: 'typecheck' | 'unit' | 'e2e' | 'lint' | 'manual';
    command?: string;
    pattern?: string;
    specs?: string[];
    description?: string;
}
export interface IEmsExtensions {
    stage: 'dev' | 'staging' | 'prod';
    profile: string;
    target_type?: 'angular' | 'lambda' | 'shared-lib';
    app_name?: string;
    function_name?: string;
}
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
    type?: 'feature' | 'bugfix' | 'refactor';
    id?: string;
    description?: string;
    acceptance_criteria: string[];
    priority: number;
    max_qa_cycles: number;
    validation_strategy: IValidationGate[];
    constraints: string[];
    scope: string[];
    context_files: string[];
    ems?: IEmsExtensions;
}
export declare function parseTemplate(filePath: string): ParsedTemplate;
export declare function validateTemplateFile(filePath: string): {
    valid: boolean;
    errors: string[];
};
/**
 * Validates that a template has all required fields for the full pipeline
 * (planning → execution → validation → artifact generation).
 * Stricter than parseTemplate() which allows execution-only templates.
 */
export declare function validatePipelineTemplate(filePath: string): {
    valid: boolean;
    errors: string[];
};
export {};
