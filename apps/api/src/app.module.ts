import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AnalysesController } from './adapters/http/analyses.controller.js';
import { RedisAnalysisCacheAdapter } from './adapters/cache/redis-analysis.cache.js';
import { SqsAnalysisQueueAdapter } from './adapters/messaging/sqs-analysis.queue.js';
import { PostgresAnalysisRepository } from './adapters/persistence/postgres-analysis.repository.js';
import { S3ObjectStorageAdapter } from './adapters/storage/s3-object-storage.adapter.js';
import { UuidIdGeneratorAdapter } from './adapters/http/uuid.id-generator.js';
import { ANALYSIS_CACHE } from './application/ports/cache.port.js';
import { ANALYSIS_QUEUE } from './application/ports/analysis-queue.port.js';
import { ANALYSIS_REPOSITORY } from './application/ports/analysis-repository.port.js';
import { ID_GENERATOR } from './application/ports/id-generator.port.js';
import { OBJECT_STORAGE } from './application/ports/object-storage.port.js';
import { CreateAnalysisUseCase } from './application/use-cases/create-analysis.use-case.js';
import { CreateUploadUrlUseCase } from './application/use-cases/create-upload-url.use-case.js';
import { GetAnalysisUseCase } from './application/use-cases/get-analysis.use-case.js';
import { ListAnalysesUseCase } from './application/use-cases/list-analyses.use-case.js';
import { DeleteAnalysisUseCase } from './application/use-cases/delete-analysis.use-case.js';
import { MetricsService } from './metrics.service.js';
import { MetricsInterceptor } from './metrics.interceptor.js';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }])],
  controllers: [AppController, AnalysesController],
  providers: [
    AppService,
    CreateUploadUrlUseCase,
    CreateAnalysisUseCase,
    GetAnalysisUseCase,
    ListAnalysesUseCase,
    DeleteAnalysisUseCase,
    MetricsService,
    { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: ANALYSIS_REPOSITORY, useClass: PostgresAnalysisRepository },
    { provide: OBJECT_STORAGE, useClass: S3ObjectStorageAdapter },
    { provide: ANALYSIS_QUEUE, useClass: SqsAnalysisQueueAdapter },
    { provide: ID_GENERATOR, useClass: UuidIdGeneratorAdapter },
    { provide: ANALYSIS_CACHE, useClass: RedisAnalysisCacheAdapter },
  ],
})
export class AppModule {}
