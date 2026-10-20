import { Controller, Get, Header } from '@nestjs/common';
import { AppService } from './app.service.js';
import { MetricsService } from './metrics.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService, private readonly metrics: MetricsService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth() {
    return {
      service: 'ninar-api',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4')
  getMetrics() {
    return this.metrics.prometheus();
  }
}
