import { WorkerService } from './worker.service.js';
import type { AnalysisRepositoryPort, ClassificationResult, ClassifierPort, ObjectStoragePort } from './domain/analysis.js';

const result: ClassificationResult = {
  model: 'test-model',
  sample_rate: 16_000,
  duration_seconds: 2,
  predictions: [{ category: 'hungry', confidence: 0.9 }],
};

describe('WorkerService', () => {
  function createSubject() {
    const getStatus = vi.fn().mockResolvedValue('queued');
    const markProcessing = vi.fn().mockResolvedValue(undefined);
    const markCompleted = vi.fn().mockResolvedValue(undefined);
    const markFailed = vi.fn().mockResolvedValue(undefined);
    const repository: AnalysisRepositoryPort = {
      getStatus,
      markProcessing,
      markCompleted,
      markFailed,
    };
    const getObject = vi.fn().mockResolvedValue({ body: Buffer.from('audio'), contentType: 'audio/wav' });
    const deleteObject = vi.fn().mockResolvedValue(undefined);
    const storage: ObjectStoragePort = {
      getObject,
      deleteObject,
    };
    const classify = vi.fn().mockResolvedValue(result);
    const classifier: ClassifierPort = {
      classify,
    };
    const service = new WorkerService(repository, storage, classifier);
    const process = (service as unknown as { process(body: string): Promise<void> }).process.bind(service);
    return { process, getStatus, markProcessing, markCompleted, markFailed, deleteObject, classify };
  }

  it('removes the audio after completing the classification', async () => {
    const { process, markCompleted, deleteObject } = createSubject();

    await process(JSON.stringify({ analysisId: 'analysis-1', objectKey: 'analyses/analysis-1/audio.wav' }));

    expect(markCompleted).toHaveBeenCalledWith('analysis-1', result);
    expect(deleteObject).toHaveBeenCalledWith('analyses/analysis-1/audio.wav');
  });

  it('retries cleanup for an already completed analysis', async () => {
    const { process, getStatus, deleteObject, markProcessing } = createSubject();
    getStatus.mockResolvedValue('completed');

    await process(JSON.stringify({ analysisId: 'analysis-2', objectKey: 'analyses/analysis-2/audio.wav' }));

    expect(deleteObject).toHaveBeenCalledWith('analyses/analysis-2/audio.wav');
    expect(markProcessing).not.toHaveBeenCalled();
  });

  it('keeps the audio when classification fails so the message can be retried', async () => {
    const { process, markFailed, deleteObject, classify } = createSubject();
    classify.mockRejectedValue(new Error('classifier unavailable'));

    await expect(process(JSON.stringify({ analysisId: 'analysis-3', objectKey: 'analyses/analysis-3/audio.wav' }))).rejects.toThrow('classifier unavailable');

    expect(markFailed).toHaveBeenCalledWith('analysis-3', 'classifier unavailable');
    expect(deleteObject).not.toHaveBeenCalled();
  });
});
