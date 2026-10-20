import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Analysis, analysisIsTerminal } from '../../domain/analysis.js';
import { ANALYSIS_CACHE } from '../ports/cache.port.js';
import type { AnalysisCachePort } from '../ports/cache.port.js';
import { ANALYSIS_REPOSITORY } from '../ports/analysis-repository.port.js';
import type { AnalysisRepositoryPort } from '../ports/analysis-repository.port.js';

@Injectable()
export class GetAnalysisUseCase {
  constructor(
    @Inject(ANALYSIS_REPOSITORY) private readonly repository: AnalysisRepositoryPort,
    @Inject(ANALYSIS_CACHE) private readonly cache: AnalysisCachePort,
  ) {}

  async execute(id: string): Promise<Analysis> {
    const cacheKey = `analysis:${id}`;
    const cached = await this.cache.get<Analysis>(cacheKey);
    if (cached && analysisIsTerminal(cached.status)) return cached;

    const analysis = await this.repository.findById(id);
    if (!analysis) throw new NotFoundException('Analysis not found.');
    if (analysis.status === 'completed') await this.cache.set(cacheKey, analysis, 30);
    return analysis;
  }
}
