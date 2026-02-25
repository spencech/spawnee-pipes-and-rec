import { z } from 'zod';
declare const ConfigSchema: z.ZodObject<{
    apiKey: z.ZodString;
    apiBaseUrl: z.ZodDefault<z.ZodString>;
    maxConcurrent: z.ZodDefault<z.ZodNumber>;
    pollInterval: z.ZodDefault<z.ZodNumber>;
    defaultTimeout: z.ZodDefault<z.ZodNumber>;
    stateFile: z.ZodDefault<z.ZodString>;
    verbose: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    apiKey: string;
    apiBaseUrl: string;
    maxConcurrent: number;
    pollInterval: number;
    defaultTimeout: number;
    stateFile: string;
    verbose: boolean;
}, {
    apiKey: string;
    apiBaseUrl?: string | undefined;
    maxConcurrent?: number | undefined;
    pollInterval?: number | undefined;
    defaultTimeout?: number | undefined;
    stateFile?: string | undefined;
    verbose?: boolean | undefined;
}>;
export type Config = z.infer<typeof ConfigSchema>;
export interface ConfigOverrides {
    apiKey?: string;
    apiBaseUrl?: string;
    maxConcurrent?: number;
    pollInterval?: number;
    defaultTimeout?: number;
    stateFile?: string;
    verbose?: boolean;
    configFile?: string;
}
declare const DEFAULT_CONFIG_FILENAME = ".spawneerc.json";
export declare function loadConfig(overrides?: ConfigOverrides): Config;
export declare function generateDefaultConfig(): string;
export declare function getConfigFilePath(): string;
export { DEFAULT_CONFIG_FILENAME };
