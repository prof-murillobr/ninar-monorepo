import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ANALYSIS_REPOSITORY } from '../ports/analysis-repository.port.js';
import type { AnalysisRepositoryPort } from '../ports/analysis-repository.port.js';
import { OBJECT_STORAGE } from '../ports/object-storage.port.js';
import type { ObjectStoragePort } from '../ports/object-storage.port.js';
import { ANALYSIS_CACHE } from '../ports/cache.port.js';
import type { AnalysisCachePort } from '../ports/cache.port.js';

@Injectable()
export class DeleteAnalysisUseCase {
  constructor(
    @Inject(ANALYSIS_REPOSITORY) private readonly repository: AnalysisRepositoryPort,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
    @Inject(ANALYSIS_CACHE) private readonly cache: AnalysisCachePort,
  ) {}

  async execute(id: string): Promise<void> {
    const analysis = await this.repository.findById(id);
    if (!analysis) throw new NotFoundException('Analysis not found.');

    await this.storage.deleteObject(analysis.objectKey);
    await this.repository.delete(id);
    await this.cache.delete(`analysis:${id}`);
  }
}
