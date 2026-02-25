import { z } from 'zod';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ConfigSchema = z.object({
  apiKey: z.string().min(1, 'API key is required. Set SPAWNEE_API_KEY or use --api-key'),
  apiBaseUrl: z.string().url().default('https://api.cursor.com'),
  maxConcurrent: z.number().min(1).max(256).default(10),
  pollInterval: z.number().min(5000).default(15000),
  defaultTimeout: z.number().min(60000).default(3600000),
  stateFile: z.string().default('.spawnee-state.json'),
  verbose: z.boolean().default(false),
});

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

const DEFAULT_CONFIG_FILENAME = '.spawneerc.json';

function loadConfigFile(configPath?: string): Partial<Config> {
  const paths = configPath 
    ? [resolve(configPath)] 
    : [resolve(process.cwd(), DEFAULT_CONFIG_FILENAME), resolve(process.env.HOME || '', DEFAULT_CONFIG_FILENAME)];

  for (const filePath of paths) {
    if (!existsSync(filePath)) continue;
    try {
      const content = readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as Partial<Config>;
    } catch {
      if (configPath) throw new Error(`Failed to parse config file: ${filePath}`); // Only throw if explicitly specified
    }
  }

  return {};
}

function loadEnvConfig(): Partial<Config> {
  const env: Partial<Config> = {};
  
  if (process.env.SPAWNEE_API_KEY) env.apiKey = process.env.SPAWNEE_API_KEY;
  if (process.env.SPAWNEE_API_URL) env.apiBaseUrl = process.env.SPAWNEE_API_URL;
  if (process.env.SPAWNEE_CONCURRENCY) env.maxConcurrent = parseInt(process.env.SPAWNEE_CONCURRENCY, 10);
  if (process.env.SPAWNEE_POLL_INTERVAL) env.pollInterval = parseInt(process.env.SPAWNEE_POLL_INTERVAL, 10);
  if (process.env.SPAWNEE_TIMEOUT) env.defaultTimeout = parseInt(process.env.SPAWNEE_TIMEOUT, 10);
  if (process.env.SPAWNEE_STATE_FILE) env.stateFile = process.env.SPAWNEE_STATE_FILE;
  if (process.env.SPAWNEE_VERBOSE) env.verbose = process.env.SPAWNEE_VERBOSE === 'true' || process.env.SPAWNEE_VERBOSE === '1';

  return env;
}

export function loadConfig(overrides: ConfigOverrides = {}): Config {
  const fileConfig = loadConfigFile(overrides.configFile); // Priority 3: Config file
  const envConfig = loadEnvConfig(); // Priority 2: Environment variables
  
  const { configFile: _, ...cliOverrides } = overrides; // Priority 1: CLI flags (strip configFile key)
  const filteredOverrides = Object.fromEntries(Object.entries(cliOverrides).filter(([, v]) => v !== undefined));

  const merged = { ...fileConfig, ...envConfig, ...filteredOverrides };
  return ConfigSchema.parse(merged);
}

export function generateDefaultConfig(): string {
  const template: Record<string, unknown> = {
    apiKey: '',
    apiBaseUrl: 'https://api.cursor.com',
    maxConcurrent: 10,
    pollInterval: 15000,
    defaultTimeout: 3600000,
    stateFile: '.spawnee-state.json',
    verbose: false,
  };
  return JSON.stringify(template, null, 2);
}

export function getConfigFilePath(): string {
  return resolve(process.cwd(), DEFAULT_CONFIG_FILENAME);
}

export { DEFAULT_CONFIG_FILENAME };
