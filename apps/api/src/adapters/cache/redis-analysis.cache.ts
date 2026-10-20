import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { AnalysisCachePort } from '../../application/ports/cache.port.js';

@Injectable()
export class RedisAnalysisCacheAdapter implements AnalysisCachePort, OnModuleDestroy {
  private readonly client = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;

  async get<T>(key: string): Promise<T | null> {
    if (!this.client) return null;
    try {
      const value = await this.client.get(key);
      return value ? (JSON.parse(value) as T) : null;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      // Cache failures must never make the API unavailable.
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.del(key);
    } catch {
      // Cache failures must never make the API unavailable.
    }
  }

  async onModuleDestroy() {
    await this.client?.quit();
  }
}
