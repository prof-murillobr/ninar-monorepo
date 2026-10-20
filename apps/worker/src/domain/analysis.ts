export interface ClassificationPrediction {
  category: string;
  confidence: number;
}

export interface ClassificationResult {
  model: string;
  sample_rate: number;
  duration_seconds: number;
  predictions: ClassificationPrediction[];
  confidence_low?: boolean;
}

export interface AnalysisRepositoryPort {
  getStatus(id: string): Promise<string | null>;
  markProcessing(id: string): Promise<void>;
  markCompleted(id: string, result: ClassificationResult): Promise<void>;
  markFailed(id: string, message: string): Promise<void>;
}

export interface ObjectStoragePort {
  getObject(objectKey: string): Promise<{ body: Buffer; contentType: string }>;
  deleteObject(objectKey: string): Promise<void>;
}

export interface ClassifierPort {
  classify(input: { body: Buffer; contentType: string; filename: string }): Promise<ClassificationResult>;
}

export const ANALYSIS_REPOSITORY = Symbol('WORKER_ANALYSIS_REPOSITORY');
export const OBJECT_STORAGE = Symbol('WORKER_OBJECT_STORAGE');
export const CLASSIFIER = Symbol('CLASSIFIER');
