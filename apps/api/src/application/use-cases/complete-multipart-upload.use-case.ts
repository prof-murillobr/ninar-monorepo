import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ANALYSIS_REPOSITORY } from '../ports/analysis-repository.port.js';
import type { AnalysisRepositoryPort } from '../ports/analysis-repository.port.js';
import { OBJECT_STORAGE } from '../ports/object-storage.port.js';
import type { ObjectStoragePort } from '../ports/object-storage.port.js';

@Injectable()
export class CompleteMultipartUploadUseCase {
  constructor(
    @Inject(ANALYSIS_REPOSITORY) private readonly repository: AnalysisRepositoryPort,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
  ) {}

  async execute(input: { analysisId: string; uploadId: string; parts: Array<{ partNumber: number; etag: string }> }): Promise<void> {
    const analysis = await this.repository.findById(input.analysisId);
    if (!analysis) throw new NotFoundException('Analysis not found.');
    if (analysis.status !== 'upload_pending') throw new BadRequestException('Upload is no longer pending.');
    if (input.parts.length === 0) throw new BadRequestException('At least one uploaded part is required.');
    await this.storage.completeMultipartUpload({ objectKey: analysis.objectKey, uploadId: input.uploadId, parts: input.parts });
  }
}
