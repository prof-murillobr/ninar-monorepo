import { DeleteObjectCommand, GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ObjectStoragePort } from '../../domain/analysis.js';

@Injectable()
export class S3ObjectStorageAdapter implements ObjectStoragePort {
  private readonly bucket = process.env.S3_BUCKET ?? 'ninar-audio';
  private readonly client = new S3Client({
    region: process.env.AWS_REGION ?? 'us-east-1',
    endpoint: process.env.S3_ENDPOINT || process.env.AWS_ENDPOINT_URL,
    forcePathStyle: Boolean(process.env.S3_ENDPOINT || process.env.AWS_ENDPOINT_URL),
  });

  async getObject(objectKey: string): Promise<{ body: Buffer; contentType: string }> {
    const response = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }));
    if (!response.Body) throw new Error(`Audio object not found: ${objectKey}`);
    const bytes = await response.Body.transformToByteArray();
    return { body: Buffer.from(bytes), contentType: response.ContentType ?? 'application/octet-stream' };
  }

  async deleteObject(objectKey: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: objectKey }));
  }
}
