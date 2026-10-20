import { Injectable } from '@nestjs/common';
import { ClassificationResult, ClassifierPort } from '../../domain/analysis.js';

@Injectable()
export class HttpClassifierAdapter implements ClassifierPort {
  private readonly baseUrl = (process.env.CLASSIFIER_URL ?? 'http://localhost:8000').replace(/\/$/, '');

  async classify(input: { body: Buffer; contentType: string; filename: string }): Promise<ClassificationResult> {
    const form = new FormData();
    const audioBytes = new Uint8Array(input.body.byteLength);
    audioBytes.set(input.body);
    form.append('file', new Blob([audioBytes.buffer], { type: input.contentType }), input.filename);
    const response = await fetch(`${this.baseUrl}/classify`, { method: 'POST', body: form });
    if (!response.ok) throw new Error(`Classifier returned HTTP ${response.status}: ${await response.text()}`);
    return (await response.json()) as ClassificationResult;
  }
}
