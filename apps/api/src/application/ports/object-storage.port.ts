export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

export interface ObjectStoragePort {
  createUploadUrl(input: {
    objectKey: string;
    contentType: string;
    expiresInSeconds: number;
  }): Promise<string>;
  deleteObject(objectKey: string): Promise<void>;
}
