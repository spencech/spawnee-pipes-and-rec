export interface CursorAgentConfig {
    prompt: string;
    repository: string;
    branch?: string;
    ref?: string;
    model?: string;
    autoCreatePr?: boolean;
    branchName?: string;
}
export interface CursorAgent {
    id: string;
    name?: string;
    status: AgentStatus;
    source: {
        repository: string;
        ref?: string;
    };
    target?: {
        branchName?: string;
        url?: string;
        prUrl?: string;
        autoCreatePr?: boolean;
        openAsCursorGithubApp?: boolean;
        skipReviewerRequest?: boolean;
    };
    summary?: string;
    createdAt: string;
}
export type AgentStatus = 'CREATING' | 'RUNNING' | 'FINISHED' | 'FAILED' | 'STOPPED' | 'EXPIRED';
export interface AgentListResponse {
    agents: CursorAgent[];
    nextCursor?: string;
}
export interface CreateAgentRequest {
    prompt: {
        text: string;
        images?: Array<{
            data: string;
            dimension: {
                width: number;
                height: number;
            };
        }>;
    };
    model?: string;
    source: {
        repository: string;
        ref?: string;
    };
    target?: {
        autoCreatePr?: boolean;
        openAsCursorGithubApp?: boolean;
        skipReviewerRequest?: boolean;
        branchName?: string;
    };
    webhook?: {
        url: string;
        secret?: string;
    };
}
export interface ModelsListResponse {
    models: string[];
}
