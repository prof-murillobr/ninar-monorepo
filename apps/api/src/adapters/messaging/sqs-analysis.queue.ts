import { Injectable } from '@nestjs/common';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { AnalysisQueuePort } from '../../application/ports/analysis-queue.port.js';

@Injectable()
export class SqsAnalysisQueueAdapter implements AnalysisQueuePort {
  private readonly queueUrl = process.env.SQS_QUEUE_URL ?? '';
  private readonly client = new SQSClient({
    region: process.env.AWS_REGION ?? 'us-east-1',
    endpoint: process.env.AWS_ENDPOINT_URL,
  });

  async publish(input: { id: string; objectKey: string }): Promise<void> {
    if (!this.queueUrl) throw new Error('SQS_QUEUE_URL is not configured.');
    await this.client.send(
      new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify({ analysisId: input.id, objectKey: input.objectKey }),
      }),
    );
  }
}
