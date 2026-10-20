import { Injectable } from '@nestjs/common';

@Injectable()
export class MetricsService {
  private readonly counters = new Map<string, number>();

  increment(name: string): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + 1);
  }

  prometheus(): string {
    const lines = [
      '# HELP ninar_http_requests_total Total HTTP requests handled by the API.',
      '# TYPE ninar_http_requests_total counter',
      `ninar_http_requests_total ${this.counters.get('http_requests_total') ?? 0}`,
      '# HELP ninar_http_errors_total Total HTTP handler errors.',
      '# TYPE ninar_http_errors_total counter',
      `ninar_http_errors_total ${this.counters.get('http_errors_total') ?? 0}`,
      '# HELP ninar_process_uptime_seconds Process uptime in seconds.',
      '# TYPE ninar_process_uptime_seconds gauge',
      `ninar_process_uptime_seconds ${process.uptime().toFixed(2)}`,
      '# HELP ninar_process_resident_memory_bytes Resident process memory.',
      '# TYPE ninar_process_resident_memory_bytes gauge',
      `ninar_process_resident_memory_bytes ${process.memoryUsage().rss}`,
    ];
    return `${lines.join('\n')}\n`;
  }
}
