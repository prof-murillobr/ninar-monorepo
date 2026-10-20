import { describe, expect, it, vi } from 'vitest';
import { CreateAnalysisUseCase } from './create-analysis.use-case.js';
import type { AnalysisRepositoryPort } from '../ports/analysis-repository.port.js';
import type { AnalysisQueuePort } from '../ports/analysis-queue.port.js';
import type { Analysis } from '../../domain/analysis.js';

const analysis: Analysis = {
  id: '11111111-1111-4111-8111-111111111111',
  objectKey: 'analyses/11111111-1111-4111-8111-111111111111/audio.wav',
  originalFilename: 'audio.wav',
  contentType: 'audio/wav',
  status: 'queued',
  result: null,
  errorMessage: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('CreateAnalysisUseCase', () => {
  it('persists before publishing and publishes only a small message', async () => {
    const repository = { create: vi.fn().mockResolvedValue(analysis) } as unknown as AnalysisRepositoryPort;
    const queue = { publish: vi.fn().mockResolvedValue(undefined) } as unknown as AnalysisQueuePort;
    const useCase = new CreateAnalysisUseCase(repository, queue);

    await expect(useCase.execute({ id: analysis.id, objectKey: analysis.objectKey, originalFilename: 'audio.wav', contentType: 'audio/wav' })).resolves.toEqual(analysis);
    expect(repository.create).toHaveBeenCalledOnce();
    expect(queue.publish).toHaveBeenCalledWith({ id: analysis.id, objectKey: analysis.objectKey });
  });

  it('rejects an object key belonging to another analysis', async () => {
    const repository = {} as AnalysisRepositoryPort;
    const queue = {} as AnalysisQueuePort;
    const useCase = new CreateAnalysisUseCase(repository, queue);

    await expect(useCase.execute({ id: analysis.id, objectKey: 'analyses/other/audio.wav', originalFilename: 'audio.wav', contentType: 'audio/wav' })).rejects.toThrow('objectKey');
  });
});
