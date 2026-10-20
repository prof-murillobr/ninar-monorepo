import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WorkerService } from './worker.service.js';
import { PostgresAnalysisRepository } from './adapters/persistence/postgres-analysis.repository.js';
import { S3ObjectStorageAdapter } from './adapters/storage/s3-object.storage.js';
import { HttpClassifierAdapter } from './adapters/classifier/http-classifier.adapter.js';
import { ANALYSIS_REPOSITORY, CLASSIFIER, OBJECT_STORAGE } from './domain/analysis.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  providers: [
    WorkerService,
    { provide: ANALYSIS_REPOSITORY, useClass: PostgresAnalysisRepository },
    { provide: OBJECT_STORAGE, useClass: S3ObjectStorageAdapter },
    { provide: CLASSIFIER, useClass: HttpClassifierAdapter },
  ],
})
export class AppModule {}
