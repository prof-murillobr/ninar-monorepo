import { Injectable, OnModuleDestroy } from '@nestjs/common';
import pg from 'pg';
import { AnalysisRepositoryPort, ClassificationResult } from '../../domain/analysis.js';

@Injectable()
export class PostgresAnalysisRepository implements AnalysisRepositoryPort, OnModuleDestroy {
  private readonly pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

  async getStatus(id: string): Promise<string | null> {
    const result = await this.pool.query<{ status: string }>('SELECT status FROM analyses WHERE id = $1', [id]);
    return result.rows[0]?.status ?? null;
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

  async onModuleDestroy() {
    await this.pool.end();
  }
}
