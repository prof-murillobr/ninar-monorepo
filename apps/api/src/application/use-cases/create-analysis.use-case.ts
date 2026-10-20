import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { NewAnalysis } from '../../domain/analysis.js';
import { ANALYSIS_QUEUE } from '../ports/analysis-queue.port.js';
import type { AnalysisQueuePort } from '../ports/analysis-queue.port.js';
import { ANALYSIS_REPOSITORY } from '../ports/analysis-repository.port.js';
import type { AnalysisRepositoryPort } from '../ports/analysis-repository.port.js';

@Injectable()
export class CreateAnalysisUseCase {
  constructor(
    @Inject(ANALYSIS_REPOSITORY) private readonly repository: AnalysisRepositoryPort,
    @Inject(ANALYSIS_QUEUE) private readonly queue: AnalysisQueuePort,
  ) {}

  async execute(input: NewAnalysis) {
    if (!input.objectKey.startsWith(`analyses/${input.id}/`)) {
      throw new BadRequestException('objectKey does not belong to analysisId.');
    }
    const analysis = await this.repository.create(input);
    try {
      await this.queue.publish({ id: analysis.id, objectKey: analysis.objectKey });
    } catch (error) {
      await this.repository.markFailed(analysis.id, 'Unable to enqueue analysis.');
      throw error;
    }
    return analysis;
  }
}
