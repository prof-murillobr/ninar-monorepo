import { describe, expect, it, vi } from 'vitest';
import { CreateUploadUrlUseCase } from './create-upload-url.use-case.js';
import type { IdGeneratorPort } from '../ports/id-generator.port.js';
import type { ObjectStoragePort } from '../ports/object-storage.port.js';
import type { AnalysisRepositoryPort } from '../ports/analysis-repository.port.js';

const analysisId = '11111111-1111-4111-8111-111111111111';

describe('CreateUploadUrlUseCase', () => {
  function createSubject() {
    const idGenerator: IdGeneratorPort = { generate: vi.fn().mockReturnValue(analysisId) };
    const createUploadUrl = vi.fn().mockResolvedValue('https://storage.example/single');
    const createMultipartUpload = vi.fn().mockResolvedValue({ uploadId: 'upload-1' });
    const createUploadPartUrl = vi.fn().mockResolvedValue('https://storage.example/part');
    const storage: ObjectStoragePort = {
      createUploadUrl,
      createMultipartUpload,
      createUploadPartUrl,
      completeMultipartUpload: vi.fn(),
      deleteObject: vi.fn(),
    };
    const createAnalysis = vi.fn().mockResolvedValue(undefined);
    const repository = { create: createAnalysis } as unknown as AnalysisRepositoryPort;
    return { useCase: new CreateUploadUrlUseCase(idGenerator, storage, repository), createUploadUrl, createMultipartUpload, createUploadPartUrl, createAnalysis };
  }

  it('creates the pending analysis before returning a direct upload URL', async () => {
    const { useCase, createMultipartUpload, createAnalysis } = createSubject();

    const result = await useCase.execute({ filename: 'audio.wav', contentType: 'audio/wav', size: 1024 });

    expect(createAnalysis).toHaveBeenCalledWith({
      id: analysisId,
      objectKey: `analyses/${analysisId}/audio.wav`,
      originalFilename: 'audio.wav',
      contentType: 'audio/wav',
    });
    expect(result.upload).toEqual({ kind: 'single', uploadUrl: 'https://storage.example/single' });
    expect(createMultipartUpload).not.toHaveBeenCalled();
  });

  it('returns signed part URLs for uploads at or above the multipart threshold', async () => {
    const { useCase, createUploadPartUrl, createUploadUrl } = createSubject();

    const result = await useCase.execute({ filename: 'long.wav', contentType: 'audio/wav', size: 8 * 1024 * 1024 });

    expect(result.upload).toMatchObject({ kind: 'multipart', uploadId: 'upload-1', partSize: 5 * 1024 * 1024 });
    expect(createUploadPartUrl).toHaveBeenCalledTimes(2);
    expect(createUploadUrl).not.toHaveBeenCalled();
  });
});
