import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import pg from 'pg';
import type { PoolClient } from 'pg';
import { Analysis, AnalysisStatus, ClassificationResult, NewAnalysis } from '../../domain/analysis.js';
import { AnalysisRepositoryPort } from '../../application/ports/analysis-repository.port.js';

type AnalysisRow = {
  id: string;
  object_key: string;
  original_filename: string;
  content_type: string;
  status: AnalysisStatus;
  result: ClassificationResult | null;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
};

@Injectable()
export class PostgresAnalysisRepository implements AnalysisRepositoryPort, OnModuleInit, OnModuleDestroy {
  private readonly pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

  async onModuleInit() {
    await this.withRetry(async () => {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS analyses (
          id UUID PRIMARY KEY,
          object_key TEXT NOT NULL UNIQUE,
          original_filename TEXT NOT NULL,
          content_type TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('upload_pending', 'queued', 'processing', 'completed', 'failed')),
          result JSONB,
          error_message TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS analyses_created_at_idx ON analyses (created_at DESC);
      `);
    });
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  async create(input: NewAnalysis): Promise<Analysis> {
    const result = await this.pool.query<AnalysisRow>(
      `INSERT INTO analyses (id, object_key, original_filename, content_type, status)
       VALUES ($1, $2, $3, $4, 'queued')
       RETURNING *`,
      [input.id, input.objectKey, input.originalFilename, input.contentType],
    );
    return this.map(result.rows[0]);
  }

  async findById(id: string): Promise<Analysis | null> {
    const result = await this.pool.query<AnalysisRow>('SELECT * FROM analyses WHERE id = $1', [id]);
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  async list(limit: number): Promise<Analysis[]> {
    const result = await this.pool.query<AnalysisRow>(
      'SELECT * FROM analyses ORDER BY created_at DESC LIMIT $1',
      [limit],
    );
    return result.rows.map((row) => this.map(row));
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM analyses WHERE id = $1', [id]);
    return result.rowCount === 1;
  }

  async markProcessing(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE analyses SET status = 'processing', error_message = NULL, updated_at = NOW() WHERE id = $1`,
      [id],
    );
  }

  async markCompleted(id: string, result: ClassificationResult): Promise<void> {
    await this.pool.query(
      `UPDATE analyses SET status = 'completed', result = $2, error_message = NULL, updated_at = NOW() WHERE id = $1`,
      [id, JSON.stringify(result)],
    );
  }

  async markFailed(id: string, message: string): Promise<void> {
    await this.pool.query(
      `UPDATE analyses SET status = 'failed', error_message = $2, updated_at = NOW() WHERE id = $1`,
      [id, message.slice(0, 1000)],
    );
  }

  private map(row: AnalysisRow): Analysis {
    return {
      id: row.id,
      objectKey: row.object_key,
      originalFilename: row.original_filename,
      contentType: row.content_type,
      status: row.status,
      result: row.result,
      errorMessage: row.error_message,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private async withRetry(operation: (client: PoolClient) => Promise<void> | Promise<unknown>): Promise<void> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 15; attempt += 1) {
      try {
        const client = await this.pool.connect();
        try {
          await operation(client);
          return;
        } finally {
          client.release();
        }
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, Math.min(attempt * 500, 3000)));
      }
    }
    throw lastError;
  }
}
