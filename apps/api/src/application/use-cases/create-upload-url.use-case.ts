import { Inject, Injectable } from '@nestjs/common';
import { ID_GENERATOR } from '../ports/id-generator.port.js';
import type { IdGeneratorPort } from '../ports/id-generator.port.js';
import { OBJECT_STORAGE } from '../ports/object-storage.port.js';
import type { ObjectStoragePort } from '../ports/object-storage.port.js';

export interface CreateUploadUrlInput {
  filename: string;
  contentType: string;
}

export interface CreateUploadUrlOutput {
  analysisId: string;
  objectKey: string;
  uploadUrl: string;
  expiresInSeconds: number;
}

@Injectable()
export class CreateUploadUrlUseCase {
  private readonly expiresInSeconds = 900;

  constructor(
    @Inject(ID_GENERATOR) private readonly idGenerator: IdGeneratorPort,
    @Inject(OBJECT_STORAGE) private readonly objectStorage: ObjectStoragePort,
  ) {}

  async execute(input: CreateUploadUrlInput): Promise<CreateUploadUrlOutput> {
    const analysisId = this.idGenerator.generate();
    const safeFilename = input.filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
    const objectKey = `analyses/${analysisId}/${safeFilename || 'audio.bin'}`;
    const uploadUrl = await this.objectStorage.createUploadUrl({
      objectKey,
      contentType: input.contentType,
      expiresInSeconds: this.expiresInSeconds,
    });

    return { analysisId, objectKey, uploadUrl, expiresInSeconds: this.expiresInSeconds };
  }
}
