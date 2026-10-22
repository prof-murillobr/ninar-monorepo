import { Inject, Injectable } from '@nestjs/common';
import { ID_GENERATOR } from '../ports/id-generator.port.js';
import type { IdGeneratorPort } from '../ports/id-generator.port.js';
import { OBJECT_STORAGE } from '../ports/object-storage.port.js';
import type { ObjectStoragePort } from '../ports/object-storage.port.js';
import { ANALYSIS_REPOSITORY } from '../ports/analysis-repository.port.js';
import type { AnalysisRepositoryPort } from '../ports/analysis-repository.port.js';

export interface CreateUploadUrlInput {
  filename: string;
  contentType: string;
  size: number;
}

export interface CreateUploadUrlOutput {
  analysisId: string;
  objectKey: string;
  expiresInSeconds: number;
  upload: { kind: 'single'; uploadUrl: string } | { kind: 'multipart'; uploadId: string; partSize: number; partUrls: string[] };
}

@Injectable()
export class CreateUploadUrlUseCase {
  private readonly expiresInSeconds = 900;
  private readonly multipartThresholdBytes = Number(process.env.MULTIPART_THRESHOLD_BYTES ?? 8 * 1024 * 1024);
  private readonly multipartPartSize = Math.max(5 * 1024 * 1024, Number(process.env.MULTIPART_PART_SIZE_BYTES ?? 5 * 1024 * 1024));

  constructor(
    @Inject(ID_GENERATOR) private readonly idGenerator: IdGeneratorPort,
    @Inject(OBJECT_STORAGE) private readonly objectStorage: ObjectStoragePort,
    @Inject(ANALYSIS_REPOSITORY) private readonly repository: AnalysisRepositoryPort,
  ) {}

  async execute(input: CreateUploadUrlInput): Promise<CreateUploadUrlOutput> {
    const analysisId = this.idGenerator.generate();
    const safeFilename = input.filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
    const objectKey = `analyses/${analysisId}/${safeFilename || 'audio.bin'}`;
    // The record exists before the object upload. S3 is then the source of the
    // processing event; the browser never needs to enqueue a job itself.
    await this.repository.create({
      id: analysisId,
      objectKey,
      originalFilename: input.filename,
      contentType: input.contentType,
    });

    if (input.size < this.multipartThresholdBytes) {
      const uploadUrl = await this.objectStorage.createUploadUrl({
        objectKey,
        contentType: input.contentType,
        expiresInSeconds: this.expiresInSeconds,
      });
      return { analysisId, objectKey, expiresInSeconds: this.expiresInSeconds, upload: { kind: 'single', uploadUrl } };
    }

    const { uploadId } = await this.objectStorage.createMultipartUpload({ objectKey, contentType: input.contentType });
    const partCount = Math.ceil(input.size / this.multipartPartSize);
    const partUrls = await Promise.all(
      Array.from({ length: partCount }, (_, index) => this.objectStorage.createUploadPartUrl({
        objectKey,
        uploadId,
        partNumber: index + 1,
        expiresInSeconds: this.expiresInSeconds,
      })),
    );

    return {
      analysisId,
      objectKey,
      expiresInSeconds: this.expiresInSeconds,
      upload: { kind: 'multipart', uploadId, partSize: this.multipartPartSize, partUrls },
    };
  }
}
