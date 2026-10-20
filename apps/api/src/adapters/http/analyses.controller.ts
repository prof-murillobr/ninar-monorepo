import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { CreateAnalysisUseCase } from '../../application/use-cases/create-analysis.use-case.js';
import { CreateUploadUrlUseCase } from '../../application/use-cases/create-upload-url.use-case.js';
import { GetAnalysisUseCase } from '../../application/use-cases/get-analysis.use-case.js';
import { ListAnalysesUseCase } from '../../application/use-cases/list-analyses.use-case.js';
import { DeleteAnalysisUseCase } from '../../application/use-cases/delete-analysis.use-case.js';
import { CreateAnalysisDto, CreateUploadUrlDto } from './analyses.dto.js';

@Controller('analyses')
export class AnalysesController {
  constructor(
    private readonly createUploadUrl: CreateUploadUrlUseCase,
    private readonly createAnalysis: CreateAnalysisUseCase,
    private readonly getAnalysis: GetAnalysisUseCase,
    private readonly listAnalyses: ListAnalysesUseCase,
    private readonly deleteAnalysis: DeleteAnalysisUseCase,
  ) {}

  @Post('upload-url')
  requestUploadUrl(@Body() input: CreateUploadUrlDto) {
    return this.createUploadUrl.execute(input);
  }

  @Post()
  create(@Body() input: CreateAnalysisDto) {
    return this.createAnalysis.execute({
      id: input.analysisId,
      objectKey: input.objectKey,
      originalFilename: input.originalFilename,
      contentType: input.contentType,
    });
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
