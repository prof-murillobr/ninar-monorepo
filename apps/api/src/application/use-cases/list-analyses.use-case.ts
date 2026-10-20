import { Inject, Injectable } from '@nestjs/common';
import { ANALYSIS_REPOSITORY } from '../ports/analysis-repository.port.js';
import type { AnalysisRepositoryPort } from '../ports/analysis-repository.port.js';

@Injectable()
export class ListAnalysesUseCase {
  constructor(@Inject(ANALYSIS_REPOSITORY) private readonly repository: AnalysisRepositoryPort) {}

  execute(limit = 20) {
    return this.repository.list(Math.min(Math.max(limit, 1), 100));
  }
}
