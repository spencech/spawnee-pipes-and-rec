export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export declare class Logger {
    private context;
    private minLevel;
    constructor(context: string, minLevel?: LogLevel);
    private levels;
    private shouldLog;
    private timestamp;
    private format;
    debug(message: string): void;
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
    success(message: string): void;
}
export declare const logger: Logger;
