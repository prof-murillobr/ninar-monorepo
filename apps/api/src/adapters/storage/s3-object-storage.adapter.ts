import { Injectable } from '@nestjs/common';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ObjectStoragePort } from '../../application/ports/object-storage.port.js';

@Injectable()
export class S3ObjectStorageAdapter implements ObjectStoragePort {
  private readonly bucket = process.env.S3_BUCKET ?? 'ninar-audio';
  private readonly presignClient = new S3Client({
    region: process.env.AWS_REGION ?? 'us-east-1',
    endpoint: process.env.S3_PUBLIC_ENDPOINT || process.env.S3_ENDPOINT || process.env.AWS_ENDPOINT_URL,
    forcePathStyle: Boolean(process.env.S3_PUBLIC_ENDPOINT || process.env.S3_ENDPOINT || process.env.AWS_ENDPOINT_URL),
    requestChecksumCalculation: 'WHEN_REQUIRED',
  });
  private readonly serverClient = new S3Client({
    region: process.env.AWS_REGION ?? 'us-east-1',
    endpoint: process.env.S3_ENDPOINT || process.env.AWS_ENDPOINT_URL || undefined,
    forcePathStyle: Boolean(process.env.S3_ENDPOINT || process.env.AWS_ENDPOINT_URL),
    requestChecksumCalculation: 'WHEN_REQUIRED',
  });

  createUploadUrl(input: { objectKey: string; contentType: string; expiresInSeconds: number }): Promise<string> {
    return getSignedUrl(
      this.presignClient,
      new PutObjectCommand({ Bucket: this.bucket, Key: input.objectKey, ContentType: input.contentType }),
      { expiresIn: input.expiresInSeconds },
    );
  }

  async deleteObject(objectKey: string): Promise<void> {
    await this.serverClient.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: objectKey }));
  }
}
