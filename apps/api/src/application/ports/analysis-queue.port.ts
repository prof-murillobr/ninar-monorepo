import { NewAnalysis } from '../../domain/analysis.js';

export const ANALYSIS_QUEUE = Symbol('ANALYSIS_QUEUE');

export interface AnalysisQueuePort {
  publish(input: Pick<NewAnalysis, 'id' | 'objectKey'>): Promise<void>;
}
