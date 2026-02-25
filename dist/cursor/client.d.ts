import { EventEmitter } from 'events';
import { CursorAgentConfig, CursorAgent, AgentListResponse, ModelsListResponse } from './types.js';
import { RetryOptions } from '../utils/retry.js';
export declare class CursorClient extends EventEmitter {
    private client;
    private pollIntervals;
    private logger;
    private apiKey;
    constructor(apiKey: string, baseUrl?: string);
    createAgent(config: CursorAgentConfig, retryOpts?: RetryOptions): Promise<CursorAgent>;
    getAgent(agentId: string): Promise<CursorAgent>;
    listAgents(limit?: number, cursor?: string): Promise<AgentListResponse>;
    listModels(): Promise<ModelsListResponse>;
    sendFollowUp(agentId: string, message: string): Promise<void>;
    stopAgent(agentId: string): Promise<void>;
    cancelAgent(agentId: string): Promise<void>;
    deleteAgent(agentId: string): Promise<void>;
    startMonitoring(agentId: string, intervalMs?: number): void;
    stopMonitoring(agentId: string): void;
    stopAllMonitoring(): void;
}
