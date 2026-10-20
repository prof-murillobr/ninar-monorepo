export type AnalysisStatus =
  | 'upload_pending'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed';

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

export interface Analysis {
  id: string;
  objectKey: string;
  originalFilename: string;
  contentType: string;
  status: AnalysisStatus;
  result: ClassificationResult | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewAnalysis {
  id: string;
  objectKey: string;
  originalFilename: string;
  contentType: string;
}

export const analysisIsTerminal = (status: AnalysisStatus): boolean =>
  status === 'completed' || status === 'failed';
