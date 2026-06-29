import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants';

export type CheckStatus = 'up' | 'down';

export interface DependencyCheck {
  status: CheckStatus;
  latencyMs?: number;
  error?: string;
}

export interface ReadinessReport {
  status: CheckStatus;
  checks: Record<string, DependencyCheck>;
}

/**
 * Probes the application's critical stateful dependencies for readiness.
 *
 * Liveness (is the process up?) is intentionally separate and cheap — these
 * checks answer "can this instance actually serve traffic right now?", which is
 * what a load balancer / orchestrator should gate routing on.
 */
@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async readiness(): Promise<ReadinessReport> {
    const [database, cache] = await Promise.all([
      this.timed(() => this.dataSource.query('SELECT 1')),
      this.timed(() => this.redis.ping()),
    ]);

    const checks = { database, cache };
    const status: CheckStatus = Object.values(checks).every(
      (c) => c.status === 'up',
    )
      ? 'up'
      : 'down';

    return { status, checks };
  }

  private async timed(probe: () => Promise<unknown>): Promise<DependencyCheck> {
    const started = Date.now();
    try {
      await probe();
      return { status: 'up', latencyMs: Date.now() - started };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Readiness probe failed: ${message}`);
      return {
        status: 'down',
        latencyMs: Date.now() - started,
        error: message,
      };
    }
  }
}
