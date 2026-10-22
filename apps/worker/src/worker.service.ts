import { DeleteMessageCommand, ReceiveMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { Inject, Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ANALYSIS_REPOSITORY, CLASSIFIER, OBJECT_STORAGE } from './domain/analysis.js';
import type { AnalysisRepositoryPort, ClassifierPort, ObjectStoragePort } from './domain/analysis.js';
import type { ClassificationResult } from './domain/analysis.js';

type S3EventRecord = {
  eventName?: string;
  s3?: { object?: { key?: string } };
};

@Injectable()
export class WorkerService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(WorkerService.name);
  private readonly sqs: SQSClient;
  private readonly queueUrl: string;
  private readonly concurrency = Math.max(1, Math.min(10, Number(process.env.WORKER_CONCURRENCY ?? 1)));
  private running = true;

  constructor(
    @Inject(ANALYSIS_REPOSITORY) private readonly repository: AnalysisRepositoryPort,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
    @Inject(CLASSIFIER) private readonly classifier: ClassifierPort,
  ) {
    this.sqs = new SQSClient({ region: process.env.AWS_REGION ?? 'us-east-1', endpoint: process.env.AWS_ENDPOINT_URL || undefined });
    this.queueUrl = process.env.SQS_QUEUE_URL ?? '';
  }

  async onModuleInit() {
    if (process.env.WORKER_ENABLED !== 'true') {
      this.logger.log('Worker disabled (set WORKER_ENABLED=true to consume SQS).');
      return;
    }
    if (!this.queueUrl) {
      this.logger.warn('SQS_QUEUE_URL is not configured; worker will stay idle.');
      return;
    }
    this.logger.log(JSON.stringify({ event: 'worker_started', queueUrl: this.queueUrl, concurrency: this.concurrency }));
    void this.consume();
  }

  async onApplicationShutdown() {
    this.running = false;
  }

  private async consume() {
    while (this.running) {
      try {
        const response = await this.sqs.send(new ReceiveMessageCommand({
          QueueUrl: this.queueUrl,
          MaxNumberOfMessages: this.concurrency,
          WaitTimeSeconds: 20,
          VisibilityTimeout: 900,
          AttributeNames: ['All'],
        }));
        const results = await Promise.allSettled((response.Messages ?? []).map(async (message) => {
          await this.process(message.Body ?? '{}');
          if (message.ReceiptHandle) {
            await this.sqs.send(new DeleteMessageCommand({ QueueUrl: this.queueUrl, ReceiptHandle: message.ReceiptHandle }));
          }
        }));
        results.forEach((result) => {
          if (result.status === 'rejected') this.logger.error(JSON.stringify({ event: 'message_failed', error: String(result.reason) }));
        });
      } catch (error) {
        this.logger.error(JSON.stringify({ event: 'queue_cycle_failed', error: error instanceof Error ? error.message : String(error) }));
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }

  private async process(body: string) {
    const payload = this.parseS3Event(body);
    // Floci (like S3) emits a test event when a notification target is
    // configured. It has no Records array and must not create a job.
    if (!payload) return;
    const { analysisId, objectKey } = payload;

    if ((await this.repository.getStatus(analysisId)) === 'completed') {
      await this.storage.deleteObject(objectKey);
      this.logger.log(JSON.stringify({ event: 'message_already_completed', analysisId }));
      return;
    }
    await this.repository.markProcessing(analysisId);
    let result: ClassificationResult;
    try {
      const audio = await this.storage.getObject(objectKey);
      result = await this.classifier.classify({
        body: audio.body,
        contentType: audio.contentType,
        filename: objectKey.split('/').pop() ?? 'audio.bin',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.repository.markFailed(analysisId, message);
      throw error;
    }
    await this.repository.markCompleted(analysisId, result);
    try {
      await this.storage.deleteObject(objectKey);
    } catch (error) {
      this.logger.error(JSON.stringify({ event: 'audio_cleanup_failed', analysisId, objectKey, error: String(error) }));
      throw error;
    }
    this.logger.log(JSON.stringify({ event: 'analysis_completed', analysisId, objectKey }));
  }

  private parseS3Event(body: string): { analysisId: string; objectKey: string } | null {
    let event: { Records?: S3EventRecord[] };
    try {
      event = JSON.parse(body) as { Records?: S3EventRecord[] };
    } catch {
      throw new Error('Invalid JSON message.');
    }
    const record = event.Records?.find((candidate) => /^(s3:)?ObjectCreated:/.test(candidate.eventName ?? ''));
    if (!record) return null;
    const encodedKey = record.s3?.object?.key;
    if (!encodedKey) throw new Error('S3 event does not contain an object key.');
    const objectKey = decodeURIComponent(encodedKey.replace(/\+/g, ' '));
    const match = /^analyses\/([0-9a-f-]{36})\/.+$/i.exec(objectKey);
    if (!match) {
      this.logger.warn(JSON.stringify({ event: 'ignored_s3_object', objectKey }));
      return null;
    }
    return { analysisId: match[1], objectKey };
  }
}
