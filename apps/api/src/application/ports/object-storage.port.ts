export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

export interface ObjectStoragePort {
  createUploadUrl(input: {
    objectKey: string;
    contentType: string;
    expiresInSeconds: number;
  }): Promise<string>;
  createMultipartUpload(input: { objectKey: string; contentType: string }): Promise<{ uploadId: string }>;
  createUploadPartUrl(input: { objectKey: string; uploadId: string; partNumber: number; expiresInSeconds: number }): Promise<string>;
  completeMultipartUpload(input: {
    objectKey: string;
    uploadId: string;
    parts: Array<{ partNumber: number; etag: string }>;
  }): Promise<void>;
  deleteObject(objectKey: string): Promise<void>;
}
