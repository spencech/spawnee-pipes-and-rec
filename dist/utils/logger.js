import chalk from 'chalk';
export class Logger {
    context;
    minLevel;
    constructor(context, minLevel = 'info') {
        this.context = context;
        this.minLevel = minLevel;
    }
    levels = { debug: 0, info: 1, warn: 2, error: 3 };
    shouldLog(level) {
        return this.levels[level] >= this.levels[this.minLevel];
    }
    timestamp() {
        return new Date().toISOString().slice(11, 19);
    }
    format(level, message) {
        const colors = {
            debug: chalk.gray,
            info: chalk.blue,
            warn: chalk.yellow,
            error: chalk.red,
        };
        return `${chalk.gray(`[${this.timestamp()}]`)} ${colors[level](`[${this.context}]`)} ${message}`;
    }
    debug(message) {
        if (this.shouldLog('debug'))
            console.log(this.format('debug', message));
    }
    info(message) {
        if (this.shouldLog('info'))
            console.log(this.format('info', message));
    }
    warn(message) {
        if (this.shouldLog('warn'))
            console.log(this.format('warn', `⚠ ${message}`));
    }
    error(message) {
        if (this.shouldLog('error'))
            console.log(this.format('error', `✗ ${message}`));
    }
    success(message) {
        if (this.shouldLog('info'))
            console.log(this.format('info', chalk.green(`✓ ${message}`)));
    }
}
export const logger = new Logger('Main');
//# sourceMappingURL=logger.js.map