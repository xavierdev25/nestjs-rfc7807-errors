import { LoggerService, LogLevel } from '@nestjs/common';
import { RequestContext } from '../context/request-context';

export interface LogEntry {
  level: LogLevel;
  time: string;
  context?: string;
  message: unknown;
  correlationId?: string;
  requestId?: string;
  tenantId?: string;
  trace?: string;
}

/**
 * Structured (JSON, one object per line) logger for production.
 *
 * Every line is machine-parseable and automatically enriched with the
 * request-scoped `correlationId` / `requestId` / `tenantId` from
 * AsyncLocalStorage, so logs can be grepped/correlated end-to-end in a log
 * aggregator (CloudWatch Logs / ELK / Loki) without manual plumbing.
 *
 * Implemented against Nest's `LoggerService` with zero extra dependencies.
 */
export class JsonLogger implements LoggerService {
  log(message: unknown, ...optionalParams: unknown[]): void {
    this.emit(this.format('log', message, optionalParams));
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.emit(this.format('error', message, optionalParams), true);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.emit(this.format('warn', message, optionalParams));
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.emit(this.format('debug', message, optionalParams));
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.emit(this.format('verbose', message, optionalParams));
  }

  /**
   * Builds the structured entry. Nest passes the logger `context` as the last
   * string param, and `error()` may include a stack trace before it.
   */
  format(
    level: LogLevel,
    message: unknown,
    optionalParams: unknown[],
  ): LogEntry {
    const params = [...optionalParams];
    let context: string | undefined;
    let trace: string | undefined;

    if (typeof params[params.length - 1] === 'string') {
      context = params.pop() as string;
    }
    if (level === 'error' && typeof params[params.length - 1] === 'string') {
      trace = params.pop() as string;
    }

    const ctx = RequestContext.current();
    return {
      level,
      time: new Date().toISOString(),
      context,
      message,
      correlationId: ctx?.correlationId,
      requestId: ctx?.requestId,
      tenantId: ctx?.tenantId ?? undefined,
      ...(trace ? { trace } : {}),
    };
  }

  private emit(entry: LogEntry, isError = false): void {
    const line = JSON.stringify(entry) + '\n';
    (isError ? process.stderr : process.stdout).write(line);
  }
}
