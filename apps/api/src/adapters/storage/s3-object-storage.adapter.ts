import { Injectable } from '@nestjs/common';
import {
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
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

  async createMultipartUpload(input: { objectKey: string; contentType: string }): Promise<{ uploadId: string }> {
    const response = await this.serverClient.send(new CreateMultipartUploadCommand({
      Bucket: this.bucket,
      Key: input.objectKey,
      ContentType: input.contentType,
    }));
    if (!response.UploadId) throw new Error('Storage did not return an upload ID.');
    return { uploadId: response.UploadId };
  }

  createUploadPartUrl(input: { objectKey: string; uploadId: string; partNumber: number; expiresInSeconds: number }): Promise<string> {
    return getSignedUrl(
      this.presignClient,
      new UploadPartCommand({
        Bucket: this.bucket,
        Key: input.objectKey,
        UploadId: input.uploadId,
        PartNumber: input.partNumber,
      }),
      { expiresIn: input.expiresInSeconds },
    );
  }

  async completeMultipartUpload(input: { objectKey: string; uploadId: string; parts: Array<{ partNumber: number; etag: string }> }): Promise<void> {
    await this.serverClient.send(new CompleteMultipartUploadCommand({
      Bucket: this.bucket,
      Key: input.objectKey,
      UploadId: input.uploadId,
      MultipartUpload: {
        Parts: input.parts.map((part) => ({ PartNumber: part.partNumber, ETag: part.etag })),
      },
    }));
  }

  async deleteObject(objectKey: string): Promise<void> {
    await this.serverClient.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: objectKey }));
  }
}
