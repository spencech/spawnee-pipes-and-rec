import axios from 'axios';
import { EventEmitter } from 'events';
import { retry } from '../utils/retry.js';
import { Logger } from '../utils/logger.js';
export class CursorClient extends EventEmitter {
    client;
    pollIntervals = new Map();
    logger;
    apiKey;
    constructor(apiKey, baseUrl = 'https://api.cursor.com') {
        super();
        this.apiKey = apiKey;
        this.logger = new Logger('CursorClient');
        // Cursor API uses Basic Auth: apiKey: (empty password)
        const auth = Buffer.from(`${apiKey}:`).toString('base64');
        this.client = axios.create({
            baseURL: baseUrl,
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000,
        });
        this.client.interceptors.response.use(response => response, (error) => {
            const status = error.response?.status;
            const responseData = error.response?.data;
            const message = responseData?.message || responseData?.error || error.message;
            const details = responseData?.details ? JSON.stringify(responseData.details, null, 2) : '';
            this.logger.error(`API Error [${status}]: ${message}${details ? '\n' + details : ''}`);
            return Promise.reject(new Error(`Cursor API Error [${status}]: ${message}${details ? '\n' + details : ''}`));
        });
    }
    async createAgent(config, retryOpts) {
        // Normalize repository URL - remove .git suffix if present, ensure it's a full URL
        let repository = config.repository.trim();
        if (repository.endsWith('.git')) {
            repository = repository.slice(0, -4);
        }
        const request = {
            prompt: { text: config.prompt },
            source: {
                repository: repository,
                ref: config.ref || config.branch || 'main'
            },
            ...(config.model && { model: config.model }),
            ...(config.autoCreatePr !== undefined || config.branchName ? {
                target: {
                    ...(config.autoCreatePr !== undefined && { autoCreatePr: config.autoCreatePr }),
                    ...(config.branchName && { branchName: config.branchName }),
                }
            } : {}),
        };
        this.logger.debug(`Creating agent with request: ${JSON.stringify(request, null, 2)}`);
        return retry(async () => {
            try {
                const response = await this.client.post('/v0/agents', request);
                return response.data;
            }
            catch (error) {
                // Log the full error for debugging
                if (error.response?.data) {
                    this.logger.debug(`API Error Response: ${JSON.stringify(error.response.data, null, 2)}`);
                }
                throw error;
            }
        }, retryOpts);
    }
    async getAgent(agentId) {
        const response = await this.client.get(`/v0/agents/${agentId}`);
        return response.data;
    }
    async listAgents(limit, cursor) {
        const params = {};
        if (limit !== undefined)
            params.limit = limit;
        if (cursor)
            params.cursor = cursor;
        const response = await this.client.get('/v0/agents', { params });
        return response.data;
    }
    async listModels() {
        const response = await this.client.get('/v0/models');
        return response.data;
    }
    async sendFollowUp(agentId, message) {
        await this.client.post(`/v0/agents/${agentId}/followup`, {
            prompt: { text: message }
        });
    }
    async stopAgent(agentId) {
        await this.client.post(`/v0/agents/${agentId}/stop`);
    }
    async cancelAgent(agentId) {
        // Alias for stopAgent for backward compatibility
        await this.stopAgent(agentId);
    }
    async deleteAgent(agentId) {
        await this.client.delete(`/v0/agents/${agentId}`);
    }
    startMonitoring(agentId, intervalMs = 15000) {
        if (this.pollIntervals.has(agentId))
            return;
        const poll = async () => {
            try {
                const agent = await this.getAgent(agentId);
                this.emit('status', { agentId, ...agent });
                // Map Cursor API statuses to our internal statuses
                const finishedStatuses = ['FINISHED', 'FAILED', 'STOPPED', 'EXPIRED'];
                if (finishedStatuses.includes(agent.status)) {
                    this.stopMonitoring(agentId);
                    // Map FINISHED -> completed, FAILED -> failed, STOPPED/EXPIRED -> cancelled
                    const mappedStatus = agent.status === 'FINISHED' ? 'completed' :
                        agent.status === 'FAILED' ? 'failed' : 'cancelled';
                    this.emit(mappedStatus, { agentId, ...agent });
                }
            }
            catch (error) {
                this.emit('error', { agentId, error });
            }
        };
        poll();
        const interval = setInterval(poll, intervalMs);
        this.pollIntervals.set(agentId, interval);
    }
    stopMonitoring(agentId) {
        const interval = this.pollIntervals.get(agentId);
        if (!interval)
            return;
        clearInterval(interval);
        this.pollIntervals.delete(agentId);
    }
    stopAllMonitoring() {
        for (const agentId of this.pollIntervals.keys())
            this.stopMonitoring(agentId);
    }
}
//# sourceMappingURL=client.js.map