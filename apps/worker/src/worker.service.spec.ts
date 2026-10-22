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

    await process(s3Event('11111111-1111-4111-8111-111111111111', 'audio.wav'));

    expect(markCompleted).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', result);
    expect(deleteObject).toHaveBeenCalledWith('analyses/11111111-1111-4111-8111-111111111111/audio.wav');
  });

  it('retries cleanup for an already completed analysis', async () => {
    const { process, getStatus, deleteObject, markProcessing } = createSubject();
    getStatus.mockResolvedValue('completed');

    await process(s3Event('22222222-2222-4222-8222-222222222222', 'audio.wav'));

    expect(deleteObject).toHaveBeenCalledWith('analyses/22222222-2222-4222-8222-222222222222/audio.wav');
    expect(markProcessing).not.toHaveBeenCalled();
  });

  it('keeps the audio when classification fails so the message can be retried', async () => {
    const { process, markFailed, deleteObject, classify } = createSubject();
    classify.mockRejectedValue(new Error('classifier unavailable'));

    await expect(process(s3Event('33333333-3333-4333-8333-333333333333', 'audio.wav'))).rejects.toThrow('classifier unavailable');

    expect(markFailed).toHaveBeenCalledWith('33333333-3333-4333-8333-333333333333', 'classifier unavailable');
    expect(deleteObject).not.toHaveBeenCalled();
  });
});

function s3Event(analysisId: string, filename: string): string {
  return JSON.stringify({
    Records: [{
      eventName: 'ObjectCreated:Put',
      s3: { object: { key: `analyses/${analysisId}/${filename}` } },
    }],
  });
}
