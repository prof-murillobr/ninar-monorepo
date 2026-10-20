import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { MetricsService } from './metrics.service.js';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    this.metrics.increment('http_requests_total');
    return next.handle().pipe(
      catchError((error: unknown) => {
        this.metrics.increment('http_errors_total');
        return throwError(() => error);
      }),
      tap(() => undefined),
    );
  }
}
