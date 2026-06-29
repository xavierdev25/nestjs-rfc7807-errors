import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { SkipRateLimit } from '../rate-limit/rate-limit.decorator';
import { HealthService, ReadinessReport } from './health.service';

/**
 * Kubernetes/ALB-style probes. Both are public and not rate-limited so
 * orchestrator health checks are never blocked.
 *
 * - `GET /health/live`  — liveness: the process is running.
 * - `GET /health/ready` — readiness: critical dependencies (DB, cache) are
 *   reachable. Returns 503 if any is down so the LB stops routing to this pod.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Public()
  @SkipRateLimit()
  @Get('live')
  @HttpCode(HttpStatus.OK)
  liveness(): { status: 'ok'; uptime: number } {
    return { status: 'ok', uptime: process.uptime() };
  }

  @Public()
  @SkipRateLimit()
  @Get('ready')
  async readiness(): Promise<ReadinessReport> {
    const report = await this.health.readiness();
    if (report.status !== 'up') {
      // Mapped to RFC 7807 (503) by the global exception filter.
      throw new ServiceUnavailableException({
        message: 'One or more dependencies are not ready',
        ...report,
      });
    }
    return report;
  }
}
