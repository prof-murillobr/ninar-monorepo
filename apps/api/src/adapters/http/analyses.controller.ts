import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { CreateUploadUrlUseCase } from '../../application/use-cases/create-upload-url.use-case.js';
import { CompleteMultipartUploadUseCase } from '../../application/use-cases/complete-multipart-upload.use-case.js';
import { GetAnalysisUseCase } from '../../application/use-cases/get-analysis.use-case.js';
import { ListAnalysesUseCase } from '../../application/use-cases/list-analyses.use-case.js';
import { DeleteAnalysisUseCase } from '../../application/use-cases/delete-analysis.use-case.js';
import { CompleteMultipartUploadDto, CreateUploadUrlDto } from './analyses.dto.js';

@Controller('analyses')
export class AnalysesController {
  constructor(
    private readonly createUploadUrl: CreateUploadUrlUseCase,
    private readonly completeMultipartUpload: CompleteMultipartUploadUseCase,
    private readonly getAnalysis: GetAnalysisUseCase,
    private readonly listAnalyses: ListAnalysesUseCase,
    private readonly deleteAnalysis: DeleteAnalysisUseCase,
  ) {}

  @Post('upload-url')
  requestUploadUrl(@Body() input: CreateUploadUrlDto) {
    return this.createUploadUrl.execute(input);
  }

  @Post(':id/complete-upload')
  @HttpCode(HttpStatus.NO_CONTENT)
  async completeUpload(@Param('id') id: string, @Body() input: CompleteMultipartUploadDto): Promise<void> {
    await this.completeMultipartUpload.execute({ analysisId: id, uploadId: input.uploadId, parts: input.parts });
  }

  @Get()
  list(@Query('limit', new ParseIntPipe({ optional: true })) limit?: number) {
    return this.listAnalyses.execute(limit);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.getAnalysis.execute(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string): Promise<void> {
    await this.deleteAnalysis.execute(id);
  }
}
