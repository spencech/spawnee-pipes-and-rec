import chalk from 'chalk';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class Logger {
  constructor(private context: string, private minLevel: LogLevel = 'info') {}

  private levels: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[this.minLevel];
  }

  private timestamp(): string {
    return new Date().toISOString().slice(11, 19);
  }

  private format(level: LogLevel, message: string): string {
    const colors: Record<LogLevel, (s: string) => string> = {
      debug: chalk.gray,
      info: chalk.blue,
      warn: chalk.yellow,
      error: chalk.red,
    };
    return `${chalk.gray(`[${this.timestamp()}]`)} ${colors[level](`[${this.context}]`)} ${message}`;
  }

  debug(message: string): void {
    if (this.shouldLog('debug')) console.log(this.format('debug', message));
  }

  info(message: string): void {
    if (this.shouldLog('info')) console.log(this.format('info', message));
  }

  warn(message: string): void {
    if (this.shouldLog('warn')) console.log(this.format('warn', `⚠ ${message}`));
  }

  error(message: string): void {
    if (this.shouldLog('error')) console.log(this.format('error', `✗ ${message}`));
  }

  success(message: string): void {
    if (this.shouldLog('info')) console.log(this.format('info', chalk.green(`✓ ${message}`)));
  }
}

export const logger = new Logger('Main');

