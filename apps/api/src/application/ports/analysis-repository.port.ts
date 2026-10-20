import { Analysis, ClassificationResult, NewAnalysis } from '../../domain/analysis.js';

export const ANALYSIS_REPOSITORY = Symbol('ANALYSIS_REPOSITORY');

export interface AnalysisRepositoryPort {
  create(input: NewAnalysis): Promise<Analysis>;
  findById(id: string): Promise<Analysis | null>;
  list(limit: number): Promise<Analysis[]>;
  delete(id: string): Promise<boolean>;
  markProcessing(id: string): Promise<void>;
  markCompleted(id: string, result: ClassificationResult): Promise<void>;
  markFailed(id: string, message: string): Promise<void>;
}
