export const ANALYSIS_CACHE = Symbol('ANALYSIS_CACHE');

export interface AnalysisCachePort {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
}
