import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './shared/auth/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * GET /health — Public health check endpoint.
   * Used by Docker Compose, load balancers, and monitoring.
   */
  @Public()
  @Get('health')
  healthCheck() {
    return this.appService.getHealth();
  }
}
