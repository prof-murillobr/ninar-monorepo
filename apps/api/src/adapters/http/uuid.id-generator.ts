import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { IdGeneratorPort } from '../../application/ports/id-generator.port.js';

@Injectable()
export class UuidIdGeneratorAdapter implements IdGeneratorPort {
  generate(): string {
    return randomUUID();
  }
}
